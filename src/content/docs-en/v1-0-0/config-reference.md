---
title: "Configuration Reference"
description: "Complete configuration schema, precedence, and environment variables."
icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
order: 8
---

# Configuration Reference

> **Note**: The references `(v4-A1)`, `(v4-B1)`, etc. refer to phases of the internal development plan (Base plan v4). All of them are included in v1.0.0.

## Layer System

Configuration is resolved across 4 layers (lowest to highest priority):

```
1. Pydantic defaults (code)
        ↓
2. YAML file (-c config.yaml)
        ↓
3. Environment variables (ARCHITECT_*)
        ↓
4. CLI flags (--model, --workspace, etc.)
```

The `deep_merge()` function in `config/loader.py` combines layers recursively: nested dicts are merged instead of replaced. This way you can override `llm.model` from the CLI without losing `llm.timeout` from the YAML.

---

## Environment Variables

| Variable | Config Field | Example |
|----------|-------------|---------|
| `LITELLM_API_KEY` | Read by LiteLLM directly (not by architect) | `sk-...` |
| `ARCHITECT_MODEL` | `llm.model` | `gpt-4o` |
| `ARCHITECT_API_BASE` | `llm.api_base` | `http://localhost:8000` |
| `ARCHITECT_LOG_LEVEL` | `logging.level` | `debug` |
| `ARCHITECT_WORKSPACE` | `workspace.root` | `/home/user/project` |

`LITELLM_API_KEY` is the default API key. If you need a different variable, configure `llm.api_key_env` in the YAML.

---

## CLI Flags that Override Config

| Flag | Overridden Field |
|------|-----------------|
| `--model MODEL` | `llm.model` |
| `--api-base URL` | `llm.api_base` |
| `--api-key KEY` | `llm.api_key_env` → direct key |
| `--timeout N` | Total session timeout (watchdog). Does **not** override `llm.timeout` (per-request) |
| `--no-stream` | `llm.stream = False` |
| `--workspace PATH` | `workspace.root` |
| `--max-steps N` | `agent_config.max_steps` |
| `--mode MODE` | `agent_config.confirm_mode` |
| `-v / -vv / -vvv` | `logging.verbose` (count) |
| `--log-level LEVEL` | `logging.level` |
| `--log-file PATH` | `logging.file` |
| `--self-eval MODE` | `evaluation.mode` (off/basic/full) |
| `--allow-commands` | `commands.enabled = True` |
| `--no-commands` | `commands.enabled = False` |
| `--budget FLOAT` | `costs.budget_usd` |
| `--cache` | `llm_cache.enabled = True` |
| `--no-cache` | `llm_cache.enabled = False` |
| `--json` | JSON output to stdout (disables streaming) |
| `--dry-run` | Dry-run mode: simulates without executing write tools |
| `--report FORMAT` | Report format: `json`, `markdown`, `github` |
| `--report-file PATH` | Write report to file (otherwise stdout) |
| `--session ID` | Resume existing session by ID |
| `--confirm-mode MODE` | Override confirm mode (yolo/confirm-all/confirm-sensitive) |
| `--context-git-diff REF` | Inject `git diff REF` diff as additional context |
| `--exit-code-on-partial` | Return exit code 2 if status=partial (default in CI) |

**Additional Commands:**

| Command | Description |
|---------|-------------|
| `architect loop TASK --check CMD` | Ralph Loop: iterate until checks pass |
| `architect pipeline FILE` | Pipeline: execute multi-step YAML workflow |
| `architect parallel --task CMD` | Parallel: execute in parallel worktrees |
| `architect parallel-cleanup` | Clean up worktrees from parallel runs |
| `architect eval TASK --models CSV --check CMD` | Competitive multi-model evaluation |
| `architect init --preset NAME` | Initialize project with configuration preset |
| `--health` (in `architect run`) | Code health analysis before/after |

---

## Complete YAML Schema

