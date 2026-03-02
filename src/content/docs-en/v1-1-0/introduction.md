---
title: "Introduction"
description: "Index of the technical documentation for the Architect v1.1.0 project."
icon: "M19 11H5m14 0-7-7m7 7-7 7"
order: 1
---

# Technical Documentation — architect CLI

Index of the project's internal documentation. Aimed at developers and AIs who need to understand, modify, or extend the system.

---

## Files

| File | Content |
|------|---------|
| [`usage.md`](/architect-docs/en/docs/v1-1-0/usage) | **Usage guide**: flags, logging, configs, CI/CD, scripts, custom agents, multi-project |
| [`architecture.md`](/architect-docs/en/docs/v1-1-0/architecture) | High-level overview, component diagram, and full execution flow |
| [`core-loop.md`](/architect-docs/en/docs/v1-1-0/core-loop) | The while True loop, safety nets, StopReason, graceful close, hooks lifecycle, human logging, ContextManager, parallel tools, SelfEvaluator |
| [`data-models.md`](/architect-docs/en/docs/v1-1-0/data-models) | All data models: Pydantic, dataclasses, error hierarchy |
| [`tools-and-execution.md`](/architect-docs/en/docs/v1-1-0/tools-and-execution) | Tool system: filesystem, editing, search, MCP, ExecutionEngine |
| [`agents-and-modes.md`](/architect-docs/en/docs/v1-1-0/agents-and-modes) | Default agents, registry, system prompts |
| [`config-reference.md`](/architect-docs/en/docs/v1-1-0/config-reference) | Complete configuration schema, precedence, environment variables |
| [`logging.md`](/architect-docs/en/docs/v1-1-0/logging) | **Logging system**: 3 pipelines, HUMAN level, icons, HumanFormatter, structlog |
| [`ai-guide.md`](/architect-docs/en/docs/v1-1-0/ai-guide) | AI guide: critical invariants, patterns, where to add things, pitfalls |
| [`testing.md`](/architect-docs/en/docs/v1-1-0/testing) | Test map: ~817+ tests in 30+ files, coverage by module |
| [`containers.md`](/architect-docs/en/docs/v1-1-0/containers) | **Containers**: Containerfiles (root, non-root, OpenShift), Kubernetes Deployments, Docker, CI/CD configuration |
| [`casos-de-uso.md`](/architect-docs/en/use-cases/) | **Use cases**: integration into daily development, CI/CD, QA, DevOps, AIOps, MLOps, MCP architectures, multi-agent pipelines |
| [`fast-usage.md`](/architect-docs/en/docs/v1-1-0/fast-usage) | **Quick start guide**: installation, minimal setup, most useful commands, and flag reference |
| [`mcp-server.md`](/architect-docs/en/docs/v1-1-0/mcp-server) | **MCP Server**: how to create an MCP server that exposes architect as a remote tool (complete server.py + tools.py) |
| [`good-practices.md`](/architect-docs/en/docs/v1-1-0/good-practices) | **Best practices**: prompts, agents, editing, costs, hooks lifecycle, guardrails, skills, memory, self-evaluation, CI/CD, common mistakes |
| [`security.md`](/architect-docs/en/docs/v1-1-0/security) | **Security model**: 22 defensive layers, threat model, path traversal, command security, sensitive file protection, prompt injection, hardening |
| [`sessions.md`](/architect-docs/en/docs/v1-1-0/sessions) | **Sessions**: persistence and resume — save, list, resume, and clean up sessions between runs |
| [`reports.md`](/architect-docs/en/docs/v1-1-0/reports) | **Reports**: execution reports in JSON, Markdown, and GitHub PR comment for CI/CD |
| [`dryrun.md`](/architect-docs/en/docs/v1-1-0/dryrun) | **Dry Run**: execution simulation — DryRunTracker, WRITE_TOOLS/READ_TOOLS, action plan |
| [`ralph-loop.md`](/architect-docs/en/docs/v1-1-0/ralph-loop) | **Ralph Loop**: automatic iteration with checks — RalphConfig, RalphLoop, clean context, worktrees, safety nets |
| [`pipelines.md`](/architect-docs/en/docs/v1-1-0/pipelines) | **Pipelines**: multi-step YAML workflows — {{name}} variables, conditions, output_var, checkpoints, dry-run, from-step |
| [`parallel.md`](/architect-docs/en/docs/v1-1-0/parallel) | **Parallel**: parallel execution in git worktrees — ParallelRunner, workers, round-robin models |
| [`checkpoints.md`](/architect-docs/en/docs/v1-1-0/checkpoints) | **Checkpoints**: git restore points — CheckpointManager, rollback, pipeline integration |
| [`auto-review.md`](/architect-docs/en/docs/v1-1-0/auto-review) | **Auto-Review**: post-build review with clean context — AutoReviewer, ReviewResult, fix-pass |
| [`dispatch-subagent.md`](/architect-docs/en/docs/v1-1-0/dispatch-subagent) | **Sub-Agents**: sub-task delegation (explore/test/review) with isolated context and limited tools |
| [`health.md`](/architect-docs/en/docs/v1-1-0/health) | **Code Health Delta**: before/after quality metrics analysis (complexity, duplicates, long functions) |
| [`eval.md`](/architect-docs/en/docs/v1-1-0/eval) | **Competitive Evaluation**: multi-model comparison with ranking by quality, efficiency, and cost |
| [`telemetry.md`](/architect-docs/en/docs/v1-1-0/telemetry) | **OpenTelemetry Traces**: session, LLM, and tool spans — OTLP, console, JSON file exporters |
| [`presets.md`](/architect-docs/en/docs/v1-1-0/presets) | **Presets**: project initialization with predefined configurations (python, node-react, ci, paranoid, yolo) |
| [`troubleshooting.md`](/architect-docs/en/docs/v1-1-0/troubleshooting) | **Troubleshooting**: symptom-based diagnosis — LLM errors, loops, tools, hooks, guardrails, advanced features, exit codes |
| [`extending.md`](/architect-docs/en/docs/v1-1-0/extending) | **Extensibility**: create custom tools, agents, lifecycle hooks, skills, guardrails — with complete examples |
| [`ci-cd-integration.md`](/architect-docs/en/docs/v1-1-0/ci-cd-integration) | **CI/CD**: complete recipes for GitHub Actions, GitLab CI, Jenkins — review bots, auto-fix, pipelines, secrets, costs |
| [`cost-management.md`](/architect-docs/en/docs/v1-1-0/cost-management) | **Cost management**: CostTracker, per-model pricing, budgets, prompt caching, local cache, optimization strategies |
| [`prompt-engineering.md`](/architect-docs/en/docs/v1-1-0/prompt-engineering) | **Prompt Engineering**: writing effective prompts, .architect.md, skills, anti-patterns, recipes by agent |
| [`i18n.md`](/architect-docs/en/docs/v1-1-0/i18n) | **Internationalization**: multi-language support (English and Spanish), lazy resolution, ~160 keys, how to add a new language |

