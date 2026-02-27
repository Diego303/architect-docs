---
title: "AI Guide"
description: "Critical invariants, patterns, where to add things, pitfalls."
icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
order: 9
---

# AI Guide — how to modify architect

This guide is aimed at AI models (and developers) who need to understand the system to apply changes correctly. It covers the critical invariants, established patterns, and where to add each type of extension.

---

## Invariants that must NEVER be broken

### 1. Tools never throw exceptions

```python
# CORRECT — every tool
def execute(self, **kwargs) -> ToolResult:
    try:
        result = do_something()
        return ToolResult(success=True, output=str(result))
    except Exception as e:
        return ToolResult(success=False, output=f"Error: {e}", error=str(e))

# INCORRECT
def execute(self, **kwargs) -> ToolResult:
    result = do_something()  # can throw -> breaks the agent loop
    return ToolResult(success=True, output=str(result))
```

The `ExecutionEngine` has an outer `try/except` as a backstop, but tools must handle their own errors. The agent loop expects `ToolResult`, not exceptions.

### 2. Every file operation goes through `validate_path()`

```python
# CORRECT
def execute(self, path: str, **kwargs) -> ToolResult:
    try:
        safe_path = validate_path(path, self.workspace_root)
        content = safe_path.read_text()
        ...

# INCORRECT — security bypass
def execute(self, path: str, **kwargs) -> ToolResult:
    content = Path(path).read_text()  # path traversal possible
```

### 3. stdout is only for the final result and JSON

```python
# CORRECT
click.echo("Error: file not found", err=True)   # -> stderr
click.echo(state.final_output)                    # -> stdout
click.echo(json.dumps(output_dict))               # -> stdout

# INCORRECT
click.echo(f"Processing {filename}...")           # pollutes stdout
print(f"Step {n} completed")                      # breaks pipes
```

This includes the `SelfEvaluator` output — all evaluation notices go to `stderr`.

### 4. Tool errors return to the LLM, they don't terminate the loop

```python
# CORRECT — in ExecutionEngine
result = engine.execute_tool_call(name, args)
# result.success can be False; the loop continues
ctx.append_tool_results(messages, [tc], [result])
# The LLM receives the error and decides what to do

# INCORRECT
result = engine.execute_tool_call(name, args)
if not result.success:
    state.status = "failed"   # the LLM didn't get a chance to recover
    break
```

### 5. The version must be consistent in 4 places

When doing a version bump, update all 4:
1. `src/architect/__init__.py` -> `__version__ = "X.Y.Z"`
2. `pyproject.toml` -> `version = "X.Y.Z"`
3. `src/architect/cli.py` -> `@click.version_option(version="X.Y.Z")`
4. `src/architect/cli.py` -> execution headers with `vX.Y.Z` (appears 2 times, one per mode)

### 6. The ContextManager never throws exceptions

### 7. `CostTracker.record()` and `PriceLoader.get_prices()` never throw (except `BudgetExceededError`)

```python
# CORRECT — CostTracker
def record(self, step, model, usage, source="agent") -> None:
    # ... calculate cost ...
    if self._budget_usd and self.total_cost_usd > self._budget_usd:
        raise BudgetExceededError(...)  # <- only permitted exception

# PriceLoader always returns a ModelPricing (generic fallback if model unknown)
# LocalLLMCache.get() always returns None on failure (doesn't break the adapter)
# LocalLLMCache.set() fails silently
```

### 8. `run_command` does not use `tool.sensitive` for confirmation

The `run_command` tool has `sensitive=True` as a base attribute, but `ExecutionEngine` **does not use that attribute** for this tool. Instead, it calls `_should_confirm_command()` which dynamically queries `tool.classify_sensitivity(command)`. If you add new confirmation logic, make sure to keep this bypass intact.

### 9. Clean context per iteration in Ralph Loop and Auto-Review

`RalphLoop` and `AutoReviewer` create a **fresh** agent on each iteration/review via `agent_factory`. They never reuse the message history from a previous iteration. This is intentional: it prevents context accumulation and allows indefinite iterations without degradation.

