---
title: "Best Practices"
description: "Prompts, agents, editing, costs, lifecycle hooks, guardrails, skills, memory, CI/CD."
icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
order: 16
---

# Best Practices -- Architect CLI

A guide to best practices for getting the most out of `architect`, avoiding common mistakes, and optimizing costs.

---

## Table of Contents

- [Writing good prompts](#writing-good-prompts)
- [Choosing the right agent](#choosing-the-right-agent)
- [File editing](#file-editing)
- [Command execution](#command-execution)
- [Context management](#context-management)
- [Cost optimization](#cost-optimization)
- [Lifecycle hooks](#lifecycle-hooks)
- [Guardrails](#guardrails)
- [Skills and project context](#skills-and-project-context)
- [Procedural memory](#procedural-memory)
- [Self-evaluation](#self-evaluation)
- [Confirmation modes](#confirmation-modes)
- [Workspace configuration](#workspace-configuration)
- [CI/CD usage](#cicd-usage)
- [Ralph Loop](#ralph-loop)
- [Pipelines](#pipelines)
- [Parallel execution](#parallel-execution)
- [Auto-review](#auto-review)
- [Sub-agents (Dispatch)](#sub-agents-dispatch)
- [Code Health](#code-health)
- [Competitive evaluation](#competitive-evaluation)
- [Telemetry](#telemetry)
- [Presets](#presets)
- [Common mistakes and how to avoid them](#common-mistakes-and-how-to-avoid-them)

---

## Writing good prompts

The agent follows an internal cycle: **ANALYZE -> PLAN -> EXECUTE -> VERIFY -> CORRECT**. A good prompt guides each phase of that cycle.

### Be specific about what and where

```bash
# Bad -- vague, forces the agent to guess
architect run "fix the login bug"

# Good -- indicates file, symptom, and hint
architect run "the POST /login endpoint returns 401 with valid credentials. \
  The problem is probably in src/auth.py in the validate_token() function. \
  Check the JWT expiration verification."
```

A specific prompt saves between 5 and 10 exploration steps. Each step costs tokens and consumes context.

### Describe the expected outcome

```bash
# Bad -- does not say what the desired result is
architect run "improve the users module"

# Good -- describes the desired end state
architect run "in src/models/user.py, change the User class from dataclass \
  to Pydantic BaseModel. Keep the default values. Add \
  model_config = {'extra': 'forbid'}. Update the imports in \
  the files that use User."
```

### One goal per execution

The agent works best with focused tasks. Instead of a long prompt with 5 tasks, run 5 times with short prompts.

```bash
# Worse -- too many goals in a single prompt
architect run "refactor utils.py, add tests, update docs, \
  fix the parsing bug, and migrate to async"

# Better -- one task per execution
architect run "migrate the functions in utils.py to Pydantic v2" --mode yolo
architect run "generate tests for the new Pydantic models" --mode yolo
architect run "update docs/models.md with the new schemas" --mode yolo
```

### Mention context the agent cannot infer

The agent sees the project tree and can read files, but it does not know things like:

- Team conventions that are not documented in the code.
- Why one pattern was chosen over another.
- Business requirements that are not reflected in the code.

```bash
# Include context not visible in the code
architect run "add Spanish NIF validation to the tax_id field of User. \
  We use the stdnum library for tax validations (already in requirements). \
  The expected format has the letter at the end, without hyphens."
```

---

## Choosing the right agent

| Task | Agent | Why |
|-------|--------|---------|
| Implement code | `build` (default) | Has all tools: read, write, search, commands |
| Understand code | `resume` | Fast, cheap, 15 steps max |
| Plan before implementing | `plan` | Read-only, produces a plan without touching anything |
| Code review | `review` | Focused on feedback, does not modify files |
| Sensitive task (production) | `build` with `confirm-all` | Confirms each operation |
| CI automation | `build` or `review` with `yolo` | No interactive confirmations |

**Recommended pattern for large tasks:**

```bash
# 1. Plan (cheap, read-only)
architect run "how to add JWT authentication?" -a plan --json > plan.json

# 2. Review the plan
cat plan.json | jq -r '.output'

# 3. Implement using the plan as reference
PLAN=$(jq -r '.output' plan.json)
architect run "Implement this plan: ${PLAN}" --mode yolo --self-eval basic
```

---

## File editing

### Editing hierarchy

| Situation | Tool | Reason |
|-----------|-------------|--------|
| Change a contiguous block | `edit_file` | Precise, generates diff, preferred |
| Changes across multiple sections | `apply_patch` | A single step for multi-hunk |
| New file or complete rewrite | `write_file` | Creates from scratch |

### edit_file uniqueness rule

`edit_file` requires that the `old_str` is **unique** in the file. If it appears 0 or 2+ times, it fails.

**How to avoid problems:**

The agent normally handles this well. But if you see "old_str appears N times" errors, you can help in the prompt:

```bash
# Mention context so the agent includes surrounding lines
architect run "in config.py, change the timeout of the connect() function \
  (not the retry() function timeout) from 30 to 60 seconds"
```

### Prefer edit_file over write_file for changes

`write_file` overwrites all content. If the agent reads a 500-line file and rewrites it to change 2, it may lose formatting or introduce errors. `edit_file` only touches the exact block.

---

## Command execution

### Enable when you need it

By default, `run_command` is enabled but the `build` agent requires confirmation for "dev" commands (pytest, mypy, ruff). With `--mode yolo` they run without asking.

```bash
# Let the agent run tests without confirmation
architect run "fix the bug and run pytest to verify" \
  --mode yolo --allow-commands
```

### Safe, dev, and dangerous commands

The system classifies each command automatically:

| Category | Examples | Confirmation in `confirm-sensitive` |
|-----------|----------|-------------------------------------|
| **safe** | `ls`, `cat`, `git status`, `git log`, `python --version` | Auto-approved |
| **dev** | `pytest`, `mypy`, `ruff`, `npm test`, `cargo test`, `make` | Auto-approved |
| **dangerous** | Custom scripts, unknown commands | Requires confirmation |

If you use non-standard tools, add them to the config:

```yaml
commands:
  safe_commands:
    - "my-linter --check"
    - "custom-test-runner"
```

### Timeouts

The default timeout is 30 seconds. If your tests or builds take longer:

```yaml
commands:
  default_timeout: 120   # 2 minutes
```

### What is always blocked

These patterns are blocked under all circumstances:

- `rm -rf /` -- System destruction.
- `sudo` -- Privilege escalation.
- `curl | bash`, `wget | sh` -- Remote code execution.
- `dd of=/dev/` -- Direct disk writing.
- `chmod 777` -- Insecure permissions.
- `mkfs` -- Disk formatting.
- Fork bombs.

There is no override for these. It is a design decision for security.

---

## Context management

The agent maintains a message history with the LLM. As steps accumulate, the context grows and can become saturated.

### The three levels of protection

1. **Tool result truncation**: Tool results larger than `max_tool_result_tokens` are cut, keeping the beginning and end of the output.
2. **Old step compression**: After N steps with tool calls, the oldest ones are summarized by the LLM (extra cost: ~500 tokens per compression).
3. **Sliding window**: If the context exceeds `max_context_tokens`, the oldest messages are removed.

### How to avoid filling the context

- **Search before reading.** Use `search_code` or `grep` to locate relevant code instead of reading entire files.
- **One task per execution.** Do not ask for 5 refactorings in a single prompt.
- **Control the number of steps.** If you see a task regularly consuming 30+ steps, split it up.
- **Adjust the thresholds** for large projects:

```yaml
context:
  max_tool_result_tokens: 2000     # Tokens per tool result
  summarize_after_steps: 8         # Compress after 8 steps with tools
  keep_recent_steps: 4             # Keep the 4 most recent steps
  max_context_tokens: 80000        # Hard limit for total context
```

### When to increase `max_context_tokens`

Depends on the model:

| Model | Actual context window | Recommended value |
|--------|--------------------:|------------------:|
| gpt-4o | 128K | 80,000-100,000 |
| gpt-4o-mini | 128K | 80,000-100,000 |
| claude-sonnet-4-6 | 200K | 120,000-160,000 |
| claude-opus-4-6 | 200K | 120,000-160,000 |
| ollama/llama3 (8B) | 8K | 4,000-6,000 |

Leave a 20-30% margin for the system prompt and the project index.

---

## Cost optimization

### Choose the model based on the task

| Task | Recommended model | Relative cost |
|-------|--------------------|----------------|
| Review, summary, planning | `gpt-4o-mini` | Very low |
| Simple implementation (1-3 files) | `gpt-4o` | Medium |
| Complex refactoring | `claude-sonnet-4-6` | Medium-high |
| Critical tasks with full auto-eval | `gpt-4o` / `claude-sonnet-4-6` | High |

```bash
# Cheap review
architect run "review src/auth.py" -a review --model gpt-4o-mini

# Implementation with powerful model
architect run "refactor the entire ORM" --model claude-sonnet-4-6
```

### Enable prompt caching

Reduces the system prompt cost by 90% on consecutive calls to the same model. The cache lasts ~5 minutes.

```yaml
llm:
  prompt_caching: true
```

It is especially useful when running several tasks in a row on the same project:

```bash
architect run "step 1..." --model claude-sonnet-4-6
architect run "step 2..." --model claude-sonnet-4-6   # 90% cheaper on system prompt
architect run "step 3..." --model claude-sonnet-4-6   # same
```

### Set a budget

Always use `--budget` in automation to avoid runaway costs:

```bash
architect run "..." --budget 2.00 --show-costs
```

The agent stops with `status: "partial"` and `stop_reason: "budget_exceeded"` if it exceeds the limit. Before stopping, it generates a summary of what it did.

```yaml
# Config with early warning
costs:
  enabled: true
  budget_usd: 5.00
  warn_at_usd: 2.00    # Log warning when reaching $2
```

### Local cache for development

If you are iterating on the same prompt (debugging, config tuning), enable the local cache:

```bash
architect run "..." --cache
# Second run with same prompt → instant response, 0 tokens
```

Do not use in production: cached responses may become stale if the code changes.

---

## Lifecycle hooks

### When to use them

Hooks automatically run linters, formatters, or type checkers. Starting with v0.16.0, 10 lifecycle events are supported (not just post-editing).

```yaml
hooks:
  post_tool_use:
    - name: format
      command: "black {file}"
      file_patterns: ["*.py"]
      timeout: 10
    - name: lint
      command: "ruff check {file}"
      file_patterns: ["*.py"]
      timeout: 10
  pre_tool_use:
    - name: validate-secrets
      command: "bash scripts/check-secrets.sh"
      matcher: "write_file|edit_file"
      timeout: 5
```

### Best practices with hooks

**Keep hooks fast.** Each hook adds time and potentially an extra iteration if it fails. A 30s hook on every edit adds up quickly.

**Avoid tests in hooks.** Tests are usually slow. It is better for the agent to run them explicitly with `run_command` once at the end, or use guardrails quality gates to verify on completion.

```yaml
# Good -- fast formatting and lint hooks
hooks:
  post_tool_use:
    - name: format
      command: "black {file}"
      file_patterns: ["*.py"]
      timeout: 10
```

**Use pre-hooks for security, post-hooks for quality.** Pre-hooks with exit code 2 block the action; post-hooks inform the LLM.

**If a hook is broken, disable it.** A misconfigured linter that always fails causes the agent to enter a loop trying to fix errors that are not its own.

```yaml
hooks:
  post_tool_use:
    - name: broken-lint
      command: "..."
      enabled: false     # Disabled
```

**Use async for notifications.** Session hooks that send notifications (Slack, email) should be async to avoid blocking.

```yaml
hooks:
  session_end:
    - name: notify
      command: "curl -s $SLACK_WEBHOOK -d 'Session completed'"
      async: true
```

---

## Guardrails

### When to use them

Guardrails are **deterministic** security rules evaluated BEFORE hooks. Ideal for teams or environments that need strict control.

### Best practices with guardrails

**Protect sensitive files.** Use `sensitive_files` for secrets (blocks read and write) and `protected_files` for files that can be read but not modified.

```yaml
guardrails:
  enabled: true
  # Blocks read AND write — secrets never reach the LLM
  sensitive_files:
    - ".env"
    - "*.pem"
    - "*.key"
  # Blocks write only — agent can read but not modify
  protected_files:
    - "deploy/**"
    - "Dockerfile"
```

**Limit the scope of changes.** In CI environments or with partially-trusted agents, limit how much the agent can change.

```yaml
guardrails:
  max_files_modified: 10
  max_lines_changed: 500
```

**Use quality gates for final verification.** They are more effective than tests in hooks because they run only once upon completion.

```yaml
guardrails:
  quality_gates:
    - name: tests
      command: "pytest tests/ -x --tb=short"
      required: true
      timeout: 120
    - name: lint
      command: "ruff check src/"
      required: false    # informational only
```

**Use code_rules for prohibited patterns.** Useful for preventing anti-patterns in generated code.

```yaml
guardrails:
  code_rules:
    - pattern: "eval\\("
      message: "Do not use eval() -- injection risk"
      severity: block
    - pattern: "console\\.log"
      message: "Use logger instead of console.log"
      severity: warn
```

---

## Skills and project context

### When to use them

Skills inject project context into the agent's system prompt. They are the way to communicate team conventions, preferred patterns, and project rules.

### Best practices with skills

**Create a `.architect.md` in every project.** It is the most effective way to give context to the agent without repeating it in every prompt.

```markdown
<!-- .architect.md -->
# Conventions

- Python: snake_case, black, ruff, mypy
- Tests in tests/ with pytest
- Use pydantic v2 for validation
- Do not use print(), use structlog
```

**Use skills with globs for specific context.** If Django rules only apply to certain files, use globs.

```markdown
---
name: django-patterns
globs: ["**/views.py", "**/models.py", "**/serializers.py"]
---
# Django Patterns
- Use class-based views
- Validate with serializers, never in views
```

**Do not repeat in skills what the code already says.** Skills are for implicit conventions, not for documenting what is already visible in the code.

---

## Procedural memory

### When to use it

Procedural memory detects user corrections and persists them for future sessions. Useful for projects where you interact repeatedly with the agent.

### Best practices with memory

**Enable it on recurring projects.** If you work with the agent on the same project for days/weeks, memory reduces repeated corrections.

```yaml
memory:
  enabled: true
```

**Review `.architect/memory.md` periodically.** Auto-detected corrections may contain noise. Edit the file manually to keep only relevant rules.

**Use patterns for permanent rules.** In addition to automatic corrections, you can add rules manually:

```markdown
- [2026-02-22] Pattern: Always use pnpm, never npm or yarn
- [2026-02-22] Pattern: Tests go in __tests__/ alongside the code
```

---

## Self-evaluation

### When to use each mode

| Mode | Extra cost | When to use |
|------|-------------|---------------|
| `off` | 0 | Trivial tasks, exploration, rapid development |
| `basic` | ~500 tokens | Quality gate in CI, post-implementation verification |
| `full` | 2-5x the base cost | Critical tasks that must be correct |

```bash
# CI -- verify that the task was completed
architect run "..." --self-eval basic

# Critical task -- re-run if evaluation fails
architect run "..." --self-eval full

# Rapid development -- no extra evaluation
architect run "..." --self-eval off
```

### Be careful with `full` mode

The `full` mode can re-run the agent up to `max_retries` times (default: 2). This means the cost can multiply by 3-5x:

```
Base execution:    1000 tokens    $0.02
Evaluation 1:       500 tokens    $0.01  → "incomplete"
Re-execution 1:     800 tokens    $0.015
Evaluation 2:       500 tokens    $0.01  → "completed"
─────────────────────────────────────────
Total:             2800 tokens    $0.055 (2.75x the base cost)
```

Use `--budget` together with `--self-eval full` to cap spending:

```bash
architect run "..." --self-eval full --budget 1.00
```

### Confidence threshold

The evaluator returns a confidence between 0 and 1. If it is less than `confidence_threshold` (default: 0.8), it is considered incomplete.

```yaml
evaluation:
  mode: full
  max_retries: 2
  confidence_threshold: 0.8   # 80% minimum to accept
```

Lower the threshold if your tasks are inherently ambiguous (documentation, large refactorings):

```yaml
evaluation:
  confidence_threshold: 0.6   # More permissive
```

---

## Confirmation modes

### When to use each mode

| Mode | Ideal use | Risk |
|------|-----------|--------|
| `confirm-sensitive` | Daily development | Low: you only confirm writes |
| `confirm-all` | Production operations | None: you confirm everything |
| `yolo` | CI/CD, automation, trusted tasks | Medium: agent acts without asking |

### confirm-sensitive (build agent default)

It is the recommended balance for daily development:
- Reads and searches run automatically.
- File writes ask for confirmation.
- Safe/dev commands run automatically.
- Unknown commands ask for confirmation.

### yolo -- essential in CI

In environments without a terminal (CI/CD, containers, cron), `confirm-sensitive` and `confirm-all` block execution because there is no terminal to respond. Always use `--mode yolo`:

```bash
# Headless CI
architect run "..." --mode yolo --budget 2.00
```

### Safe combination for yolo

If you use `yolo` but want to limit risk:

```yaml
workspace:
  allow_delete: false          # Prohibit file deletion

commands:
  allowed_only: true           # Only safe + dev commands
  blocked_patterns:
    - "git push"               # Prohibit push from the agent
    - "docker rm"              # Prohibit container deletion

costs:
  budget_usd: 2.00             # Spending limit
```

---

## Workspace configuration

### Path traversal prevention

Architect confines all file operations to the workspace root. The agent cannot read or write outside this directory, neither with relative paths (`../../etc/passwd`) nor with symlinks.

```bash
# The workspace is the current directory by default
architect run "..." -w /home/user/my-project
```

### Exclude directories from the indexer

If your project has heavy directories that do not need indexing:

```yaml
indexer:
  exclude_dirs:
    - vendor
    - .terraform
    - coverage
    - data
  exclude_patterns:
    - "*.generated.go"
    - "*.pb.go"
```

This speeds up startup and reduces the system prompt size.

### Large projects

For repos with more than 300 files, the indexer generates a compact tree grouped by directory. If the indexer takes too long, enable the disk cache during development:

```yaml
indexer:
  use_cache: true   # Disk cache, 5-minute TTL
```

---

## CI/CD usage

### CI checklist

1. Use `--mode yolo` (no interactive terminal).
2. Use `--quiet --json` (parseable output).
3. Set `--budget` (cost control).
4. Check exit code (0=ok, 1=failure, 2=partial, 3=config, 4=auth, 5=timeout).
5. API key as CI secret, never in code.
6. Use `--report github --report-file report.md` to publish as PR comment.
7. Use `--context-git-diff origin/main` to give the agent PR context.
8. Use `--exit-code-on-partial` so partial returns exit 2.

```bash
architect run "..." \
  --mode yolo \
  --quiet --json \
  --budget 1.00 \
  > result.json

EXIT_CODE=$?
STATUS=$(jq -r '.status' result.json)

if [ "$EXIT_CODE" -ne 0 ] || [ "$STATUS" != "success" ]; then
  echo "Architect failed: status=${STATUS}, exit=${EXIT_CODE}"
  jq -r '.output // empty' result.json
  exit 1
fi
```

### Recommended CI config

```yaml
llm:
  model: gpt-4o-mini
  stream: false
  prompt_caching: true

commands:
  enabled: true
  allowed_only: true

evaluation:
  mode: basic

costs:
  enabled: true
  budget_usd: 1.00

sessions:
  auto_save: true
  cleanup_after_days: 30
```

### CI example with reports and sessions

```bash
architect run "review the PR changes" \
  --mode yolo --quiet --json \
  --budget 2.00 \
  --context-git-diff origin/main \
  --report github --report-file pr-report.md \
  --exit-code-on-partial \
  > result.json

# Publish report as PR comment
gh pr comment $PR_NUMBER --body-file pr-report.md

# If it was partial, resume
if [ $? -eq 2 ]; then
  SESSION=$(jq -r '.session_id // empty' result.json)
  [ -n "$SESSION" ] && architect resume "$SESSION" --budget 1.00
fi
```

---

## Ralph Loop

### When to use it

The Ralph Loop is ideal when the task has an **automatically verifiable success condition**: tests passing, lint with no errors, build that compiles, etc.

### Best practices with Ralph Loop

**Use concrete and fast checks.** Each check runs between iterations. A check that takes 2 minutes multiplies the total time by the number of iterations.

```bash
# Good -- fast and specific check
architect loop "..." --check "pytest tests/test_auth.py -x"

# Worse -- slow check that runs the entire suite
architect loop "..." --check "pytest tests/ --cov=src"
```

**Always set `--max-iterations` and `--max-cost`.** Without limits, the loop can iterate indefinitely if the task is ambiguous or impossible.

```bash
architect loop "..." \
  --check "pytest tests/" \
  --max-iterations 10 \
  --max-cost 5.0
```

**Use multiple checks for complete verification.** All checks must pass for the iteration to be successful.

```bash
architect loop "..." \
  --check "pytest tests/ -x" \
  --check "ruff check src/" \
  --check "mypy src/"
```

**Clean context is an advantage.** Each iteration's agent does not inherit errors or assumptions from previous iterations. It only sees: task + failed checks + their output.

---

## Pipelines

### When to use them

Pipelines are ideal for repeatable multi-step workflows: implement -> test -> review, or more complex CI/CD workflows.

### Best practices with pipelines

**Use checkpoints at critical steps.** If a later step fails, you can roll back to the previous step's checkpoint.

```yaml
steps:
  - name: implement
    prompt: "..."
    checkpoint: true    # restore point
  - name: test
    prompt: "..."
    checks:
      - "pytest tests/"
```

**Use `output_var` to pass context between steps.** The output of a step is captured and can be used as `{{variable}}` in later steps.

```yaml
steps:
  - name: plan
    prompt: "Plan how to implement X"
    agent: plan
    output_var: plan
  - name: implement
    prompt: "Implement according to this plan: {{plan}}"
    agent: build
```

**Use conditions for optional steps.** A step with `condition` only runs if the command returns exit 0.

```yaml
- name: fix-lint
  prompt: "Fix lint errors"
  condition: "ruff check src/ 2>&1 | grep -q 'error'"
```

**Use `--from-step` to resume after manual corrections.** If a step fails and you fix it manually, resume from that step.

```bash
architect pipeline workflow.yaml --from-step test
```

---

## Parallel execution

### When to use it

Parallel execution is ideal for: comparing results from different models, dividing independent work, or experimenting with multiple approaches.

### Best practices with parallel

**Always use `--budget-per-worker`.** Without a limit, N workers can consume N times the expected cost.

```bash
architect parallel "..." --workers 3 --budget-per-worker 1.0
```

**Clean up worktrees after inspecting.** Worktrees take up disk space (full repo copy per worker).

```bash
# Inspect results
cd .architect-parallel-1 && git diff HEAD~1

# Clean up when satisfied
architect parallel-cleanup
```

**Use round-robin models for competition.** It is an effective way to evaluate which model produces the best results for your type of task.

```bash
architect parallel "optimize performance" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat
```

**Independent tasks split better.** Parallel execution works best when tasks do not depend on each other (do not touch the same files).

---

## Auto-review

### When to use it

Auto-review is useful as an automatic quality gate: the reviewer has clean context (only sees the diff) and can detect problems the builder overlooked.

### Best practices with auto-review

**Use a different model for the reviewer.** A model different from the builder can provide a different perspective.

```yaml
auto_review:
  enabled: true
  review_model: claude-sonnet-4-6    # different from the builder
  max_fix_passes: 1
```

**Use `max_fix_passes: 0` for reporting only.** If you do not want the builder to attempt automatic fixes, just get the report.

```yaml
auto_review:
  enabled: true
  max_fix_passes: 0    # report only, do not fix
```

**Combine with guardrails for maximum safety.** Guardrails prevent dangerous actions; auto-review detects logic issues.

---

## Sub-agents (Dispatch)

**Use `explore` before implementing.** The main agent can delegate investigation to an explore sub-agent that searches patterns, reads files, and reports results without contaminating the builder's context.

**Do not delegate trivial tasks.** Each sub-agent consumes a full LLM invocation (up to 15 steps). If the task is simple (read a file, search for a function), it is more efficient for the main agent to do it directly.

**Use `test` for post-implementation verification.** Delegate test execution to a test sub-agent: it runs, verifies results, and reports without inflating the builder's context.

**Sub-agents are read-only (except `test`).** The `explore` and `review` types cannot modify files -- ideal for risk-free analysis.

---

## Code Health

**Enable `--health` on large refactorings.** The metrics delta shows whether the refactoring actually improved quality: less complexity, fewer duplicates, shorter functions.

**Install `radon` for accurate metrics.** Without radon, cyclomatic complexity is estimated with AST (less precise). With `pip install architect-ai-cli[health]` you get exact metrics.

**Set `health.enabled: true` for continuous monitoring.** Instead of passing `--health` every time, enable it in config so quality is always analyzed.

**Use `exclude_dirs` to avoid noise.** Exclude `venv`, `node_modules`, generated files, and dependencies that would inflate metrics.

---

## Competitive evaluation

**Evaluate models for your type of task.** Models have different strengths: one model may be better at refactoring and another at test generation. `architect eval` gives you objective data.

**Use meaningful checks.** Checks determine 40% of the score. Use unit tests and linters that verify the code works, not just that it compiles.

**Set a budget per model.** Without a budget, a slow model could spend much more than another. With `--budget-per-model` you level the playing field.

**Worktrees remain for inspection.** After `architect eval`, each model has its worktree intact. Manually inspect the winning code before merging it.

```bash
# Evaluation with equal budget and timeout
architect eval "implement JWT authentication" \
  --models gpt-4o,claude-sonnet-4-6 \
  --check "pytest tests/" --check "ruff check src/" \
  --budget-per-model 1.0 --timeout-per-model 300
```

---

## Telemetry

**Use `console` for debugging.** The `console` exporter prints spans to stderr -- ideal for seeing what is happening without setting up infrastructure.

**Use `otlp` in production.** Connect to Jaeger, Grafana Tempo, or any OpenTelemetry backend for centralized monitoring.

**Use `json-file` for offline analysis.** Write traces to a JSON file that you can process with jq, pandas, or any analysis tool.

**Telemetry is completely optional.** Without the OpenTelemetry dependencies installed, a transparent NoopTracer is used with no performance impact.

---

## Presets

**Use `architect init` as a starting point.** Presets generate a base configuration that you can customize. It is faster than starting from scratch.

**Choose the preset closest to your case.**

| Situation | Recommended preset |
|-----------|-------------------|
| New Python project | `python` |
| React/TypeScript project | `node-react` |
| CI/CD pipeline | `ci` |
| Production with sensitive data | `paranoid` |
| Quick prototype | `yolo` |

**Customize after init.** The generated files (`.architect.md`, `config.yaml`) are editable. Adjust hooks, guardrails, and conventions to the specific needs of your project.

**The `paranoid` preset is ideal for team onboarding.** It includes strict guardrails, security code rules, and auto-review -- ensures the agent does nothing dangerous while the team becomes familiar.

---

## Common mistakes and how to avoid them

### 1. The agent hangs waiting for confirmation

**Cause:** `confirm-sensitive` or `confirm-all` mode in an environment without a terminal.

**Solution:** Use `--mode yolo`.

### 2. edit_file fails with "old_str appears N times"

**Cause:** The text to replace is not unique in the file.

**Solution:** The agent normally retries with more context. If it persists, the prompt can help by indicating the exact function or section where the change should be made.

### 3. Unexpectedly high cost

**Cause:** Complex task + `--self-eval full` + many hook iterations.

**Solution:**
- Always use `--budget`.
- Use `--self-eval basic` instead of `full`.
- Choose a cheaper model for simple tasks.
- Enable `prompt_caching: true`.

### 4. The agent cannot find files that exist

**Cause:** The file is in a directory excluded by the indexer (node_modules, .venv, etc.).

**Solution:** Adjust `indexer.exclude_dirs` in the config or specify the exact path in the prompt.

### 5. run_command fails with "blocked command"

**Cause:** The command matches a blocklist pattern.

**Solution:** Blocklist commands are blocked for security and cannot be unblocked. If the command is legitimate but similar (for example, `rm -rf ./build/` is confused with `rm -rf /`), the agent normally retries with a safe alternative.

### 6. Agent timeout

**Cause:** The task is too large for the configured timeout.

**Solution:** Increase `--timeout` or split the task into subtasks.

```bash
architect run "..." --timeout 600   # 10 minutes
```

### 7. "Budget exceeded" with partial status

**Cause:** The accumulated cost exceeded the budget before completing the task.

**Solution:** The agent generates a summary of what it did before stopping. You can use `architect resume` to continue exactly where it left off:

```bash
# First run (stops at partial)
architect run "refactor the entire auth module" --budget 1.00

# View saved sessions
architect sessions

# Resume with more budget (restores all context)
architect resume 20260223-143022-a1b2 --budget 2.00
```

If you are not using sessions, you can continue manually:

```bash
architect run "refactor the entire auth module" --budget 1.00 --json > result1.json

STATUS=$(jq -r '.status' result1.json)
if [ "$STATUS" = "partial" ]; then
  OUTPUT=$(jq -r '.output' result1.json)
  architect run "Continue this task. Previous progress: ${OUTPUT}" \
    --budget 1.00
fi
```

### 8. The indexer takes too long on large repos

**Cause:** Repo with thousands of files or very large files.

**Solution:**

```yaml
indexer:
  max_file_size: 500000       # 500KB instead of 1MB
  exclude_dirs:
    - data
    - vendor
    - assets
  use_cache: true              # 5-minute disk cache
```

---

## Quick reference

| Practice | Recommendation |
|----------|---------------|
| Prompts | Specific, one goal per execution |
| Agent | `review`/`plan` for analysis, `build` for changes |
| Editing | Prefer `edit_file` over `write_file` |
| Commands | Fast hooks, tests only with `run_command` or quality gates |
| Context | Search before reading, split large tasks |
| Costs | `prompt_caching: true`, `--budget`, appropriate model |
| Hooks | Pre-hooks for security, post-hooks for lint/format, async for notifications |
| Guardrails | Protect sensitive files, limit scope, quality gates at the end |
| Skills | `.architect.md` in every project, skills with globs for specific context |
| Memory | Enable on recurring projects, review `.architect/memory.md` periodically |
| Sessions | Enable `auto_save: true`, use `resume` for partial tasks, periodic `cleanup` |
| Reports | `--report github` on PRs, `--report json` for CI, `--report-file` always in CI (format inferred from extension if `--report` not passed) |
| Dry run | `--dry-run` to preview before executing in production |
| Evaluation | `basic` for CI, `full` only for critical tasks |
| Mode | `confirm-sensitive` locally, `yolo` in CI |
| CI/CD | `--context-git-diff`, `--exit-code-on-partial`, `--report`, sessions for resume |
| Security | `allowed_only: true`, `allow_delete: false`, guardrails in CI |
| Ralph Loop | Fast checks, `--max-iterations` + `--max-cost` always, multiple checks |
| Pipelines | Checkpoints at critical steps, `output_var` for context, conditions for optionals |
| Parallel | `--budget-per-worker`, clean up worktrees, independent tasks |
| Auto-review | Different model for the reviewer, `max_fix_passes: 0` for reporting only |
