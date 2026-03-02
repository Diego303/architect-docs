---
title: "Dry Run"
description: "Execution simulation: DryRunTracker, WRITE_TOOLS/READ_TOOLS, action plan."
icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
order: 19
---

# Dry Run — Execution Simulation

The `--dry-run` mode lets you preview what the agent would do without executing real changes. Read tools work normally, but write tools are simulated and recorded in an action plan.

---

## Usage

```bash
# Preview what the agent would do
architect run "refactor auth.py" --dry-run

# Combine with other flags
architect run "migrate tests to pytest" --dry-run --mode yolo --show-costs
```

The agent interacts normally with the LLM, reads files, searches code. But when it tries to write, edit, or execute commands, it receives `[DRY-RUN] Would execute: tool_name(args)`.

---

## How it works

### Write tools (simulated)

`WRITE_TOOLS` (frozenset): `write_file`, `edit_file`, `apply_patch`, `delete_file`, `run_command`

These tools **are not executed** in dry-run. Instead:
1. The `DryRunTracker` records the action (`PlannedAction`)
2. `ToolResult(success=True, "[DRY-RUN] ...")` is returned
3. The LLM continues planning with the information it has

### Read tools (executed normally)

`READ_TOOLS` (frozenset): `read_file`, `list_files`, `search_code`, `grep`, `find_files`

These are executed normally so the agent can analyze code and plan.

The `WRITE_TOOLS` and `READ_TOOLS` sets are disjoint by design.

---

## DryRunTracker — data model

```python
@dataclass
class PlannedAction:
    tool_name:   str      # tool name
    description: str      # human-readable description of the action
    tool_input:  dict     # original tool arguments

class DryRunTracker:
    actions: list[PlannedAction]

    def record_action(self, tool_name: str, tool_input: dict) -> None: ...
    def get_plan_summary(self) -> str: ...    # formatted summary
    @property
    def action_count(self) -> int: ...
```

### `_summarize_action(tool_name, tool_input)`

Generates readable descriptions with 5 code paths:

| Case | Example description |
|------|-------------------|
| Tool with `path` | `write_file → src/main.py` |
| Tool with short `command` | `run_command → pytest tests/` |
| Tool with long `command` | `run_command → pytest tests/test_a... (truncated)` |
| Tool with other keys | `edit_file → old_str, new_str, path` |
| Tool with no arguments | `delete_file → (no arguments)` |

---

## Plan summary

`get_plan_summary()` generates a readable summary:

```
Action plan (dry-run): 3 planned actions

1. write_file → tests/test_auth.py
2. edit_file → src/auth.py
3. run_command → pytest tests/ -x
```

If there are no actions: `"Dry-run complete: no write actions were planned."`

---

## Integration with reports

If `--report` and `--dry-run` are used together, the report includes planned actions instead of actually modified files. The `files_modified` field in the report is populated from the actions recorded by the `DryRunTracker`.

---

## Files

- **Module**: `src/architect/features/dryrun.py`
- **Tests**: `tests/test_dryrun/` (23 tests) + `scripts/test_phase_b.py` section B4 (6 tests, 18 checks)