```yaml
# ==============================================================================
# LLM
# ==============================================================================
llm:
  provider: litellm        # always "litellm"
  mode: direct             # "direct" | "proxy" (LiteLLM Proxy Server)
  model: gpt-4o-mini       # any LiteLLM model

  # api_base: http://localhost:8000   # custom endpoint (Proxy, Ollama, etc.)

  api_key_env: LITELLM_API_KEY       # env var containing the API key

  timeout: 60              # seconds per LLM call
  retries: 2               # retries on transient errors (not auth)
  stream: true             # streaming by default; disabled with --no-stream/--json/--quiet
  prompt_caching: false    # mark system prompt with cache_control → 50-90% savings on Anthropic/OpenAI

# ==============================================================================
# Agents (custom or overrides of defaults)
# ==============================================================================
agents:
  # Partial override of a default:
  build:
    confirm_mode: confirm-all    # only overrides this field
    max_steps: 10

  # Completely new agent:
  deploy:
    system_prompt: |
      You are a specialized deployment agent.
      ...
    allowed_tools:
      - read_file
      - list_files
      - write_file
    confirm_mode: confirm-all
    max_steps: 15

# ==============================================================================
# Logging
# ==============================================================================
logging:
  level: human             # "debug" | "info" | "human" | "warn" | "error"
                           # v3: "human" shows agent traceability
  verbose: 0               # 0=human logs only, 1=info, 2=debug, 3+=all
  # file: logs/architect.jsonl   # JSON Lines; always full DEBUG

# ==============================================================================
# Workspace
# ==============================================================================
workspace:
  root: .                  # root directory; all file ops confined here
  allow_delete: false      # true = enable delete_file tool

# ==============================================================================
# MCP (Model Context Protocol — remote tools)
# ==============================================================================
mcp:
  servers:
    - name: github
      url: http://localhost:3001
      token_env: GITHUB_TOKEN         # env var with Bearer token

    - name: database
      url: https://mcp.example.com/db
      token_env: DB_TOKEN

    # inline token (not recommended in production):
    # - name: internal
    #   url: http://internal:8080
    #   token: "hardcoded-token"

# ==============================================================================
# Indexer — repository tree in the system prompt (F10)
# ==============================================================================
indexer:
  enabled: true            # false = no tree in the prompt; search tools remain available
  max_file_size: 1000000   # bytes; files larger than this are omitted from the index
  exclude_dirs: []         # additional dirs to exclude (besides .git, node_modules, etc.)
  # exclude_dirs:
  #   - vendor
  #   - .terraform
  exclude_patterns: []     # additional patterns to exclude (besides *.pyc, *.min.js, etc.)
  # exclude_patterns:
  #   - "*.generated.py"
  #   - "*.pb.go"
  use_cache: true          # disk-based index cache, 5-minute TTL

# ==============================================================================
# Context — context window management (F11)
# ==============================================================================
context:
  # Level 1: truncate long tool results
  max_tool_result_tokens: 2000   # ~4 chars/token; 0 = disable truncation

  # Level 2: compress old steps with the LLM
  summarize_after_steps: 8       # 0 = disable compression
  keep_recent_steps: 4           # recent steps to preserve intact

  # Level 3: hard limit on total context window
  max_context_tokens: 80000      # 0 = no limit (dangerous for long tasks)
  # Reference: gpt-4o/mini → 80000, claude-sonnet-4-6 → 150000

  # Parallel tool calls
  parallel_tools: true           # false = always sequential

# ==============================================================================
# Evaluation — result self-evaluation (F12)
# ==============================================================================
evaluation:
  mode: off                # "off" | "basic" | "full"
                           # CLI override: --self-eval basic|full
  max_retries: 2           # retries in "full" mode (range: 1-5)
  confidence_threshold: 0.8  # confidence threshold to accept result (0.0-1.0)

# ==============================================================================
# Commands — system command execution (F13)
# ==============================================================================
commands:
  enabled: true            # false = do not register run_command; --allow-commands/--no-commands
  default_timeout: 30      # default seconds (1-600)
  max_output_lines: 200    # stdout/stderr lines before truncation (10-5000)
  blocked_patterns: []     # extra regexes to block (in addition to built-ins)
  # blocked_patterns:
  #   - "git push --force"
  #   - "docker rm"
  safe_commands: []        # additional commands classified as 'safe'
  allowed_only: false      # if true, only safe/dev; dangerous rejected in execute()

# ==============================================================================
# Costs — LLM call cost tracking (F14)
# ==============================================================================
costs:
  enabled: true            # false = no cost tracking
  # prices_file: my_prices.json  # custom prices (same format as default_prices.json)
  # budget_usd: 1.0        # stop if exceeding $1.00; Override: --budget 1.0
  # warn_at_usd: 0.5       # log warning upon reaching $0.50

# ==============================================================================
# LLM Cache — local LLM response cache for development (F14)
# ==============================================================================
llm_cache:
  enabled: false           # true = enable; Override: --cache / --no-cache
  dir: ~/.architect/cache  # directory to store entries
  ttl_hours: 24            # validity of each entry (1-8760 hours)

# ==============================================================================
# Hooks — full lifecycle (v4-A1, backward compat v3-M4)
# ==============================================================================
hooks:
  # Pre-hooks: run BEFORE the action. Exit code 2 = BLOCK.
  pre_tool_use:
    - name: validate-secrets
      command: "bash scripts/check-secrets.sh"
      matcher: "write_file|edit_file"      # regex to filter tools
      file_patterns: ["*.py", "*.env"]
      timeout: 5

  # Post-hooks: run AFTER the action.
  post_tool_use:
    - name: python-lint
      command: "ruff check {file} --no-fix"    # {file} is replaced with the edited path
      file_patterns: ["*.py"]                    # glob patterns
      timeout: 15                                # seconds (1-300, default: 10)
      enabled: true                              # false = skip this hook
    - name: python-typecheck
      command: "mypy {file} --no-error-summary"
      file_patterns: ["*.py"]
      timeout: 30

  # Session hooks (notification only, cannot block)
  session_start: []
  session_end: []
  on_error: []
  agent_complete: []
  budget_warning: []
  context_compress: []

  # Pre/post LLM call
  pre_llm_call: []
  post_llm_call: []

  # Backward compatibility v3-M4: post_edit maps to post_tool_use
  # with automatic matcher for edit_file/write_file/apply_patch
  post_edit:
    - name: legacy-lint
      command: "ruff check {file}"
      file_patterns: ["*.py"]
      timeout: 15

  # Fields for each hook:
  # name:          str           — descriptive name
  # command:       str           — shell command ({file} is replaced)
  # matcher:       str = "*"    — regex/glob to filter tools
  # file_patterns: list[str]    — glob patterns to filter files
  # timeout:       int = 10     — seconds (1-300)
  # async:         bool = false — true = run in background without blocking
  # enabled:       bool = true  — false = skip

# ==============================================================================
# Guardrails — deterministic security (v4-A2)
# ==============================================================================
guardrails:
  enabled: false              # true = enable guardrails
  protected_files: []         # globs: [".env", "*.pem", "secrets/**"]
  blocked_commands: []        # regexes: ["git push --force", "docker rm"]
  max_files_modified: null    # limit of distinct files per session (null = no limit)
  max_lines_changed: null     # limit of accumulated lines changed
  max_commands_executed: null  # limit of commands executed
  require_test_after_edit: false  # force test every N edits

  code_rules: []              # simple static analysis rules
  # - pattern: "eval\\("
  #   message: "Usage of eval() detected"
  #   severity: block          # block | warn

  quality_gates: []           # final verification upon completion
  # - name: tests
  #   command: "pytest tests/ -x"
  #   required: true           # true = blocks if it fails
  #   timeout: 120

# ==============================================================================
# Skills — project context and workflows (v4-A3)
# ==============================================================================
skills:
  auto_discover: true         # auto-discover skills in .architect/skills/
  inject_by_glob: true        # inject skills based on active files

# ==============================================================================
# Memory — procedural memory (v4-A4)
# ==============================================================================
memory:
  enabled: false              # true = enable correction detection
  auto_detect_corrections: true  # automatically detect corrections in user messages

# ==============================================================================
# Sessions — persistence and resume (v4-B1)
# ==============================================================================
sessions:
  auto_save: true             # save state after each step (default: true)
  cleanup_after_days: 7       # days after which `architect cleanup` removes sessions

# ==============================================================================
# Ralph Loop — automatic iteration with checks (v4-C1)
# ==============================================================================
ralph:
  max_iterations: 25           # maximum iterations (1-100)
  max_cost: null               # maximum total cost in USD (null = no limit)
  max_time: null               # maximum total time in seconds (null = no limit)
  completion_tag: COMPLETE     # tag the agent emits when declaring completion
  agent: build                 # agent to use in each iteration

# ==============================================================================
# Parallel Runs — parallel execution in git worktrees (v4-C2)
# ==============================================================================
parallel:
  workers: 3                   # number of parallel workers (1-10)
  agent: build                 # agent to use in each worker
  max_steps: 50                # maximum steps per worker
  budget_per_worker: null      # USD per worker (null = no limit)
  timeout_per_worker: null     # seconds per worker (null = 600s)

# ==============================================================================
# Checkpoints — git restore points (v4-C4)
# ==============================================================================
checkpoints:
  enabled: false               # true = enable automatic checkpoints in the AgentLoop
  every_n_steps: 5             # create checkpoint every N steps (1-50)

# ==============================================================================
# Auto-Review — automatic post-build review
# ==============================================================================
auto_review:
  enabled: false               # true = enable auto-review after completion
  review_model: null           # model for the reviewer (null = same as builder)
  max_fix_passes: 1            # fix passes (0 = report only, 1-3 = fix)

# ==============================================================================
# Telemetry — OpenTelemetry traces (v1.0.0)
# ==============================================================================
telemetry:
  enabled: false               # true = enable OpenTelemetry traces
  exporter: console            # "otlp" | "console" | "json-file"
  endpoint: http://localhost:4317  # gRPC endpoint for OTLP
  trace_file: null             # file path for json-file (e.g.: .architect/traces.json)

# ==============================================================================
# Health — code health analysis (v1.0.0)
# ==============================================================================
health:
  enabled: false               # true = automatic analysis (no --health flag needed)
  include_patterns:            # glob patterns of files to analyze
    - "**/*.py"
  exclude_dirs:                # directories to exclude from analysis
    - .git
    - venv
    - __pycache__
    - node_modules
```