```python
# CORRECT — agent_factory creates fresh agent
for iteration in range(max_iterations):
    agent = self.agent_factory(task=prompt, **kwargs)
    result = agent.run()

# INCORRECT — reusing the same agent
agent = self.agent_factory(task=initial_prompt)
for iteration in range(max_iterations):
    result = agent.run()  # accumulates context -> degradation
```

### 10. Parallel worktrees are independent and not auto-cleaned

`ParallelRunner` worktrees (`.architect-parallel-{N}`) persist after execution to allow inspection. They are only cleaned with `architect parallel-cleanup`. The original repository is never modified during parallel execution.

### 11. Post-edit hooks never throw exceptions

`PostEditHooks.run_for_tool()` and `run_for_file()` catch all exceptions internally. `subprocess.TimeoutExpired` returns a formatted `HookRunResult` with the timeout error. Other exceptions log a warning and return `None`. The hook result (if any) is concatenated to the `ToolResult` so the LLM can self-correct.

`maybe_compress()` fails silently if the LLM is unavailable. `enforce_window()` and `truncate_tool_result()` are purely string operations. None of the three should propagate exceptions to the loop.

```python
# CORRECT — in maybe_compress
try:
    summary = self._summarize_steps(old_msgs, llm)
except Exception:
    self.log.warning("context.compress.failed")
    return messages  # returns original unchanged
```

### 12. `dispatch_subagent` inherits tools from the parent agent

The `dispatch_subagent` tool (v1.0.0) creates sub-agents with isolated context. Sub-agents only have access to read tools (explore, test, review). They can never modify files or execute dangerous commands. The sub-agent's result is returned as a `ToolResult` to the parent agent.

### 13. OpenTelemetry is optional and never breaks execution

`ArchitectTracer` and `NoopTracer` share the same interface. If OpenTelemetry is not installed or the configuration is invalid, `NoopTracer` is used silently. Traces never block the agent loop or cause visible errors.

### 14. `CodeHealthAnalyzer` requires `radon` as an optional dependency

If `radon` is not installed, `architect health` returns an informative error. Cyclomatic complexity metrics depend on radon. The remaining metrics (lines, functions) work with the standard AST parser.

### 15. `CompetitiveEval` is deterministic and reproducible

The scoring weights (correctness=40, quality=30, efficiency=20, style=10) are hardcoded. The evaluator runs each model with the same prompt and compares results. Results include cost and time per model.

---

## Established patterns

### Adding a new local tool

1. Define the argument model in `tools/schemas.py`:

```python
class MyToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path:    str
    option:  str | None = None
```

2. Implement the tool in `tools/filesystem.py` or a new file:

```python
class MyTool(BaseTool):
    name        = "my_tool"
    description = "Clear description for the LLM of what this tool does."
    args_model  = MyToolArgs
    sensitive   = False   # True if it modifies the system

    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root

    def execute(self, path: str, option: str | None = None) -> ToolResult:
        try:
            safe_path = validate_path(path, self.workspace_root)
            # ... logic ...
            return ToolResult(success=True, output="Result...")
        except PathTraversalError as e:
            return ToolResult(success=False, output=str(e), error=str(e))
        except Exception as e:
            return ToolResult(success=False, output=f"Unexpected error: {e}", error=str(e))
```

3. Register in `tools/setup.py`:

```python
def register_filesystem_tools(registry, workspace_config):
    root = workspace_config.root.resolve()
    # ...existing tools...
    registry.register(MyTool(root))   # <- add here
```

4. If the tool should be available to all agents, nothing else is needed. If only for some, add `"my_tool"` to the `allowed_tools` of the corresponding agent.

---

### Adding a search tool (without `workspace_root`)

For tools that don't need path confinement (e.g., searching the full workspace):

```python
# In tools/search.py
class MySearchTool(BaseTool):
    name        = "my_search"
    description = "Searches X in the workspace code."
    args_model  = MySearchArgs
    sensitive   = False

    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root

    def execute(self, pattern: str, path: str = ".") -> ToolResult:
        try:
            base = validate_path(path, self.workspace_root)
            # search within base...
            return ToolResult(success=True, output=results_str)
        except Exception as e:
            return ToolResult(success=False, output=str(e), error=str(e))
```

