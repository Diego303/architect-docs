---
title: "Core Loop"
description: "The AgentLoop: safety nets, StopReason, graceful close, hooks lifecycle."
icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
order: 5
---

# The agent loop (core/loop.py)

The `AgentLoop` is the heart of the system. See also [`logging.md`](/architect-docs/docs/v1-0-0/logging) for details on the logging system.

It uses a `while True` loop — the LLM decides when to stop (it stops requesting tools). The safety nets (max_steps, budget, timeout, context) are watchdogs that request a clean shutdown from the LLM instead of cutting off abruptly.

---

## Full pseudocode (v3)

```python
def run(prompt, stream=False, on_stream_chunk=None):
    # Initialization
    messages = ctx.build_initial(agent_config, prompt)
    tools_schema = registry.get_schemas(agent_config.allowed_tools or None)
    state = AgentState(messages=messages, model=llm.config.model, ...)
    step = 0

    while True:

        # ── SAFETY NETS (before each LLM call) ───────────
        stop_reason = _check_safety_nets(state, step)
        if stop_reason is not None:
            return _graceful_close(state, stop_reason, tools_schema)

        # ── CONTEXT MANAGEMENT ──────────────────────────────────
        if context_manager:
            messages = context_manager.manage(messages, llm)
            # manage() applies:
            #   1. LLM compression (if context > 75% of max)
            #   2. Hard limit sliding window

        # ── LLM CALL ──────────────────────────────────────
        hlog.llm_call(step, messages_count=len(messages))

        try:
            with StepTimeout(step_timeout):
                if stream:
                    response = None
                    for chunk_or_response in llm.completion_stream(messages, tools_schema):
                        if isinstance(chunk_or_response, StreamChunk):
                            if on_stream_chunk:
                                on_stream_chunk(chunk_or_response.data)  # → stderr
                        else:
                            response = chunk_or_response  # Final LLMResponse

                else:
                    response = llm.completion(messages, tools_schema)

        except StepTimeoutError:
            hlog.step_timeout(step_timeout)
            return _graceful_close(state, StopReason.TIMEOUT, tools_schema)

        except Exception as e:
            hlog.llm_error(str(e))
            state.status = "failed"
            state.stop_reason = StopReason.LLM_ERROR
            state.final_output = f"Unrecoverable LLM error: {e}"
            return state

        # ── RECORD COST ───────────────────────────────────
        if cost_tracker and response.usage:
            try:
                cost_tracker.record(step=step, model=..., usage=response.usage)
            except BudgetExceededError:
                return _graceful_close(state, StopReason.BUDGET_EXCEEDED, tools_schema)

        step += 1

        # ── THE LLM DECIDED TO FINISH (no tools requested) ───────────
        if not response.tool_calls:
            hlog.agent_done(step)
            state.final_output = response.content
            state.status = "success"
            state.stop_reason = StopReason.LLM_DONE
            break

        # ── THE LLM REQUESTED TOOLS → EXECUTE ──────────────────────
        tool_results = _execute_tool_calls_batch(response.tool_calls, step)
        messages = ctx.append_tool_results(messages, response.tool_calls, tool_results)
        state.steps.append(StepResult(step, response, tool_results))

        # ── SESSION AUTO-SAVE (v4-B1) ────────────────────────────
        # If sessions.auto_save=true, state is saved after each step
        # to allow resume if the execution is interrupted
        if session_manager:
            session_manager.save(session_state)

    # ── Final log ───────────────────────────────────────────────
    hlog.loop_complete(status=state.status, stop_reason=...,
                       total_steps=state.current_step,
                       total_tool_calls=state.total_tool_calls)
    return state
```

### Key difference from v1

```
BEFORE (v1):                        NOW (v3):

for i in range(max_steps):          while True:
    response = llm(...)                 if watchdog_triggered:
    if done: break                          graceful_close()  ← LLM resumes
    execute_tools()                         break
else:                                   response = llm(...)
    status = "partial"  ← cold          if no tool_calls:
                                            done!  ← LLM decided
                                            break
                                        execute_tools()
```

The `for-range` makes `max_steps` the structure. The `while True` makes **the LLM's decision** the structure and `max_steps` a guard.

---

## StopReason — why the agent stopped

