---
title: "Testing"
description: "Test map: ~817+ tests across 30+ files, coverage by module."
icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
order: 12
---

# Testing -- Complete Coverage Overview

Document updated on 2026-02-24. Reflects the current state of all tests. Version: v1.0.0.

> **Requirement**: To run the tests and quality tools, install the `dev` extra:
> ```bash
> pip install architect-ai-cli[dev]
> ```
> Includes: `pytest`, `pytest-cov`, `pytest-asyncio`, `black`, `ruff`, `mypy`.

## Global results

### Integration scripts (`scripts/`)

| File | Tests | Status | Requires API key |
|---|:---:|:---:|:---:|
| `test_phase1.py` | 6 | Passed | No |
| `test_phase2.py` | 7 | Passed | No |
| `test_phase3.py` | 5 | Passed | No |
| `test_phase4.py` | 3 | Passed | No |
| `test_phase5.py` | 5 | Passed | No |
| `test_phase6.py` | 4+1 skip | Passed | No (1 skip) |
| `test_phase7.py` | 11 | Passed | No |
| `test_phase8.py` | 7 | Passed | No |
| `test_phase9.py` | 24 | Passed | No |
| `test_phase10.py` | 35 | Passed | No |
| `test_phase11.py` | 9 | Passed | No |
| `test_phase12.py` | 39 | Passed | No |
| `test_phase13.py` | 54 | Passed | No |
| `test_phase14.py` | 6 | Passed | No |
| `test_v3_m1.py` | 38 | Passed | No |
| `test_v3_m2.py` | 22 | Passed | No |
| `test_v3_m3.py` | 34 | Passed | No |
| `test_v3_m4.py` | 44 | Passed | No |
| `test_v3_m5.py` | 41 | Passed | No |
| `test_v3_m6.py` | 23 | Passed | No |
| `test_phase15.py` | 29 | Passed | No |
| `test_phase16.py` | 24 | Passed | No |
| `test_phase17.py` | 31 | Passed | No |
| `test_phase18.py` | 32 | Passed | No |
| `test_phase_b.py` | ~104 checks | Passed | No |
| `test_phase_c_e2e.py` | 31 | Passed | No |
| `test_integration.py` | 54 (47+7) | 47 passed, 7 expected | 7 require key |
| `test_config_loader.py` | 37 | Passed | No |
| `test_mcp_internals.py` | 47 | Passed | No |
| `test_streaming.py` | 33 | Passed | No |
| `test_parallel_execution.py` | 29 | Passed | No |
| **TOTAL scripts** | **~848** | **Passed** | **7 expected with key** |

### Unit tests pytest (`tests/`)

| Directory | Tests | What it covers |
|---|:---:|---|
| `tests/test_hooks/` | 29 | HookExecutor, HooksRegistry, HookEvent |
| `tests/test_guardrails/` | 24 | GuardrailsEngine, quality gates, code rules |
| `tests/test_skills/` | 31 | SkillsLoader, SkillInstaller |
| `tests/test_memory/` | 32 | ProceduralMemory, correction patterns |
| `tests/test_sessions/` | 22 | SessionManager, SessionState, generate_session_id |
| `tests/test_reports/` | 20 | ExecutionReport, ReportGenerator, collect_git_diff |
| `tests/test_dryrun/` | 23 | DryRunTracker, PlannedAction, WRITE_TOOLS/READ_TOOLS |
| `tests/test_ralph/` | 90 | RalphLoop, RalphConfig, LoopIteration, RalphLoopResult |
| `tests/test_pipelines/` | 83 | PipelineRunner, PipelineConfig, PipelineStep, variables, conditions |
| `tests/test_checkpoints/` | 48 | CheckpointManager, Checkpoint, create/list/rollback |
| `tests/test_reviewer/` | 47 | AutoReviewer, ReviewResult, build_fix_prompt, get_recent_diff |
| `tests/test_parallel/` | 43 | ParallelRunner, ParallelConfig, WorkerResult, worktrees |
| `tests/test_dispatch/` | 36 | DispatchSubagentTool, DispatchSubagentArgs, types, tools |
| `tests/test_health/` | 28 | CodeHealthAnalyzer, HealthSnapshot, HealthDelta, FunctionMetric |
| `tests/test_competitive/` | 19 | CompetitiveEval, CompetitiveConfig, CompetitiveResult, ranking |
| `tests/test_telemetry/` | 20 (9 skip) | ArchitectTracer, NoopTracer, NoopSpan, create_tracer, SERVICE_VERSION |
| `tests/test_presets/` | 37 | PresetManager, AVAILABLE_PRESETS, apply, list_presets |
| `tests/test_bugfixes/` | 41 | Validation BUG-3 to BUG-7 (code_rules, dispatch, telemetry, health, parallel) |
| **TOTAL pytest** | **687** | **Phases A + B + C + D + Bugfixes** |

