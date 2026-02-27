---
title: "Quick Start Guide"
description: "Installation, minimal configuration, most useful commands, and flags reference."
icon: "M13 10V3L4 14h7v7l9-11h-7z"
order: 2
---

# Quick Start Guide — Architect CLI

Installation, minimal configuration, and the most useful commands for day-to-day use.

---

## Installation

```bash
# From PyPI
pip install architect-ai-cli

# Optional extras
pip install architect-ai-cli[dev]        # pytest, black, ruff, mypy
pip install architect-ai-cli[telemetry]  # OpenTelemetry (OTLP traces)
pip install architect-ai-cli[health]     # radon (cyclomatic complexity)

# Or from GitHub
git clone -b main --single-branch https://github.com/Diego303/architect-cli.git
cd architect-cli && pip install -e .

# Verify
architect --version
```

---

## Minimal Configuration

### Direct API key (OpenAI, Anthropic, etc.)

```bash
export LITELLM_API_KEY="sk-..."
```

### With LiteLLM Proxy (teams)

Create a `config.yaml`:

```yaml
llm:
  mode: proxy
  model: gpt-4o
  api_base: http://litellm-proxy:8000
  api_key_env: LITELLM_API_KEY
  prompt_caching: true
```

```bash
architect run "your task" -c config.yaml
```

### Change model without config

```bash
# Via env var
export ARCHITECT_MODEL="claude-sonnet-4-6"

# Or via flag
architect run "..." --model gpt-4o-mini
```

---

## Available Agents

| Agent | What it does | Modifies files |
|-------|-------------|----------------|
| `build` | Implements code (default) | Yes |
| `plan` | Analyzes and plans without touching anything | No |
| `review` | Reviews code and provides feedback | No |
| `resume` | Summarizes and synthesizes information | No |

```bash
architect run "..." -a plan      # Plan only
architect run "..." -a review    # Review only
architect run "..."              # build by default
```

---

## Usage Examples

### Development with visual feedback (interactive mode)

The default mode: streaming + human logs to stderr. The agent asks for confirmation before writing files.

```bash
architect run "add email validation to user.py with tests"
```

You'll see what the agent does in real time:
```
--- architect . build . gpt-4o ---------------------

🔄 Step 1 — LLM call
🔧 search_code("email.*valid", file_pattern="*.py")
🔧 read_file("src/user.py")
🔄 Step 2 — LLM call
🔧 edit_file("src/user.py", ...)     <- Asks for confirmation
🔧 write_file("tests/test_user.py")  <- Asks for confirmation
✅ Completed

--- Result -----------------------------------------

Status: success | Steps: 3 | Tool calls: 5
```

### Autonomous development (yolo mode)

No confirmations. Ideal for tasks where you trust the agent.

```bash
architect run "refactor utils.py to use dataclasses" --mode yolo
```

### Development with test execution

Allows the agent to run commands (pytest, linters) to verify its work.

```bash
architect run \
  "fix the bug in parser.py and run pytest to verify" \
  --mode yolo --allow-commands
```

### Development with full self-verification

The agent implements, verifies with hooks, and self-evaluates at the end.

```bash
architect run \
  "implement a GET /health endpoint with test" \
  --mode yolo --allow-commands --self-eval basic
```

### Code review

```bash
architect run \
  "review src/auth/ looking for bugs, vulnerabilities, and code smells" \
  -a review
```

### Explore an unknown project

```bash
architect run "explain the architecture of this project" -a resume
```

### Planning without executing

```bash
architect run \
  "how would you implement JWT authentication in this project?" \
  -a plan
```

### Generate documentation

```bash
architect run \
  "add Google Style docstrings to all functions in src/services/" \
  --mode yolo
```

---

## Output for Scripts and CI

### Parseable JSON

```bash
architect run "summarize the project" \
  --mode yolo --quiet --json | jq '.final_output'
```

### Logs to file + JSON to stdout

```bash
architect run "..." \
  --mode yolo --json --log-file debug.jsonl > result.json
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Task completed |
| 1 | Failed |
| 2 | Partial (budget/timeout/self-eval) |
| 3 | Configuration error |
| 4 | Authentication error |
| 5 | Timeout |
| 130 | Interrupted (Ctrl+C) |

---

## Cost Control

```bash
# Spending limit
architect run "..." --budget 0.50

# View cost summary
architect run "..." --show-costs

# Cheap model for simple tasks
architect run "..." --model gpt-4o-mini
```

---

## Lifecycle Hooks (v4)

Automatic hooks on 10 events. Most common: lint after editing and validation before writing.

```yaml
# In config.yaml
hooks:
  post_tool_use:
    - name: lint
      command: "ruff check {file} --fix"
      file_patterns: ["*.py"]
  pre_tool_use:
    - name: no-secrets
      command: "bash scripts/check-secrets.sh"
      matcher: "write_file|edit_file"
```

```bash
architect run "..." -c config.yaml --mode yolo
# Pre-hooks validate, post-hooks auto-lint
```

---

## Guardrails (v4)

Deterministic security rules. Evaluated BEFORE hooks.

```yaml
guardrails:
  enabled: true
  protected_files: [".env", "*.pem"]
  max_files_modified: 10
  quality_gates:
    - name: tests
      command: "pytest tests/ -x"
      required: true