Add in `register_search_tools()` in `tools/setup.py`.

---

### Adding a new default agent

In `agents/registry.py`:

```python
DEFAULT_AGENTS: dict[str, AgentConfig] = {
    "plan":   AgentConfig(...),
    "build":  AgentConfig(...),
    "resume": AgentConfig(...),
    "review": AgentConfig(...),
    "test":   AgentConfig(           # <- new agent
        system_prompt=TEST_PROMPT,   # add in prompts.py
        allowed_tools=["read_file", "list_files", "search_code", "write_file"],
        confirm_mode="confirm-sensitive",
        max_steps=15,
    ),
}
```

In `agents/prompts.py`:

```python
TEST_PROMPT = """
You are a specialized testing agent.
Your job is to analyze code and generate unit tests with pytest.
...
"""
```

---

### Adding a new CLI subcommand

```python
# In cli.py, after the main group

@main.command("my-command")
@click.option("-c", "--config", "config_path", type=click.Path(exists=False), default=None)
@click.option("--option", default=None)
def my_command(config_path, option):
    """Command description for --help."""
    try:
        config = load_config(config_path=Path(config_path) if config_path else None)
    except FileNotFoundError as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(EXIT_CONFIG_ERROR)

    # ... logic ...
    click.echo("Result")   # -> stdout
```

---

### Adding a field to the configuration

1. Add the field to the Pydantic model in `config/schema.py`.
2. If it needs to be configurable from env vars, add in `load_env_overrides()` in `config/loader.py`.
3. If it needs a CLI flag, add `@click.option` in `cli.py` and update `apply_cli_overrides()` in `loader.py`.
4. Update `config.example.yaml` with documentation for the new field.
5. Update `docs/config-reference.md`.

---

### Adding support for a new LLM error type

In `llm/adapter.py`, `_RETRYABLE_ERRORS`:

```python
_RETRYABLE_ERRORS = (
    litellm.RateLimitError,
    litellm.ServiceUnavailableError,
    litellm.APIConnectionError,
    litellm.Timeout,
    litellm.NewTransientError,   # <- if transient, add here
)
```

If the error is fatal (like auth errors), DO NOT add to `_RETRYABLE_ERRORS`. Let it propagate to the loop, which catches it and marks `status="failed"`.

To detect the error type in the CLI (exit codes):

```python
# In cli.py, in the except block of the run command
except Exception as e:
    err_str = str(e).lower()
    if any(k in err_str for k in ["authenticationerror", "api key", "unauthorized", "401"]):
        sys.exit(EXIT_AUTH_ERROR)
    elif any(k in err_str for k in ["timeout", "timed out", "readtimeout"]):
        sys.exit(EXIT_TIMEOUT)
    elif "new_type" in err_str:      # <- add here if you need a specific exit code
        sys.exit(NEW_EXIT_CODE)
    else:
        sys.exit(EXIT_FAILED)
```

---

## Where everything lives