> The 7 tests that fail in `test_integration.py` are real calls to the OpenAI API (sections 1 and 2). They fail with `AuthenticationError` because no `OPENAI_API_KEY` is configured. This is the expected behavior in CI without credentials.

---

## Coverage by module

### `src/architect/tools/` -- Local tools

| Source file | Test file(s) | What is tested |
|---|---|---|
| `filesystem.py` | `test_phase1`, `test_phase9`, `test_v3_m6`, `test_integration` | read_file, write_file, edit_file, delete_file, list_files -- real operations, path traversal, dry-run, write modes |
| `patch.py` | `test_phase9`, `test_v3_m6` | apply_patch -- single-hunk, multi-hunk, pure insertion, format errors, diff output |
| `search.py` | `test_phase10`, `test_v3_m6` | search_code (regex), grep (literal), find_files (glob) -- case insensitive, patterns, context |
| `commands.py` | `test_phase13` | run_command -- blocklist (layer 1), allowed_only (layer 2), timeout+truncation (layer 3), directory sandboxing (layer 4), extra patterns, extra safe commands, sensitivity classification |

### `src/architect/core/` -- Agent loop

| Source file | Test file(s) | What is tested |
|---|---|---|
| `loop.py` | `test_v3_m1`, `test_parallel_execution` | AgentLoop.run(), _check_safety_nets (5 conditions), _graceful_close (4 StopReasons), _should_parallelize, _execute_tool_calls_batch (sequential vs parallel, preserved order) |
| `state.py` | `test_v3_m1`, `test_parallel_execution` | StopReason (7 members), AgentState, StepResult, _CLOSE_INSTRUCTIONS (4 keys), ToolCallResult |
| `context.py` | `test_v3_m2`, `test_phase11` | ContextManager -- _estimate_tokens, _is_above_threshold, is_critically_full, manage(), _summarize_steps, _format_steps_for_summary, _count_tool_exchanges, truncate_tool_result, enforce_window, maybe_compress |
| `hooks.py` | `test_v3_m4`, `test_phase15`, `test_parallel_execution` | HookExecutor -- 10 lifecycle events (HookEvent enum), HookDecision (ALLOW/BLOCK/MODIFY), exit code protocol, env vars, async hooks, matcher/file_patterns filtering, HooksRegistry, backward-compat run_post_edit; PostEditHooks legacy |
| `evaluator.py` | `test_phase12` | SelfEvaluator -- basic mode, full mode, result evaluation |
| `mixed_mode.py` | `test_phase3`, `test_v3_m3` | MixedModeRunner -- no longer default, backward compat |
| `shutdown.py` | `test_phase7` | GracefulShutdown -- initial state, reset, should_stop, integration with AgentLoop |
| `timeout.py` | `test_phase7` | StepTimeout -- no timeout, clean exit, handler restoration, raises |

### `src/architect/llm/` -- LLM adapter

