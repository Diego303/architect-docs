---
title: "Ralph Loop"
description: "Automatic iteration with checks: RalphConfig, RalphLoop, clean context, worktrees."
icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
order: 20
---

# Ralph Loop — Automatic Iteration with Checks

The Ralph Loop runs an agent iteratively until a set of verifications (checks) pass. Each iteration receives a **completely clean context** — it does not carry over history from previous iterations.

---

## Concept

The Ralph Loop pattern solves a common problem: running an agent that modifies code and then verifying that the modifications are correct (tests, lint, type check). If the checks fail, the agent must try again with information about the errors.

```
Iteración 1:  Agent → modifica código → checks fallan (test error en line 42)
Iteración 2:  Agent → recibe error + diff → corrige → checks fallan (lint warning)
Iteración 3:  Agent → recibe error + diff → corrige → checks pasan ✓
```

The key is the **clean context**: each iteration creates a completely new `AgentLoop`. The agent only receives:

1. The original spec (file or prompt)
2. The accumulated diff from all previous iterations
3. The check errors from the previous iteration
4. An auto-generated `progress.md` with the history

This avoids context contamination and allows long iterations without degradation.

---

## Basic usage

```bash
# Iterate until tests pass
architect loop "implementa autenticación JWT" \
  --check "pytest tests/test_auth.py"

# Multiple checks — ALL must pass
architect loop "refactoriza el módulo de pagos" \
  --check "pytest tests/" \
  --check "ruff check src/" \
  --check "mypy src/"
```

### With spec file

For complex tasks, you can define the specification in a Markdown file:

```bash
architect loop "implementar según spec" \
  --spec requirements/auth-spec.md \
  --check "pytest tests/test_auth.py" \
  --check "ruff check src/auth/"
```

The spec file content is injected into the prompt of each iteration instead of the `TASK` argument text.

### With isolated worktree

```bash
architect loop "migrar de SQLAlchemy a Tortoise ORM" \
  --check "pytest tests/" \
  --worktree \
  --max-iterations 10
```

With `--worktree`, the loop creates an isolated git worktree (`.architect-ralph-worktree`). If all checks pass, the result includes the path to the worktree for inspection or manual merge.

---

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--check CMD` | (required) | Shell verification command. Repeatable. All must pass (exit 0) |
| `--spec PATH` | — | Specification file. Used instead of the TASK argument |
| `--max-iterations N` | 25 | Maximum iterations before stopping |
| `--max-cost FLOAT` | — | Cost limit in USD. Stops if exceeded |
| `--max-time INT` | — | Total time limit in seconds |
| `--completion-tag TAG` | `COMPLETE` | Tag the agent must emit when it considers the task finished |
| `--agent NAME` | `build` | Agent to use in each iteration |
| `--model MODEL` | — | LLM model (config override) |
| `-c, --config PATH` | — | YAML configuration file |
| `--worktree` | `false` | Run in an isolated git worktree |
| `--quiet` | `false` | Final result only, no iteration logs |

---

## How it works internally

### Execution flow

```
architect loop "task" --check "pytest" --check "ruff check src/"
  │
  ├── 1. Capturar ref inicial: git rev-parse HEAD → initial_ref
  ├── 2. (Opcional) Crear worktree: .architect-ralph-worktree
  │
  ├── LOOP:
  │   ├── 3. Construir prompt limpio (_build_iteration_prompt)
  │   │       ├── Spec/task original
  │   │       ├── Instrucciones de iteración (nº, checks, completion_tag)
  │   │       ├── Diff acumulado: git diff <initial_ref> (truncado 5000 chars)
  │   │       ├── Errores de checks previos (truncado 2000 chars/check)
  │   │       └── Contenido de .architect/ralph-progress.md
  │   │
  │   ├── 4. agent_factory() → AgentLoop fresco
  │   ├── 5. agent.run(prompt) → AgentState
  │   │
  │   ├── 6. _run_checks() → ejecutar cada check como subprocess
  │   │       └── subprocess.run(cmd, shell=True, timeout=120, cwd=workspace)
  │   │
  │   ├── 7. _update_progress() → escribir iteración a .architect/ralph-progress.md
  │   │
  │   ├── 8. ¿Todos los checks pasaron Y completion_tag encontrado?
  │   │       ├── SÍ → success, salir del loop
  │   │       └── NO → ¿Safety nets?
  │   │               ├── max_iterations alcanzado → stop
  │   │               ├── max_cost superado → stop
  │   │               ├── max_time excedido → stop
  │   │               └── Continuar al siguiente iteration
  │   └── (vuelve a 3)
  │
  ├── 9. (Opcional) Resultado incluye worktree_path
  └── 10. Retornar RalphLoopResult
```

### Clean context per iteration

Each iteration invokes `agent_factory()` which creates a completely new `AgentLoop`. No state is shared between iterations:

- New `ContextBuilder` (no previous messages)
- New `CostTracker` (cost is accumulated externally)
- New `ExecutionEngine` with fresh guardrails

The only thing connecting iterations is the **filesystem** (modified files persist) and the **prompt** (which includes the accumulated diff and errors).

### Checks

Checks are shell commands executed as subprocesses:

```python
subprocess.run(cmd, shell=True, capture_output=True, timeout=120, cwd=workspace_root)
```

- **Exit code 0** = check passed
- **Any other exit code** = check failed
- **Timeout** (120s by default) = check failed with "Timeout" message
- The output (stdout + stderr) is truncated to the last 2000 characters
- Checks are executed in the workspace directory (or worktree)

### Progress file

After each iteration, `.architect/ralph-progress.md` is written:

```markdown
## Iteración 1 — FAIL
- Steps: 8
- Coste: $0.0234
- Duración: 15.2s
- Checks:
  - pytest tests/: PASS
  - ruff check src/: FAIL — src/auth.py:42:1: F841 local variable 'x' is assigned to but never used