---

## The `load_config()` Function

```python
def load_config(
    config_path: Path | None = None,
    cli_args: dict | None = None,
) -> AppConfig:
    # 1. Load YAML (empty if config_path=None)
    yaml_dict = load_yaml_config(config_path)

    # 2. Read ARCHITECT_* env vars
    env_dict = load_env_overrides()

    # 3. Merge: yaml ← env
    merged = deep_merge(yaml_dict, env_dict)

    # 4. Apply CLI flags
    if cli_args:
        merged = apply_cli_overrides(merged, cli_args)

    # 5. Validate with Pydantic (extra="forbid")
    return AppConfig(**merged)
```

If the YAML contains unknown keys, Pydantic raises `ValidationError` → the CLI displays the error and exits with code 3 (EXIT_CONFIG_ERROR).

---

## Common Configuration Examples

### Minimal (API key in env only)

```bash
export LITELLM_API_KEY=sk-...
architect run "analyze the project" -a resume
```

### OpenAI with Explicit Config

```yaml
llm:
  model: gpt-4o
  api_key_env: OPENAI_API_KEY
  timeout: 120
  retries: 3

workspace:
  root: /my/project
  allow_delete: false
```

### Anthropic Claude

```yaml
llm:
  model: claude-sonnet-4-6
  api_key_env: ANTHROPIC_API_KEY
  stream: true

context:
  max_context_tokens: 150000   # Claude has a larger window
```