---

## Quick Summary

**architect** is a headless CLI that connects an LLM to filesystem tools (and optionally to remote MCP servers). The user describes a task in natural language; the system iterates: calls the LLM -> the LLM decides which tools to use -> the tools execute -> the results go back to the LLM -> next iteration.

```
architect run "refactor main.py" -a build --mode yolo
         |
         +- load_config()         YAML + env + CLI flags
         +- configure_logging()   3 pipelines: HUMAN + technical + JSON file
         +- ToolRegistry          local tools + remote MCP
         +- RepoIndexer           workspace tree -> system prompt
         +- LLMAdapter            LiteLLM + selective retries + prompt caching + local cache
         +- ContextManager        context pruning (3 levels)
         +- CostTracker           cost tracking + budget enforcement
         +- SkillsLoader          .architect.md + skills -> system prompt context
         +- ProceduralMemory      user corrections -> .architect/memory.md
         +- SessionManager        session persistence in .architect/sessions/
         +- DryRunTracker         action recording in --dry-run mode
         +- CheckpointManager     git commits with rollback (architect:checkpoint)
         +- ArchitectTracer       OpenTelemetry spans (session/llm/tool) or NoopTracer
         +- CodeHealthAnalyzer    before/after quality metrics (--health)
         |
         +- RalphLoop             automatic iteration until checks pass
         +- PipelineRunner        multi-step YAML workflows with variables
         +- ParallelRunner        parallel execution in git worktrees
         +- CompetitiveEval       comparative multi-model evaluation (architect eval)
         +- AutoReviewer          post-build review with clean context
         +- PresetManager         .architect.md + config.yaml generation (architect init)
         +- DispatchSubagentTool  sub-task delegation (explore/test/review)
         |
         +- AgentLoop (build by default)        while True + safety nets
         |       |
         |       +- [check safety nets]   max_steps / budget / timeout / context_full -> StopReason
         |       +- [check shutdown]      SIGINT/SIGTERM -> graceful close
         |       +- [StepTimeout]         SIGALRM per step
         |       +- llm.completion()      -> streaming chunks to stderr
         |       +- cost_tracker.record() -> step cost; BudgetExceededError if exceeded
         |       +- engine.execute()      -> guardrails -> pre-hooks -> validate -> confirm -> tool -> post-hooks
         |       |       +- GuardrailsEngine   -> check_file_access / check_command / check_edit_limits
         |       |       +- HookExecutor       -> pre_tool_use (BLOCK/ALLOW) + post_tool_use (lint/etc)
         |       |       +- PostEditHooks      -> backward-compat v3-M4
         |       +- HumanLog              -> HUMAN events (25) to stderr (separate pipeline)
         |       +- ctx.append_results()  -> next iteration
         |       +- context_mgr.prune()   -> truncate/summarize/window
         |       +- session_mgr.save()    -> save state after each step (B1)
         |       +- _graceful_close()     -> last LLM call without tools (summary)
         |
         +- SelfEvaluator (optional, --self-eval)
                 +- evaluate_basic() / evaluate_full()

         +- ReportGenerator (optional, --report json|markdown|github)
                 +- to_json() / to_markdown() / to_github_pr_comment()
```