| What do I need to change? | File(s) |
|--------------------------|---------|
| New local tool (filesystem) | `tools/schemas.py`, `tools/filesystem.py`, `tools/setup.py` |
| New search tool | `tools/schemas.py`, `tools/search.py`, `tools/setup.py` |
| New MCP tool | Only configure the server in `config.yaml`; the adapter is generic |
| New default agent | `agents/prompts.py`, `agents/registry.py` |
| Loop behavior | `core/loop.py` |
| Context window management | `core/context.py` -> `ContextManager` |
| Evaluation logic | `core/evaluator.py` -> `SelfEvaluator` |
| Repository indexing | `indexer/tree.py` -> `RepoIndexer` |
| Index cache | `indexer/cache.py` -> `IndexCache` |
| Mixed plan->build mode | `core/mixed_mode.py` |
| New configuration field | `config/schema.py`, `config/loader.py`, `cli.py`, `config.example.yaml` |
| New CLI subcommand | `cli.py` |
| LLM retries | `llm/adapter.py` -> `_RETRYABLE_ERRORS`, `_call_with_retry` |
| Streaming | `llm/adapter.py` -> `completion_stream()`, `core/loop.py` -> stream section |
| Exit codes | `cli.py` (constants + detection in except) |
| OS signals | `core/shutdown.py` (SIGINT/SIGTERM), `core/timeout.py` (SIGALRM) |
| Logging | `logging/setup.py` |
| LLM message format | `core/context.py` -> `ContextBuilder` |
| Context pruning | `core/context.py` -> `ContextManager` |
| JSON output serialization | `core/state.py` -> `AgentState.to_output_dict()` |
| Path security | `execution/validators.py` |
| Confirmation policies | `execution/policies.py` |
| MCP discovery | `mcp/discovery.py` |
| MCP HTTP client | `mcp/client.py` |
| MCP adapter | `mcp/adapter.py` |
| Command execution (F13) | `tools/commands.py` -> `RunCommandTool` |
| Command classification (F13) | `tools/commands.py` -> `classify_sensitivity()` |
| Dynamic run_command confirmation | `execution/engine.py` -> `_should_confirm_command()` |
| Model pricing (F14) | `costs/prices.py` -> `PriceLoader`, `costs/default_prices.json` |
| Cost tracking (F14) | `costs/tracker.py` -> `CostTracker` |
| Budget enforcement (F14) | `costs/tracker.py` -> `BudgetExceededError` |
| Local LLM cache (F14) | `llm/cache.py` -> `LocalLLMCache` |
| Prompt caching headers (F14) | `llm/adapter.py` -> `_prepare_messages_with_caching()` |
| Post-edit hooks (v3-M4) | `core/hooks.py` -> `PostEditHooks`, `config/schema.py` -> `HookConfig` |
| Human logging (v3-M5) | `logging/human.py` -> `HumanLog`, `HumanFormatter`, `HumanLogHandler` |
| structlog pipeline (v0.15.3) | `logging/setup.py` -> always `wrap_for_formatter`, never direct `ConsoleRenderer` |
| HUMAN level (25) | `logging/levels.py` |
| Human log integration in loop | `core/loop.py` -> `self.hlog = HumanLog(self.log)` |
| Hook execution in engine | `execution/engine.py` -> `run_post_edit_hooks()` |
| StopReason enum | `core/state.py` -> `StopReason` |
| Ralph Loop | `features/ralph.py` -> `RalphLoop`, `RalphConfig` |
| Pipeline mode | `features/pipelines.py` -> `PipelineRunner`, `PipelineConfig` |
| Parallel execution | `features/parallel.py` -> `ParallelRunner`, `ParallelConfig` |
| Checkpoints | `features/checkpoints.py` -> `CheckpointManager`, `Checkpoint` |
| Auto-review | `agents/reviewer.py` -> `AutoReviewer`, `ReviewResult` |
| Phase C configs | `config/schema.py` -> `RalphLoopConfig`, `ParallelRunsConfig`, `CheckpointsConfig`, `AutoReviewConfig` |
| Phase C CLI commands | `cli.py` -> `loop`, `pipeline`, `parallel`, `parallel-cleanup` |
| Dispatch sub-agents (v1.0.0) | `tools/dispatch.py` -> `DispatchSubagentTool` |
| Code health metrics (v1.0.0) | `features/health.py` -> `CodeHealthAnalyzer`, `HealthSnapshot`, `HealthDelta` |
| Competitive evaluation (v1.0.0) | `features/eval.py` -> `CompetitiveEval`, `CompetitiveResult` |
| OpenTelemetry traces (v1.0.0) | `telemetry/otel.py` -> `ArchitectTracer`, `NoopTracer` |
| Presets and init (v1.0.0) | `features/presets.py` -> `PresetManager`, `PRESETS` |

---

## Common pitfalls

### The LLM requests a tool not in `allowed_tools`

The `ExecutionEngine` returns `ToolResult(success=False, "Tool not found")`. The LLM receives that error in the next message and can try something else. This is intentional — it's not a bug.

