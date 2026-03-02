---
title: "Agents and Modes"
description: "Agent system, registry, execution modes, skills, and memory."
icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
order: 7
---

# Agent system and execution modes

---

## Default agents

Defined in `agents/registry.py` as `DEFAULT_AGENTS: dict[str, AgentConfig]`.

| Agent | Available tools | confirm_mode | max_steps | Purpose |
|-------|----------------|--------------|-----------|---------|
| `plan` | `read_file`, `list_files`, `search_code`, `grep`, `find_files` | `yolo` | 20 | Analyzes the task and generates a structured plan. Read-only. (v3: yolo because plan does not modify files) |
| `build` | all tools (filesystem + editing + search + `run_command` + `dispatch_subagent`) | `confirm-sensitive` | 50 | Executes tasks: creates and modifies files with full tooling. Can delegate sub-tasks to sub-agents. |
| `resume` | `read_file`, `list_files`, `search_code`, `grep`, `find_files` | `yolo` | 15 | Reads and summarizes information. Read-only, no confirmations. |
| `review` | `read_file`, `list_files`, `search_code`, `grep`, `find_files` | `yolo` | 20 | Reviews code and provides feedback. Read-only, no confirmations. |

The search tools (`search_code`, `grep`, `find_files`) are available to all agents since F10. The `build` agent has additional access to `edit_file` and `apply_patch` for incremental editing, and `dispatch_subagent` (v1.0.0) for delegating sub-tasks to specialized agents with isolated context (types: explore, test, review). See [`dispatch-subagent.md`](/architect-docs/en/docs/v1-1-0/dispatch-subagent).

---

## System prompts (`agents/prompts.py`)

> **v1.1.0**: The default agent prompts are resolved **lazily** via the i18n system. This means that `DEFAULT_PROMPTS["build"]` returns the prompt in the configured language (`language` in config). Resolution happens at runtime, not at import-time, allowing the language to be changed after importing the module. See [`i18n.md`](/architect-docs/en/docs/v1-1-0/i18n).

### `PLAN_PROMPT`
- Role: analyst and planner.
- **Never executes actions** — its output is the plan, not the changes.
- Expected output format: `## Summary / ## Steps / ## Affected Files / ## Considerations`.
- Includes a search tool guide (when to use `search_code` vs `grep` vs `find_files`).
- Ideal for: understanding the scope of a task before executing it.

### `BUILD_PROMPT`
- Role: careful executor.
- Flow: reads the code first, then modifies, then verifies.
- **Explicit editing hierarchy**:
  1. `edit_file` — single contiguous block change (preferred).
  2. `apply_patch` — multiple changes or pre-existing diff.
  3. `write_file` — new files or complete reorganizations.
- Incremental and conservative changes.
- On completion: summarizes the changes made.
- Ideal for: creating, modifying, or refactoring code.

### `RESUME_PROMPT`
- Role: read-only analyst.
- Never modifies files.
- Structured output with bullets.
- Can use `search_code` to find specific implementations.
- Ideal for: quickly understanding a project.

### `REVIEW_PROMPT`
- Role: constructive code reviewer.
- Prioritizes issues: critical / important / minor.
- Categories: bugs, security, performance, clean code.
- Never modifies files.
- Can use `grep` to search for problematic patterns across the project.
- Ideal for: auditing code quality.

---

## Agent registry — agent resolution

`agents/registry.py` defines how an agent is resolved given its name.

### Merge precedence (lowest to highest):

```
1. DEFAULT_AGENTS[name]          (if name exists in defaults)
2. YAML override (config.agents) (only specified fields)
3. CLI overrides (--mode, --max-steps)
```

The merge is selective: `model_copy(update=yaml.model_dump(exclude_unset=True))`. Only fields explicitly defined in the YAML are overwritten; the rest are kept from the default.

### `get_agent(name, yaml_agents, cli_overrides)` -> `AgentConfig | None`

```python
# Returns None if name is None -> mixed mode
# Raises AgentNotFoundError if name does not exist in defaults or YAML

config = DEFAULT_AGENTS.get(name) or _build_from_yaml(name, yaml_agents)
config = _merge_agent_config(config, yaml_agents.get(name))
config = _apply_cli_overrides(config, cli_overrides)
return config
```

### Fully custom agent (YAML only)

```yaml
agents:
  deploy:
    system_prompt: |
      You are a specialized deployment agent.
      Verify tests, review CI/CD, generate a report before acting.
    allowed_tools:
      - read_file
      - list_files
      - search_code
      - write_file
    confirm_mode: confirm-all
    max_steps: 15
```

### Partial override of a default

```yaml
agents:
  build:
    confirm_mode: confirm-all   # only changes this; max_steps, tools, prompt = defaults
```

---

## Execution modes

### Single-agent — default mode

The `build` agent is used by default if `-a` is not specified. With `-a name` any other agent can be selected.

```
AgentLoop(llm, engine, agent_config, ctx, shutdown, step_timeout, context_manager, cost_tracker, timeout)
  +- run(prompt, stream, on_stream_chunk)
```

The specified agent executes the prompt directly. The `engine` uses the agent's `confirm_mode` (unless `--mode` overrides it).

### Mixed mode (without `-a`) — legacy

No longer the default mode since v0.15.0 (v3-M3). The `build` agent is used directly as the default.

If mixed mode plan->build is needed, `MixedModeRunner` can be invoked programmatically, but the CLI no longer uses it as the default. For a plan->build flow from the CLI, run `-a plan` first and then `-a build`.

