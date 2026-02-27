---
title: "Architecture"
description: "Overview, component diagram, and full execution flow."
icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
order: 4
---

# System Architecture

## Component Map

```
+-------------------------------------------------------------------------+
|  CLI (cli.py)                                                           |
|                                                                         |
|  architect run PROMPT                                                   |
|     |                                                                   |
|     +- 1. GracefulShutdown()          installs SIGINT + SIGTERM         |
|     +- 2. load_config()               YAML -> env -> CLI flags          |
|     +- 3. configure_logging()         logging/setup.py                  |
|     |       +- logging/levels.py      custom HUMAN level (25)           |
|     |       +- logging/human.py       HumanLogHandler + HumanLog        |
|     +- 4. ToolRegistry                                                  |
|     |       +- register_all_tools()   filesystem + editing + search     |
|     |       +- MCPDiscovery()         (optional, --disable-mcp)         |
|     +- 5. RepoIndexer                 workspace tree (F10)              |
|     |       +- IndexCache             disk cache (TTL 5 min)            |
|     +- 6. LLMAdapter(config.llm)      LiteLLM + selective retries       |
|     +- 7. ContextManager(config.ctx)  3-level pruning (F11)             |
|     +- 8. ContextBuilder(repo_index, context_manager)                   |
|     +- 8b. PostEditHooks(config)      core/hooks.py - auto-verification |
|     +- 8c. SessionManager(workspace)  features/sessions.py (v4-B1)      |
|     +- 8d. DryRunTracker()            features/dryrun.py (v4-B4)        |
|     |                                                                   |
|     +- 9a. AgentLoop (default mode: build, or -a flag)                  |
|     |       +- ExecutionEngine(registry, config, confirm_mode,          |
|     |       |                  hooks: PostEditHooks)                     |
|     |       +- while True + safety nets (_check_safety_nets)            |
|     |       +- HumanLog(log) - traceability to stderr                   |
|     |       +- step_timeout (per step) + timeout (total execution)      |
|     |       +- cost_tracker (CostTracker, optional)                     |
|     +- 9b. MixedModeRunner (mixed mode, no longer default)              |
|             +- shared engine (plan + build)                              |
|             +- shared cost_tracker                                       |
|             +- shared ContextManager between phases                      |
|                                                                         |
|    10. SelfEvaluator (optional, --self-eval basic|full, F12)            |
|         +- evaluate_basic() | evaluate_full(run_fn)                     |
|                                                                         |
|    11. ReportGenerator (optional, --report json|markdown|github, B2)    |
|         +- to_json() | to_markdown() | to_github_pr_comment()          |
|                                                                         |
|  == Advanced orchestration modes ==                                     |
|                                                                         |
|    12. RalphLoop (architect loop)                                       |
|         +- agent_factory() -> fresh AgentLoop per iteration             |
|         +- _run_checks() -> subprocess shell commands                   |
|         +- _build_iteration_prompt() -> spec + diff + errors + progress |
|         +- worktree support -> .architect-ralph-worktree                |
|                                                                         |
|    13. PipelineRunner (architect pipeline)                               |
|         +- from_yaml() -> load pipeline from YAML                       |
|         +- agent_factory() -> fresh AgentLoop per step                  |
|         +- _resolve_vars() -> {{variable}} substitution                 |
|         +- _eval_condition() -> skip steps conditionally                |
|         +- _create_checkpoint() -> git commit per step                  |
|                                                                         |
|    14. ParallelRunner (architect parallel)                               |
|         +- ProcessPoolExecutor(max_workers)                             |
|         +- _run_worker_process() -> subprocess architect run in worktree|
|         +- cleanup() -> remove worktrees and branches                   |
|                                                                         |
|    15. AutoReviewer                                                      |
|         +- review_changes(task, diff) -> ReviewResult                   |
|         +- build_fix_prompt() -> correction prompt                      |
|         +- get_recent_diff() -> git diff HEAD                           |
|                                                                         |
|    16. CheckpointManager                                                 |
|         +- create(step) -> git commit with prefix                       |
|         +- list_checkpoints() -> parse git log                          |
|         +- rollback(step|commit) -> git reset --hard                    |
|                                                                         |
|  == Advanced extensions ==                                               |
|                                                                         |
|    17. CompetitiveEval (architect eval)                                  |
|         +- ParallelRunner -> same task with multiple models             |
|         +- _run_checks_in_worktree() -> per-worktree validation         |
|         +- _rank_results() -> composite score (100 pts)                 |
|                                                                         |
|    18. DispatchSubagentTool (tool dispatch_subagent)                    |
|         +- agent_factory() -> fresh AgentLoop for sub-task              |
|         +- types: explore (RO), test (RO+cmd), review (RO)             |
|         +- SUBAGENT_MAX_STEPS=15, truncated summary 1000 chars          |
|                                                                         |
|    19. CodeHealthAnalyzer (--health)                                     |
|         +- take_before_snapshot() -> pre-execution metrics              |
|         +- take_after_snapshot() -> post-execution metrics              |
|         +- compute_delta() -> HealthDelta with markdown report          |
|                                                                         |
|    20. ArchitectTracer (telemetry)                                       |
|         +- start_session() -> full session span                         |
|         +- trace_llm_call() -> span per LLM call                       |
|         +- trace_tool() -> span per tool execution                     |
|         +- NoopTracer if OTel not installed                             |
|                                                                         |
|    21. PresetManager (architect init)                                    |
|         +- apply(preset) -> generates .architect.md + config.yaml       |
|         +- 5 presets: python, node-react, ci, paranoid, yolo            |
+-------------------------------------------------------------------------+
```