```python
class StopReason(Enum):
    LLM_DONE = "llm_done"              # The LLM decided it was done (natural)
    MAX_STEPS = "max_steps"            # Watchdog: step limit
    BUDGET_EXCEEDED = "budget_exceeded" # Watchdog: cost limit
    CONTEXT_FULL = "context_full"      # Watchdog: context window full
    TIMEOUT = "timeout"                # Watchdog: total time exceeded
    USER_INTERRUPT = "user_interrupt"   # The user pressed Ctrl+C
    LLM_ERROR = "llm_error"           # Unrecoverable LLM error
```

`StopReason` is saved in `AgentState.stop_reason` and included in the JSON output.

---

## Safety nets (`_check_safety_nets`)

These check conditions before each iteration. If any triggers, they return a `StopReason` and the loop calls `_graceful_close()`.

```python
def _check_safety_nets(state, step) -> StopReason | None:
    # 1. User interrupt (Ctrl+C / SIGTERM) — most urgent
    if shutdown and shutdown.should_stop:
        return StopReason.USER_INTERRUPT

    # 2. Max steps — step watchdog
    if step >= agent_config.max_steps:
        return StopReason.MAX_STEPS

    # 3. Total timeout — time watchdog
    if timeout and (time.time() - start_time) > timeout:
        return StopReason.TIMEOUT

    # 4. Context window critically full (>95%)
    if context_manager and context_manager.is_critically_full(messages):
        return StopReason.CONTEXT_FULL

    return None  # All good, continue
```

Each safety net emits a HUMAN log via `hlog.safety_net()`.

---

## Graceful close (`_graceful_close`)

When a safety net triggers, it does not cut off abruptly. It gives the LLM one last chance to summarize what it did and what remains pending.

```python
def _graceful_close(state, reason, tools_schema) -> AgentState:
    hlog.closing(reason.value, len(state.steps))

    # USER_INTERRUPT: immediate cut, no LLM call
    if reason == StopReason.USER_INTERRUPT:
        state.status = "partial"
        state.final_output = "Interrupted by the user."
        return state

    # For all others: request summary from the LLM
    instruction = _CLOSE_INSTRUCTIONS[reason]
    state.messages.append({"role": "user", "content": f"[SYSTEM] {instruction}"})

    try:
        # Last call WITHOUT tools — text-only closing
        response = llm.completion(messages=state.messages, tools=None)
        state.final_output = response.content
    except Exception:
        state.final_output = f"The agent stopped ({reason.value})."

    state.status = "partial"
    state.stop_reason = reason
    hlog.loop_complete(status="partial", ...)
    return state
```

---

## Post-edit hooks (v3-M4)

After the agent edits a file (`edit_file`, `write_file`, `apply_patch`), configured hooks (lint, typecheck, tests) run automatically. The result is returned to the LLM as part of the tool result.

```python
def _execute_single_tool(tc, step) -> ToolCallResult:
    hlog.tool_call(tc.name, tc.arguments)

    result = engine.execute_tool_call(tc.name, tc.arguments)

    # v3-M4: Run post-edit hooks if applicable
    hook_output = engine.run_post_edit_hooks(tc.name, tc.arguments)

    if hook_output and result.success:
        # Append hook output to the tool result
        combined_output = result.output + "\n\n" + hook_output
        result = ToolResult(success=result.success, output=combined_output)
        hlog.hook_complete(tc.name)

    hlog.tool_result(tc.name, result.success, result.error)
    return ToolCallResult(tool_name=tc.name, args=tc.arguments, result=result)
```

Example output with hooks:
```
   🔧 edit_file → src/main.py (3→5 lines)
      ✓ OK
      🔍 Hook python-lint: ✓
```

If a hook fails, the LLM sees the error and can self-correct:
```
      🔍 Hook python-lint: ⚠️
         src/main.py:45: E302 expected 2 blank lines, found 1
```

### Hook configuration

```yaml
hooks:
  post_edit:
    - name: python-lint
      command: "ruff check {file} --no-fix"
      file_patterns: ["*.py"]
      timeout: 10

    - name: python-typecheck
      command: "mypy {file}"
      file_patterns: ["*.py"]
      timeout: 15
      enabled: false
```

The `{file}` placeholder is replaced with the path of the edited file. The environment variable `ARCHITECT_EDITED_FILE` is also available.

---

## Parallel tool calls

When the LLM requests multiple tool calls in a single step, the loop can execute them in parallel.

### Decision logic (`_should_parallelize`)