| Source file | Test file(s) | What is tested |
|---|---|---|
| `adapter.py` | `test_streaming`, `test_phase2`, `test_phase7`, `test_integration` | completion_stream (full mock), _parse_arguments, _try_parse_text_tool_calls, _prepare_messages_with_caching, _normalize_response, StreamChunk/LLMResponse/ToolCall models, retry logic |
| `cache.py` | `test_phase14` | LocalLLMCache -- deterministic SHA-256, TTL, hit/miss |

### `src/architect/mcp/` -- MCP (Model Context Protocol)

| Source file | Test file(s) | What is tested |
|---|---|---|
| `client.py` | `test_mcp_internals`, `test_phase4` | MCPClient init (headers, token, URL), _parse_sse (8 scenarios), _parse_response (JSON/SSE/fallback), _resolve_token (4 sources), _next_id (sequence), _ensure_initialized (handshake mock) |
| `adapter.py` | `test_mcp_internals`, `test_phase4` | MCPToolAdapter -- name prefixing, schema generation, dynamic args_model, required/optional fields, type mapping, _extract_content (4 formats), execute (success/errors) |
| `discovery.py` | `test_phase4` | MCPDiscovery -- server discovery |

### `src/architect/config/` -- Configuration

| Source file | Test file(s) | What is tested |
|---|---|---|
| `schema.py` | `test_config_loader`, `test_v3_m4`, `test_phase13`, `test_phase14` | AppConfig, AgentConfig, ContextConfig, MCPServerConfig, HookConfig, HooksConfig, LoggingConfig, CommandsConfig -- Pydantic validation, extra='forbid', defaults |
| `loader.py` | `test_config_loader` | deep_merge (8 tests), load_yaml_config (5), load_env_overrides (6), apply_cli_overrides (10), load_config pipeline (5), Pydantic validation in pipeline (3) |

### `src/architect/execution/` -- Execution engine

| Source file | Test file(s) | What is tested |
|---|---|---|
| `engine.py` | `test_phase1`, `test_v3_m4`, `test_parallel_execution` | ExecutionEngine -- execute, dry-run, run_post_edit_hooks, integration with hooks |
| `policies.py` | `test_phase1`, `test_parallel_execution` | ConfirmationPolicy -- yolo, confirm-all, confirm-sensitive |
| `validators.py` | `test_phase1`, `test_v3_m6` | validate_path -- path traversal prevention |

### `src/architect/costs/` -- Cost tracking

| Source file | Test file(s) | What is tested |
|---|---|---|
| `tracker.py` | `test_phase14`, `test_phase11` | CostTracker -- record, summary, format_summary_line |
| `prices.py` | `test_phase14` | PriceLoader -- per-model prices, default_prices.json |
| `__init__.py` | `test_phase14` | BudgetExceededError -- budget exceeded |

### `src/architect/agents/` -- Agents and prompts

| Source file | Test file(s) | What is tested |
|---|---|---|
| `prompts.py` | `test_v3_m3` | BUILD_PROMPT (5 phases: ANALYZE->PLAN->EXECUTE->VERIFY->CORRECT), PLAN_PROMPT, REVIEW_PROMPT, DEFAULT_PROMPTS |
| `registry.py` | `test_v3_m3`, `test_phase3` | DEFAULT_AGENTS (4 agents), get_agent (merge YAML+defaults), list_available_agents, resolve_agents_from_yaml, AgentNotFoundError, CLI overrides |

### `src/architect/indexer/` -- Repository indexer

| Source file | Test file(s) | What is tested |
|---|---|---|
| `tree.py` | `test_phase10` | RepoIndexer -- basic, excludes, file_info, languages |
| `cache.py` | `test_phase10` | IndexCache -- set/get, TTL expiration |

### `src/architect/logging/` -- Logging system