### Ollama (local, no API key)

```yaml
llm:
  model: ollama/llama3
  api_base: http://localhost:11434
  retries: 0    # local, no need for retries
  timeout: 300  # local models can be slow

context:
  parallel_tools: false   # no parallelism for slow local models
```

### LiteLLM Proxy (teams)

```yaml
llm:
  mode: proxy
  model: gpt-4o-mini
  api_base: http://proxy.internal:8000
  api_key_env: LITELLM_PROXY_KEY
```

### CI/CD (yolo mode, no confirmations, with evaluation)

```yaml
llm:
  model: gpt-4o-mini
  timeout: 120
  retries: 3
  stream: false

workspace:
  root: .

logging:
  verbose: 0
  level: warn

evaluation:
  mode: basic              # evaluate the result in CI
  confidence_threshold: 0.7  # less strict than interactive
```

```bash
architect run "update obsolete imports in src/" \
  --mode yolo --quiet --json \
  -c ci/architect.yaml
```

### Large Repos (with context optimization)

```yaml
indexer:
  exclude_dirs:
    - vendor
    - .terraform
    - coverage
  exclude_patterns:
    - "*.generated.py"
    - "*.pb.go"
  use_cache: true

context:
  max_tool_result_tokens: 1000   # more aggressive for large repos
  summarize_after_steps: 5       # compress faster
  keep_recent_steps: 3
  max_context_tokens: 60000      # more conservative
  parallel_tools: true
```