```

---

## Skills and Memory (v4)

Project context automatically injected into the system prompt.

```bash
# Create .architect.md with project conventions
# The agent reads it automatically in each session

# Skill management
architect skill create my-pattern    # Create local skill
architect skill install user/repo    # Install from GitHub
architect skill list                 # List skills
```

```yaml
# Enable procedural memory (detects corrections and remembers them)
memory:
  enabled: true
```

---

## Sessions and Resume (v4-B)

Architect saves state automatically. If an execution is interrupted, you can resume it.

```bash
# Run with limited budget (stops when exceeded)
architect run "refactor auth" --budget 1.00

# View saved sessions
architect sessions

# Resume where it left off
architect resume 20260223-143022-a1b2 --budget 2.00

# Clean up old sessions
architect cleanup --older-than 30
```

---

## Reports (v4-B)

Generate execution reports for CI/CD or documentation.

```bash
# JSON for CI
architect run "..." --mode yolo --report json > report.json

# Markdown for docs
architect run "..." --mode yolo --report markdown --report-file report.md

# GitHub PR comment with collapsible sections
architect run "..." --mode yolo \
  --context-git-diff origin/main \
  --report github --report-file pr-comment.md
```

---

## Competitive Evaluation (v1.0.0)

Compare multiple models on the same task with automatic checks.

```bash
architect eval "implement feature X" \
  --models gpt-4o,claude-sonnet-4-6 \
  --check "pytest tests/" \
  --budget-per-model 1.0
```

---

## Initialization with Presets (v1.0.0)

Generate optimized initial configuration for your project type.

```bash
# View available presets
architect init --list-presets

# Initialize Python project
architect init --preset python
# -> Creates .architect.md + config.yaml with ruff, mypy, pytest

# Maximum security mode
architect init --preset paranoid
```

---

## Code Health (v1.0.0)

Before/after code quality analysis during execution.

```bash
architect run "refactor utils.py" --health
# -> Shows complexity delta, long functions, duplicates
```

---

## Verbose and Debugging

```bash
architect run "..." -v       # Info: workspace, model, streaming
architect run "..." -vv      # Debug: full args, LLM responses
architect run "..." -vvv     # Full: HTTP, payloads, internal timing
```

---

## Quick Flags Reference

```
architect run "PROMPT" [options]

Agents and modes:
  -a, --agent NAME          build | plan | review | resume (default: build)
  -m, --mode MODE           yolo | confirm-sensitive | confirm-all
  --dry-run                 Simulate without real changes

LLM:
  --model MODEL             Model override (gpt-4o, claude-sonnet-4-6, ...)
  --api-base URL            API base URL
  --api-key KEY             Direct API key
  --no-stream               Disable streaming
  --timeout SECONDS         Global timeout

Output:
  --json                    Structured JSON output to stdout
  --quiet                   Result only, no banner or logs
  -v / -vv / -vvv           Increasing verbosity

Costs:
  --budget USD              Spending limit per execution
  --show-costs              Show cost summary

Execution:
  --allow-commands           Enable run_command
  --no-commands              Disable run_command
  --self-eval MODE           off | basic | full

Cache:
  --cache                   Enable local LLM cache
  --no-cache                Disable cache
  --cache-clear             Clear cache before running

Sessions and reports:
  --session ID              Resume existing session by ID
  --report FORMAT           json | markdown | github
  --report-file PATH        Save report to file
  --context-git-diff REF    Inject git diff as context
  --confirm-mode MODE       Confirm mode override
  --exit-code-on-partial    Exit code 2 if status=partial

Analysis (v1.0.0):
  --health                  Before/after quality analysis

Config:
  -c, --config PATH         YAML configuration file
  -w, --workspace PATH      Working directory
  --log-level LEVEL         debug | info | human | warn | error
  --log-file PATH           JSON log file

Additional commands (v1.0.0):
  architect eval PROMPT     Competitive multi-model evaluation
  architect init            Initialize project with presets
  architect loop PROMPT     Automatic iteration (Ralph Loop)
  architect pipeline FILE   Execute YAML workflow
  architect parallel        Parallel execution in worktrees
```

---

## Complete Development config.yaml Example

```yaml
llm:
  model: gpt-4o
  stream: true
  prompt_caching: true

commands:
  enabled: true

hooks:
  post_tool_use:
    - name: lint
      command: "ruff check {file} --fix"
      file_patterns: ["*.py"]

guardrails:
  enabled: true
  protected_files: [".env"]
  quality_gates:
    - name: tests
      command: "pytest tests/ -x"
      required: true

skills:
  auto_discover: true

memory:
  enabled: true

costs:
  enabled: true
  budget_usd: 5.00
  warn_at_usd: 2.00

sessions:
  auto_save: true
  cleanup_after_days: 7

# Telemetry (optional, requires pip install architect-ai-cli[telemetry])
telemetry:
  enabled: false
  exporter: console        # otlp | console | json-file

# Health (optional, requires pip install architect-ai-cli[health] for radon)
health:
  enabled: false
  include_patterns: ["**/*.py"]
```

```bash
architect run "implement feature X" -c config.yaml --mode yolo --show-costs

# With CI/CD report
architect run "..." --mode yolo --report github --report-file report.md

# With health check
architect run "..." --mode yolo --health
```
