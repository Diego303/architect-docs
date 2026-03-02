---
title: "Troubleshooting"
description: "Symptom-based diagnosis: LLM errors, loops, tools, hooks, guardrails, exit codes."
icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
order: 35
---

# Troubleshooting and Diagnostics

Problem-solving guide for architect-cli v1.1.0. Organized by symptoms: identify the problem, diagnose the cause, and apply the specific solution.

---

## Diagnostic approach

Architect has three main sources of information for diagnosing problems:

1. **HUMAN output** (stderr) -- the visual log with icons showing what the agent does step by step. Always active except with `--quiet` or `--json`.
2. **JSON log** (file) -- captures ALL events in JSON Lines format. Activated with `--log-file`. This is the most powerful diagnostic tool.
3. **Technical console** (stderr) -- technical logs controlled by `-v`/`-vv`/`-vvv`.

**Recommended pattern**: for any problem, reproduce with `--log-file` and use `jq` to filter:

```bash
architect run "task" --log-file debug.jsonl -vv
cat debug.jsonl | jq 'select(.event == "agent.tool_call.execute")'
```

---

## 1. Connection and LLM errors

### 1.1 Authentication error (exit code 4)

**Symptom**: the agent terminates immediately with `exit code 4` and the message `Authentication failed` or `Invalid API key`.

**Cause**: the API key is not configured, is invalid, or has expired.

**Solution**:

```bash
# Verify that the environment variable is defined
echo $LITELLM_API_KEY

# Or use the OpenAI/Anthropic key directly
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Pass via CLI (single execution)
architect run "task" --api-key "sk-..."

# Verify in the YAML config that api_key_env points to the correct variable
# .architect.yaml
llm:
  api_key_env: "OPENAI_API_KEY"  # name of the env var
```

If you use a proxy or local server, also verify `--api-base`.

### 1.2 LLM call timeout

**Symptom**: HUMAN output shows `LLM error: timeout` (icon ❌) or the JSON log has `event: "agent.llm_error"` with an error containing "timeout" or "timed out".

> **Note v1.1.0**: HUMAN messages are now in English by default. With `language: es`, they are shown in Spanish. See [`i18n.md`](/architect-docs/en/docs/v1-1-0/i18n).

**Cause**: the default LLM timeout is 60 seconds (`llm.timeout: 60`). Large models or very long prompts may take longer. Slow connection to the provider.

**Solution**:

```yaml
# .architect.yaml
llm:
  timeout: 120   # increase to 120 seconds
  retries: 3     # increase retries (default: 2)
```

```bash
# Diagnose with detailed logging
architect run "task" --log-file debug.jsonl -vvv
cat debug.jsonl | jq 'select(.event | startswith("agent.llm"))'
```

### 1.3 Model not found

**Symptom**: error `Model not found` or `Invalid model` at startup. Exit code 3 (config error).

**Cause**: the model name does not exist for the configured provider, or the provider does not support that model.

**Solution**:

```bash
# Verify that the model is valid for the provider
# OpenAI: gpt-4o, gpt-4o-mini, gpt-4.1, etc.
# Anthropic: claude-sonnet-4-6, claude-opus-4-6, etc.
# For models via LiteLLM proxy, use prefix: openai/gpt-4o, anthropic/claude-sonnet-4-6

architect run "task" --model gpt-4o
architect run "task" --model anthropic/claude-sonnet-4-6
```

```yaml
# .architect.yaml
llm:
  model: "gpt-4o"         # exact model name
  api_base: null           # null to use the direct provider
```

### 1.4 Rate limiting (429)

**Symptom**: JSON log shows repeated HTTP 429 errors. The agent may recover automatically thanks to retries, but if the issue persists, it stops with `LLM_ERROR`.

**Cause**: too many requests to the provider in a short time. Common in parallel executions or with low-quota models.

**Solution**:

```yaml
# .architect.yaml
llm:
  retries: 3           # increase retries with backoff
  timeout: 120         # allow more time for backoff to work
```

```bash
# In parallel executions, reduce workers
architect parallel --workers 2 --task "..."

# Check quota in the provider dashboard
# OpenAI: platform.openai.com/usage
# Anthropic: console.anthropic.com
```

### 1.5 Incorrect API base