### With Command Execution (F13) and Costs (F14)

```yaml
llm:
  model: claude-sonnet-4-6
  api_key_env: ANTHROPIC_API_KEY
  prompt_caching: true     # saves tokens on repeated calls to the same system prompt

commands:
  enabled: true
  default_timeout: 60
  max_output_lines: 200
  safe_commands:
    - "pnpm test"
    - "cargo check"

costs:
  enabled: true
  budget_usd: 2.0          # maximum $2 per run
  warn_at_usd: 1.0         # warning upon reaching $1

# Local cache for development: avoids repeated LLM calls
llm_cache:
  enabled: false           # enable with --cache in CLI during development
  ttl_hours: 24
```

```bash
# With local cache enabled and budget from CLI
architect run "PROMPT" -a build --cache --budget 1.5 --show-costs
```

### With Lifecycle Hooks (v4-A1)

```yaml
hooks:
  post_tool_use:
    - name: python-lint
      command: "ruff check {file} --no-fix"
      file_patterns: ["*.py"]
      timeout: 15
    - name: python-typecheck
      command: "mypy {file} --no-error-summary"
      file_patterns: ["*.py"]
      timeout: 30
  pre_tool_use:
    - name: no-secrets
      command: "bash scripts/check-secrets.sh"
      matcher: "write_file|edit_file"
      timeout: 5
```

```bash
# Hooks run automatically — the LLM sees the lint/typecheck output
# and can self-correct errors. Pre-hooks can block actions.
architect run "refactor utils.py" -a build --mode yolo -c config.yaml
```

### With Guardrails (v4-A2)

```yaml
guardrails:
  enabled: true
  protected_files: [".env", "*.pem", "deploy/**"]
  blocked_commands: ["git push", "docker rm"]
  max_files_modified: 10
  max_lines_changed: 500
  require_test_after_edit: true
  code_rules:
    - pattern: "eval\\("
      message: "Do not use eval()"
      severity: block
  quality_gates:
    - name: tests
      command: "pytest tests/ -x"
      required: true
      timeout: 120
```

### With Skills and Memory (v4-A3/A4)

```yaml
skills:
  auto_discover: true
  inject_by_glob: true

memory:
  enabled: true
  auto_detect_corrections: true
```

### CI/CD with Reports and Sessions (v4-B)

```yaml
llm:
  model: gpt-4o-mini
  stream: false
  prompt_caching: true

commands:
  enabled: true
  allowed_only: true

costs:
  enabled: true
  budget_usd: 2.00

sessions:
  auto_save: true
  cleanup_after_days: 30
```

```bash
# Run with report and PR diff context
architect run "review the PR changes" \
  --mode yolo --quiet \
  --context-git-diff origin/main \
  --report github --report-file pr-report.md \
  --budget 2.00 \
  -c ci/architect.yaml

# Resume if left partial
architect resume SESSION_ID --budget 2.00

# Clean up old sessions in CI
architect cleanup --older-than 30
```

### Full Config with Self-Eval