| Source file | Test file(s) | What is tested |
|---|---|---|
| `levels.py` | `test_v3_m5` | HUMAN level (25, between INFO and WARNING) |
| `human.py` | `test_v3_m5` | HumanFormatter.format_event, HumanLog methods, HumanLogHandler filtering |
| `setup.py` | `test_v3_m5`, `test_phase5` | configure_logging, dual pipeline (JSON file + stderr human), quiet mode, verbose levels |

### `src/architect/cli.py` -- CLI (Click)

| Test file(s) | What is tested |
|---|---|
| `test_phase6`, `test_phase8`, `test_v3_m3` | JSON output format, exit codes, stdout/stderr separation, CLI help, agents command, validate-config, full init without LLM, dry-run without API key, build as default |

### v4 Phase A -- Hooks, Guardrails, Skills, Memory

| Source file | Test file(s) | What is tested |
|---|---|---|
| `core/hooks.py` | `test_phase15` (29 tests) | HookEvent (10 values), HookDecision (3 values), HookResult, HookConfig, HooksRegistry (register, get_hooks, has_hooks), HookExecutor (_build_env, execute_hook, run_event with matcher/file_patterns, run_post_edit backward-compat), exit code protocol (0=ALLOW, 2=BLOCK, other=Error), async hooks, timeout |
| `core/guardrails.py` | `test_phase16` (24 tests) | GuardrailsEngine -- check_file_access (protected_files globs), check_command (blocked_commands regex), check_edit_limits (max_files/lines), check_code_rules (severity warn/block), record_command/record_edit, should_force_test, run_quality_gates (subprocess, timeout, required vs optional), state tracking |
| `skills/loader.py` | `test_phase17` (31 tests) | SkillsLoader -- load_project_context (.architect.md, AGENTS.md, CLAUDE.md), discover_skills (local + installed), _parse_skill (YAML frontmatter), get_relevant_skills (glob matching), build_system_context; SkillInfo dataclass |
| `skills/installer.py` | `test_phase17` | SkillInstaller -- install_from_github (sparse checkout), create_local (SKILL.md template), list_installed, uninstall |
| `skills/memory.py` | `test_phase18` (32 tests) | ProceduralMemory -- 6 CORRECTION_PATTERNS (direct, negation, clarification, should_be, wrong_approach, absolute_rule), detect_correction, add_correction (dedup), add_pattern, _load/_append_to_file, get_context, analyze_session_learnings |
| `config/schema.py` | `test_phase15-18`, `test_config_loader` | HookItemConfig, HooksConfig (10 events + post_edit compat), GuardrailsConfig, QualityGateConfig, CodeRuleConfig, SkillsConfig, MemoryConfig -- Pydantic validation, defaults, extra='forbid' |

### v4 Phase B -- Sessions, Reports, Dry Run, CI/CD Flags

| Source file | Test file(s) | What is tested |
|---|---|---|
| `features/sessions.py` | `test_phase_b` (B1, 8 tests), `tests/test_sessions/` (22 tests) | SessionManager -- save/load/list/cleanup/delete, SessionState round-trip, generate_session_id (format + uniqueness), message truncation (>50 -> last 30), corrupt JSON -> None, newest-first sorting, special characters, StopReason round-trip |
| `features/report.py` | `test_phase_b` (B2, 8 tests), `tests/test_reports/` (20 tests) | ExecutionReport, ReportGenerator -- to_json (parseable + all keys), to_markdown (tables + sections), to_github_pr_comment (`<details>` collapsible), status icons (OK/WARN/FAIL), zero values, empty collections, long paths, collect_git_diff |
| `features/dryrun.py` | `test_phase_b` (B4, 6 tests), `tests/test_dryrun/` (23 tests) | DryRunTracker -- record_action, get_plan_summary, action_count, WRITE_TOOLS/READ_TOOLS disjoint, _summarize_action (5 code paths), interleave read+write, complex tool_input/truncation |
| `cli.py` (B3 flags) | `test_phase_b` (B3, 5 tests) | CLI flags: --json, --dry-run, --report, --report-file, --session, --confirm-mode, --context-git-diff, --exit-code-on-partial; commands: `architect sessions`, `architect cleanup`, `architect resume NONEXISTENT` -> exit 3; exit code constants (0,1,2,3,4,5,130) |