---

## Module Diagram and Dependencies

```
cli.py
 +-- config/loader.py ---- config/schema.py
 +-- logging/levels.py                          custom HUMAN level (25)
 +-- logging/human.py ---- logging/levels.py    HumanLogHandler + HumanLog
 +-- logging/setup.py ---- logging/levels.py
 |                          logging/human.py (HumanLogHandler)
 +-- tools/setup.py ------ tools/registry.py
 |                          tools/filesystem.py -- tools/base.py
 |                          tools/patch.py         tools/schemas.py
 |                          tools/search.py
 |                          execution/validators.py
 +-- mcp/discovery.py ---- mcp/client.py
 |                          mcp/adapter.py -------- tools/base.py
 +-- indexer/tree.py
 +-- indexer/cache.py
 +-- llm/adapter.py
 +-- core/hooks.py -------- config/schema.py (HookConfig)
 +-- core/context.py ----- indexer/tree.py (RepoIndex)
 |                          llm/adapter.py (LLMAdapter - for maybe_compress)
 +-- core/loop.py -------- core/state.py (AgentState, StopReason)
 |                          core/shutdown.py
 |                          core/timeout.py
 |                          core/context.py (ContextManager)
 |                          core/hooks.py (PostEditHooks - via ExecutionEngine)
 |                          costs/tracker.py (CostTracker, BudgetExceededError)
 |                          logging/human.py (HumanLog)
 +-- core/mixed_mode.py -- core/loop.py
 |                          core/context.py (ContextManager)
 |                          costs/tracker.py (CostTracker)
 +-- core/evaluator.py --- llm/adapter.py (LLMAdapter)
 |                          core/state.py (AgentState) - TYPE_CHECKING only
 +-- features/sessions.py -- core/state.py (StopReason)
 |                            config/schema.py (SessionsConfig)
 +-- features/report.py ---- core/state.py (AgentState)
 |                            costs/tracker.py (CostTracker)
 +-- features/dryrun.py ---- (standalone, minimal deps)
 +-- features/ralph.py ----- core/state.py (AgentState)       # v4-C1
 |                            costs/tracker.py (CostTracker)
 +-- features/pipelines.py -- core/state.py (AgentState)      # v4-C3
 |                             costs/tracker.py (CostTracker)
 +-- features/parallel.py -- (subprocess, standalone)
 +-- features/checkpoints.py - (subprocess git, standalone)
 +-- features/competitive.py -- features/parallel.py (ParallelRunner)
 +-- agents/reviewer.py ---- core/state.py (AgentState)
 +-- tools/dispatch.py ------ tools/base.py (BaseTool)
 |                             core/loop.py (AgentLoop - via factory)
 +-- core/health.py ---------- (AST stdlib + optional radon)
 +-- telemetry/otel.py ------- (optional opentelemetry)
 +-- config/presets.py -------- (standalone, templates)
 +-- agents/registry.py ---- agents/prompts.py
                            config/schema.py (AgentConfig)
```

---

## Full Execution Flow

### Single-agent mode — the default mode (`architect run PROMPT`)