**Symptom**: error `Connection refused` or `Could not resolve host`. The agent cannot connect to the LLM.

**Cause**: `api_base` points to a nonexistent server, an unreachable server, or uses an incorrect protocol.

**Solution**:

```bash
# Verify that the server responds
curl https://your-server.com/v1/models

# Fix in the configuration
architect run "task" --api-base "https://your-server.com/v1"
```

```yaml
# .architect.yaml
llm:
  api_base: "https://your-server.com/v1"
  mode: "proxy"    # use "proxy" if it is a LiteLLM server or OpenAI-compatible
```

---

## 2. The agent does not finish / infinite loops

### 2.1 max_steps too high or not configured

**Symptom**: the agent executes dozens or hundreds of steps without finishing. The HUMAN output shows `Step 50`, `Step 51`... endlessly.

**Cause**: `max_steps` defaults to 50 for the `build` agent (20 for `plan` and `review`, 15 for `resume`). If the task is ambiguous, the LLM may not find a stopping point.

**Solution**:

```yaml
# .architect.yaml -- limit steps
agents:
  build:
    max_steps: 30    # reasonable cap

# Also use budget and timeout as complementary safety nets
costs:
  budget_usd: 2.00   # max $2 per execution
```

```bash
# From CLI
architect run "task" --max-steps 25 --budget 1.50 --timeout 300
```

### 2.2 No safety nets configured

**Symptom**: the agent runs indefinitely consuming tokens and money. There are no `safety.*` messages in the logs.

**Cause**: no budget limits, timeout, or adequate max_steps were configured.

**Solution**: always configure all three safety nets:

```yaml
# .architect.yaml -- defensive configuration
agents:
  build:
    max_steps: 30

costs:
  budget_usd: 5.00
  warn_at_usd: 3.00

# Timeout from CLI (there is no YAML config for global timeout, it is passed as a flag)
```

```bash
architect run "task" --max-steps 30 --budget 5.00 --timeout 600
```

### 2.3 Hooks failing repeatedly cause loops

**Symptom**: the agent repeats the same step over and over. The HUMAN output shows `Hook name: (warning)` repeatedly. The agent tries to correct, the hook fails again, and so on.

**Cause**: a `post_tool_use` hook or a quality gate fails consistently, the LLM receives the error as feedback and tries to correct it, but the correction also fails the hook.

**Solution**:

```bash
# Diagnose: see which hooks are failing
cat debug.jsonl | jq 'select(.event == "agent.hook.complete" and .success == false)'

# Verify the hook manually
echo '{}' | ARCHITECT_EVENT=post_tool_use ARCHITECT_TOOL_NAME=edit_file bash -c 'your-hook-command'
echo $?  # should be 0 (ALLOW) or 2 (BLOCK)
```

```yaml
# Temporarily disable the problematic hook
hooks:
  post_tool_use:
    - name: "my-hook"
      command: "..."
      enabled: false    # <-- disable
```

Hooks NEVER break the loop (errors return ALLOW), but if a required quality gate fails repeatedly, the agent keeps trying. Verify that the quality gates are achievable:

```yaml
guardrails:
  quality_gates:
    - name: "tests"
      command: "pytest tests/ -x"
      required: true     # change to false if it blocks
      timeout: 60
```

### 2.4 Context window filling up

**Symptom**: HUMAN output shows `Compressing context -- N exchanges` and `Context window: removed N messages`. The agent becomes slow. May terminate with `StopReason: CONTEXT_FULL`.

**Cause**: the task is very long, tool responses are too large, or the context management configuration is insufficient.

**Solution**:

```yaml
# .architect.yaml -- aggressive context management
context:
  max_tool_result_tokens: 1500     # truncate large results
  summarize_after_steps: 6         # compress sooner
  keep_recent_steps: 3             # keep fewer steps
  max_context_tokens: 60000        # hard limit

# Use a model with a larger context
llm:
  model: "gpt-4o"  # 128k context
```

### 2.5 Quality gates contradict the task

**Symptom**: the agent completes the task but quality gates fail, so the agent tries to "fix" the code and breaks what it had done. It repeats in a loop.

**Cause**: a quality gate (lint, tests, typecheck) fails for reasons unrelated to the current task, but the agent receives the error and tries to correct it.

**Solution**:

```yaml
guardrails:
  quality_gates:
    - name: "lint"
      command: "ruff check src/ --select E,W"  # be specific about which rules
      required: false   # do not block the agent
      timeout: 30

    - name: "tests-related"
      command: "pytest tests/test_specific.py -x"  # only relevant tests
      required: true
      timeout: 120
```

---

## 3. The agent produces incorrect results

### 3.1 Prompt too vague or ambiguous

**Symptom**: the agent completes (exit code 0, `StopReason: LLM_DONE`) but the result is not what was expected. It makes changes to incorrect files or generates irrelevant code.

**Cause**: the prompt is not specific enough. The agent infers the intent incorrectly.

**Solution**:

```bash
# Be explicit about what to do, where, and how
architect run "In src/auth/login.py, refactor the validate_token() function \
  to use pyjwt instead of jose. Keep the same public interface. \
  Update the tests in tests/test_auth.py"

# For complex tasks, use a heredoc or file via shell
architect run "$(cat spec.md)"
```

### 3.2 Incorrect agent selected

**Symptom**: the agent plans instead of building, or builds without planning a complex task.

**Cause**: the default agent is `build`. The task may require `plan` (for large tasks) or `review` (for code review).

**Solution**:

```bash
# Use an explicit agent
architect run "..." --agent plan      # planning
architect run "..." --agent build     # building (default)
architect run "..." --agent review    # code review
architect run "..." --agent resume    # resume an interrupted task
```

### 3.3 Missing .architect.md in the project

**Symptom**: the agent does not follow the project conventions. It uses tabs instead of spaces, imports disallowed libraries, does not follow the architecture pattern.

**Cause**: there is no `.architect.md` file in the project root to tell the agent about the conventions. The agent uses its own defaults.

**Solution**: create `.architect.md` in the workspace root with the conventions:

```markdown
# Project Conventions

- Python 3.12+, use strict typing
- Format: black (100 chars), ruff for linting
- Tests with pytest, minimum 80% coverage
- Do not use print(), always use structlog
- Absolute imports, never relative
```

### 3.4 Model too weak for the task

**Symptom**: the agent completes but the code has obvious bugs, does not compile, or ignores clear instructions from the prompt.

**Cause**: small models (gpt-4o-mini, claude-haiku) may not be sufficient for complex refactoring or architecture tasks.

**Solution**:

```bash
# Use a more capable model
architect run "complex task" --model gpt-4o
architect run "complex task" --model anthropic/claude-sonnet-4-6
```

### 3.5 Context too large causes hallucinations

**Symptom**: the agent mixes content from different files, invents functions that do not exist, or references code that was removed by context compression.

**Cause**: when the context approaches the limit, models can lose precision. Context compression may remove relevant information.

**Solution**:

```yaml
# Be more aggressive with truncation to maintain precision
context:
  max_tool_result_tokens: 1000   # less content per tool result
  keep_recent_steps: 5           # keep more recent steps intact
  summarize_after_steps: 5       # compress sooner

# Split the task into smaller steps
# Or use pipelines to sequence sub-tasks
```

```bash
# Use pipeline for large tasks
architect pipeline workflow.yaml
```

---

## 4. Tool errors

### 4.1 Path traversal blocked

**Symptom**: HUMAN output shows `ERROR: Path validation failed` or `Path outside workspace`. The tool result contains an error about path traversal.

**Cause**: the agent attempts to access a file outside the `workspace_root`. All filesystem operations validate that the path is within the workspace.

**Solution**:

```bash
# Verify that the workspace is correct
architect run "task" --workspace /path/to/project

# If you need to access files outside the workspace, adjust the workspace root
architect run "task" --workspace /parent/path
```

```yaml
# .architect.yaml
workspace:
  root: "."   # relative to the execution directory
```

### 4.2 Tool not available for the agent

**Symptom**: JSON log shows `tool_not_found` or `Tool 'X' not found in registry`. The agent tries to use a tool that is not assigned to it.

**Cause**: each agent has an `allowed_tools` list. If the tool is not in the list, it cannot use it. The `review` agent only has read-only tools.

**Solution**:

```yaml
# .architect.yaml -- assign tools to the agent
agents:
  build:
    allowed_tools:
      - read_file
      - write_file
      - edit_file
      - apply_patch
      - search_code
      - grep
      - find_files
      - run_command
      - dispatch_subagent
```

