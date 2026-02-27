---
title: "Competitive Evaluation"
description: "Multi-model comparison with ranking by quality, efficiency, and cost."
icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
order: 27
---

# Competitive Evaluation (Competitive Eval)

Automated comparison of multiple LLM models executing the same task, with ranking based on quality, efficiency, and cost.

Implemented in `src/architect/features/competitive.py`. Available since v1.0.0 (Base plan v4 Phase D — D3).

---

## Concept

`architect eval` runs the same task with multiple models in parallel (each in an isolated git worktree) and then runs the same validation checks on each worktree. It generates a comparative ranking based on a composite score.

```bash
architect eval "implement JWT authentication" \
  --models gpt-4o,claude-sonnet-4-6,gemini-2.0-flash \
  --check "pytest tests/test_auth.py -q" \
  --check "ruff check src/" \
  --budget-per-model 1.0
```

---

## How it works

```
architect eval TASK --models m1,m2,m3 --check "cmd1" --check "cmd2"
  │
  ├── Create CompetitiveConfig
  │     └── task, models, checks, agent, max_steps, budget, timeout
  │
  ├── CompetitiveEval.run()
  │     ├── ParallelRunner (reuses parallel infrastructure)
  │     │     └── Each model → git worktree → `architect run` as subprocess
  │     │
  │     ├── For each resulting worktree:
  │     │     └── _run_checks_in_worktree(checks) → (passed, total)
  │     │
  │     └── _rank_results() → calculate composite score
  │
  ├── CompetitiveEval.generate_report()
  │     └── Markdown table with ranking
  │
  └── Display report (stdout or --report-file)
```

---

## Scoring system

The composite score is out of **100 points**:

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Checks passed | 40 pts | `(checks_passed / checks_total) * 40` |
| Status | 30 pts | success=30, partial=15, timeout=5, failed=0 |
| Efficiency | 20 pts | Fewer steps = higher score (normalized) |
| Cost | 10 pts | Lower cost = higher score (normalized) |

---

## CLI

```
architect eval PROMPT [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--models LIST` | Comma-separated models (required) |
| `--check CMD` | Verification command (repeatable, required) |
| `--agent NAME` | Agent to use (default: `build`) |
| `--max-steps N` | Maximum steps per model (default: 50) |
| `--budget-per-model N` | Cost limit per model in USD |
| `--timeout-per-model N` | Time limit per model in seconds |
| `--report-file PATH` | Save report to file |
| `--config PATH` | YAML configuration file |
| `--api-base URL` | LLM API base URL |

### Examples

```bash
# Compare 3 models with checks
architect eval "refactor utils.py" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat \
  --check "pytest tests/ -q" \
  --check "ruff check src/" \
  --budget-per-model 0.50

# Save report
architect eval "optimize SQL queries" \
  --models gpt-4o,claude-sonnet-4-6 \
  --check "pytest" \
  --report-file eval_report.md

# With strict timeout
architect eval "implement feature" \
  --models gpt-4o-mini,claude-sonnet-4-6 \
  --check "pytest tests/" \
  --timeout-per-model 300 \
  --max-steps 30
```

---

## API

### `CompetitiveConfig`

```python
@dataclass
class CompetitiveConfig:
    task: str
    models: list[str]
    checks: list[str]
    agent: str = "build"
    max_steps: int = 50
    budget_per_model: float | None = None
    timeout_per_model: int | None = None
    config_path: str | None = None
    api_base: str | None = None
```

### `CompetitiveResult`

```python
@dataclass
class CompetitiveResult:
    model: str
    status: str               # success | partial | failed | timeout
    steps: int
    cost: float
    duration: float
    files_modified: list[str]
    checks_passed: int
    checks_total: int
    worktree_path: str
    score: float              # composite score (0-100)
```

### `CompetitiveEval`

```python
class CompetitiveEval:
    def __init__(self, config: CompetitiveConfig, workspace_root: str): ...
    def run(self) -> list[CompetitiveResult]: ...
    def generate_report(self, results: list[CompetitiveResult]) -> str: ...
```

---

## Generated report

The report includes:

1. **Comparison table**: model, status, steps, cost, time, checks passed, files modified
2. **Ranking**: sorted by composite score (1st, 2nd, 3rd place)
3. **Check results**: detail per model
4. **Worktree paths**: for manual inspection of each result

```markdown
## Ranking

| # | Model | Score | Status | Steps | Cost | Checks |
|---|-------|-------|--------|-------|------|--------|
| 1 | gpt-4o | 85.0 | success | 12 | $0.42 | 3/3 |
| 2 | claude-sonnet-4-6 | 78.5 | success | 15 | $0.38 | 2/3 |
| 3 | deepseek-chat | 45.0 | partial | 30 | $0.12 | 1/3 |
```

---

## Relationship with Parallel

`CompetitiveEval` reuses the `ParallelRunner` infrastructure (git worktrees + ProcessPoolExecutor). The difference is that:

- `parallel` runs **different tasks** (or the same task) with possibly different models
- `eval` runs the **same task** with **different models** and adds validation with checks + ranking

---

## Files

| File | Contents |
|------|----------|
| `src/architect/features/competitive.py` | `CompetitiveEval`, `CompetitiveConfig`, `CompetitiveResult` |
| `src/architect/cli.py` | `architect eval` command |
| `tests/test_competitive/` | Unit tests |
