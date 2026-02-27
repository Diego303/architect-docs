---
title: "Sub-Agents"
description: "Sub-task delegation (explore/test/review) with isolated context and limited tools."
icon: "M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
order: 25
---

# Sub-Agents (Dispatch Subagent)

System for delegating sub-tasks to specialized agents with isolated context.

Implemented in `src/architect/tools/dispatch.py`. Available since v1.0.0 (Base plan v4 Phase D — D1).

---

## Concept

The main agent (`build`) can delegate sub-tasks to specialized agents via the `dispatch_subagent` tool. Each sub-agent runs in a fresh `AgentLoop` with:

- **Isolated context**: does not share the main agent's history
- **Limited tools**: each sub-agent type has a restricted set of tools
- **Strict limits**: maximum 15 steps, summary truncated to 1000 characters

This allows the main agent to delegate exploration, testing, or review tasks without contaminating its own context or consuming too much budget.

---

## Sub-agent types

| Type | Available tools | Typical use |
|------|----------------|-------------|
| `explore` | `read_file`, `list_files`, `search_code`, `grep`, `find_files` | Investigate code, search for patterns, explore structure |
| `test` | Explore + `run_command` | Run tests, verify behavior, run linters |
| `review` | `read_file`, `list_files`, `search_code`, `grep`, `find_files` | Review code, quality analysis, find bugs |

---

## How it works

```
AgentLoop (build)
  │
  ├─ LLM decides: dispatch_subagent(type="explore", task="find all REST endpoints")
  │
  ├─ _subagent_factory() → creates fresh AgentLoop
  │     ├─ Tools: only those for the selected type
  │     ├─ Max steps: 15
  │     ├─ Confirm mode: yolo
  │     └─ Context: only the sub-task prompt
  │
  ├─ Sub-agent executes and returns summary
  │     └─ Truncated to 1000 chars to avoid inflating context
  │
  └─ AgentLoop (build) continues with the information
```

---

## API

### `DispatchSubagentTool`

Tool registered as `dispatch_subagent` in the `ToolRegistry`.

```python
class DispatchSubagentArgs(BaseModel):
    agent_type: str    # "explore" | "test" | "review"
    task: str          # Description of the sub-task
    context: str = ""  # Additional context (relevant files, etc.)
```

### Constants

```python
SUBAGENT_MAX_STEPS = 15
SUBAGENT_SUMMARY_MAX_CHARS = 1000
VALID_SUBAGENT_TYPES = {"explore", "test", "review"}

SUBAGENT_ALLOWED_TOOLS = {
    "explore": ["read_file", "list_files", "search_code", "grep", "find_files"],
    "test": ["read_file", "list_files", "search_code", "grep", "find_files", "run_command"],
    "review": ["read_file", "list_files", "search_code", "grep", "find_files"],
}
```

### `register_dispatch_tool()`

```python
# In tools/setup.py
def register_dispatch_tool(
    registry: ToolRegistry,
    workspace_config: WorkspaceConfig,
    agent_factory: Callable[..., AgentLoop],
) -> None:
```

Called from `cli.py` after creating the main `AgentLoop`. Receives an `agent_factory` which is a closure capturing all necessary components (LLM, config, registry, guardrails, etc.).

---

## Wiring in CLI

The dispatch is connected in `cli.py` via a closure:

```python
def _subagent_factory(
    agent: str = "build",
    max_steps: int = 15,
    allowed_tools: list[str] | None = None,
    **kw,
) -> AgentLoop:
    """Creates a fresh AgentLoop for sub-agents."""
    sub_agent_config = get_agent(agent, config.agents, {"max_steps": max_steps})
    if allowed_tools:
        sub_agent_config.allowed_tools = list(allowed_tools)
    sub_engine = ExecutionEngine(
        registry, config, confirm_mode="yolo", guardrails=guardrails_engine,
    )
    sub_ctx = ContextBuilder(repo_index=repo_index, context_manager=ContextManager(config.context))
    return AgentLoop(llm, sub_engine, sub_agent_config, sub_ctx, ...)

register_dispatch_tool(registry, config.workspace, _subagent_factory)
```

---

## Security

- Sub-agents of type `explore` and `review` are **read-only** — they have no access to write/edit/delete/run_command
- The `test` type can execute commands but inherits the guardrails of the main agent
- Each sub-agent operates in `yolo` mode (no confirmations) but with the same security restrictions (path validation, command blocklist)
- The summary is truncated to 1000 characters — prevents a sub-agent from injecting excessive content

---

## Best practices

1. **Use `explore` for investigation** before implementing — does not contaminate the builder's context
2. **Use `test` to verify** changes — the sub-agent runs tests and reports results
3. **Do not overuse**: each sub-agent consumes additional LLM steps — use only when the main task benefits from delegation
4. **Minimal context**: pass in `context` only the relevant information (paths, function names)

---

## Files

| File | Contents |
|------|----------|
| `src/architect/tools/dispatch.py` | `DispatchSubagentTool`, `DispatchSubagentArgs`, constants |
| `src/architect/tools/setup.py` | `register_dispatch_tool()` |
| `src/architect/cli.py` | `_subagent_factory()` closure, wiring |
| `tests/test_dispatch/test_dispatch.py` | 36 unit tests |
| `tests/test_bugfixes/test_bugfixes.py` | BUG-4 tests (wiring) |