### Streaming and tool calls in the same step

When the LLM is streaming, text chunks arrive first. If there are tool calls afterward, they accumulate internally in the adapter and are returned in the final `LLMResponse`. The `on_stream_chunk` callback does NOT receive tool call chunks, only text.

### `allowed_tools = []` vs `allowed_tools = None`

- `[]` in `AgentConfig` -> `registry.get_schemas([])` -> empty list -> the LLM has no tools.
- `None` -> `registry.get_schemas(None)` -> all registered tools.

In the defaults, `allowed_tools=[]` (empty list) is treated as "all tools" in the registry:

```python
# In loop.py
tools_schema = registry.get_schemas(agent_config.allowed_tools or None)
# [] -> or None -> None -> all tools
```

The `or None` is the trick. An empty list `[]` is falsy in Python, so it converts to `None`.

### MixedModeRunner creates two distinct engines (legacy)

Mixed plan->build mode is no longer the default (v3-M3). The CLI uses `build` directly as the default agent. If you use `MixedModeRunner` programmatically, don't reuse the same `ExecutionEngine` for plan and build. The plan needs `confirm_mode="confirm-all"` and limited tools; the build needs `confirm_mode="confirm-sensitive"` and all tools. The `ContextManager` IS **shared** between both phases.

### `validate_path()` with absolute paths

`validate_path("/etc/passwd", workspace)` also raises `PathTraversalError`. The calculation `(workspace_root / "/etc/passwd").resolve()` results in `/etc/passwd` directly (Python ignores workspace_root when the path is absolute), and then `is_relative_to(workspace)` fails. The protection works correctly for absolute paths.

### Tenacity `reraise=True`

`_call_with_retry` has `reraise=True`. This means that after exhausting retries, the original exception is propagated. The loop catches it and marks `status="failed"`. Without `reraise=True`, tenacity would throw its own `RetryError`.

### `StepTimeout` does not work on Windows

`signal.SIGALRM` does not exist on Windows. `StepTimeout` is transparently a no-op. If you need timeout on Windows, you would have to use a thread with `threading.Timer`, but that implies threading complexity that the sync-first design consciously avoids.

### `model_copy(update=..., exclude_unset=True)` in the registry

The agent merge uses `exclude_unset=True` to know which fields the YAML actually specified (vs those that have a value due to having a default). This allows a partial override to not overwrite fields the user didn't intend to change with default values.

### `edit_file` requires unique `old_str`

If `old_str` appears more than once in the file, `EditFileTool` returns an error. The agent must include enough context in `old_str` for it to be unique. If there are multiple occurrences, use `apply_patch` with line-specific hunks.

### Parallel tool calls and `confirm-sensitive`

With `confirm-sensitive`, if **any** tool call in the batch has `sensitive=True`, **the entire batch is executed sequentially**. This is conservative by design: user interaction is not thread-safe, and mixing confirmations in parallel would create confusion.

### `SelfEvaluator` only evaluates `status == "success"`

If the agent already finished with `"partial"` or `"failed"`, the `SelfEvaluator` does not run. Evaluation only makes sense when the agent believes it finished correctly.

### ContextManager Level 2 can call the LLM

`maybe_compress()` makes an extra LLM call to summarize old steps. This means:
1. It consumes extra tokens (generally small).
2. It can fail if there are network/auth errors -> fails silently.
3. The summary is marked with `[Summary of previous steps]` so the LLM knows it's a synthesis.

In tests, pass `context_manager=None` to avoid the LLM call during compression.

### `RepoIndexer` excludes files >1MB

Very large files (datasets, binaries, etc.) are omitted from the index but are still accessible with `read_file`. The agent will see them in the tree as omitted, but can read them explicitly. For repos with valid large files, adjust `indexer.max_file_size`.

### Message order in `enforce_window`

Level 3 removes pairs `messages[2:4]` (the oldest assistant + tool after the initial user message). It never removes `messages[0]` (system) or `messages[1]` (original user). If there are fewer than 4 messages, nothing is removed. Pairs are removed 2 at a time to maintain OpenAI format coherence.

