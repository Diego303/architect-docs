---
title: "CLI Usage"
description: "Practical usage guide: flags, logging, configs, CI/CD, scripts, custom agents."
icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
order: 3
---

# Usage Guide — architect CLI

Practical real-world usage guide: from the simplest case to advanced configurations for CI/CD, multiple projects, and teams. Includes all flags, logging combinations, and automation patterns.

> **Note on versions**: The references `(v4-A1)`, `(v4-B1)`, `(v4-C1)`, etc. in section titles refer to phases of the internal development plan (Base Plan v4). Version 1.0.0 is the first official release and contains all of these features.

---

## Table of Contents

1. [Installation and initial setup](#1-installation-and-initial-setup)
2. [Basic usage without configuration](#2-basic-usage-without-configuration)
3. [Agent selection (-a)](#3-agent-selection--a)
4. [Confirmation modes (--mode)](#4-confirmation-modes---mode)
5. [Output flags: --json, --quiet, --dry-run](#5-output-flags---json---quiet---dry-run)
6. [Logging flags: -v, --log-level, --log-file](#6-logging-flags--v---log-level---log-file)
7. [Silent usage (no logs)](#7-silent-usage-no-logs)
8. [LLM flags: --model, --api-base, --api-key, --timeout](#8-llm-flags---model---api-base---api-key---timeout)
9. [Configuration files](#9-configuration-files)
10. [Per-environment configurations](#10-per-environment-configurations)
11. [MCP: remote tools](#11-mcp-remote-tools)
12. [Incremental editing tools (F9)](#12-incremental-editing-tools-f9)
13. [Indexer and search tools (F10)](#13-indexer-and-search-tools-f10)
14. [Context window management (F11)](#14-context-window-management-f11)
15. [Self-evaluation --self-eval (F12)](#15-self-evaluation---self-eval-f12)
16. [Command execution --allow-commands (F13)](#16-command-execution---allow-commands-f13)
17. [Cost tracking --show-costs (F14)](#17-cost-tracking---show-costs-f14)
18. [Lifecycle hooks (v4-A1)](#18-lifecycle-hooks-v4-a1)
19. [Usage in scripts and pipes](#19-usage-in-scripts-and-pipes)
20. [CI/CD: GitHub Actions, GitLab, cron](#20-cicd-github-actions-gitlab-cron)
21. [Multi-project: workspace and per-project config](#21-multi-project-workspace-and-per-project-config)
22. [Custom agents in YAML](#22-custom-agents-in-yaml)
23. [Auxiliary commands](#23-auxiliary-commands)
24. [Quick flags reference](#24-quick-flags-reference)
25. [Guardrails (v4-A2)](#25-guardrails-v4-a2)
26. [Skills and .architect.md (v4-A3)](#26-skills-and-architectmd-v4-a3)
27. [Procedural memory (v4-A4)](#27-procedural-memory-v4-a4)
28. [Sessions and resume (v4-B1)](#28-sessions-and-resume-v4-b1)
29. [Execution reports (v4-B2)](#29-execution-reports-v4-b2)
30. [Detailed Dry Run (v4-B4)](#30-detailed-dry-run-v4-b4)
31. [Advanced CI/CD flags (v4-B3)](#31-advanced-cicd-flags-v4-b3)
32. [Ralph Loop — automatic iteration (v4-C1)](#32-ralph-loop--automatic-iteration-v4-c1)
33. [Pipeline Mode — YAML workflows (v4-C3)](#33-pipeline-mode--yaml-workflows-v4-c3)
34. [Parallel execution in worktrees (v4-C2)](#34-parallel-execution-in-worktrees-v4-c2)
35. [Checkpoints and rollback (v4-C4)](#35-checkpoints-and-rollback-v4-c4)
36. [Post-build auto-review (v4-C5)](#36-post-build-auto-review-v4-c5)
37. [Competitive evaluation — architect eval (v1.0.0)](#37-competitive-evaluation--architect-eval-v100)
38. [Code Health — architect health (v1.0.0)](#38-code-health--architect-health-v100)
39. [Presets — architect init (v1.0.0)](#39-presets--architect-init-v100)
40. [Sub-agents — dispatch_subagent (v1.0.0)](#40-sub-agents--dispatch_subagent-v100)
41. [OpenTelemetry — distributed traces (v1.0.0)](#41-opentelemetry--distributed-traces-v100)

---

## 1. Installation and initial setup

```bash
# From PyPI
pip install architect-ai-cli

# Optional extras
pip install architect-ai-cli[dev]        # pytest, black, ruff, mypy
pip install architect-ai-cli[telemetry]  # OpenTelemetry (OTLP traces)
pip install architect-ai-cli[health]     # radon (cyclomatic complexity)

# Or from GitHub
git clone https://github.com/Diego303/architect-cli.git
cd architect-cli
pip install -e .

# Verify installation
architect --version   # architect, version 1.0.0
architect --help

# Configure API key (minimum required for LLM calls)
export LITELLM_API_KEY="sk-..."

# Verify it works (doesn't need API key for this)
architect agents
architect validate-config -c config.example.yaml
```

**Relevant files in the initial setup:**

```
architect-cli/
+-- config.example.yaml   <- starting point for your config.yaml
+-- pyproject.toml        <- project dependencies
+-- src/architect/        <- source code
```

Copy the example as a base:

```bash
cp config.example.yaml config.yaml
# Edit config.yaml according to your needs
```

---

## 2. Basic usage without configuration

The simplest case: just the API key in env, without any YAML file.

```bash
export LITELLM_API_KEY="sk-..."

# Analyze a project (read-only — safe)
architect run "explain what this project does and its structure"

# Read and summarize a file
architect run "read main.py and explain what each function does" -a resume

# Review code
architect run "review src/utils.py and detect potential issues" -a review

# Plan a task (without executing anything)
architect run "plan how to add JWT authentication to the project" -a plan
```

Without `-c config.yaml`, architect uses all defaults:
- Model: `gpt-4o`
- Workspace: current directory (`.`)
- Streaming: active
- `allow_delete`: disabled
- Confirmation: according to the chosen agent
- Indexer: enabled (builds project tree automatically)

---

## 3. Agent selection (`-a`)

```bash
# Without -a -> build agent directly (default since v0.15.0)
architect run "refactor the authentication module"

# Specific agent with -a / --agent
architect run "PROMPT" -a plan       # only analyzes, never modifies
architect run "PROMPT" -a build      # creates and modifies files
architect run "PROMPT" -a resume     # reads and summarizes, no confirmations
architect run "PROMPT" -a review     # code review

# Custom agent defined in config.yaml
architect run "PROMPT" -a deploy -c config.yaml
architect run "PROMPT" -a security-audit -c config.yaml
```

**When to use each agent?**

| Situation | Recommended agent |
|-----------|-------------------|
| Understanding a new project | `resume` or `review` |
| Detecting bugs or issues | `review` |
| Planning before executing | `plan` |
| Creating files or refactoring | `build` or mixed mode |
| Complex task requiring prior analysis | `plan` first, then `build` |
| Clear and well-defined task | `build` (default, without `-a`) |

---

## 4. Confirmation modes (`--mode`)

Controls whether architect asks for confirmation before each file operation.

```bash
# confirm-all: confirms absolutely everything (read AND write)
architect run "PROMPT" -a build --mode confirm-all

# confirm-sensitive: only confirms writes and deletes (build agent default)
architect run "PROMPT" -a build --mode confirm-sensitive

# yolo: no confirmations (for CI or when you trust the agent)
architect run "PROMPT" -a build --mode yolo

# Usage examples by context
architect run "add docstrings to utils.py" -a build --mode yolo         # development
architect run "reorganize project folders" -a build --mode confirm-sensitive  # production
architect run "analyze dependencies" -a resume --mode yolo               # read-only, safe
```

**TTY note**: `--mode confirm-all` and `--mode confirm-sensitive` require an interactive terminal. In scripts or CI without TTY, use `--mode yolo` or `--dry-run`.

```bash
# In CI: always yolo or dry-run
architect run "PROMPT" --mode yolo
architect run "PROMPT" --dry-run
```

The `--mode` flag overrides the agent's `confirm_mode`. If the agent has `confirm_mode: confirm-all` in YAML but you pass `--mode yolo`, the CLI flag prevails.

**Note on parallel tools**: with `--mode yolo`, independent tool calls execute in parallel automatically (up to 4 in parallel). With `--mode confirm-sensitive`, if any tool is sensitive (`write_file`, `edit_file`, etc.) execution becomes sequential to allow interactive confirmation.

---

## 5. Output flags: `--json`, `--quiet`, `--dry-run`

### `--dry-run` — simulate without executing

```bash
# See what the agent would do without actually doing it
architect run "delete all .tmp files from the project" -a build --dry-run

# Dry-run with verbose to see the full plan
architect run "refactor config.py to use dataclasses" -a build --dry-run -v

# Dry-run in CI to validate the prompt before executing in prod
architect run "update obsolete imports" --mode yolo --dry-run
```

With `--dry-run`:
- Tool calls execute in simulation mode.
- Messages returned to the LLM are `[DRY-RUN] Would execute: write_file(path=...)`.
- The LLM can continue reasoning about the results as if they were real.
- No files are modified.

### `--json` — structured output

```bash
# JSON output to stdout (logs to stderr)
architect run "summarize the project" -a resume --quiet --json

# Parse with jq
architect run "summarize the project" -a resume --quiet --json | jq .status
architect run "summarize the project" -a resume --quiet --json | jq .output
architect run "summarize the project" -a resume --quiet --json | jq .steps
architect run "summarize the project" -a resume --quiet --json | jq '.tools_used[].name'
```

JSON format:
```json
{
  "status":           "success",
  "output":           "The project consists of...",
  "steps":            3,
  "tools_used": [
    {"name": "read_file", "success": true},
    {"name": "edit_file", "success": true},
    {"name": "search_code", "success": true}
  ],
  "duration_seconds": 8.5,
  "model":            "gpt-4o-mini"
}
```

`--json` disables streaming automatically (chunks are not sent to stderr).

### `--quiet` — only the final result

```bash
# No logs, only stdout with the response
architect run "generate the content of a .gitignore for Python" -a build --quiet

# Redirect the result to a file
architect run "generate the content of a .gitignore for Python" -a build --quiet > .gitignore

# Combined with --json for clean pipes
architect run "summarize the project" -a resume --quiet --json | jq -r .output
```

`--quiet` moves the log level to ERROR (only errors to stderr). The agent's response still goes to stdout.

---

## 6. Logging flags: `-v`, `--log-level`, `--log-file`

### Verbose levels

```bash
# Without -v: only agent steps with icons to stderr (HUMAN level, WARNING technical)
architect run "PROMPT" -a resume

# -v: agent steps and tool calls (INFO level)
architect run "PROMPT" -a build -v

# -vv: tool arguments and LLM responses (DEBUG level)
architect run "PROMPT" -a build -vv

# -vvv: everything, including HTTP requests and full payloads
architect run "PROMPT" -a build -vvv
```

Example output with `-v`:
```
[INFO] agent.loop.start  agent=build step_timeout=0
[INFO] agent.step.start  step=1
[INFO] agent.tool_call.execute  tool=search_code pattern="def validate" file_pattern="*.py"
[INFO] agent.tool_call.complete tool=search_code success=True chars=842
[INFO] agent.tool_call.execute  tool=edit_file path=src/utils.py
[INFO] agent.tool_call.complete tool=edit_file success=True
[INFO] eval.basic.start   prompt_preview="refactor validate_path..."
[INFO] eval.basic.complete completed=True confidence=92%
[INFO] agent.complete     status=success steps=2
```

### `--log-level` — base logger level

```bash
# Only errors (most restrictive)
architect run "PROMPT" --log-level error

# Full debug (equivalent to -vvv, but without --verbose count)
architect run "PROMPT" --log-level debug
```

### `--log-file` — save logs to JSON file

```bash
# Save logs to JSON Lines file
architect run "PROMPT" -a build -v --log-file logs/session.jsonl

# The file captures full DEBUG regardless of console verbose
architect run "PROMPT" --log-file logs/session.jsonl     # console quiet, file DEBUG

# Analyze the logs afterwards
cat logs/session.jsonl | jq 'select(.event == "agent.tool_call.execute")'
cat logs/session.jsonl | jq 'select(.level == "error")'
cat logs/session.jsonl | jq 'select(.event | startswith("eval."))'
cat logs/session.jsonl | jq -r '.event + " " + (.step | tostring)' 2>/dev/null
```

---

## 7. Silent usage (no logs)

For scripts, pipes, and automation where only the result matters.

```bash
# Clean result to stdout, no logs to stderr
architect run "summarize the project in 3 lines" -a resume --quiet

# Result to file, errors to /dev/null
architect run "generate README.md" -a build --quiet 2>/dev/null

# Only parsed JSON, total silence
architect run "analyze dependencies" -a resume --quiet --json 2>/dev/null | jq -r .output

# Check if it succeeded without seeing anything
architect run "validate the configuration" -a resume --quiet 2>/dev/null
echo "Exit code: $?"   # 0=success, 1=failure, 2=partial, 3=config error...
```

**Output path summary:**

```
Normal mode:    stderr <- [streaming + logs]    stdout <- [final result]
--quiet:        stderr <- [only errors]          stdout <- [final result]
--json:         stderr <- [logs per -v]          stdout <- [full JSON]
--quiet --json: stderr <- [only errors]          stdout <- [full JSON]
```

---

## 8. LLM flags: `--model`, `--api-base`, `--api-key`, `--timeout`

### Change model

```bash
# OpenAI
architect run "PROMPT" --model gpt-4o
architect run "PROMPT" --model gpt-4o-mini           # cheaper
architect run "PROMPT" --model o1-mini               # reasoning

# Anthropic
architect run "PROMPT" --model claude-opus-4-6       # most capable
architect run "PROMPT" --model claude-sonnet-4-6     # balanced
architect run "PROMPT" --model claude-haiku-4-5-20251001  # fastest

# Google Gemini
architect run "PROMPT" --model gemini/gemini-2.0-flash
architect run "PROMPT" --model gemini/gemini-1.5-pro

# Ollama (local, no API key)
architect run "PROMPT" --model ollama/llama3 --api-base http://localhost:11434
architect run "PROMPT" --model ollama/mistral --api-base http://localhost:11434
architect run "PROMPT" --model ollama/codellama --api-base http://localhost:11434
```

### Timeout and retries

```bash
# 120-second timeout for the FULL SESSION (watchdog)
architect run "PROMPT" --timeout 120

# Long tasks: increase session timeout
architect run "analyze all the repository's source code" -a resume --timeout 300

# Quick tasks in CI: short timeout to fail early
architect run "summarize README" -a resume --timeout 30
```

**Note**: `--timeout` controls the **total session** timeout (watchdog), not the per-individual-LLM-call timeout. The per-request timeout is configured in the YAML with `llm.timeout` (default: 60s). This allows long sessions (`--timeout 300`) without each LLM call having an excessive timeout.

---

## 9. Configuration files

### Minimal `config.yaml` structure

```yaml
llm:
  model: gpt-4o-mini
  api_key_env: LITELLM_API_KEY
  timeout: 60

workspace:
  root: .
  allow_delete: false
```

### Development `config.yaml` (with verbose and self-eval)

```yaml
llm:
  model: gpt-4o-mini
  api_key_env: LITELLM_API_KEY
  timeout: 60
  retries: 1
  stream: true

workspace:
  root: .
  allow_delete: false

logging:
  level: debug
  verbose: 2
  file: logs/dev.jsonl

indexer:
  enabled: true
  use_cache: true

context:
  max_tool_result_tokens: 2000
  parallel_tools: true

evaluation:
  mode: basic              # always evaluate in development
  confidence_threshold: 0.75

agents:
  build:
    confirm_mode: confirm-sensitive
    max_steps: 10
```

### Production / automation `config.yaml`

```yaml
llm:
  model: gpt-4o
  api_key_env: OPENAI_API_KEY
  timeout: 120
  retries: 3
  stream: false

workspace:
  root: /path/to/project
  allow_delete: false

logging:
  level: warn
  verbose: 0
  file: /var/log/architect/run.jsonl

indexer:
  enabled: true
  use_cache: true

context:
  max_tool_result_tokens: 2000
  max_context_tokens: 80000
  parallel_tools: true

evaluation:
  mode: full               # with retries in production
  max_retries: 2
  confidence_threshold: 0.8

agents:
  build:
    confirm_mode: yolo
    max_steps: 30
```

### Use `-c` to specify the file

```bash
# Default config (uses defaults if no YAML)
architect run "PROMPT"

# Explicit config
architect run "PROMPT" -c config.yaml
architect run "PROMPT" -c /etc/architect/prod.yaml

# Config + CLI overrides (CLI always wins)
architect run "PROMPT" -c config.yaml --model gpt-4o --mode yolo --self-eval basic
```

---

## 10. Per-environment configurations

### Environment variables as override

```bash
ARCHITECT_MODEL=gpt-4o architect run "PROMPT"
ARCHITECT_WORKSPACE=/other/project architect run "PROMPT"
ARCHITECT_LOG_LEVEL=debug architect run "PROMPT"
```

### Multiple configs with shell aliases

```bash
# In ~/.bashrc or ~/.zshrc
alias architect-dev='architect -c ~/configs/architect-dev.yaml'
alias architect-prod='architect -c ~/configs/architect-prod.yaml --mode confirm-all'
alias aresume='architect run -a resume --mode yolo --quiet'
alias areview='architect run -a review --mode yolo'

# Usage
aresume "explain this project"
areview "review src/auth.py"
architect-dev run "refactor config.py" -a build
```

---

## 11. MCP: remote tools

MCP (Model Context Protocol) allows the agent to use tools on remote servers.

```yaml
mcp:
  servers:
    - name: github
      url: http://localhost:3001
      token_env: GITHUB_TOKEN

    - name: database
      url: https://mcp.company.com/db
      token_env: DB_MCP_TOKEN
```

```bash
# MCP tools are discovered automatically
architect run "create a PR with the current changes" --mode yolo

# Disable MCP
architect run "PROMPT" --disable-mcp

# View available MCP tools
architect agents -c config.yaml
```

MCP tools are named `mcp_{server}_{tool_name}`. With `parallel_tools=true`, independent MCP tool calls execute in parallel, which is especially useful since they are network calls.

**Auto-injection in `allowed_tools`**: Starting from v0.16.2, discovered MCP tools are automatically injected into the active agent's `allowed_tools`. You don't need to list them manually in the agent configuration — just configure the MCP servers and the tools will be available to any agent.

---

## 12. Incremental editing tools (F9)

Starting from v0.9.0, the `build` agent has more precise editing tools than `write_file`:

### `edit_file` — exact text substitution

The agent can modify a specific code block without rewriting the entire file.

```bash
# Example: the agent will use edit_file to change a function
architect run "change the calculate() function in utils.py to accept float parameters" \
  -a build --mode yolo
```

The agent internally:
1. Reads the file with `read_file`
2. Identifies the block to change
3. Calls `edit_file` with the exact text to replace and the new text
4. Verifies the result

**Advantages over `write_file`**:
- Consumes fewer tokens (only sends the changed block, not the entire file)
- Lower risk of losing unrelated code
- The change diff stays in the LLM history

### `apply_patch` — unified diff

For multiple changes in a file:

```bash
# The agent can apply multiple changes at once
architect run "update the logging API in all modules" -a build --mode yolo
```

The agent can generate a unified diff and apply it directly.

### Controlling the editing strategy

The `BUILD_PROMPT` includes a priority table that the agent follows:

```
1. edit_file   — a single contiguous change (preferred)
2. apply_patch — multiple changes or pre-existing diff
3. write_file  — new files or complete reorganization
```

There is no CLI flag to force a strategy — the agent decides based on the task.

---

## 13. Indexer and search tools (F10)

Starting from v0.10.0, the agent knows the project structure from the very beginning.

### The project tree in the system prompt

On startup, architect indexes the workspace and automatically adds the tree to the system prompt:

```
The agent sees something like this in its context:

## Project Structure

Workspace: /home/user/my-project
Files: 47 files | 3,241 lines
Languages: Python (23), YAML (8), Markdown (6)

src/
+-- auth/
|   +-- __init__.py     Python    12 lines
|   +-- jwt.py          Python    89 lines
|   +-- middleware.py   Python    134 lines
+-- utils/
    +-- validators.py   Python    67 lines
```

This reduces the number of `list_files` calls and enables more accurate plans from the start.

### Configure the indexer

```yaml
indexer:
  enabled: true
  max_file_size: 1000000     # skip files > 1MB
  use_cache: true            # 5-minute disk cache

  # Exclude additional dirs (in addition to .git, node_modules, etc.)
  exclude_dirs:
    - vendor
    - .terraform
    - migrations/auto

  # Exclude additional patterns (in addition to *.pyc, *.min.js, etc.)
  exclude_patterns:
    - "*.generated.py"
    - "*.pb.go"
    - "*.lock"
```

### Available search tools

Agents can use these tools during execution:

- `search_code` — search for implementations, code patterns, function uses
- `grep` — search literal text, imports, specific strings
- `find_files` — locate files by name or extension

---

## 14. Context window management (F11)

Starting from v0.11.0, architect automatically manages context for long tasks.

The `ContextManager` acts on 3 levels automatically:

1. **Tool result truncation** (always active): if a `read_file` returns 500 lines, the agent receives the first 40 + the last 20 with a marker.
2. **LLM compression** (after 8+ steps): when the agent has done many steps, the oldest ones are summarized into a paragraph.
3. **Sliding window** (hard limit): if the total exceeds 80k estimated tokens, the oldest messages are removed.

### Configure per model

```yaml
context:
  max_tool_result_tokens: 2000   # max tokens per tool result (~8000 chars)
  summarize_after_steps: 5       # default: 8
  keep_recent_steps: 3           # default: 4
  max_context_tokens: 80000      # gpt-4o/mini
  # max_context_tokens: 150000   # claude-sonnet-4-6 (larger)
  parallel_tools: true           # parallel independent tool calls
```

---

## 15. Self-evaluation `--self-eval` (F12)

Starting from v0.12.0, architect can automatically verify whether the task was completed correctly.

### `basic` mode — one extra evaluation

```bash
architect run "generate unit tests for src/auth.py" -a build --self-eval basic
```

If the evaluation detects problems, the state changes to `partial` (exit code 2).

**Cost**: ~500 extra tokens per evaluation call. No effect on files.

### `full` mode — evaluation with automatic retries

```bash
architect run "migrate database.py from SQLite to PostgreSQL" -a build --self-eval full
```

**When to use `full`**:
- Complex tasks where a partial error is costly
- When the LLM may need to see the result of its own actions to correct
- CI/CD where retrying is preferred over failing

### Configure in YAML (persistent)

```yaml
evaluation:
  mode: basic              # always evaluate (override with --self-eval off)
  confidence_threshold: 0.8
  max_retries: 2           # only for full mode
```

```bash
# CLI always overrides YAML
architect run "PROMPT" --self-eval off    # disables even if YAML says basic/full
architect run "PROMPT" --self-eval full   # enables even if YAML says off
```

---

## 16. Command execution `--allow-commands` (F13)

Starting from v0.13.0, the `build` agent can execute system commands: tests, linters, compilers, and scripts.

### Enable the `run_command` tool

```bash
# Enabled by default if commands.enabled: true in config
architect run "run the tests and fix the errors" -a build --allow-commands --mode yolo

# Disable even if configured
architect run "PROMPT" -a build --no-commands
```

### Sensitivity classification

| Type | Examples | Confirmation in `confirm-sensitive` | Confirmation in `yolo` |
|------|----------|-------------------------------------|------------------------|
| `safe` | `ls`, `cat`, `git status`, `git log`, `grep`, `python --version` | No | No |
| `dev` | `pytest`, `mypy`, `ruff`, `make`, `npm run test`, `cargo build` | **Yes** | No |
| `dangerous` | Any other unrecognized command | **Yes** | No |

### Built-in security

The tool always blocks: `rm -rf /`, `rm -rf ~`, `sudo`, `chmod 777`, `curl|bash`, `dd of=/dev/`, `mkfs` and other destructive commands, regardless of confirmation mode.

### Configure in YAML

```yaml
commands:
  enabled: true
  default_timeout: 60       # default timeout in seconds
  max_output_lines: 200     # output line limit
  safe_commands:
    - "my-custom-lint.sh"   # additional commands classified as 'safe'
  blocked_patterns:
    - "git push"            # block destructive git operations
  allowed_only: false       # if true, only safe/dev permitted in execute()
```

---

## 17. Cost tracking `--show-costs` (F14)

Starting from v0.14.0, architect records the cost of each LLM call and can stop execution if a budget is exceeded.

```bash
# Show summary at the end
architect run "PROMPT" -a build --show-costs

# Budget limit
architect run "long task" -a build --mode yolo --budget 0.50

# Prompt caching — token savings
# config.yaml
# llm:
#   prompt_caching: true   # saves 50-90% on system prompt in repeated calls
```

### Configure budget in YAML

```yaml
costs:
  enabled: true
  budget_usd: 2.0      # max $2 per execution
  warn_at_usd: 1.0     # warning (no stop) at $1

llm_cache:
  enabled: false         # local cache for development
  ttl_hours: 24
```

---

## 18. Lifecycle hooks (v4-A1)

Starting from v0.16.0 (Base Plan v4 Phase A), architect supports a complete system of hooks on **10 lifecycle events**. The system is backward-compatible with previous `post_edit` hooks.

### Available events

| Event | When it runs | Type |
|-------|-------------|------|
| `pre_tool_use` | Before executing each tool call | Pre-hook (can BLOCK) |
| `post_tool_use` | After executing each tool call | Post-hook |
| `pre_llm_call` | Before each LLM call | Pre-hook (can BLOCK) |
| `post_llm_call` | After each LLM response | Post-hook |
| `session_start` | On agent session start | Notification |
| `session_end` | On agent session end | Notification |
| `on_error` | When an error occurs in the loop | Notification |
| `budget_warning` | When `warn_at_usd` is reached | Notification |
| `context_compress` | When context is compressed | Notification |
| `agent_complete` | When the agent completes its task | Notification |

### Exit code protocol

Hooks are executed as system subprocesses and communicate via exit codes:

| Exit code | Decision | Description |
|:---------:|----------|-------------|
| `0` | **ALLOW** | Allows the action. stdout can contain JSON with `additionalContext` or `updatedInput` |
| `2` | **BLOCK** | Blocks the action (pre-hooks only). stderr contains the reason |
| Other | **Error** | Logged as warning, doesn't break the loop. Action is allowed |

### Configure hooks in YAML

```yaml
hooks:
  pre_tool_use:
    - name: validate-path
      command: "python3 scripts/validate.py"
      matcher: "write_file|edit_file"    # regex to filter tools
      timeout: 5

  post_tool_use:
    - name: python-lint
      command: "ruff check {file} --no-fix"
      file_patterns: ["*.py"]
      timeout: 15
    - name: python-typecheck
      command: "mypy {file} --no-error-summary"
      file_patterns: ["*.py"]
      timeout: 30

  session_start:
    - name: notify-start
      command: "echo 'Session started'"
      async: true                        # run in background without blocking
```

### Hook fields

```yaml
- name: my-hook             # descriptive name
  command: "my-script.sh"   # shell command to execute
  matcher: "*"              # regex/glob to filter tools (default: "*")
  file_patterns: ["*.py"]   # glob patterns to filter files
  timeout: 10               # seconds (1-300, default: 10)
  async: false              # true = run in background without blocking
  enabled: true             # false = ignore this hook
```

### Injected environment variables

Hooks receive context via `ARCHITECT_*` environment variables:

| Variable | Content |
|----------|---------|
| `ARCHITECT_EVENT` | Event name (e.g., `pre_tool_use`) |
| `ARCHITECT_WORKSPACE` | Workspace root directory |
| `ARCHITECT_TOOL` | Tool name (in tool events) |
| `ARCHITECT_FILE` | File path (if applicable) |
| `ARCHITECT_EDITED_FILE` | Edited file path (v3 backward compat) |

Additionally, `{file}` in the command is replaced with the edited file path.

---

## 19. Usage in scripts and pipes

### Capture result in a variable

```bash
RESULT=$(architect run "summarize the project in 1 line" -a resume --quiet)
echo "The project is: $RESULT"

# With JSON
JSON=$(architect run "analyze the project" -a resume --quiet --json)
STATUS=$(echo "$JSON" | jq -r .status)
OUTPUT=$(echo "$JSON" | jq -r .output)
```

### Verify exit code

```bash
architect run "task" --mode yolo --quiet
case $? in
  0)   echo "Completed successfully" ;;
  1)   echo "Agent failed" ;;
  2)   echo "Partially completed (or evaluator failed)" ;;
  3)   echo "Configuration error" ;;
  4)   echo "Authentication error (API key)" ;;
  5)   echo "Timeout" ;;
  130) echo "Interrupted (Ctrl+C)" ;;
esac
```

---

## 20. CI/CD: GitHub Actions, GitLab, cron

### GitHub Actions

```yaml
# .github/workflows/architect.yml
name: Architect AI Task

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * 1'   # every Monday at 9:00

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install architect
        run: pip install architect-ai-cli

      - name: Run architect with self-eval
        env:
          LITELLM_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          architect run "review the last commit's changes and detect potential bugs" \
            -a review \
            --mode yolo \
            --self-eval basic \
            --quiet \
            --json \
            -c ci/architect.yaml \
            | tee result.json

      - name: Check result
        run: |
          STATUS=$(cat result.json | jq -r .status)
          OUTPUT=$(cat result.json | jq -r .output)
          echo "$OUTPUT"
          if [ "$STATUS" = "failed" ]; then
            echo "::error::Architect failed: $STATUS"
            exit 1
          fi
```

### GitHub Actions with PR report (v4-B)

```yaml
- name: AI Review with report
  env:
    LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
  run: |
    architect run "review the PR changes" \
      --mode yolo --quiet \
      --context-git-diff origin/${{ github.base_ref }} \
      --report github --report-file pr-report.md \
      --budget 1.00

- name: Publish report on PR
  if: always()
  run: gh pr comment ${{ github.event.pull_request.number }} --body-file pr-report.md
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 21. Multi-project: workspace and per-project config

```bash
# Work on a project different from the CWD
architect run "summarize what this project does" -a resume -w /path/to/other-project

# With project config
architect run "refactor the main module" -a build \
  -w /path/to/project \
  -c /path/to/project/architect.yaml
```

---

## 22. Custom agents in YAML

```yaml
# config.yaml
agents:
  deploy:
    system_prompt: |
      You are a specialized deployment agent.
      Your job is to prepare code for production:
      1. Verify that tests exist (use find_files and read_file)
      2. Review the production configuration
      3. Read CI/CD files to understand the pipeline
      4. Generate a report BEFORE making any changes
    allowed_tools:
      - read_file
      - list_files
      - search_code
      - write_file
    confirm_mode: confirm-all
    max_steps: 15

  security:
    system_prompt: |
      You are a software security expert.
      Analyze the code looking for:
      - SQL injection, XSS, CSRF
      - Hardcoded secrets (API keys, passwords)
      - User input validation
      - Dependencies with known CVEs
    allowed_tools:
      - read_file
      - list_files
      - grep
      - search_code
      - find_files
    confirm_mode: yolo
    max_steps: 25
```

```bash
architect run "prepare the 1.2.0 release" -a deploy -c config.yaml
architect run "audit the security of the entire application" -a security -c config.yaml
```

---

## 23. Auxiliary commands

```bash
# List available agents
architect agents
architect agents -c config.yaml

# Validate configuration
architect validate-config -c config.yaml

# Skill management (v4-A3)
architect skill list
architect skill create my-skill
architect skill install user/repo

# Sessions (v4-B1)
architect sessions
architect resume 20260223-143022-a1b2 --budget 2.00
architect cleanup --older-than 30

# Competitive evaluation (v1.0.0)
architect eval "optimize SQL queries" \
  --models gpt-4o,claude-sonnet-4-6

# Initialize with presets (v1.0.0)
architect init python
architect init paranoid

# Code health (v1.0.0)
architect health
architect health --json
```

---

## 24. Quick flags reference

### `architect run PROMPT [OPTIONS]`

```
Identification
  -c, --config PATH         YAML configuration file
  -a, --agent NAME          Agent: plan, build, resume, review, or custom

Execution
  -m, --mode MODE           confirm-all | confirm-sensitive | yolo
  -w, --workspace PATH      Working directory
  --dry-run                 Simulate without executing real changes
  --max-steps N             Maximum agent step limit

LLM
  --model MODEL             Model (gpt-4o, claude-sonnet-4-6, ollama/llama3...)
  --api-base URL            API base URL (Proxy, Ollama, custom)
  --api-key KEY             Direct API key (prefer using env var)
  --no-stream               Wait for complete response (no streaming)
  --timeout N               Total session timeout in seconds (watchdog)

Output
  --json                    JSON output to stdout (disables streaming)
  --quiet                   Only errors to stderr, result to stdout
  -v / -vv / -vvv           Verbose: steps / debug / everything

Logging
  --log-level LEVEL         debug | info | warn | error
  --log-file PATH           Save JSON logs to .jsonl file

MCP
  --disable-mcp             Don't connect to configured MCP servers

Self-evaluation (F12)
  --self-eval MODE          off | basic | full (default: uses YAML config)

Command execution (F13)
  --allow-commands          Enable run_command (overrides YAML config)
  --no-commands             Disable run_command (overrides YAML config)

Costs and cache (F14)
  --budget FLOAT            Spending limit in USD (stops if exceeded)
  --show-costs              Show cost summary at the end (also with -v)
  --cache                   Enable local LLM response cache
  --no-cache                Disable local LLM response cache
  --cache-clear             Clear local cache before running

Sessions and reports (v4-B)
  --session ID              Resume existing session by ID
  --report FORMAT           json | markdown | github — report format
  --report-file PATH        Write report to file (otherwise to stdout)
  --context-git-diff REF    Inject git diff REF as additional context
  --confirm-mode MODE       Confirm mode override
  --exit-code-on-partial    Exit code 2 if status=partial
```

Health and evaluation (v1.0.0)
  --health                  Show code metrics delta at the end

### Additional commands (Base Plan v4 Phase C)

```
architect loop TASK [OPTIONS]     Ralph Loop: iterate until checks pass
  --check CMD                     Shell check (repeatable). All must pass (exit 0)
  --max-iterations N              Maximum iterations (default: 25)
  --max-cost FLOAT                Maximum total cost USD
  --max-time INT                  Maximum total time in seconds

architect pipeline FILE [OPTIONS] Pipeline: execute multi-step YAML workflow
  --from-step NAME                Resume from a specific step
  --dry-run                       Simulate without executing
  --var KEY=VALUE                 Extra variable (repeatable)

architect parallel TASK [OPTIONS] Parallel: execute in git worktrees
  --task CMD                      Task (repeatable). Round-robin across workers
  --workers N                     Number of workers (default: 3)
  --models CSV                    Comma-separated models (round-robin)

architect parallel-cleanup        Clean up parallel execution worktrees

Additional commands (v1.0.0)

architect eval PROMPT [OPTIONS]  Competitive multi-model evaluation
  --models CSV                    Comma-separated models
  --budget-per-model FLOAT        USD per model

architect init [PRESET]          Generate config.yaml from preset
  Presets: python, node-react, ci, paranoid, yolo

architect health [OPTIONS]       Code quality metrics
  --json                          JSON output
```

---

## 25. Guardrails (v4-A2)

Starting from v0.16.0 (Base Plan v4 Phase A), architect includes a **deterministic guardrails** engine that is evaluated BEFORE hooks. These are security rules that cannot be disabled by the LLM.

```yaml
guardrails:
  enabled: true
  protected_files:
    - ".env"
    - "*.pem"
    - "secrets/**"
  blocked_commands:
    - "git push --force"
    - "docker rm -f"
  max_files_modified: 10
  max_lines_changed: 500
  quality_gates:
    - name: tests
      command: "pytest tests/ -x"
      required: true
      timeout: 120
```

---

## 26. Skills and .architect.md (v4-A3)

Starting from v0.16.0 (Base Plan v4 Phase A), architect supports a two-level **skills** system to inject project-specific context into the agent's system prompt.

### Level 1: Project context (always active)

Architect automatically looks for these files in the workspace root:

```
.architect.md    <- preferred
AGENTS.md        <- alternative
CLAUDE.md        <- alternative
```

If one exists, its content is injected at the beginning of the system prompt as `# Project Instructions`.

### Level 2: Glob-activated skills

Skills are folders in `.architect/skills/` or `.architect/installed-skills/` with a `SKILL.md` file:

```markdown
---
name: django-patterns
description: "Django patterns for this project"
globs: ["*.py", "**/views.py", "**/models.py"]
---

# Django Patterns

- Use class-based views for CRUD
- Validate with serializers, never in views
- Queries with select_related/prefetch_related
```

### Skill management

```bash
architect skill create my-pattern
architect skill install user/repo
architect skill list
architect skill remove react-best
```

---

## 27. Procedural memory (v4-A4)

Starting from v0.16.0 (Base Plan v4 Phase A), architect can detect user corrections and store them as **procedural memory** that persists between sessions.

1. The user corrects the agent: *"No, use const instead of var"*
2. Architect detects the correction pattern automatically
3. Saves it in `.architect/memory.md` with a timestamp
4. In future sessions, the content of `memory.md` is injected into the system prompt

```yaml
memory:
  enabled: true
  auto_detect_corrections: true
```

---

## 28. Sessions and resume (v4-B1)

Starting from v0.17.0 (Base Plan v4 Phase B), architect saves the agent state automatically after each step. If an execution is interrupted (Ctrl+C, timeout, budget exceeded), you can resume it.

```bash
# Run a task with limited budget
architect run "refactor the entire auth module" --budget 1.00

# View saved sessions
architect sessions

# Resume with more budget
architect resume 20260223-143022-a1b2 --budget 2.00

# Cleanup
architect cleanup --older-than 30
```

See full documentation: [`sessions.md`](/architect-docs/en/docs/v1-0-0/sessions).

---

## 29. Execution reports (v4-B2)

Starting from v0.17.0 (Base Plan v4 Phase B), architect can generate detailed execution reports in three formats: JSON (CI/CD), Markdown (documentation), and GitHub PR comment (with collapsible sections).

```bash
# JSON for CI
architect run "..." --mode yolo --report json

# Markdown for docs
architect run "..." --mode yolo --report markdown --report-file report.md

# GitHub PR comment with <details> collapsible
architect run "..." --mode yolo --report github --report-file pr-comment.md
```

See full documentation: [`reports.md`](/architect-docs/en/docs/v1-0-0/reports).

---

## 30. Detailed Dry Run (v4-B4)

The `--dry-run` flag simulates execution without making real changes. Starting from v0.17.0 (Base Plan v4 Phase B), the system records each planned action and generates a summary.

```bash
architect run "refactor auth" --dry-run
```

The agent interacts with the LLM and executes read tools normally, but write tools (`write_file`, `edit_file`, `apply_patch`, `delete_file`, `run_command`) return `[DRY-RUN]` without executing.

---

## 31. Advanced CI/CD flags (v4-B3)

### `--context-git-diff REF`

Injects the diff from `git diff REF` as additional context in the agent's prompt.

```bash
architect run "review the changes in this PR" \
  --mode yolo --context-git-diff origin/main
```

### `--exit-code-on-partial`

In CI mode, returns exit code 2 if the final status is `partial` (instead of 0).

### Exit codes

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | `EXIT_SUCCESS` | Success |
| 1 | `EXIT_FAILED` | Agent failure |
| 2 | `EXIT_PARTIAL` | Partial (budget/timeout/self-eval) |
| 3 | `EXIT_CONFIG_ERROR` | Configuration error |
| 4 | `EXIT_AUTH_ERROR` | LLM authentication error |
| 5 | `EXIT_TIMEOUT` | Timeout |
| 130 | `EXIT_INTERRUPTED` | Interrupted by Ctrl+C |

---

## 32. Ralph Loop — automatic iteration (v4-C1)

Starting from v0.18.0 (Base Plan v4 Phase C), architect includes the **Ralph Loop**: an automatic iteration mode that runs the agent repeatedly until a set of checks (shell commands) pass. Each iteration uses an agent with **clean context** — no history from previous iterations.

```bash
# Iterate until tests pass
architect loop "fix the failing tests" \
  --check "pytest tests/ -x"

# With multiple checks (all must pass)
architect loop "implement the feature and verify quality" \
  --check "pytest tests/" \
  --check "ruff check src/" \
  --check "mypy src/"

# With safety limits
architect loop "refactor the auth module" \
  --check "pytest tests/test_auth.py" \
  --max-iterations 10 \
  --max-cost 5.0 \
  --max-time 600
```

See full documentation: [`ralph-loop.md`](/architect-docs/en/docs/v1-0-0/ralph-loop).

---

## 33. Pipeline Mode — YAML workflows (v4-C3)

Starting from v0.18.0 (Base Plan v4 Phase C), architect supports **pipelines**: multi-step YAML workflows where each step is an agent execution with its own prompt, agent, and configuration.

```bash
# Execute a pipeline defined in YAML
architect pipeline workflow.yaml

# Execute from a specific step (resume)
architect pipeline workflow.yaml --from-step test

# Dry-run the pipeline
architect pipeline workflow.yaml --dry-run
```

### YAML file format

```yaml
name: implement-and-test
variables:
  task: "implement feature X"
  module: "src/auth"

steps:
  - name: implement
    prompt: "Implement: {{task}} in {{module}}"
    agent: build
    checkpoint: true

  - name: test
    prompt: "Generate tests for {{module}}"
    agent: build
    checks:
      - "pytest tests/ -x"

  - name: review
    prompt: "Review the changes made"
    agent: review
    condition: "test -f src/auth/new_feature.py"
    output_var: review_result
```

See full documentation: [`pipelines.md`](/architect-docs/en/docs/v1-0-0/pipelines).

---

## 34. Parallel execution in worktrees (v4-C2)

Starting from v0.18.0 (Base Plan v4 Phase C), architect supports **parallel execution** of multiple agents, each in an isolated git worktree.

```bash
# Same task with different models (competition)
architect parallel "optimize the SQL queries" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat

# Different tasks in parallel
architect parallel \
  --task "tests for src/auth.py" \
  --task "tests for src/users.py" \
  --task "tests for src/billing.py" \
  --workers 3

# Cleanup
architect parallel-cleanup
```

See full documentation: [`parallel.md`](/architect-docs/en/docs/v1-0-0/parallel).

---

## 35. Checkpoints and rollback (v4-C4)

Starting from v0.18.0 (Base Plan v4 Phase C), architect can create **checkpoints**: git commits with the `architect:checkpoint` prefix that allow reverting to a previous workspace state.

```yaml
checkpoints:
  enabled: true        # enable checkpoints every N steps in the AgentLoop
  every_n_steps: 5     # create checkpoint every 5 steps
```

See full documentation: [`checkpoints.md`](/architect-docs/en/docs/v1-0-0/checkpoints).

---

## 36. Post-build auto-review (v4-C5)

Starting from v0.18.0 (Base Plan v4 Phase C), architect can automatically run a **post-build review** with a reviewer agent that has clean context (only sees the diff and original task).

```yaml
auto_review:
  enabled: true
  review_model: claude-sonnet-4-6
  max_fix_passes: 1
```

See full documentation: [`auto-review.md`](/architect-docs/en/docs/v1-0-0/auto-review).

---

## 37. Competitive evaluation — architect eval (v1.0.0)

Compare multiple LLM models by executing the same task and scoring the results.

```bash
architect eval "refactor utils.py to use dataclasses" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat
```

### Scoring

Each model is scored on 4 dimensions (total = 100):

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| Correctness | 40 | Does it complete the task correctly? |
| Quality | 30 | Clean, maintainable code? |
| Efficiency | 20 | Reasonable cost and steps? |
| Style | 10 | Follows project conventions? |

See full documentation: [`eval.md`](/architect-docs/en/docs/v1-0-0/eval).

---

## 38. Code Health — architect health (v1.0.0)

Analyzes code quality metrics (cyclomatic complexity, lines, functions, etc.) and shows a delta compared to the previous execution.

```bash
architect health
architect health --json
architect run "refactor the auth module" --mode yolo --health
```

See full documentation: [`health.md`](/architect-docs/en/docs/v1-0-0/health).

---

## 39. Presets — architect init (v1.0.0)

Generates a `config.yaml` file from predefined presets.

```bash
architect init
architect init python
architect init paranoid
architect init yolo
```

| Preset | Model | Mode | Budget | Description |
|--------|-------|------|--------|-------------|
| `python` | `gpt-4o` | `confirm-sensitive` | $2.0 | Python with ruff, mypy, pytest |
| `node-react` | `gpt-4o` | `confirm-sensitive` | $2.0 | Node.js + ESLint |
| `ci` | `gpt-4o` | `yolo` | $1.0 | Headless for CI/CD |
| `paranoid` | `gpt-4o` | `confirm-all` | $0.5 | Strict guardrails, protected files |
| `yolo` | `gpt-4o` | `yolo` | -- | No restrictions, no budget |

See full documentation: [`presets.md`](/architect-docs/en/docs/v1-0-0/presets).

---

## 40. Sub-agents — dispatch_subagent (v1.0.0)

The `build` agent can delegate sub-tasks to specialized agents with isolated context via the `dispatch_subagent` tool.

| Type | Purpose | Tools |
|------|---------|-------|
| `explore` | Investigate code | Read-only |
| `test` | Run tests and verify | Read + `run_command` |
| `review` | Review code | Read-only |

Sub-agents never modify files. Their result is returned as `ToolResult` to the parent agent.

See full documentation: [`dispatch-subagent.md`](/architect-docs/en/docs/v1-0-0/dispatch-subagent).

---

## 41. OpenTelemetry — distributed traces (v1.0.0)

Architect can emit OpenTelemetry traces for observability in production and CI/CD environments.

```yaml
telemetry:
  enabled: true
  exporter: otlp              # otlp, console, json_file
  endpoint: http://jaeger:4318
  service_name: architect-cli
```

| Exporter | Destination | Use |
|----------|-------------|-----|
| `otlp` | Jaeger, Grafana Tempo, OTEL Collector | Production |
| `console` | stderr | Local debug |
| `json_file` | JSON file | CI/offline analysis |

Traces include spans for: full session, each LLM call, each tool call, and context compression.

See full documentation: [`telemetry.md`](/architect-docs/en/docs/v1-0-0/telemetry).