### Base plan v4 Phase C -- Ralph Loop, Parallel, Pipelines, Checkpoints, Auto-Review

| Source file | Test file(s) | What is tested |
|---|---|---|
| `features/ralph.py` | `tests/test_ralph/` (90 tests) | RalphLoop -- full iteration, clean context per iteration, safety nets (max_iterations, max_cost, max_time), _run_checks (subprocess, exit codes), _build_iteration_prompt (with failed checks and outputs), RalphConfig dataclass, LoopIteration, RalphLoopResult, stop_reason (5 values), worktree isolation, agent_factory pattern |
| `features/pipelines.py` | `tests/test_pipelines/` (83 tests) | PipelineRunner -- sequential execution, _substitute_variables ({{name}}), _check_condition (shell exit code), _run_checks, _create_checkpoint, from_step resume, dry_run mode, PipelineConfig/PipelineStep dataclasses, PipelineStepResult, output_var capture, conditioned steps, YAML parsing |
| `features/parallel.py` | `tests/test_parallel/` (43 tests) | ParallelRunner -- _create_worktrees, _run_worker (subprocess), cleanup_worktrees, round-robin of tasks and models, WorkerResult dataclass, ParallelConfig, WORKTREE_PREFIX, ProcessPoolExecutor, error handling per worker |
| `features/checkpoints.py` | `tests/test_checkpoints/` (48 tests) | CheckpointManager -- create (git add + commit), list_checkpoints (git log --grep, format %H\|%s\|%at), rollback (git reset --hard), get_latest, has_changes_since, Checkpoint dataclass (frozen), short_hash, CHECKPOINT_PREFIX, no-changes -> None |
| `agents/reviewer.py` | `tests/test_reviewer/` (47 tests) | AutoReviewer -- review_changes (clean context, agent_factory), build_fix_prompt, get_recent_diff (subprocess git diff), ReviewResult dataclass, REVIEW_SYSTEM_PROMPT, "no issues" detection (case-insensitive), error handling (LLM failure -> ReviewResult with error), AutoReviewConfig |
| `cli.py` (C commands) | `test_phase_c_e2e.py` (31 tests) | CLI: `architect loop`, `architect pipeline`, `architect parallel`, `architect parallel-cleanup`; ralph+checks integration, pipeline+variables+conditions, parallel+worktrees, checkpoints+list+rollback, auto-review flow |

### Base plan v4 Phase D -- Dispatch, Health, Eval, Telemetry, Presets

| Source file | Test file(s) | What is tested |
|---|---|---|
| `tools/dispatch.py` | `tests/test_dispatch/` (36 tests) | DispatchSubagentTool -- DispatchSubagentArgs validation, VALID_SUBAGENT_TYPES (explore/test/review), SUBAGENT_ALLOWED_TOOLS per type, SUBAGENT_MAX_STEPS=15, SUBAGENT_SUMMARY_MAX_CHARS=1000, execute with agent_factory mock, error handling |
| `core/health.py` | `tests/test_health/` (28 tests) | CodeHealthAnalyzer -- take_before/after_snapshot, compute_delta, FunctionMetric (frozen dataclass), HealthSnapshot fields, HealthDelta.to_report() markdown, LONG_FUNCTION_THRESHOLD (50), DUPLICATE_BLOCK_SIZE (6), AST analysis without radon |
| `features/competitive.py` | `tests/test_competitive/` (19 tests) | CompetitiveEval -- CompetitiveConfig, CompetitiveResult, run() with ParallelRunner mock, _run_checks_in_worktree, _rank_results (composite score), generate_report markdown |
| `telemetry/otel.py` | `tests/test_telemetry/` (20 tests, 9 skip) | ArchitectTracer -- start_session context manager, trace_llm_call, trace_tool, NoopTracer/NoopSpan, create_tracer factory (enabled/disabled), SERVICE_NAME/SERVICE_VERSION constants. 9 tests skip if OpenTelemetry is not installed |
| `config/presets.py` | `tests/test_presets/` (37 tests) | PresetManager -- AVAILABLE_PRESETS (5), apply() generates .architect.md + config.yaml, list_presets(), overwrite behavior, preset content validation |
| (bugfixes) | `tests/test_bugfixes/` (41 tests) | BUG-3: code_rules pre-execution (11), BUG-4: dispatch wiring (5), BUG-5: telemetry wiring (8), BUG-6: health wiring (6), BUG-7: parallel config propagation (11) |