## Iteración 2 — PASS
- Steps: 3
- Coste: $0.0089
- Duración: 5.1s
- Checks:
  - pytest tests/: PASS
  - ruff check src/: PASS
```

This file is included in the prompt of subsequent iterations so the agent has visibility into the progress.

---

## Safety nets

The loop stops automatically if any of these conditions are met:

| Condition | Configuration | Behavior |
|-----------|---------------|----------|
| Iterations | `--max-iterations 25` | Stops after N iterations without success |
| Cost | `--max-cost 5.0` | Stops if accumulated cost exceeds the limit |
| Time | `--max-time 600` | Stops if total duration exceeds N seconds |

The result (`RalphLoopResult`) indicates the stop reason in `stop_reason`:
- `"all_checks_passed"` — all checks passed (success)
- `"max_iterations"` — iterations exhausted
- `"budget_exhausted"` — budget exceeded
- `"timeout"` — maximum time exceeded

---

## Worktrees

With `--worktree`, the loop creates an isolated git worktree:

1. **Creation**: `git worktree add -b architect/ralph-loop .architect-ralph-worktree HEAD`
2. **Execution**: All iterations work in the worktree
3. **Result**: If checks pass, `result.worktree_path` contains the path

The worktree is not automatically removed — you can inspect it, cherry-pick, or merge manually:

```bash
# See what changed
cd .architect-ralph-worktree
git diff HEAD~1

# Merge to main branch
git checkout main
git merge architect/ralph-loop

# Clean up manually
git worktree remove .architect-ralph-worktree
git branch -D architect/ralph-loop
```

---

## YAML configuration

```yaml
ralph_loop:
  max_iterations: 25        # 1-100
  max_cost: null             # USD, null = no limit
  max_time: null             # seconds, null = no limit
  completion_tag: "COMPLETE" # tag the agent emits
  agent: build               # default agent
```

---

## Python API

### RalphConfig

```python
@dataclass
class RalphConfig:
    task: str                           # Task description
    checks: list[str]                   # Verification commands (must return exit 0)
    spec_file: str | None = None        # Specification file (replaces task in prompt)
    completion_tag: str = "COMPLETE"     # Completion tag
    max_iterations: int = 25            # Maximum iterations
    max_cost: float | None = None       # USD limit
    max_time: int | None = None         # Time limit in seconds
    agent: str = "build"                # Agent to use
    model: str | None = None            # LLM model
    use_worktree: bool = False          # Use git worktree
```

### RalphLoop

```python
class RalphLoop:
    def __init__(
        self,
        config: RalphConfig,
        agent_factory: Callable[..., Any],  # (**kwargs) → AgentLoop
        workspace_root: str | None = None,
    ) -> None: ...

    def run(self) -> RalphLoopResult: ...
    def cleanup_worktree(self) -> bool: ...
    def cleanup_progress(self) -> None: ...
```

### RalphLoopResult

```python
@dataclass
class RalphLoopResult:
    iterations: list[LoopIteration]     # All iterations
    total_cost: float = 0.0             # Accumulated cost in USD
    total_duration: float = 0.0         # Total duration in seconds
    success: bool = False               # True if checks passed
    stop_reason: str = ""               # "all_checks_passed", "max_iterations", etc.
    worktree_path: str = ""             # Path to worktree (if used)

    @property
    def total_iterations(self) -> int: ...
```

### LoopIteration

```python
@dataclass
class LoopIteration:
    iteration: int                      # Number (1-based)
    steps_taken: int                    # Agent steps
    cost: float                         # USD cost of this iteration
    duration: float                     # Duration in seconds
    check_results: list[dict]           # [{name, passed, output}]
    all_checks_passed: bool             # True if all passed
    completion_tag_found: bool          # True if the agent emitted the tag
    error: str | None = None            # Execution error (if any)
```

---

## Advanced examples

### Loop with budget and timeout

```bash
architect loop "implementa feature X según la spec" \
  --spec spec.md \
  --check "pytest tests/ -x" \
  --check "ruff check src/" \
  --max-iterations 10 \
  --max-cost 3.0 \
  --max-time 600 \
  --model gpt-4o
```

### Loop in CI/CD

```yaml
# GitHub Actions
- name: Implementar y verificar
  run: |
    architect loop "${{ github.event.issue.body }}" \
      --spec spec.md \
      --check "pytest tests/ -q" \
      --check "ruff check src/" \
      --max-iterations 5 \
      --max-cost 2.0 \
      --quiet
```

### Loop with worktree for experimentation

```bash
# Run in isolated worktree
architect loop "migra a async/await" \
  --check "pytest tests/" \
  --worktree \
  --max-iterations 15

# If successful, inspect and merge
git diff main...architect/ralph-loop
git merge architect/ralph-loop
```
