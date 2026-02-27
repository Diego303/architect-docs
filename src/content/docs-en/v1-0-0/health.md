---
title: "Code Health Delta"
description: "Before/after code quality metrics analysis: complexity, duplicates, long functions."
icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
order: 26
---

# Code Health Delta

Automatic analysis of code quality metrics before and after an execution.

Implemented in `src/architect/core/health.py`. Available since v1.0.0 (Base plan v4 Phase D — D2).

> **Requirement**: For precise cyclomatic complexity metrics, install the `health` extra:
> ```bash
> pip install architect-ai-cli[health]
> ```
> Without this extra, complexity is estimated using a simplified AST count (less precise).

---

## Concept

The `CodeHealthAnalyzer` takes a snapshot of Python code metrics at the start of execution and another at the end. The delta between them shows whether the agent's changes improved or degraded code quality.

```
architect run "refactor utils.py" --health
```

At the end of execution, a report is shown on stderr:

```
## Code Health Delta

| Metric               | Before | After | Delta |
|----------------------|--------|-------|-------|
| Files analyzed       | 12     | 12    | =     |
| Total functions      | 45     | 43    | -2    |
| Average complexity   | 4.2    | 3.8   | -0.4  |
| Maximum complexity   | 12     | 8     | -4    |
| Long functions       | 3      | 1     | -2    |
| Duplicate blocks     | 5      | 3     | -2    |
```

---

## Metrics analyzed

### Cyclomatic complexity

If `radon` is installed (`pip install radon`), the real cyclomatic complexity of each function is calculated. Without radon, a simplified AST count (branches + loops) is used.

### Long functions

Functions with more than **50 lines** (configurable threshold via `LONG_FUNCTION_THRESHOLD`).

### Complex functions

Functions with cyclomatic complexity greater than **10** (configurable threshold via `COMPLEX_FUNCTION_THRESHOLD`).

### Code duplication

Detection of duplicate blocks using a sliding window of **6 lines** (configurable via `DUPLICATE_BLOCK_SIZE`). Each window is hashed with MD5 and collisions are detected.

### Function count

Total functions in the project, including new and removed ones.

---

## API

### `CodeHealthAnalyzer`

```python
class CodeHealthAnalyzer:
    def __init__(
        self,
        workspace_root: str,
        include_patterns: list[str] = ["**/*.py"],
        exclude_dirs: list[str] | None = None,
    ): ...

    def take_before_snapshot(self) -> HealthSnapshot: ...
    def take_after_snapshot(self) -> HealthSnapshot: ...
    def compute_delta(self) -> HealthDelta | None: ...
```

### `HealthSnapshot`

```python
@dataclass
class HealthSnapshot:
    files_analyzed: int
    total_functions: int
    avg_complexity: float
    max_complexity: int
    long_functions: int        # > LONG_FUNCTION_THRESHOLD lines
    duplicate_blocks: int      # duplicate code blocks
    functions: list[FunctionMetric]
```

### `HealthDelta`

```python
@dataclass
class HealthDelta:
    before: HealthSnapshot
    after: HealthSnapshot

    def to_report(self) -> str:
        """Generates a markdown report with a comparison table."""
```

### `FunctionMetric`

```python
@dataclass(frozen=True)
class FunctionMetric:
    file: str
    name: str
    lines: int
    complexity: int
```

### Constants

```python
LONG_FUNCTION_THRESHOLD = 50      # lines
COMPLEX_FUNCTION_THRESHOLD = 10   # cyclomatic complexity
DUPLICATE_BLOCK_SIZE = 6          # lines per block
```

---

## Configuration

### CLI flag

```bash
architect run "task" --health
```

### YAML config

```yaml
health:
  enabled: true                    # enable automatically (no need for --health flag)
  include_patterns: ["**/*.py"]    # file patterns to analyze
  exclude_dirs:                    # directories to exclude
    - .git
    - venv
    - __pycache__
    - node_modules
```

### Optional dependency

```bash
# For precise cyclomatic complexity
pip install radon

# Or install with the extra
pip install architect-ai-cli[health]
```

Without `radon`, the analysis works but uses a simplified AST count for complexity.

---

## Execution flow

```
CLI: architect run "..." --health
  |
  +-- --health flag OR config.health.enabled?
  |     +-- Yes: create CodeHealthAnalyzer
  |
  +-- health_analyzer.take_before_snapshot()
  |     +-- Scans all .py files in workspace
  |
  +-- AgentLoop.run(prompt)
  |     +-- ... normal agent execution ...
  |
  +-- health_analyzer.take_after_snapshot()
  |
  +-- delta = health_analyzer.compute_delta()
  |
  +-- click.echo(delta.to_report(), err=True)
        +-- Markdown report to stderr
```

---

## Files

| File | Contents |
|---------|-----------|
| `src/architect/core/health.py` | `CodeHealthAnalyzer`, `HealthSnapshot`, `HealthDelta`, `FunctionMetric` |
| `src/architect/config/schema.py` | `HealthConfig` (Pydantic model) |
| `src/architect/cli.py` | `--health` flag, wiring before/after snapshots |
| `tests/test_health/test_health.py` | 28 unit tests |
| `tests/test_bugfixes/test_bugfixes.py` | BUG-6 tests (wiring) |