---

## Integration tests (`test_integration.py`)

60 assertions that test end-to-end flows across multiple modules:

| Section | Tests | Status | Note |
|---|:---:|:---:|---|
| 0. Prerequisites | 4 | Passed | Imports, version, tools, config |
| 1. LLM Proxy -- Direct calls | 4 | **Requires API key** | Basic completion, with tools, multiple tools, usage |
| 2. Streaming -- Real-time responses | 3 | **Requires API key** | Basic streaming, tool calls, usage info |
| 3. MCP -- Real servers | 3 | Passed | Client init, handshake mock, tool call mock |
| 4. CLI End-to-End | 5 | Passed | Help, version, agents list, validate-config, dry-run |
| 5. Config YAML -- Complex configurations | 6 | Passed | Full YAML, merge, env vars, defaults |
| 6. Safety Nets -- Watchdogs | 4 | Passed | Timeout, shutdown, max_steps, context full |
| 7. CLI + MCP -- Full flow | 3 | Passed | Config with MCP, discovery mock, tools adapter |
| 8. Post-Edit Hooks | 5 | Passed | run_for_tool, matching, truncation, disabled |
| 9. Local Tools | 8 | Passed | read/write/edit/delete/list/search/grep/find |
| 10. Context Manager | 6 | Passed | estimate_tokens, threshold, manage, summarize |
| 11. Cost Tracker | 3 | Passed | Basic tracking, budget exceeded, format line |

---

## What is NOT tested (known gaps)

These areas do not have automated coverage but are difficult to test without real infrastructure:

| Area | Reason |
|---|---|
| **Real LLM** (sections 1-2 of integration) | Requires `OPENAI_API_KEY`. Works with key, manually tested |
| **Real MCP server** (live HTTP) | Requires an MCP server running. `test_phase4` tests with mocks; `test_mcp_internals` tests internals exhaustively |
| **Full agent loop** (LLM -> Tools -> LLM) | Requires API key for the complete cycle. Individual parts are tested separately |
| **Real streaming over network** | `test_streaming.py` tests with full generator mocks; real streaming requires API key |
| **Real SIGINT/SIGTERM** | `test_phase7` tests GracefulShutdown in isolation; real signals on a live process are fragile in CI |

> All internal functions, parsing, validation, security, and decision logic are covered without needing external credentials.

---

## QA -- v0.16.1

After v4 Phase A implementation, a complete QA process was performed:

1. All 25 test scripts were run (597 original + 116 new)
2. 5 bugs were detected and fixed:
   - `CostTracker.format_summary_line()` -- AttributeError due to incorrectly referenced field
   - `PriceLoader._load_prices()` -- dict access with `get()` vs `[]` on nested keys
   - `HUMAN` log level -- double registration of the level in `logging.addLevelName()`
   - `HumanFormatter._summarize_args()` -- `ValueError` in `.index()` for strings without separator
   - `CommandTool` -- incorrect reference to `args.timeout` vs `args.timeout_seconds`