```bash
# View available tools with verbose
architect run "task" -v --log-file debug.jsonl
cat debug.jsonl | jq 'select(.event | contains("tool")) | .tool'
```

### 4.3 edit_file: old_str is not unique

**Symptom**: tool result contains error `old_str not found` or `old_str matches multiple locations`. The edit fails.

**Cause**: `edit_file` uses exact string replacement. If `old_str` appears more than once or does not exist exactly as passed, it fails.

**Solution**: the agent itself resolves this, but if it occurs repeatedly:

```bash
# Verify the exact file content
cat -A file.py  # shows tabs and spaces

# The agent should use a longer and unique old_str
# If it persists, instruct the agent to use apply_patch instead of edit_file
architect run "Use apply_patch instead of edit_file for changes in file.py"
```

### 4.4 apply_patch: context does not match

**Symptom**: tool result contains `patch failed` or `context mismatch`. The patch cannot be applied.

**Cause**: the context lines of the unified diff do not match the current file content. The file was modified between when the agent read it and generated the patch.

**Solution**: the agent normally retries by reading the file again. If it persists:

```bash
# Diagnose with the log
cat debug.jsonl | jq 'select(.tool == "apply_patch") | {args: .args, error: .error}'
```

The agent should use `read_file` before `apply_patch` to get the updated content.

### 4.5 run_command blocked or timeout

**Symptom**: tool result contains `Command blocked` (command in the blocked list) or `Command timed out after Ns`.

**Cause**: the command matches a blocked pattern (built-in or custom) or exceeds the timeout.

**Solution**:

```yaml
# .architect.yaml
commands:
  enabled: true
  default_timeout: 60       # increase timeout (default: 30)
  max_output_lines: 500     # increase output (default: 200)

  # Add safe commands
  safe_commands:
    - "npm test"
    - "cargo build"

  # Add additional blocked patterns
  blocked_patterns:
    - "docker rm"

  # Only allow safe/dev commands (restrictive mode)
  allowed_only: false   # true = safe+dev only
```

### 4.6 delete_file not allowed

**Symptom**: tool result contains `Delete not allowed` or `File deletion disabled`.

**Cause**: by default, `allow_delete` is disabled in the workspace configuration.

**Solution**:

```yaml
# .architect.yaml
workspace:
  allow_delete: true   # allow file deletion
```

---

## 5. Hook and guardrail problems

### 5.1 Hook timeout

**Symptom**: log shows `hook.timeout` with the hook name. The hook is ignored (returns ALLOW by default).

**Cause**: the hook takes longer than its configured timeout (default: 10 seconds).

**Solution**:

```yaml
hooks:
  post_tool_use:
    - name: "my-linter"
      command: "ruff check --fix $ARCHITECT_FILE_PATH"
      timeout: 30   # increase (default: 10, max: 300)
```

```bash
# Verify how long the hook takes manually
time ruff check --fix src/main.py
```

### 5.2 Hook blocks unexpectedly

**Symptom**: HUMAN output shows `Hook name: (warning)`. The agent receives a block message from the hook but it should not. The tool call is not executed.

**Cause**: a pre-hook returns exit code 2 (BLOCK) when it should not. The hook's stderr contains the block reason.

**Solution**:

```bash
# Run the hook manually to see what happens
export ARCHITECT_EVENT=pre_tool_use
export ARCHITECT_TOOL_NAME=edit_file
export ARCHITECT_WORKSPACE=$(pwd)
echo '{"path": "src/main.py"}' | bash -c 'your-hook-command'
echo "Exit code: $?"  # 0=ALLOW, 2=BLOCK

# Check in the JSON log
cat debug.jsonl | jq 'select(.event == "hook.error" or .event == "agent.hook.complete")'
```

**Hook exit code protocol**:
- Exit 0 = ALLOW (permit the action)
- Exit 2 = BLOCK (block, stderr = reason)
- Other = Hook error (logged as WARNING, does not block)

### 5.3 Guardrail blocks file access

**Symptom**: tool result contains `Sensitive file blocked by guardrail: X (pattern: Y)` or `Protected file blocked by guardrail: X (pattern: Y)`.