```
MixedModeRunner(llm, engine, plan_config, build_config, context_builder,
                shutdown, step_timeout, context_manager, cost_tracker)
  +- run(prompt, stream, on_stream_chunk)
       |
       +- PHASE 1: plan (no streaming, yolo)
       |     plan_loop.run(prompt, stream=False)
       |     -> plan_state.final_output = "## Steps\n1. Read main.py\n2. ..."
       |
       +- if plan fails -> return plan_state
       +- if shutdown -> return plan_state
       |
       +- PHASE 2: build (with streaming, confirm-sensitive)
             enriched_prompt = f"""
             The user asked: {prompt}

             Generated plan:
             ---
             {plan_state.final_output}
             ---
             Your job is to execute this plan step by step.
             Use the available tools to complete each step.
             """
             build_loop.run(enriched_prompt, stream=True, ...)
```

The plan enriches the build agent's context. The build agent does not start from scratch — it already knows what to do and in what order.

**Important note**: In mixed mode, **two separate `AgentLoop` instances** are created but they share the same `ExecutionEngine`. Each loop uses its own `AgentConfig` (plan or build), which determines the available tools and confirm_mode.

The `ContextManager` is **shared** between both phases to maintain coherent context accounting. The `CostTracker` is shared between both phases so the budget is global. The `SelfEvaluator` is applied to the final result of the `build_loop`.

---

## Tool selection by agent

`AgentConfig.allowed_tools` filters which tools from the registry are available:

```python
tools_schema = registry.get_schemas(agent_config.allowed_tools or None)
# [] or None -> all registered tools
# ["read_file", "list_files", "search_code"] -> only those three
```

If the LLM tries to call an unpermitted tool (e.g., `edit_file` when it only has `read_file`), the `ExecutionEngine` rejects it with `ToolNotFoundError` converted to `ToolResult(success=False)`. The error is returned to the LLM as a tool message, and the LLM can adapt its strategy.

### Tools available by agent (with aliases)

```
Agent plan / resume / review:
  + read_file       — read any file
  + list_files      — list directory
  + search_code     — search with regex in code
  + grep            — search literal text
  + find_files      — search files by name

Agent build (+ all of the above):
  + write_file      — create or overwrite files
  + edit_file       — incremental editing (str-replace)
  + apply_patch     — apply unified diff
  + delete_file     — delete (requires allow_delete=true)
  + run_command     — execute system commands (F13)

Custom agents: explicitly defined in allowed_tools

MCP tools (auto-injected from v0.16.2):
  + mcp_{server}_{tool}  — automatically discovered from MCP servers
```

**Note on MCP tools**: Discovered MCP tools are automatically injected into the active agent's `allowed_tools`. There is no need to list them manually. If the agent has explicit `allowed_tools`, MCP tools are appended at the end.

---

## Agent listing (`architect agents`)

The `architect agents` subcommand shows all available agents:

```bash
$ architect agents
Available agents:
  plan    [yolo]              Analyzes and plans without executing
  build   [confirm-sensitive] Creates and modifies workspace files
  resume  [yolo]              Reads and summarizes project information
  review  [yolo]              Reviews code and generates feedback

$ architect agents -c config.yaml
Available agents:
  plan    [yolo]              Analyzes and plans without executing
  build * [confirm-all]       Creates and modifies workspace files  <- override
  resume  [yolo]              Reads and summarizes project information
  review  [yolo]              Reviews code and generates feedback
  deploy  [confirm-all]       Custom deployment agent
```

The `*` indicates that agent has a YAML override (some field from the default was overwritten).

---

## Indexer and system prompt (F10)

When the `RepoIndexer` is enabled (`indexer.enabled=true`), the `ContextBuilder` automatically injects the project tree into each agent's system prompt:

```
You are a specialized build agent...

## Project Structure

Workspace: /home/user/my-project
Files: 47 files | 3,241 lines

Languages: Python (23), YAML (8), Markdown (6), JSON (4)

src/
+-- architect/
|   +-- cli.py              Python    412 lines
|   +-- config/
|   |   +-- loader.py       Python    156 lines
|   |   +-- schema.py       Python    220 lines
|   +-- core/
|       +-- context.py      Python    287 lines
|       +-- evaluator.py    Python    387 lines
|       +-- loop.py         Python    201 lines
+-- tests/
    +-- test_core.py        Python     89 lines
```

This allows the agent to know the project structure **before reading any file**, reducing the number of `list_files` calls and improving plan quality.

For repositories with > 300 files, a compact view grouped by root directory is used to avoid saturating the system prompt.

---

## Context injected into system prompt (Base Plan v4 Phase A)

Starting from v0.16.0, each agent's system prompt can receive additional context from three sources:

### 1. Skills and project context

The `SkillsLoader` looks for `.architect.md`, `AGENTS.md`, or `CLAUDE.md` at the workspace root and injects it as `# Project Instructions`. Additionally, skills in `.architect/skills/` whose `globs` match active files are injected as `# Skill: {name}`.

### 2. Procedural memory

If `memory.enabled: true`, the content of `.architect/memory.md` is injected into the system prompt. This includes user corrections automatically detected in previous sessions.

### 3. Hooks and guardrails in the pipeline

Lifecycle hooks (`HookExecutor`) and guardrails (`GuardrailsEngine`) are integrated into the `ExecutionEngine`, not the system prompt. Guardrails are evaluated before each tool call, and pre/post hooks are executed around each action. See `tools-and-execution.md` for the complete 10-step pipeline.
