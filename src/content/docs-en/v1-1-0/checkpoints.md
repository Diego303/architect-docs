---
title: "Checkpoints"
description: "Git-based restore points: CheckpointManager, rollback, pipeline integration."
icon: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
order: 23
---

# Checkpoints & Rollback

Git commit-based restore points that allow reverting to a previous workspace state.

---

## Concept

Checkpoints are git commits with the prefix `architect:checkpoint`. They are created automatically in pipelines (with `checkpoint: true`) and can be listed and restored through `CheckpointManager`.

```
architect:checkpoint:step-1           ← After the first step
architect:checkpoint:step-2           ← After the second step
architect:checkpoint:implement        ← Pipeline step "implement"
```

---

## Usage in Pipelines

```yaml
steps:
  - name: implement
    prompt: "Implementa la feature"
    checkpoint: true
    # → git add -A && git commit -m "architect:checkpoint:implement"

  - name: optimize
    prompt: "Optimiza el rendimiento"
    checkpoint: true
```

Each step with `checkpoint: true` executes:
1. `git add -A` — stage all changes
2. `git commit -m "architect:checkpoint:<step_name>"` — commit with prefix

---

## Listing checkpoints

```bash
git log --oneline --grep="architect:checkpoint"
```

Output:
```
def5678 architect:checkpoint:optimize
abc1234 architect:checkpoint:implement
```

---

## Python API

### CheckpointManager

```python
class CheckpointManager:
    def __init__(self, workspace_root: str) -> None: ...

    def create(self, step: int, message: str = "") -> Checkpoint | None:
        """Creates a checkpoint. Returns None if there are no changes."""

    def list_checkpoints(self) -> list[Checkpoint]:
        """Lists checkpoints (most recent first)."""

    def rollback(self, step: int | None = None, commit: str | None = None) -> bool:
        """Rolls back to a checkpoint. Uses git reset --hard."""

    def get_latest(self) -> Checkpoint | None:
        """Gets the most recent checkpoint."""

    def has_changes_since(self, commit_hash: str) -> bool:
        """Checks if there are changes since a commit."""
```

### Checkpoint

```python
@dataclass(frozen=True)
class Checkpoint:
    step: int                          # Step number
    commit_hash: str                   # Full git hash
    message: str                       # Descriptive message
    timestamp: float                   # Unix timestamp
    files_changed: list[str]           # Modified files

    def short_hash(self) -> str:       # First 7 characters
```

### Constant

```python
CHECKPOINT_PREFIX = "architect:checkpoint"
```

---

## YAML configuration

```yaml
checkpoints:
  enabled: false              # true = enable automatic checkpoints in AgentLoop
  every_n_steps: 5            # Create checkpoint every N steps (1-50)
```

---

## Manual rollback

```bash
# View checkpoints
git log --oneline --grep="architect:checkpoint"

# Revert to a specific checkpoint
git reset --hard <commit_hash>
```

**Caution**: `git reset --hard` discards all uncommitted changes.