3. 5 test scripts were updated to use `EXPECTED_VERSION = "0.16.1"`
4. Final result: **713 tests passing**, 7 expected failures (require API key)

## QA -- v0.17.0

After v4 Phase B implementation:

1. `scripts/test_phase_b.py` was created with ~35 tests and ~104 checks
2. Unit tests pytest were created: `tests/test_sessions/` (22), `tests/test_reports/` (20), `tests/test_dryrun/` (23)
3. 4 bugs were detected and fixed (QA3):
   - `GuardrailsEngine.check_command()` -- redirect output should not be blocked
   - `ReportGenerator.to_markdown()` -- duration in timeline not calculated
   - Hardcoded version in tests -- now read dynamically from `__init__.py`
   - `_execute_tool_calls_batch` -- parallel execution timeout in CI
4. Final result: **~817+ tests passing** (scripts) + **~181 tests pytest** (unit)

## QA -- v0.18.0 (Base plan v4 Phase C)

After Phase C implementation:

1. Unit tests pytest were created: `tests/test_ralph/` (90), `tests/test_pipelines/` (83), `tests/test_checkpoints/` (48), `tests/test_reviewer/` (47), `tests/test_parallel/` (43)
2. `scripts/test_phase_c_e2e.py` was created with 31 E2E tests (C1-C5 + combined)
3. 3 bugs were detected and fixed (QA4):
   - **BUG-1**: `RalphLoop` executed iterations sharing context -- fixed to create a FRESH agent per iteration via `agent_factory`
   - **BUG-2**: `ParallelRunner._create_worktrees()` did not isolate correctly -- fixed to use git worktree with dedicated branches
   - **BUG-3**: `CheckpointManager.list_checkpoints()` incorrectly parsed the `git log` format -- fixed pipe-separated format `%H|%s|%at`
4. Final result: **~848 tests passing** (scripts) + **504 tests pytest** (unit) + **31 E2E** (Phase C)

## QA -- v0.19.0 / v1.0.0 (Base plan v4 Phase D)

After Phase D implementation:

1. Unit tests pytest were created: `tests/test_dispatch/` (36), `tests/test_health/` (28), `tests/test_competitive/` (19), `tests/test_telemetry/` (20, 9 skip), `tests/test_presets/` (37)
2. 7 bugs were detected and fixed (QA-D):
   - **BUG-1 (CRITICAL)**: `@cli.command` -> `@main.command` for `eval` and `init` -- broke CLI module import
   - **BUG-2 (MEDIUM)**: Inconsistent version between `pyproject.toml`, `__init__.py`, and `cli.py`
   - **BUG-3 (HIGH)**: `code_rules` severity:block did not prevent writes -- was executing AFTER write. Fix: moved to pre-execution
   - **BUG-4 (MEDIUM)**: `dispatch_subagent` tool existed but was not registered in CLI run
   - **BUG-5 (MEDIUM)**: `TelemetryConfig` parsed but `create_tracer()` never called
   - **BUG-6 (MEDIUM)**: `HealthConfig` parsed but `CodeHealthAnalyzer` never invoked
   - **BUG-7 (MEDIUM)**: Parallel workers did not propagate `--config` or `--api-base`
3. 41 specific bug validation tests were created in `tests/test_bugfixes/test_bugfixes.py`
4. Final result: **687 pytest passed**, 9 skipped, 0 failures + **31 E2E** + **~848 scripts**

---

## How to run

```bash
# All tests (without API key)
for f in scripts/test_*.py; do python3.12 "$f"; done

# A specific test
python3.12 scripts/test_phase13.py

# With API key (for complete integration tests)
OPENAI_API_KEY=sk-... python3.12 scripts/test_integration.py
```

All scripts are standalone: they do not require pytest, use internal `ok()`/`fail()`/`section()` helpers, and return exit code 0 (all OK) or 1 (there are failures).