```python
def _should_parallelize(tool_calls) -> bool:
    # Disabled if the config says so
    if context_manager and not context_manager.config.parallel_tools:
        return False

    # confirm-all: always sequential (user interaction)
    if agent_config.confirm_mode == "confirm-all":
        return False

    # confirm-sensitive: sequential if any tool is sensitive
    if agent_config.confirm_mode == "confirm-sensitive":
        for tc in tool_calls:
            if registry.get(tc.name).sensitive:
                return False

    # yolo or confirm-sensitive with no sensitive tools → parallel
    return True
```

### Parallel implementation

```python
def _execute_tool_calls_batch(tool_calls, step):
    if len(tool_calls) <= 1 or not _should_parallelize(tool_calls):
        return [_execute_single_tool(tc, step) for tc in tool_calls]

    # Parallel execution with ThreadPoolExecutor
    results = [None] * len(tool_calls)
    with ThreadPoolExecutor(max_workers=min(len(tool_calls), 4)) as pool:
        futures = {
            pool.submit(_execute_single_tool, tc, step): i
            for i, tc in enumerate(tool_calls)
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    return results
```

The `{future: idx}` pattern guarantees correct order regardless of completion order.

---

## ContextManager — context window management

The `ContextManager` operates at three progressive levels to prevent the context from filling up during long tasks.

### Unified pipeline (`manage`)

```python
def manage(messages, llm=None) -> list[dict]:
    # Only compress if the context exceeds 75% of the maximum
    if llm and _is_above_threshold(messages, 0.75):
        messages = maybe_compress(messages, llm)
    messages = enforce_window(messages)
    return messages
```

The 75% threshold avoids unnecessary compressions for short tasks. If `max_context_tokens=0` (no limit), it relies on `summarize_after_steps`.

### Level 1 — Tool result truncation (`truncate_tool_result`)

Applied in `ContextBuilder._format_tool_result()` before adding each tool result to the history.

- `max_tool_result_tokens=0` disables truncation.
- Preserves the first 40 lines + last 20 lines + omission marker.

### Level 2 — LLM compression (`maybe_compress`)

Activates when the number of exchanges exceeds `summarize_after_steps` AND the context is >75% full.

```python
def maybe_compress(messages, llm) -> list[dict]:
    tool_exchanges = _count_tool_exchanges(messages)
    if tool_exchanges <= config.summarize_after_steps:
        return messages  # no changes

    old_msgs = dialog[:-keep_count]
    recent_msgs = dialog[-keep_count:]

    # Summarize with the LLM; mechanical fallback if it fails
    summary = _summarize_steps(old_msgs, llm)

    return [system_msg, user_msg, summary_msg, *recent_msgs]
```

If the LLM fails to summarize (network, auth, etc.), a mechanical summary (list of tools and files) is generated as a fallback.

### Level 3 — Sliding window (`enforce_window`)

Hard limit that removes old message pairs until the estimated total fits.

- `max_context_tokens=0` disables the limit.
- Always preserves `messages[0]` (system) and `messages[1]` (original user message).

### `is_critically_full` — context safety net

```python
def is_critically_full(messages) -> bool:
    # True if the context is at 95%+ of the maximum
    return _estimate_tokens(messages) > int(max_context_tokens * 0.95)
```

Used as a safety net in the loop: if it returns True after compression, the agent must shut down.

### Token estimation (`_estimate_tokens`)

```python
def _estimate_tokens(messages) -> int:
    total_chars = 0
    for m in messages:
        if m.get("content"):
            total_chars += len(str(m["content"]))
        for tc in m.get("tool_calls", []):
            total_chars += len(str(tc["function"]["name"]))
            total_chars += len(str(tc["function"]["arguments"]))
        total_chars += 16  # overhead per message
    return total_chars // 4
```

Extracts only the relevant content fields (does not serialize the entire dict) to avoid overestimation.

---

## Human logging (v3-M5+M6)

The logging system has 3 pipelines:

1. **JSON file** (if configured) — Everything, structured
2. **HumanLogHandler** (stderr) — Only agent traceability events (HUMAN=25 level)
3. **Technical console** (stderr) — Debug/info controlled by `-v`, excluding HUMAN

### HUMAN level

```python
# logging/levels.py
HUMAN = 25  # between INFO (20) and WARNING (30)
```

### HumanLog — typed helper

The `AgentLoop` uses `self.hlog = HumanLog(logger)` to emit HUMAN events:

