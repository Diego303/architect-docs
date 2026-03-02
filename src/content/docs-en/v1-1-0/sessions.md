---
title: "Sessions"
description: "Session persistence and resume: save, list, resume, and clean up between runs."
icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
order: 17
---

# Sessions -- Persistence and Resume

The session system allows saving, listing, resuming, and cleaning up the agent state between runs.

---

## How it works

The agent automatically saves its state after each step in `.architect/sessions/<session_id>.json`. If a run is interrupted (Ctrl+C, timeout, budget exceeded, error), you can resume it where it left off.

```
.architect/
└── sessions/
    ├── 20260223-143022-a1b2c3.json
    ├── 20260223-151045-d4e5f6.json
    └── ...
```

Each file contains: session ID, original task, agent, model, status, completed steps, messages (LLM history), modified files, accumulated cost, timestamps, and stop reason.

---

## Commands

### `architect sessions` -- list sessions

```bash
architect sessions
```

Displays a table with all saved sessions:

```
ID                     Status       Steps  Cost    Task
20260223-143022-a1b2   interrupted  12     $1.23   refactor the entire auth module
20260223-151045-d4e5   success      8      $0.45   add tests to user.py
20260223-160000-f7g8   partial      25     $2.00   migrate the database
```

### `architect resume` -- resume session

```bash
architect resume 20260223-143022-a1b2
```

Loads the complete session state (messages, modified files, accumulated cost) and continues where it left off. If the ID does not exist, it exits with exit code 3 (`EXIT_CONFIG_ERROR`).

### `architect cleanup` -- clean up old sessions

```bash
architect cleanup                  # removes sessions > 7 days (default)
architect cleanup --older-than 30  # removes sessions > 30 days
```

### `--session` flag in `architect run`

```bash
architect run "continue the task" --session 20260223-143022-a1b2
```

Equivalent to `architect resume`, but allows combining with other `architect run` flags.

---

## Message truncation

Sessions with more than 50 messages are automatically truncated when saving: the last 30 messages are kept and `truncated: true` is marked in the metadata. This prevents sessions from growing indefinitely on disk.

---

## Configuration

```yaml
sessions:
  auto_save: true           # save state after each step (default: true)
  cleanup_after_days: 7     # days after which `cleanup` removes (default: 7)
```

---

## SessionState -- data model

```python
@dataclass
class SessionState:
    session_id:     str              # format: YYYYMMDD-HHMMSS-hexhex
    task:           str              # original user prompt
    agent:          str              # agent name (build, plan, etc.)
    model:          str              # LLM model used
    status:         str              # running, success, partial, failed
    steps_completed: int             # executed steps
    messages:       list[dict]       # LLM message history
    files_modified: list[str]        # files touched during the session
    total_cost:     float            # accumulated cost in USD
    started_at:     str              # ISO 8601 timestamp
    updated_at:     str              # ISO 8601 timestamp (updated on each save)
    stop_reason:    str | None       # stop reason (llm_done, timeout, etc.)
    metadata:       dict             # arbitrary additional data
```

Methods: `to_dict()` / `from_dict()` for JSON serialization.

### SessionManager

```python
class SessionManager:
    def __init__(self, workspace_root: str): ...
    def save(self, state: SessionState) -> None: ...        # saves to .architect/sessions/
    def load(self, session_id: str) -> SessionState | None: ...  # None if not found or corrupt JSON
    def list_sessions(self) -> list[dict]: ...               # summary metadata, newest first
    def cleanup(self, older_than_days: int = 7) -> int: ...  # returns count of deleted
    def delete(self, session_id: str) -> bool: ...
```

### generate_session_id

```python
def generate_session_id() -> str:
    # Format: YYYYMMDD-HHMMSS-hexhex
    # Example: 20260223-143022-a1b2c3
    # Uniqueness guaranteed by timestamp + random hex
```

---

## Resume flow

```
1. architect resume SESSION_ID
2. SessionManager.load(SESSION_ID)
3. Reconstruct AgentState from SessionState
4. Inject messages, accumulated cost, modified files
5. AgentLoop.run() continues from the last step
6. Session is re-saved with each additional step
```

---

## Usage patterns

### Long tasks with limited budget

```bash
# First run -- stops due to budget
architect run "refactor the entire auth module" --budget 1.00

# View sessions
architect sessions

# Continue with more budget
architect resume 20260223-143022-a1b2 --budget 2.00
```

### CI with persistence between runs

```bash
# Run 1: implement
architect run "implement feature X" --mode yolo --json > result.json
SESSION=$(jq -r '.session_id // empty' result.json)

# Run 2: verify and continue if it was partial
if [ "$(jq -r '.status' result.json)" = "partial" ]; then
  architect resume "$SESSION" --mode yolo --budget 1.00
fi
```

### Periodic cleanup

```bash
# Weekly cron job
architect cleanup --older-than 7
```

---

## Files

- **Module**: `src/architect/features/sessions.py`
- **Config**: `SessionsConfig` in `src/architect/config/schema.py`
- **CLI**: `architect sessions`, `architect resume`, `architect cleanup` in `src/architect/cli.py`
- **Tests**: `tests/test_sessions/` (22 tests) + `scripts/test_phase_b.py` section B1 (8 tests, 24 checks)