```yaml
llm:
  model: gpt-4o
  api_key_env: OPENAI_API_KEY
  timeout: 120

workspace:
  root: .

indexer:
  enabled: true
  use_cache: true

context:
  max_tool_result_tokens: 2000
  summarize_after_steps: 8
  max_context_tokens: 80000
  parallel_tools: true

evaluation:
  mode: full               # automatically retry if it fails
  max_retries: 2
  confidence_threshold: 0.85
```

```bash
# Or use just the CLI flag (ignores evaluation.mode from YAML)
architect run "generate tests for src/auth.py" -a build --self-eval full
```

### Ralph Loop with Checks (v4-C1)

```yaml
ralph:
  max_iterations: 10
  max_cost: 5.0
  agent: build
```

```bash
# Iterate until tests pass
architect loop "fix the failing tests in src/auth.py" \
  --check "pytest tests/test_auth.py -x" \
  --max-iterations 10

# With multiple checks
architect loop "implement email validation" \
  --check "pytest tests/" \
  --check "ruff check src/" \
  --max-cost 2.0
```

### Parallel Execution (v4-C2)

```yaml
parallel:
  workers: 3
  agent: build
  budget_per_worker: 1.0
  timeout_per_worker: 300
```

```bash
# Same task with different models
architect parallel "optimize SQL queries" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat

# Different tasks in parallel
architect parallel \
  --task "tests for auth" \
  --task "tests for users" \
  --task "tests for billing" \
  --workers 3 --budget-per-worker 1.0

# Clean up worktrees afterwards
architect parallel-cleanup
```

### Multi-Step YAML Pipeline (v4-C3)

```yaml
# pipeline.yaml
name: implement-and-test
steps:
  - name: implement
    prompt: "Implement the feature described in {{task}}"
    agent: build
    checkpoint: true

  - name: test
    prompt: "Generate tests for the changes from the previous step"
    agent: build
    checks:
      - "pytest tests/ -x"
    checkpoint: true

  - name: review
    prompt: "Review the changes made"
    agent: review
    output_var: review_result

variables:
  task: "add JWT authentication"
```

```bash
# Execute pipeline
architect pipeline pipeline.yaml

# Execute from a specific step
architect pipeline pipeline.yaml --from-step test

# Dry-run the pipeline
architect pipeline pipeline.yaml --dry-run
```

### Checkpoints and Rollback (v4-C4)

```yaml
checkpoints:
  enabled: true
  every_n_steps: 5
```

```bash
# View created checkpoints
git log --oneline --grep="architect:checkpoint"

# Manual rollback to a checkpoint
git reset --hard <commit_hash>
```

### Competitive Evaluation (v1.0.0)

```bash
# Compare models on the same task
architect eval "optimize SQL queries" \
  --models gpt-4o,claude-sonnet-4-6,deepseek-chat \
  --check "pytest tests/test_queries.py -q" \
  --check "ruff check src/" \
  --budget-per-model 1.0 \
  --report-file eval_report.md
```

### Initialization with Presets (v1.0.0)

```bash
# Generate config for a Python project
architect init --preset python

# Maximum security config
architect init --preset paranoid --overwrite
```

### Telemetry with Jaeger (v1.0.0)

```yaml
telemetry:
  enabled: true
  exporter: otlp
  endpoint: http://localhost:4317
```

```bash
# Run with tracing
architect run "implement feature" -c config.yaml --mode yolo
# → Traces visible in Jaeger UI: http://localhost:16686
```

### Health Delta (v1.0.0)

```yaml
health:
  enabled: true
  include_patterns: ["**/*.py"]
```

```bash
# Or use the flag directly
architect run "refactor utils.py" --health --mode yolo
# → Displays markdown table with metrics delta
```

### Auto-Review Post-Build

```yaml
auto_review:
  enabled: true
  review_model: claude-sonnet-4-6
  max_fix_passes: 1
```

```bash
# Auto-review activates automatically upon completing a task
# with auto_review.enabled: true. No additional CLI flags required.
architect run "implement feature X" --mode yolo -c config.yaml
# → Build completes → Automatic review → Fix-pass if there are issues
```