```python
hlog.llm_call(step, messages_count)                    # "🔄 Step N → LLM call (M messages)"
hlog.llm_response(tool_calls)                          # "   ✓ LLM responded with N tool calls"
hlog.tool_call(name, args, is_mcp, mcp_server)        # "   🔧 tool → summary" or "   🌐 tool → summary (MCP: server)"
hlog.tool_result(name, success, error)                 # "      ✓ OK" or "      ✗ ERROR: ..."
hlog.hook_complete(name, hook, success, detail)        # "      🔍 Hook name: ✓/⚠️ detail"
hlog.agent_done(step, cost)                            # "✅ Agent completed (N steps)" + cost
hlog.safety_net(reason, **kw)                          # "⚠️ Step limit reached..."
hlog.closing(reason, steps)                            # "🔄 Closing (reason, N steps)"
hlog.loop_complete(status, stop_reason, total_steps, total_tool_calls)
hlog.llm_error(error)                                  # "❌ LLM error: ..."
hlog.step_timeout(seconds)                             # "⚠️ Step timeout (Ns)..."
```

### Visual format example

```
🔄 Step 1 → LLM call (3 messages)
   ✓ LLM responded with 2 tool calls

   🔧 read_file → src/main.py
      ✓ OK
   🔧 read_file → src/config.py
      ✓ OK

🔄 Step 2 → LLM call (7 messages)
   ✓ LLM responded with 1 tool call

   🔧 edit_file → src/main.py (3→5 lines)
      ✓ OK
      🔍 Hook ruff: ✓

🔄 Step 3 → LLM call (10 messages)
   ✓ LLM responded with final text

✅ Agent completed (3 steps)
   Reason: LLM decided it was done
  (3 steps, 3 tool calls)
```

### Args summarizer (M6)

`_summarize_args(tool_name, args)` produces readable summaries per tool:

| Tool | Summary example |
|------|-----------------|
| `read_file` | `src/main.py` |
| `write_file` | `src/main.py (42 lines)` |
| `edit_file` | `src/main.py (3→5 lines)` |
| `apply_patch` | `src/main.py (+5 -3)` |
| `search_code` | `"validate_path" in src/` |
| `grep` | `"import jwt" in src/` |
| `run_command` | `pytest tests/ -x` |
| MCP tools | first argument truncated to 60 chars |

---

## SelfEvaluator — result self-evaluation (F12)

Invoked from the CLI **after** the agent completes its execution. Only evaluates `"success"` states.

### `evaluate_basic` — single evaluation

The LLM evaluates the result and responds in JSON: `{"completed": true, "confidence": 0.92, "issues": [], "suggestion": ""}`. If it does not pass, `state.status = "partial"`.

### `evaluate_full` — evaluation + retries

Up to `max_retries` cycles of `evaluate_basic()` + `run_fn(correction_prompt)`. Returns the best state.

### JSON response parsing

Three strategies in order:
1. Direct `json.loads(content)`.
2. Regex for a JSON code block.
3. Regex for the first `{...}`.

---

## Loop state (AgentState)

```
AgentState
├── messages: list[dict]           ← OpenAI history (managed by ContextManager)
├── steps: list[StepResult]        ← immutable results from each step
├── status: str                    ← "running" | "success" | "partial" | "failed"
├── stop_reason: StopReason | None ← why it stopped
├── final_output: str | None       ← agent's final response
├── start_time: float              ← for computing duration_seconds
├── model: str | None              ← model used
└── cost_tracker: CostTracker | None ← F14: cost tracker
```

State transitions (v3):

```
                  tool_calls
"running" ──────────────────────→ "running" (next step)
    │
    │  no tool_calls (LLM decided to finish)
    ├──────────────────────────→ "success" (StopReason.LLM_DONE)
    │                               │
    │                               │ SelfEvaluator (basic, fails)
    │                               └──────────→ "partial"
    │
    │  safety net: MAX_STEPS
    ├──────────────────────────→ _graceful_close → "partial"
    │                            (LLM summarizes what it did)
    │
    │  safety net: BUDGET_EXCEEDED
    ├──────────────────────────→ _graceful_close → "partial"
    │
    │  safety net: TIMEOUT / CONTEXT_FULL
    ├──────────────────────────→ _graceful_close → "partial"
    │
    │  safety net: USER_INTERRUPT
    ├──────────────────────────→ "partial" (immediate cut, no LLM)
    │
    │  LLM Exception
    └──────────────────────────→ "failed" (StopReason.LLM_ERROR)
```

---

## Message accumulation (ContextBuilder)

Each step appends messages. The history (or its compressed version) is sent to the LLM on each call.