### `run_command` and stdin

`RunCommandTool.execute()` passes `stdin=subprocess.DEVNULL` explicitly. Commands that require interactive input (e.g., `git commit` without `-m`, `vim`, `nano`) will fail. The agent must use non-interactive flags in its commands.

### Prompt caching and non-Anthropic providers

`_prepare_messages_with_caching()` adds `cache_control` to the system message. If the provider doesn't support this field (e.g., `ollama`, local providers), LiteLLM will simply ignore it when serializing the request — it doesn't produce errors. Only active with `LLMConfig.prompt_caching=True`.

### `LocalLLMCache` and configuration changes

The cache is deterministic by `(messages, tools)`. If you change the system prompt but use the same user prompt, the key is different (the system prompt is part of `messages[0]`). However, if you change the model version in config but the messages are identical, the cache returns the old response (which was generated with the previous model). In development this is intentional; in production, use `--no-cache`.

### `BudgetExceededError` and agent state

When `BudgetExceededError` is raised, the loop sets `state.status = "partial"` and exits. The `CostTracker` **already recorded** the step that caused the excess. The JSON output includes `costs` with the accumulated total including the step that exceeded the budget.

### PostEditHooks never break the loop

Hooks always return `None` or a string, they never throw exceptions. If a hook exceeds the timeout (`subprocess.TimeoutExpired`) or fails for any other reason, a warning is logged and a formatted error message is returned. That message is injected as part of the tool result so the LLM can see it and self-correct. The agent loop is never interrupted by a failed hook.

### HumanLog goes through a separate pipeline

Events with HUMAN level (25) are routed exclusively to the `HumanLogHandler` on stderr, NOT to the technical console handler. The console handler explicitly excludes HUMAN events. This means `-v` (INFO) does NOT show human logs — human logs are always shown (with icons) unless `--quiet` or `--json` is used.

**Important**: structlog ALWAYS uses `wrap_for_formatter` as the final processor (v0.15.3). If changed to direct `ConsoleRenderer`, the `HumanLogHandler` will stop working because it receives pre-rendered strings instead of the event dict. The event dict extraction depends on `record.msg` being a `dict`.

### `_graceful_close()` makes one last LLM call

When a watchdog fires (max_steps, budget, timeout, context_full), the loop calls `_graceful_close()` which injects a `[SYSTEM]` message and makes one last LLM call WITHOUT tools to get a summary of what was done up to that point. The exception is `USER_INTERRUPT` (Ctrl+C), which cuts immediately without an extra call. If the final LLM call fails, a mechanical message is used as output.

### `RalphLoop._run_checks()` uses subprocess with shell=True

Ralph Loop checks are executed with `subprocess.run(cmd, shell=True)`. This means commands can use pipes, redirects, and environment variables. Exit code 0 indicates success, any other indicates failure. There is no per-check timeout — a hanging check will block the iteration.

### `PipelineRunner._substitute_variables()` is literal

The `{{name}}` variable substitution is a simple `str.replace()`. It doesn't support expressions, filters, or nested variables. If a variable doesn't exist, `{{name}}` stays literal in the prompt — it doesn't produce an error.

### `CheckpointManager.list_checkpoints()` parses pipe-separated format

`list_checkpoints()` uses `git log --format=%H|%s|%at` and parses with `split('|')`. If a commit message contains `|`, parsing can fail. Checkpoints always use the format `architect:checkpoint:<name>` which doesn't contain pipes.

### `ParallelRunner._run_worker()` is a subprocess

Each worker is executed as `subprocess.Popen("architect run --json --confirm-mode yolo ...")` in its worktree. This means the worker inherits env vars from the parent process (including API keys). If the subprocess fails, the `WorkerResult` has `status="failed"`.

### `AutoReviewer` fails silently

If the LLM call fails during the review, the `AutoReviewer` does not propagate the exception. It returns `ReviewResult(has_issues=True, review_text="Error during review: ...", cost=0.0)`. This allows the main flow to continue without interruptions.
