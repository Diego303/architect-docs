---
title: "Parallel Execution"
description: "Multiple agents in worktrees: ParallelRunner, workers, round-robin models."
icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
order: 22
---

# Parallel Execution -- Multiple Agents in Worktrees

Run multiple tasks in parallel, each in an isolated git worktree with complete independence.

---

## Concept

Parallel execution allows launching several agents simultaneously, each working in an isolated copy of the repository (git worktree). This is useful for:

- Running the same task with different models and comparing results
- Dividing independent work among parallel workers
- Experimenting with multiple approaches simultaneously

Each worker runs as a subprocess (`architect run --json --confirm-mode yolo`) in its own worktree, with complete file isolation.

---

## Usage

```bash
# Same task with 3 different models (model competition)
architect parallel "optimize the project's SQL queries" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat

# Different tasks in parallel
architect parallel \
  --task "add tests to src/auth.py" \
  --task "add tests to src/users.py" \
  --task "add tests to src/billing.py" \
  --workers 3

# With budget and timeout per worker
architect parallel \
  --task "refactor payments module" \
  --task "refactor users module" \
  --budget-per-worker 2.0 \
  --timeout-per-worker 300
```

---

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `TASK` | -- | Task as positional argument |
| `--task CMD` | -- | Task (repeatable). Assigned round-robin to workers |
| `--workers N` | 3 | Number of parallel workers |
| `--models CSV` | -- | Comma-separated models (round-robin among workers) |
| `--agent NAME` | `build` | Agent to use in all workers |
| `--budget-per-worker FLOAT` | -- | USD limit per worker |
| `--timeout-per-worker INT` | -- | Timeout in seconds per worker |
| `--quiet` | `false` | Only final result |

---

## Worktrees

Each worker runs in an independent git worktree:

```
.
├── src/                          # Original repository (untouched)
├── .architect-parallel-1/        # Worker 1
├── .architect-parallel-2/        # Worker 2
└── .architect-parallel-3/        # Worker 3
```

Worktrees are created automatically before execution:
1. Branch: `architect/parallel-{N}`
2. Path: `.architect-parallel-{N}`
3. Base: current branch (HEAD)

### Cleanup

Worktrees **are not removed automatically** -- you can inspect them afterward:

```bash
# View active worktrees
git worktree list

# Clean up all parallel worktrees
architect parallel-cleanup

# Or manually
git worktree remove .architect-parallel-1
git branch -D architect/parallel-1
```

---

## Task and model assignment

### One task, multiple models

```bash
architect parallel "optimize performance" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat
```

| Worker | Task | Model |
|--------|-------|--------|
| 1 | optimize performance | gpt-4o |
| 2 | optimize performance | claude-sonnet-4-6 |
| 3 | optimize performance | deepseek-chat |

### Multiple tasks

```bash
architect parallel \
  --task "tests for auth" \
  --task "tests for users" \
  --task "tests for billing" \
  --workers 3
```

| Worker | Task | Model |
|--------|-------|--------|
| 1 | tests for auth | default |
| 2 | tests for users | default |
| 3 | tests for billing | default |

### Round-robin

If there are more workers than tasks, the first task is repeated. If there are more workers than models, extra workers use the default model.

---

## Result

Each worker produces a `WorkerResult`:

```python
@dataclass
class WorkerResult:
    worker_id: int              # 1-based
    branch: str                 # "architect/parallel-1"
    model: str                  # Model used
    status: str                 # "success", "partial", "failed", "timeout"
    steps: int                  # Agent steps
    cost: float                 # USD cost
    duration: float             # Seconds
    files_modified: list[str]   # Changed files
    worktree_path: str          # Path to worktree
```

---

## YAML configuration

```yaml
parallel_runs:
  workers: 3               # 1-10
  agent: build              # Default agent
  max_steps: 50             # Steps per worker
  budget_per_worker: null    # USD per worker
  timeout_per_worker: null   # Seconds per worker
```

---

## CI/CD example

```yaml
# GitHub Actions -- multiple tasks in parallel
- name: Generate tests in parallel
  run: |
    architect parallel \
      --task "generate tests for src/auth.py" \
      --task "generate tests for src/users.py" \
      --task "generate tests for src/api.py" \
      --workers 3 \
      --budget-per-worker 1.0 \
      --timeout-per-worker 300

- name: Clean up worktrees
  if: always()
  run: architect parallel-cleanup
```