**Stack**: Python 3.12+, Click, Pydantic v2, LiteLLM, httpx, structlog, tenacity.

**Current version**: 1.1.0

---

## Version History (v0.9-v1.1.0)

| Version | Functionality |
|---------|---------------|
| v0.9.0 | `edit_file` (incremental str-replace) + `apply_patch` (unified diff) |
| v0.10.0 | `RepoIndexer` (project tree in system prompt) + `search_code`, `grep`, `find_files` |
| v0.11.0 | `ContextManager` (3-level pruning) + parallel tool calls (ThreadPoolExecutor) |
| v0.12.0 | `SelfEvaluator` (self-evaluation) + `--self-eval basic/full` |
| v0.13.0 | `RunCommandTool` (code execution) + 4 security layers + `--allow-commands/--no-commands` |
| v0.14.0 | `CostTracker` + `PriceLoader` + `LocalLLMCache` + prompt caching + `--budget/--show-costs/--cache` |
| v0.15.0 | `while True` loop (v3) + `StopReason` enum + `PostEditHooks` + `HUMAN` log level + `HumanLog` + graceful close + `build` as default agent |
| v0.15.2 | `HumanFormatter` with icons + MCP distinction + `llm_response` event + cost in completion |
| v0.15.3 | Fix structlog pipeline: `wrap_for_formatter` always active, human logging works without `--log-file` |
| v0.16.0 | **v4 Phase A**: `HookExecutor` (10 lifecycle events, exit code protocol), `GuardrailsEngine` (protected files, blocked commands, edit limits, quality gates), `SkillsLoader` + `SkillInstaller` (.architect.md, SKILL.md, glob activation), `ProceduralMemory` (correction detection, persistence) |
| v0.16.1 | QA Phase A: 5 bug fixes, 116 new tests (713 total), updated scripts |
| v0.16.2 | QA2: streaming costs fix, yolo mode fix, timeout separation, MCP tools auto-injection, defensive get_schemas |
| v0.17.0 | **v4 Phase B**: `SessionManager` (save/load/resume/cleanup), `ReportGenerator` (JSON/Markdown/GitHub PR), `DryRunTracker` (action plan), CI/CD flags (`--report`, `--session`, `--context-git-diff`, `--exit-code-on-partial`), exit codes (0-5, 130), new commands (`sessions`, `resume`, `cleanup`) |
| v0.18.0 | **Base Plan v4 Phase C**: `RalphLoop` (automatic iteration with checks, clean context, worktrees), `PipelineRunner` (multi-step YAML workflows with variables, conditions, checkpoints), `ParallelRunner` (parallel execution in git worktrees), `CheckpointManager` (git commits with rollback), `AutoReviewer` (post-build review with clean context), 4 new commands (`loop`, `pipeline`, `parallel`, `parallel-cleanup`) |
| v0.19.0 | **Base Plan v4 Phase D**: `DispatchSubagentTool` (explore/test/review sub-agents), `CodeHealthAnalyzer` (quality delta with `--health`), `CompetitiveEval` (`architect eval` multi-model), `ArchitectTracer` (OpenTelemetry spans), `PresetManager` (`architect init` with 5 presets), 7 QA bugfixes |
| **v1.0.0** | **Stable release** — First public version. Culmination of Base Plan v4 (Phases A+B+C+D). 15 CLI commands, 11+ tools, 4 agents, 687 tests. |
| **v1.0.1** | Bugfixes: test fixes and general post-release bug corrections. |
| **v1.1.0** | **Sensitive file protection**: new `sensitive_files` field in guardrails that blocks read+write of files with secrets (`.env`, `*.pem`, `*.key`). Shell read detection (`cat/head/tail`). 717 tests. |