```
GracefulShutdown()
     |
load_config(yaml, env, cli_flags)
     |
configure_logging()              logging/setup.py
  +- HumanLogHandler (stderr)    HUMAN events only (25)
  +- Technical console (stderr)  controlled by -v / -vv
  +- JSON file (optional)        captures everything (DEBUG+)
     |
ToolRegistry
  +- register_all_tools()    read_file, write_file, delete_file, list_files,
  |                          edit_file, apply_patch, search_code, grep, find_files
  +- MCPDiscovery()          mcp_{server}_{tool} (if MCP servers configured)
     |
RepoIndexer.build_index()    traverses workspace -> RepoIndex
  (or IndexCache.get())       uses cache if < 5 min
     |
LLMAdapter(config.llm)
     |
ContextManager(config.context)
     |
ContextBuilder(repo_index=index, context_manager=ctx_mgr)
     |
PostEditHooks(config.hooks.post_edit, workspace_root)
     |
get_agent("build", yaml_agents, cli_overrides)
  -> AgentConfig{system_prompt, allowed_tools, confirm_mode, max_steps=50}
     |
ExecutionEngine(registry, config, confirm_mode, hooks=post_edit_hooks)
     |
AgentLoop(llm, engine, agent_config, ctx, shutdown, step_timeout,
          context_manager, cost_tracker, timeout)
     |
AgentLoop.run(prompt, stream=True, on_stream_chunk=stderr_write)
     |
     -- while True: --------------------------------------------------------
     |
     |  [1] _check_safety_nets(state, step)
     |        +- USER_INTERRUPT?  -> return immediately (no LLM)
     |        +- MAX_STEPS?       -> _graceful_close() -> asks LLM for summary
     |        +- TIMEOUT?         -> _graceful_close() -> asks LLM for summary
     |        +- BUDGET_EXCEEDED? -> _graceful_close() -> asks LLM for summary
     |        +- CONTEXT_FULL?    -> _graceful_close() -> asks LLM for summary
     |
     |  [2] ContextManager.manage(messages, llm)
     |        +- compresses if > 75% of context window used
     |
     |  [3] hlog.llm_call(step, messages_count)
     |      with StepTimeout(step_timeout):
     |        llm.completion_stream(messages, tools_schema)
     |          -> StreamChunk("def foo...") --> stderr via callback
     |          -> LLMResponse(tool_calls=[ToolCall("edit_file", {...})])
     |
     |  [4] cost_tracker.record(step, model, usage, source="agent")
     |        +- if BudgetExceededError -> _graceful_close(BUDGET_EXCEEDED)
     |
     |  [5] If no tool_calls:
     |        hlog.agent_done(step)
     |        state.status = "success"
     |        state.stop_reason = StopReason.LLM_DONE
     |        break
     |
     |  [6] _execute_tool_calls_batch([tc1, tc2, ...])
     |        if parallel -> ThreadPoolExecutor(max_workers=4)
     |          -> hlog.tool_call("edit_file", {path:...})
     |          -> engine.execute_tool_call("edit_file", {path:..., old_str:..., new_str:...})
     |              1. registry.get("edit_file")
     |              2. tool.validate_args(args)         -> EditFileArgs
     |              3. policy.should_confirm()           -> True: prompt y/n/a
     |              4. if dry_run: return [DRY-RUN]
     |              5. EditFileTool.execute()
     |                   +- validate_path() - workspace confinement
     |                   +- assert old_str is unique
     |                   +- file.write_text(new_content)
     |                   +- return ToolResult(success=True, output="[diff...]")
     |          -> engine.run_post_edit_hooks(tool_name, args)
     |              +- PostEditHooks.run_for_tool() -> hook output appended to result
     |          -> hlog.tool_result("edit_file", success=True)
     |
     |  [7] ctx.append_tool_results(messages, tool_calls, results)
     |        +- ContextManager.truncate_tool_result(content)  <- Level 1
     |      state.steps.append(StepResult(...))
     |
     -- (back to [1]) ------------------------------------------------------
     |
hlog.loop_complete(status, stop_reason, total_steps, total_tool_calls)
state.status = "success" | "partial"  (depending on StopReason)

[Optional] SelfEvaluator (if --self-eval != "off")
     |
     +-- basic: evaluate_basic(prompt, state) -> EvalResult
     |     -> if not passed: state.status = "partial"
     |
     +-- full: evaluate_full(prompt, state, run_fn)
           -> loop up to max_retries: evaluate_basic() + run_fn(correction_prompt)
           -> returns the best AgentState

if --json: stdout <- json.dumps(state.to_output_dict())
if normal: stdout <- state.final_output

[v4-B1] SessionManager.save(session_state)   <- save final session
[v4-B2] if --report: ReportGenerator(report).to_{format}()
        if --report-file: write to file; otherwise, stdout

sys.exit(EXIT_CODE)  <- StopReason -> exit code mapping (0/1/2/3/4/5/130)
```

### Mixed mode (legacy, no longer the default)

