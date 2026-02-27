---
title: "Reports"
description: "Execution reports in JSON, Markdown, and GitHub PR comment for CI/CD."
icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
order: 18
---

# Reports — Execution Reports

Generates detailed reports of what the agent did in three formats: JSON (for CI/CD), Markdown (for documentation), and GitHub PR comment (with collapsible sections).

---

## Usage

```bash
# JSON report — ideal for CI/CD pipelines
architect run "add tests to user.py" --mode yolo --report json

# Markdown report — for documentation or review
architect run "refactor utils" --mode yolo --report markdown --report-file report.md

# GitHub PR comment — with collapsible sections
architect run "review the changes" --mode yolo --report github --report-file pr-comment.md
```

### Flags

| Flag | Description |
|------|-------------|
| `--report FORMAT` | Report format: `json`, `markdown`, `github` |
| `--report-file PATH` | Save report to file (if not specified, goes to stdout) |

---

## Formats

### JSON (`--report json`)

Parseable by `jq` and CI tools. Contains all structured data.

```json
{
  "task": "add tests to user.py",
  "agent": "build",
  "model": "gpt-4o",
  "status": "success",
  "duration_seconds": 45.2,
  "steps": 8,
  "total_cost": 0.0342,
  "stop_reason": null,
  "files_modified": [
    {"path": "tests/test_user.py", "action": "created", "lines_added": 42, "lines_removed": 0}
  ],
  "quality_gates": [
    {"name": "tests", "passed": true, "output": "8 passed in 1.2s"}
  ],
  "errors": [],
  "git_diff": "diff --git a/tests/test_user.py ...",
  "timeline": [
    {"step": 1, "tool": "read_file", "duration": 0.1, "cost": 0.002},
    {"step": 2, "tool": "write_file", "duration": 0.3, "cost": 0.015}
  ]
}
```

### Markdown (`--report markdown`)

Readable format with tables and sections.

```markdown
# Execution Report

## Summary

| Field | Value |
|-------|-------|
| Task | add tests to user.py |
| Agent | build |
| Model | gpt-4o |
| Status | OK |
| Duration | 45.2s |
| Steps | 8 |
| Cost | $0.0342 |

## Files Modified

| Path | Action | +Lines | -Lines |
|------|--------|--------|--------|
| tests/test_user.py | created | 42 | 0 |

## Quality Gates

| Gate | Status |
|------|--------|
| tests | PASS |

## Timeline

| Step | Tool | Duration | Cost |
|------|------|----------|------|
| 1 | read_file | 0.1s | $0.002 |
| 2 | write_file | 0.3s | $0.015 |
```

### GitHub PR comment (`--report github`)

Optimized for GitHub with collapsible `<details>` sections. Long details (timeline, diff) are collapsed by default.

```markdown
## OK Execution Report

**Task**: add tests to user.py
**Status**: success | **Steps**: 8 | **Cost**: $0.0342

<details>
<summary>Files Modified (1)</summary>

| Path | Action | +Lines | -Lines |
|------|--------|--------|--------|
| tests/test_user.py | created | 42 | 0 |

</details>

<details>
<summary>Timeline (8 steps)</summary>
...
</details>
```

---

## Status icons

| Status | Markdown | GitHub |
|--------|----------|--------|
| `success` | OK | OK |
| `partial` | WARN | WARN |
| `failed` | FAIL | FAIL |

---

## Git Diff

`collect_git_diff(workspace_root)` runs `git diff HEAD` to capture changes made by the agent. The diff is truncated to 50KB to avoid huge reports. If the workspace is not a git repository or there are no changes, it returns `None`.

---

## ExecutionReport — data model

```python
@dataclass
class ExecutionReport:
    task:             str
    agent:            str
    model:            str
    status:           str                    # success, partial, failed
    duration_seconds: float
    steps:            int
    total_cost:       float
    stop_reason:      str | None = None
    files_modified:   list[dict] = field(default_factory=list)
    quality_gates:    list[dict] = field(default_factory=list)
    errors:           list[str]  = field(default_factory=list)
    git_diff:         str | None = None
    timeline:         list[dict] = field(default_factory=list)
```

### ReportGenerator

```python
class ReportGenerator:
    def __init__(self, report: ExecutionReport): ...
    def to_json(self) -> str: ...                  # Full JSON
    def to_markdown(self) -> str: ...              # Markdown with tables
    def to_github_pr_comment(self) -> str: ...     # GitHub with <details>
```

---

## CI/CD Integration

### GitHub Actions — report as PR comment

```yaml
- name: Run architect with report
  run: |
    architect run "review the PR changes" \
      --mode yolo \
      --context-git-diff origin/main \
      --report github \
      --report-file pr-report.md \
      --budget 2.00

- name: Comment on PR
  if: always()
  run: gh pr comment ${{ github.event.pull_request.number }} --body-file pr-report.md
```

### GitLab CI — report as artifact

```yaml
architect-report:
  script:
    - architect run "..." --mode yolo --report json --report-file report.json
  artifacts:
    paths: [report.json]
    expire_in: 1 week
```

### Parsing JSON report in scripts

```bash
# Check status
STATUS=$(jq -r '.status' report.json)

# Count modified files
FILES=$(jq '.files_modified | length' report.json)

# Check quality gates
GATES_PASSED=$(jq '[.quality_gates[] | select(.passed)] | length' report.json)
```

---

## Files

- **Module**: `src/architect/features/report.py`
- **CLI**: `--report` and `--report-file` flags in `src/architect/cli.py`
- **Tests**: `tests/test_reports/` (20 tests) + `scripts/test_phase_b.py` section B2 (8 tests, 24 checks)
