---
title: "Auto-Review"
description: "Post-build review with clean context: AutoReviewer, ReviewResult, fix-pass."
icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
order: 24
---

# Auto-Review — Automatic Post-Build Review

Reviewer agent with clean context that inspects changes made by the builder.

---

## Concept

After a builder agent completes its work, the Auto-Reviewer receives **only** the diff of the changes and the original task — with no builder history. This clean context enables an unbiased review.

The reviewer has exclusive access to read-only tools (it cannot modify files). It looks for:

1. Logic bugs and uncovered edge cases
2. Security issues (SQL injection, XSS, secrets, etc.)
3. Violations of project conventions
4. Simplification opportunities
5. Missing tests

If it finds issues, it can generate a fix prompt for the builder to resolve them in a second pass.

---

## Configuration

```yaml
auto_review:
  enabled: true                    # Enable post-build auto-review
  review_model: claude-sonnet-4-6  # Model for the reviewer (null = same as builder)
  max_fix_passes: 1                # Fix passes (0 = report only, 1-3 = fix)
```

---

## Flow

```
Builder completes task
  │
  ├── 1. get_recent_diff(workspace) → get git diff
  │
  ├── 2. AutoReviewer.review_changes(task, diff)
  │       ├── Create fresh AgentLoop (clean context)
  │       ├── Prompt: original task + diff
  │       ├── Agent "review" with read-only tools
  │       └── ReviewResult(has_issues, review_text, cost)
  │
  ├── 3. If has_issues and max_fix_passes > 0:
  │       ├── build_fix_prompt(review_text) → fix prompt
  │       └── Builder executes fix
  │
  └── 4. Final result
```

---

## Python API

### AutoReviewer

```python
class AutoReviewer:
    def __init__(
        self,
        agent_factory: Callable[..., Any],   # (**kwargs) → AgentLoop
        review_model: str | None = None,      # Model for the reviewer
    ) -> None: ...

    def review_changes(
        self,
        task: str,                            # Original task
        git_diff: str,                        # Diff of the changes
    ) -> ReviewResult: ...

    @staticmethod
    def build_fix_prompt(review_text: str) -> str:
        """Generates a fix prompt based on the review."""

    @staticmethod
    def get_recent_diff(
        workspace_root: str,
        commits_back: int = 1,
    ) -> str:
        """Gets the diff of the last N commits."""
```

### ReviewResult

```python
class ReviewResult:
    has_issues: bool       # True if issues were found
    review_text: str       # Full review text
    cost: float            # USD cost of the review
```

### REVIEW_SYSTEM_PROMPT

The reviewer's system prompt:

```
You are a senior code reviewer. Your job is to review code changes
made by another agent and find issues.

Specifically look for:
1. Logic bugs and uncovered edge cases
2. Security issues (SQL injection, XSS, secrets, etc.)
3. Violations of project conventions
4. Simplification opportunities
5. Missing tests

Be specific: file, line, exact change.
If there are no issues: say "No issues found."
```

---

## Visual output (HUMAN logging)

Starting with v1.1.0, the Auto-Reviewer emits HUMAN-level events that produce clear visual output on stderr. The user can see the review result without needing `-v` flags.

```
--- Auto-Review (142 diff lines) ------------------------------------
   + Review complete: approved, 2 issues, score 8/10
```

If the review does not approve the changes:

```
--- Auto-Review (85 diff lines) -------------------------------------
   x Review complete: not approved, 5 issues, score 4/10
```

### Emitted events

| Event | When | Data |
|-------|------|------|
| `reviewer.start` | When the review starts | diff_lines |
| `reviewer.complete` | When the review completes | approved, issues, score |

Disabled with `--quiet` or `--json`. See [`logging.md`](/architect-docs/en/docs/v1-1-0/logging) for details on the HUMAN system.

---

## Error handling

If the LLM call fails during the review, the `AutoReviewer` does not propagate the exception. Instead, it returns a `ReviewResult` with:
- `has_issues = True`
- `review_text = "Error during review: <message>"`
- `cost = 0.0`

This allows the main flow to continue without interruption.

---

## "No issues" detection

The reviewer responds "No issues found" (or variations) when there are no problems. Detection is case-insensitive and looks for the pattern "no issues" in the response.

---

## Programmatic usage example

```python
from architect.agents.reviewer import AutoReviewer, ReviewResult

def my_agent_factory(**kwargs):
    # Create fresh AgentLoop
    ...

reviewer = AutoReviewer(
    agent_factory=my_agent_factory,
    review_model="claude-sonnet-4-6",
)

# Get recent diff
diff = AutoReviewer.get_recent_diff("/path/to/repo")

# Review changes
result = reviewer.review_changes(
    task="Implement JWT authentication",
    git_diff=diff,
)

if result.has_issues:
    # Generate fix prompt
    fix_prompt = AutoReviewer.build_fix_prompt(result.review_text)
    # Execute fix with the builder...
```