**Cause**: the file matches a pattern in `guardrails.sensitive_files` (blocks read and write) or `guardrails.protected_files` (blocks write only).

**Solution**:

```yaml
guardrails:
  enabled: true

  # sensitive_files: blocks READ and WRITE (v1.1.0)
  # Use for files with secrets that the LLM should not even read
  sensitive_files:
    - ".env*"
    - "*.pem"
    - "*.key"
    - "secrets.*"

  # protected_files: blocks WRITE only
  # Use for files the LLM can read but not modify
  protected_files:
    - "Dockerfile"
    - "docker-compose*.yml"
    - "deploy/**"
    # Verify that there are no overly broad patterns
    # For example "*.json" would block ALL JSON files
```

```bash
# View which files are blocked (sensitive and protected)
cat debug.jsonl | jq 'select(.event == "guardrail.sensitive_file_blocked" or .event == "guardrail.file_blocked")'
```

### 5.4 Code rules block edits

**Symptom**: the agent writes code but receives a warning or block with the message from a code rule. The log shows `guardrail.code_rule_violation`.

**Cause**: the content written by the agent matches a regex pattern of a code rule with severity `block`.

**Solution**:

```yaml
guardrails:
  code_rules:
    - pattern: "import os\\.system"
      message: "Use subprocess instead of os.system"
      severity: "warn"     # "warn" attaches a warning, "block" prevents write

    - pattern: "TODO|FIXME|HACK"
      message: "Do not leave TODOs in the code"
      severity: "warn"     # change from "block" to "warn" if too strict
```

### 5.5 Modified files or lines limit reached

**Symptom**: tool result contains `Modified files limit reached` or `Changed lines limit reached`.

**Cause**: the guardrail `max_files_modified` or `max_lines_changed` has been reached during the session.

**Solution**:

```yaml
guardrails:
  max_files_modified: 20    # increase or set to null for no limit
  max_lines_changed: 2000   # increase or set to null
  max_commands_executed: 50  # increase or set to null
```

---

## 6. Advanced feature problems

### 6.1 Sessions: cannot resume

**Symptom**: `architect resume <id>` shows `session not found` or loads a corrupted session.

**Cause**: the session does not exist in `.architect/sessions/`, the JSON file is corrupted, or the session was automatically cleaned up.

**Solution**:

```bash
# List available sessions
architect sessions

# Verify that the directory exists
ls -la .architect/sessions/

# If the session was cleaned up, check the cleanup configuration
```

```yaml
# .architect.yaml -- keep sessions longer
sessions:
  auto_save: true
  cleanup_after_days: 30   # default: 7 days
```

**Note**: if a session has more than 50 messages, it is truncated to the 30 most recent when saved. This may affect resume if important context was lost.

### 6.2 Ralph Loop: never converges

**Symptom**: the Ralph Loop executes all iterations without the checks passing. The `.architect/ralph-progress.md` file shows FAIL on all iterations.

**Cause**: the checks are too strict, the task is too complex for a single iteration, or the agent does not receive enough context from previous errors.

**Solution**:

```bash
# Review the progress
cat .architect/ralph-progress.md

# Verify that the checks work with the current code
pytest tests/ -x          # run the check manually
ruff check src/           # run the check manually

# Use more conservative options
architect loop "task" \
  --check "pytest tests/test_specific.py -x" \
  --max-iterations 10 \
  --max-cost 5.00 \
  --model gpt-4o
```

**Common causes of non-convergence**:
- The check fails for reasons unrelated to the task (pre-existing broken tests).
- The agent does not include the `COMPLETE` tag in its response (required to converge).
- The task requires changes across multiple files that the agent cannot resolve in a single iteration.
- The check timeout (120s) is insufficient for large test suites.

### 6.3 Parallel: worktree conflicts

**Symptom**: error `Error creating worktree` when starting parallel execution. Or worktrees remain orphaned after an interrupted execution.

**Cause**: worktrees from previous executions were not cleaned up. Git does not allow creating a worktree if the branch already exists or the directory is occupied.

**Solution**:

```bash
# Clean up worktrees and branches from previous executions
architect parallel-cleanup

# Clean up manually if the command fails
git worktree list                            # view active worktrees
git worktree remove .architect-parallel-1 --force
git worktree remove .architect-parallel-2 --force
git worktree prune                           # clean up orphans
git branch -D architect/parallel-1           # delete branches
git branch -D architect/parallel-2
```