```
[configuration same as single-agent]

MixedModeRunner(llm, engine, plan_config, build_config, ctx,
                shutdown, step_timeout, context_manager, cost_tracker)
     |
     Note: a single shared engine (plan and build). The cost_tracker and
     ContextManager are also shared between phases.
     |
MixedModeRunner.run(prompt, stream=True, on_stream_chunk=...)
     |
     +-- PHASE 1: plan (no streaming)
     |     plan_loop = AgentLoop(llm, engine, plan_config, ctx,
     |                           context_manager=ctx_mgr,
     |                           cost_tracker=cost_tracker)
     |     plan_state = plan_loop.run(prompt, stream=False)
     |     if plan_state.status == "failed": return plan_state
     |     if shutdown.should_stop: return plan_state
     |
     +-- PHASE 2: build (with streaming)
     |     enriched_prompt = f"""
     |       The user asked: {prompt}
     |       The planning agent generated this plan:
     |       ---
     |       {plan_state.final_output}
     |       ---
     |       Your job is to execute this plan step by step...
     |     """
     |     build_loop = AgentLoop(llm, engine, build_config, ctx,
     |                            context_manager=ctx_mgr,
     |                            cost_tracker=cost_tracker)
     |     build_state = build_loop.run(enriched_prompt, stream=True, ...)
     |
     +-- return build_state

[SelfEvaluator is applied to build_state if --self-eval != "off"]
```

---

## stdout / stderr Separation

This separation is critical for Unix pipe compatibility.

```
+-----------------------------+------------------------------------------+
| Destination                 | Content                                  |
+-----------------------------+------------------------------------------+
| stderr                      | Real-time LLM streaming chunks           |
| stderr                      | Structured logs (structlog)              |
| stderr                      | Execution header (model, workspace)      |
| stderr                      | MCP and indexer statistics                |
| stderr                      | Confirmation prompts                     |
| stderr                      | Shutdown notices (Ctrl+C)                |
| stderr                      | SelfEvaluator output                     |
| stderr                      | Human log: agent traceability            |
|                             | (Step 1 -> LLM, tool calls, results)    |
+-----------------------------+------------------------------------------+
| stdout                      | Agent's final response                   |
| stdout                      | JSON output (--json)                     |
+-----------------------------+------------------------------------------+

# Example of correct pipe usage:
architect run "analyze the project" -a resume --quiet --json | jq .status
architect run "generate README" --mode yolo > README.md
architect run "..." -v 2>logs.txt    # logs to file, result to stdout
```

---

## Exit Codes

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | `EXIT_SUCCESS` | Success — agent finished cleanly |
| 1 | `EXIT_FAILED` | Agent failure — unrecoverable LLM or tool error |
| 2 | `EXIT_PARTIAL` | Partial — did part of the work, didn't complete (including SelfEvaluator failure) |
| 3 | `EXIT_CONFIG_ERROR` | Configuration error or YAML file not found |
| 4 | `EXIT_AUTH_ERROR` | LLM authentication error (invalid API key) |
| 5 | `EXIT_TIMEOUT` | LLM call timeout |
| 130 | `EXIT_INTERRUPTED` | Interrupted by Ctrl+C (POSIX: 128 + SIGINT=2) |

Authentication errors (exit 4) and timeouts (exit 5) are detected by keywords in the LiteLLM error message, since LiteLLM can throw various exception types for the same conceptual error.

The `SelfEvaluator` can change a `"success"` to `"partial"` (exit 2) if it detects that the task was not completed correctly.

---

## Design Decisions

| Decision | Justification |
|----------|---------------|
| Sync-first (no asyncio) | Predictable, debuggable; LLM calls are the only latency |
| No LangChain/LangGraph | The loop is simple (~300 lines); adding abstraction would obscure the flow |
| Pydantic v2 as source of truth | Validation, serialization, and documentation in one place |
| Tools never throw exceptions | The agent loop stays stable against any tool failure |
| Clean stdout | Unix pipes: `architect run ... \| jq .` works without filtering |
| MCP tools = BaseTool | Unified registry; the agent doesn't distinguish between local and remote |
| Selective retries | Only transient errors (rate limit, connection); auth errors fail fast |
| SIGALRM for timeouts | Per-step, not global; allows resuming on the next step if there's a timeout |
| `run_fn` in SelfEvaluator | Avoids circular coupling with AgentLoop; simplifies the evaluator API |
| Parallel tools with `{future:idx}` | Guarantees correct result order regardless of completion order |
| ContextManager levels 1->2->3 | Progressive: level 1 always active; levels 2 and 3 are more aggressive defenses |
| `RepoIndexer` with `os.walk()` | Efficient; prunes directories in-place (doesn't visit them) |
| `while True` + safety nets | The LLM decides when to stop; the watchdogs are safety, not drivers |
| `HUMAN` log level (25) | Agent traceability separated from technical noise |
| `HumanFormatter` with icons | Visual format allows understanding at a glance what the agent is doing |
| `PostEditHooks` | Post-edit auto-verification without breaking the loop; results go back to the LLM |
| Graceful close | Watchdogs ask the LLM for a summary instead of cutting (except USER_INTERRUPT) |