```
Step 0 (initial):
messages = [
  {"role": "system",    "content": "You are a build agent...\n\n## Project Structure\n..."},
  {"role": "user",      "content": "refactor main.py"}
]

After tool calls in step 1 (with Level 1 truncation):
messages = [
  {"role": "system",    "content": "..."},
  {"role": "user",      "content": "refactor main.py"},
  {"role": "assistant", "tool_calls": [...]},
  {"role": "tool",      "content": "def foo():\n    pass\n...\n[... 120 lines omitted ...]\n..."}
]

After 9+ steps (with Level 2 compression, if context > 75%):
messages = [
  {"role": "system",    "content": "..."},
  {"role": "user",      "content": "refactor main.py"},
  {"role": "assistant", "content": "[Summary of previous steps]\nThe agent read main.py, ..."},
  ... (last 4 complete steps) ...
]
```

---

## Streaming

When `stream=True`:
1. `llm.completion_stream(messages, tools)` returns a generator.
2. Each `StreamChunk` has `type="content"` and `data=str`.
3. The loop calls `on_stream_chunk(chunk.data)` — writes to `stderr`.
4. The last item is a complete `LLMResponse` (with `tool_calls` if any).
5. Tool call chunks are **not** sent to the callback.

Streaming is automatically disabled in: plan phase of mixed mode, `--json`, `--quiet`, `--no-stream`, `evaluate_full` retries.

---

## Graceful shutdown (GracefulShutdown)

```
GracefulShutdown
├── __init__: installs handler on SIGINT + SIGTERM
├── _handler(signum):
│     1st trigger → _interrupted=True, warns on stderr
│     2nd trigger SIGINT → sys.exit(130) immediate
└── should_stop: property → _interrupted
```

The loop checks `shutdown.should_stop` in `_check_safety_nets()` at the start of each iteration. If True, `_graceful_close()` cuts immediately (USER_INTERRUPT does not call the LLM).

---

## Per-step timeout (StepTimeout)

```python
with StepTimeout(60):          # 60 seconds
    response = llm.completion(...)
# If it takes > 60s: SIGALRM → StepTimeoutError → _graceful_close(TIMEOUT)
```

- Only active on Linux/macOS (uses `SIGALRM`). On Windows: no-op.
- `step_timeout` comes from the CLI `--timeout` flag.

---

## StopReason → Exit Code mapping (v4-B3)

After completing the loop, the CLI maps the agent's `StopReason` and `status` to an exit code:

| StopReason | status | Exit Code | Constant |
|------------|--------|:---------:|----------|
| `LLM_DONE` | `success` | 0 | `EXIT_SUCCESS` |
| `LLM_DONE` + SelfEvaluator fails | `partial` | 2 | `EXIT_PARTIAL` |
| `MAX_STEPS` | `partial` | 2 | `EXIT_PARTIAL` |
| `BUDGET_EXCEEDED` | `partial` | 2 | `EXIT_PARTIAL` |
| `CONTEXT_FULL` | `partial` | 2 | `EXIT_PARTIAL` |
| `TIMEOUT` | `partial` / `failed` | 5 | `EXIT_TIMEOUT` |
| `USER_INTERRUPT` | `partial` | 130 | `EXIT_INTERRUPTED` |
| `LLM_ERROR` | `failed` | 1 | `EXIT_FAILED` |
| Auth error | `failed` | 4 | `EXIT_AUTH_ERROR` |
| Config error | — | 3 | `EXIT_CONFIG_ERROR` |

`--exit-code-on-partial` (default in CI) ensures that `partial` returns exit code 2 instead of 0.

---

## Constructor parameters

```python
AgentLoop(
    llm:             LLMAdapter,
    engine:          ExecutionEngine,
    agent_config:    AgentConfig,
    ctx:             ContextBuilder,
    shutdown:        GracefulShutdown | None = None,
    step_timeout:    int = 0,                        # 0 = no timeout
    context_manager: ContextManager | None = None,
    cost_tracker:    CostTracker | None = None,      # F14: cost tracking
    timeout:         int | None = None,              # total execution timeout
    session_manager: SessionManager | None = None,   # v4-B1: session persistence
    dry_run_tracker: DryRunTracker | None = None,    # v4-B4: dry-run action tracking
)
```

As of v1.0.0, the `build` agent also has access to `dispatch_subagent` as an additional tool, which allows delegating sub-tasks to agents with isolated context. See [`tools-and-execution.md`](/architect-docs/docs/v1-0-0/tools-and-execution) for details.

The loop does not create its dependencies — it receives them as parameters (dependency injection). Internally it creates `self.hlog = HumanLog(logger)` to emit traceability logs.