### 6.4 Pipeline: YAML with incorrect fields (v1.1.0)

**Symptom**: when running `architect pipeline`, it shows `Validation error: Pipeline 'file.yaml' has validation errors:` followed by a list of errors, and the process exits with exit code 3.

**Cause**: the pipeline YAML has incorrect fields, empty prompts, or unknown fields. Since v1.1.0, the pipeline validates the YAML before executing.

**Solution**:

```bash
# Review the error message — it lists ALL problems at once
architect pipeline pipeline.yaml
# Validation error: Pipeline 'pipeline.yaml' has validation errors:
#   analyze: unknown field 'task' (did you mean 'prompt'?)
#   analyze: missing 'prompt' or empty
```

**Common errors**:
- `task:` instead of `prompt:` — use `prompt:` (the hint indicates this)
- Empty prompt `prompt: ""` — each step needs a prompt with content
- Invented fields (`priority:`, `description:`) — only the 9 valid fields: `name`, `agent`, `prompt`, `model`, `checkpoint`, `condition`, `output_var`, `checks`, `timeout`
- Steps as strings instead of YAML objects

### 6.5 Pipeline: variables are not resolved

**Symptom**: the pipeline prompt literally contains `{{variable}}` instead of the expected value. The agent receives the unresolved template.

**Cause**: the variable is not defined in the pipeline YAML or in the `--var` CLI flags. Undefined variables are left as-is (not resolved).

**Solution**:

```yaml
# pipeline.yaml
name: my-pipeline
variables:
  target_dir: "src/"           # define default value
  test_command: "pytest"

steps:
  - name: build
    prompt: "Build in {{target_dir}}"  # resolves to "src/"
```

```bash
# Pass variables from CLI (override YAML values)
architect pipeline pipeline.yaml --var target_dir=lib/ --var test_command="npm test"

# Verify resolution with dry-run
architect pipeline pipeline.yaml --dry-run
```

### 6.6 Checkpoints: not being created

**Symptom**: `architect history` does not show checkpoints. The log has no `checkpoint.created` events.

**Cause**: checkpoints are not enabled in config, there are no changes to commit (clean git status), or git is not initialized.

**Solution**:

```yaml
# .architect.yaml
checkpoints:
  enabled: true
  every_n_steps: 5   # create checkpoint every 5 steps
```

```bash
# Verify that there is a git repository
git status

# Verify that there are changes to commit
git status --porcelain

# Search for existing checkpoints manually
git log --oneline --grep="architect:checkpoint"
```

**Note**: checkpoints are git commits with the prefix `architect:checkpoint`. If the workspace has no staged changes, no commit is created. If `git add -A` does not capture anything new, the checkpoint is silently skipped.

### 6.7 Auto-review: does not detect issues

**Symptom**: the auto-review always reports "No issues found" even though there are obvious problems.

**Cause**: the diff is too large (truncated to 8000 characters), the reviewer does not have enough context, or the reviewer model is too weak.

**Solution**:

```yaml
# .architect.yaml
auto_review:
  enabled: true
  review_model: "gpt-4o"       # use a capable model for review
  max_fix_passes: 2             # try to fix up to 2 times
```

---

## 7. CI/CD problems

### 7.1 No TTY for confirmation mode

**Symptom**: error `NoTTYError` or `Cannot confirm: no TTY available`. Exit code 1.

**Cause**: in CI/CD there is no interactive terminal. The confirmation mode `confirm-all` or `confirm-sensitive` requires user input.

**Solution**:

```bash
# Use yolo mode (no confirmation) in CI
architect run "task" --confirm-mode yolo

# Or the short alias
architect run "task" -m yolo
```

```yaml
# .architect.yaml for CI
agents:
  build:
    confirm_mode: "yolo"
```

### 7.2 Exit codes in CI pipelines

**Symptom**: the CI pipeline fails or passes when it should not. The Architect exit codes are not interpreted correctly.

**Cause**: Architect uses specific exit codes that CI does not distinguish.

**Solution**: handle exit codes explicitly:

```bash
# In GitHub Actions / shell script
architect run "task" --confirm-mode yolo --json --budget 5.00
EXIT_CODE=$?

case $EXIT_CODE in
  0) echo "Full success" ;;
  1) echo "Failed" ; exit 1 ;;
  2) echo "Partial — review output" ;;
  3) echo "Configuration error" ; exit 1 ;;
  4) echo "Authentication error" ; exit 1 ;;
  5) echo "Timeout" ; exit 1 ;;
  130) echo "Interrupted" ; exit 1 ;;
esac
```

```bash
# Use --exit-code-on-partial to treat partial as error
architect run "task" --confirm-mode yolo --exit-code-on-partial
# Now exit code 2 (partial) becomes exit code 1 (failed)
```

### 7.3 JSON output: incorrect parsing

**Symptom**: CI tries to parse the JSON output but fails. The JSON is mixed with logs or is incomplete.

**Cause**: without `--json`, the result goes to stdout but HUMAN logs go to stderr. If CI captures both streams, they get mixed. Or the agent is interrupted before generating complete JSON.

**Solution**:

```bash
# Ensure clean JSON output
architect run "task" --json --quiet 2>/dev/null > result.json

# --json: JSON output to stdout
# --quiet: suppress HUMAN logs on stderr
# 2>/dev/null: suppress all stderr

# Parse with jq
cat result.json | jq '.status'
cat result.json | jq '.costs.total_cost_usd'
```

### 7.4 Budget exhausted in CI

**Symptom**: the agent terminates with `StopReason: BUDGET_EXCEEDED`, exit code 2 (partial). The task remains incomplete.

**Cause**: the configured budget is insufficient for the task complexity. Larger models consume more tokens.

**Solution**:

```bash
# Increase budget
architect run "task" --budget 10.00 --confirm-mode yolo

# Use prompt caching to reduce costs
```

```yaml
# .architect.yaml
costs:
  budget_usd: 10.00
  warn_at_usd: 7.00

llm:
  prompt_caching: true   # reduces cost 50-90% on repeated calls
```

```bash
# Monitor costs in CI
architect run "task" --json --confirm-mode yolo > result.json
COST=$(cat result.json | jq '.costs.total_cost_usd // 0')
echo "Execution cost: $${COST}"
```

### 7.5 MCP server not accessible

**Symptom**: log shows MCP connection errors. The MCP tools are not registered. The agent works but without the remote tools.

**Cause**: the MCP server is not accessible from the CI environment, the token has expired, or the URL is incorrect.

**Solution**:

```yaml
# .architect.yaml
mcp:
  servers:
    - name: "docs"
      url: "https://mcp-server.example.com"
      token_env: "MCP_DOCS_TOKEN"   # env var with the token
```

```bash
# Verify connectivity
curl -v https://mcp-server.example.com

# Verify that the token is configured
echo $MCP_DOCS_TOKEN

# In CI, configure as a secret
# GitHub Actions:
# env:
#   MCP_DOCS_TOKEN: ${{ secrets.MCP_DOCS_TOKEN }}
```

---

## 8. Diagnostics with logging

### 8.1 Capture the complete log

```bash
# Capture EVERYTHING (JSON debug + verbose console)
architect run "task" --log-file session.jsonl -vvv
```

The `session.jsonl` file contains each event as a JSON line. This includes LLM calls, tool calls, results, hooks, safety nets, and more.

### 8.2 Useful queries with jq

```bash
# View all executed tool calls
cat session.jsonl | jq 'select(.event == "agent.tool_call.execute") | {tool: .tool, args: .args}'

# View only tool errors
cat session.jsonl | jq 'select(.event == "agent.tool_call.complete" and .success == false) | {tool: .tool, error: .error}'

# View LLM calls and message count
cat session.jsonl | jq 'select(.event == "agent.llm.call") | {step: .step, messages: .messages_count}'

# View all safety net triggers
cat session.jsonl | jq 'select(.event | startswith("safety."))'

# View costs per step
cat session.jsonl | jq 'select(.event == "cost_tracker.record") | {step: .step, model: .model, cost: .cost_usd, tokens_in: .input_tokens, tokens_out: .output_tokens}'

# View hook events
cat session.jsonl | jq 'select(.event | startswith("hook."))'

# View guardrail events
cat session.jsonl | jq 'select(.event | startswith("guardrail."))'

# View context compression
cat session.jsonl | jq 'select(.event | startswith("context."))'

# Extract the final stop_reason
cat session.jsonl | jq 'select(.event == "agent.loop.complete") | {status: .status, stop_reason: .stop_reason, steps: .total_steps}'

# View LLM errors
cat session.jsonl | jq 'select(.event == "agent.llm_error") | .error'

# Quick summary: count of each event type
cat session.jsonl | jq -r '.event' | sort | uniq -c | sort -rn
```

### 8.3 Reading the HUMAN output (icons)

The HUMAN output uses icons to indicate the event type:

| Icon | Meaning |
|------|---------|
| 🔄 | Step N: LLM call / closing |
| ✓ | Successful LLM response or tool OK |
| 🔧 | Local tool execution |
| 🌐 | MCP tool execution (remote) |
| 🔍 | Hook result |
| ✅ | Agent complete (success) |
| ⚡ | Agent stopped (partial or failed) |
| ⚠️ | Safety net triggered or warning |
| ❌ | LLM error |
| 📦 | Context compression/management |

### 8.4 Verbose levels (-v/-vv/-vvv)

| Flag | Console level | What it shows |
|------|---------------|---------------|
| (none) | WARNING | Only HUMAN output (agent steps) + severe errors |
| `-v` | INFO | HUMAN + system operations: config loaded, tools registered, indexer |
| `-vv` | DEBUG | HUMAN + technical detail: complete args, LLM responses, timing |
| `-vvv` | DEBUG | HUMAN + EVERYTHING: HTTP requests, complete payloads |

HUMAN logs are shown **always** (except `--quiet`/`--json`), regardless of `-v`.

```bash
# For development/debug, use -vv
architect run "task" -vv --log-file debug.jsonl

# For CI, use --quiet or --json
architect run "task" --json --quiet --confirm-mode yolo
```

---

## 9. Quick exit code table

| Exit Code | Name | Description | Typical StopReason |
|-----------|------|-------------|-------------------|
| 0 | SUCCESS | Task completed successfully | `LLM_DONE` |
| 1 | FAILED | Task failed (unrecoverable error) | `LLM_ERROR` |
| 2 | PARTIAL | Task partially completed | `MAX_STEPS`, `BUDGET_EXCEEDED`, `CONTEXT_FULL`, `TIMEOUT` |
| 3 | CONFIG_ERROR | Error in the YAML configuration or flags | -- |
| 4 | AUTH_ERROR | Authentication failure with the LLM | -- |
| 5 | TIMEOUT | Global execution timeout | `TIMEOUT` |
| 130 | INTERRUPTED | Ctrl+C or SIGTERM | `USER_INTERRUPT` |

### StopReason table

| StopReason | Type | Description | Recommended action |
|------------|------|-------------|-------------------|
| `LLM_DONE` | Natural | The LLM decided it was done (did not request more tools) | Verify that the result is correct |
| `MAX_STEPS` | Safety net | The step limit was reached | Increase `max_steps` or simplify the task |
| `BUDGET_EXCEEDED` | Safety net | The USD budget was exceeded | Increase `budget_usd` or use a cheaper model |
| `CONTEXT_FULL` | Safety net | The context window was filled | Adjust `context` config or split the task |
| `TIMEOUT` | Safety net | The time limit was exceeded | Increase `--timeout` or simplify the task |
| `USER_INTERRUPT` | Manual | The user pressed Ctrl+C / sent SIGTERM | The agent attempts a graceful shutdown and resume |
| `LLM_ERROR` | Error | Unrecoverable LLM error (after retries) | Verify API key, model, connectivity |

---

## 10. Quick diagnostic checklist

For any problem, follow this order:

1. **Check exit code**: `echo $?` after execution.
2. **Read HUMAN output**: look for the last warning/error icon.
3. **Review with verbose**: repeat with `-vv`.
4. **Capture JSON log**: repeat with `--log-file debug.jsonl`.
5. **Filter with jq**: use the queries from section 8.2.
6. **Verify config**: `architect run --dry-run "test" -v` to see which config is loaded.
7. **Test hooks manually**: run the hook commands outside of Architect.
8. **Review .architect.yaml**: validate with `python -c "from architect.config.loader import load_config; load_config('.')"`.
