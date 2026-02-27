---
title: "Use Cases"
description: "Practical guide for integrating Architect CLI into real-world workflows"
---

## What is architect?

`architect` is a headless CLI that connects an LLM to filesystem tools and command execution. The user describes a task in natural language, and the agent iterates autonomously: reads code, plans changes, edits files, runs tests, and verifies its own work.

**Core capabilities:**

| Capability | Detail |
|-----------|---------|
| Intelligent reading | Reads files, searches with regex/grep/glob, indexes the project structure |
| Precise editing | `edit_file` (str_replace), `apply_patch` (unified diff), `write_file` (new files) |
| Command execution | Tests, linters, compilers, git, scripts -- with 4 layers of security |
| Self-verification | Post-edit hooks (ruff, mypy, eslint) whose output feeds back to the agent for self-correction |
| Remote tools (MCP) | Connects to MCP servers for GitHub, Jira, databases, or any API |
| Cost control | Budget per execution, token tracking, alerts |
| Structured output | `--json` for pipeline integration, `--quiet` for scripting |
| Security by design | Path traversal prevention, command blocklist, confirmation for sensitive ops |

**Four default agents:**

| Agent | Capability | Tools | Max steps |
|--------|-----------|-------|------------|
| `build` | Read + edit + execute | All (filesystem, search, commands, patch) | 50 |
| `plan` | Read + plan (no modifications) | Read-only (read, list, search, grep, find) | 20 |
| `review` | Inspect code and provide feedback | Read-only | 20 |
| `resume` | Summarize and synthesize information | Read-only | 15 |

---

## Day-to-day development

### Implementing new features

The most straightforward use case: describe what you need and let the `build` agent implement it.

```bash
# Add email validation to an existing model
architect run "in user.py, add email validation to the email field \
  using a standard regex. If the email is invalid, raise ValueError \
  with a descriptive message. Add tests in test_user.py." \
  --mode yolo

# Add a new REST endpoint
architect run "add a GET /api/v1/health endpoint that returns \
  {status: 'ok', version: '1.0.0'} with status code 200. \
  Use the same pattern as the existing endpoints in routes/" \
  --mode yolo --self-eval basic

# Implement a design pattern
architect run "refactor payment_processor.py to use the Strategy \
  pattern. Extract each payment method (stripe, paypal, transfer) \
  into its own class implementing PaymentStrategy." \
  --mode yolo -v
```

**What happens internally:**
1. The agent reads the project tree (indexer) and understands the structure.
2. It searches for relevant files with `search_code`/`grep`.
3. It reads the files to be modified.
4. It plans the changes internally.
5. It edits step by step with `edit_file` (preferred) or `write_file` (new files).
6. If hooks are configured (ruff, mypy), they run after each edit.
7. If a hook fails, the agent sees the error and corrects it automatically.
8. Optionally, it verifies the result with `--self-eval basic`.

### Code refactoring

```bash
# Rename and reorganize
architect run "move all functions from utils.py to separate modules: \
  string_utils.py, date_utils.py, and file_utils.py. Update all \
  imports across the project." \
  --mode yolo --allow-commands

# Migrate from one pattern to another
architect run "migrate the classes in config/ from dataclasses to Pydantic v2. \
  Keep existing defaults and add model_config = {'extra': 'forbid'}" \
  --mode yolo

# Remove dead code
architect run "analyze src/ and remove functions, imports, and variables \
  that are not used in any other file in the project" \
  --mode yolo --self-eval full
```

### Exploring and understanding unfamiliar code

Ideal for onboarding onto an existing project or analyzing a library.

```bash
# Quick project summary
architect run "explain the architecture of this project: \
  what it does, how it is organized, what technologies it uses, \
  and what the main flows are" \
  -a resume --quiet

# Understand a complex module
architect run "explain how the authentication system works: \
  from login to token validation. \
  Include the files involved and the data flow" \
  -a resume

# Analyze dependencies
architect run "list all external dependencies of the project, \
  what each one is used for, and whether any are duplicated or unnecessary" \
  -a plan --json | jq -r '.final_output'
```

### On-demand code review

```bash
# Security review
architect run "review src/auth/ for vulnerabilities: \
  SQL injection, XSS, CSRF, secret management, \
  input validation, and principle of least privilege" \
  -a review --json > review-security.json

# General quality review
architect run "review the latest changes in src/api/: \
  bugs, code smells, SOLID violations, \
  simplification opportunities, and missing tests" \
  -a review

# Focused review
architect run "review database.py: are there connection leaks? \
  Are all connections closed? Are there race conditions?" \
  -a review
```

### Generating documentation from code

```bash
# Docstrings for a module
architect run "add Google Style docstrings to all functions \
  and classes in src/services/ that lack documentation" \
  --mode yolo

# README from scratch
architect run "generate a complete README.md for the project: \
  description, installation, usage, configuration, \
  directory structure, and examples" \
  --mode yolo

# Document an internal API
architect run "read all endpoints in src/api/routes/ \
  and generate a docs/api-reference.md file with documentation \
  for each endpoint: method, path, parameters, responses, and examples" \
  --mode yolo
```

### AI-assisted debugging

```bash
# Analyze a stack trace
architect run "this test fails with: 'TypeError: unhashable type: list' \
  in src/cache.py line 45. Analyze the code, find the cause, \
  and fix the bug" \
  --mode yolo --allow-commands

# Investigate a bug without a stack trace
architect run "users report that login takes >5s. \
  Analyze the authentication flow, identify bottlenecks, \
  and suggest optimizations" \
  -a plan

# Fix + automatic verification
architect run "fix the bug where save_user() does not validate \
  the 'role' field. Then run pytest tests/test_user.py \
  to verify it passes" \
  --mode yolo --allow-commands
```

### Project scaffolding

```bash
# Base structure
architect run "create the base structure for a FastAPI service: \
  main.py, routes/, models/, services/, tests/, Dockerfile, \
  requirements.txt, and a README with development instructions" \
  --mode yolo

# Add a complete component
architect run "add a complete CRUD system for the 'Product' entity: \
  Pydantic model, REST endpoints (GET, POST, PUT, DELETE), \
  service with business logic, and tests for each endpoint. \
  Follow the existing pattern of the 'User' entity" \
  --mode yolo --self-eval basic
```

---

## CI/CD and automation

The key to integrating architect into CI/CD is using `--mode yolo` (no interactive confirmations), `--quiet --json` (parseable output), and `--budget` (cost control).

### Automatic Pull Request review

**GitHub Actions:**

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install architect
        run: |
          pip install architect-ai-cli

      - name: AI Review
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
        run: |
          # Get modified files
          FILES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD | head -20)

          architect run \
            "Review these modified files in the PR: ${FILES}. \
             Look for bugs, security issues, code smells, and \
             improvement opportunities. Be specific with file and line." \
            -a review \
            --mode yolo \
            --quiet \
            --json \
            --budget 0.50 \
            > review.json

          # Post as a comment on the PR
          REVIEW=$(jq -r '.final_output' review.json)
          gh pr comment ${{ github.event.pull_request.number }} \
            --body "## AI Code Review\n\n${REVIEW}\n\n---\n_Generated by architect CLI_"
```

**GitLab CI:**

```yaml
ai-review:
  stage: review
  image: python:3.12-slim
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  before_script:
    - apt-get update && apt-get install -y git
    - pip install architect-ai-cli
  script:
    - |
      architect run \
        "review the changes in this merge request and generate a quality report" \
        -a review --mode yolo --quiet --json --budget 0.30 \
        > review.json
    - cat review.json | jq -r '.final_output'
  artifacts:
    paths:
      - review.json
    expire_in: 1 week
```

### Security audit in the pipeline

```yaml
# GitHub Actions — Weekly security audit
name: Security Audit
on:
  schedule:
    - cron: '0 6 * * 1'  # Monday 6:00 UTC
  workflow_dispatch:

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install architect
        run: pip install architect-ai-cli

      - name: Run security analysis
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
        run: |
          architect run \
            "Perform a complete security audit of the project: \
             1. Look for OWASP Top 10 vulnerabilities \
             2. Verify secret management (API keys in code, .env without .gitignore) \
             3. Review input validation in endpoints \
             4. Analyze dependencies with known CVEs \
             5. Verify CORS, CSP, and security header configurations \
             Classify each finding as CRITICAL/HIGH/MEDIUM/LOW" \
            -a review \
            --mode yolo \
            --json \
            --budget 1.00 \
            > security-report.json

      - name: Check for critical findings
        run: |
          STATUS=$(jq -r '.status' security-report.json)
          OUTPUT=$(jq -r '.final_output' security-report.json)

          if echo "$OUTPUT" | grep -qi "CRITICAL"; then
            echo "::error::CRITICAL findings detected"
            echo "$OUTPUT"
            exit 1
          fi

          echo "$OUTPUT"

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: security-report.json
```

### Changelog generation

```bash
# In a release script
git log --oneline v1.0.0..HEAD > /tmp/commits.txt

architect run \
  "Read /tmp/commits.txt with the commits since the last release. \
   Generate a CHANGELOG.md in Keep a Changelog format: \
   Added, Changed, Fixed, Removed. Group by category \
   and write each entry clearly for the end user." \
  --mode yolo --quiet > CHANGELOG_DRAFT.md
```

### Linting autofix in CI

```yaml
# GitHub Actions — Autofix and commit
name: Autofix
on:
  push:
    branches: [develop]

jobs:
  autofix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GH_PAT }}

      - name: Install tools
        run: |
          pip install architect-ai-cli
          pip install ruff mypy

      - name: Autofix with architect
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
        run: |
          architect run \
            "Run 'ruff check . --output-format json' and fix \
             all linting errors found. \
             Then run 'mypy src/' and fix the type errors. \
             Do not change business logic, only style and type corrections." \
            --mode yolo \
            --allow-commands \
            --budget 0.50 \
            --self-eval basic

      - name: Commit fixes
        run: |
          git config user.name "architect-bot"
          git config user.email "architect@ci.local"
          git add -A
          git diff --staged --quiet || git commit -m "fix: autofix linting and types (architect)"
          git push
```

### Migration validation

```bash
# Before applying a database migration
architect run \
  "Review the migration in migrations/0042_add_user_roles.py: \
   1. Is it reversible? \
   2. Does it have performance impact (long locks, full table scans)? \
   3. Does it maintain backward compatibility with the current code version? \
   4. Are the indexes correct? \
   Recommend whether it is safe to apply in production without downtime." \
  -a review --mode yolo --json
```

---

## QA and Quality

### Unit test generation

```bash
# Tests for a specific module
architect run \
  "Generate unit tests for src/services/payment.py. \
   Cover all flows: success, validation errors, \
   network exceptions, and edge cases. Use pytest and mocking. \
   Follow the style of existing tests in tests/" \
  --mode yolo --self-eval basic

# Tests for uncovered code
architect run \
  "Run 'pytest --cov=src --cov-report=json' and analyze which \
   functions have 0% coverage. Generate tests for the 5 \
   most critical functions without coverage." \
  --mode yolo --allow-commands --budget 1.00
```

### Coverage analysis and missing tests

```bash
architect run \
  "Analyze the existing tests in tests/ and compare them with the code \
   in src/. Identify: \
   1. Modules with no tests at all \
   2. Public functions without tests \
   3. Edge cases not covered in existing tests \
   4. Tests that test implementation instead of behavior \
   Generate a prioritized report." \
  -a review --mode yolo --json > test-gaps.json
```

### Quality gate with self-evaluation

The `--self-eval full` mode allows the agent to verify its own work and automatically fix errors.

```bash
# The agent implements, verifies, and fixes if it fails
architect run \
  "Implement a function calculate_tax(amount, region) in billing.py \
   that supports the regions US, EU, and UK with their respective taxes. \
   Include tests in test_billing.py covering all scenarios." \
  --mode yolo \
  --self-eval full \
  --allow-commands \
  --budget 0.50

# Exit code 0 = the evaluation confirmed the task was completed
# Exit code 2 = partial, the evaluation detected issues
echo "Exit code: $?"
```

**How `--self-eval full` works:**
1. The agent implements the task normally.
2. When finished, a second prompt asks the LLM: "Was the task completed correctly?"
3. If confidence is < 80% (configurable), it generates a correction prompt.
4. It re-executes the agent with that correction prompt.
5. It repeats up to `max_retries` (default: 2) or until it passes.

### API contract review

```bash
architect run \
  "Read all API schemas in src/api/schemas/ and compare them \
   with the documentation in docs/api.md. Identify: \
   1. Documented fields that do not exist in the schema \
   2. Schema fields that are not documented \
   3. Incorrect types in the documentation \
   4. Code endpoints that are not documented" \
  -a review --mode yolo --json
```

---

## DevOps

### IaC generation and review

```bash
# Generate Terraform from a description
architect run \
  "Generate a Terraform module to deploy: \
   - VPC with 2 public and 2 private subnets \
   - ALB with target group and health checks \
   - ECS Fargate service with 2 tasks \
   - RDS PostgreSQL in a private subnet \
   Use variables for region, project name, and environment." \
  --mode yolo

# Review existing IaC
architect run \
  "Review the Terraform files in infra/: \
   1. Are there resources without tags? \
   2. Are overly permissive security groups used (0.0.0.0/0)? \
   3. Are secrets hardcoded? \
   4. Is encryption at rest missing on any resource? \
   5. Are fixed provider versions used?" \
  -a review --mode yolo
```

### Dockerfile and Helm chart analysis

```bash
# Optimize a Dockerfile
architect run \
  "Analyze the Dockerfile and suggest optimizations: \
   unnecessary layers, lighter base image, multi-stage build, \
   security (non-root user, COPY vs ADD), .dockerignore" \
  -a review

# Review a Helm chart
architect run \
  "Review the Helm chart in helm/myapp/: \
   1. Do the values.yaml have secure defaults? \
   2. Are resource limits used on all containers? \
   3. Are there health checks (liveness/readiness probes)? \
   4. Are secrets mounted as env vars instead of files?" \
  -a review --mode yolo
```

### Security configuration review

```bash
# Kubernetes RBAC
architect run \
  "Review the Kubernetes manifests in k8s/: \
   1. Does any ServiceAccount have excessive permissions? \
   2. Do Pods run as root? \
   3. Are NetworkPolicies used? \
   4. Are Secrets encrypted or in plain text?" \
  -a review --mode yolo --json > k8s-security.json
```

---

## Technical documentation

### API documentation

```bash
# Generate docs from code
architect run \
  "Read all files in src/api/ and generate a \
   docs/api-reference.md file in Markdown format with: \
   - Endpoint table (method, path, description) \
   - Detail for each endpoint: parameters, body, responses, errors \
   - Usage examples with curl \
   Use the format that already exists in docs/ if there is one." \
  --mode yolo

# Keep docs up to date
architect run \
  "Compare the current code in src/api/ with docs/api-reference.md. \
   Update the documentation to reflect the changes: \
   new endpoints, changed parameters, removed fields." \
  --mode yolo --self-eval basic
```

### New developer onboarding

```bash
# Architecture guide
architect run \
  "Generate an ARCHITECTURE.md document that explains: \
   1. System overview and what problem it solves \
   2. Component diagram (in ASCII/text) \
   3. Main data flow (request -> response) \
   4. Technologies and why they were chosen \
   5. How to add a new endpoint (step by step) \
   6. Project conventions (naming, structure, tests)" \
  --mode yolo

# Technical glossary
architect run \
  "Analyze the code and generate a GLOSSARY.md with all \
   domain terms in the project: entities, services, \
   business concepts. Define each one in 1-2 sentences." \
  --mode yolo
```

### Architecture decision analysis

```bash
# ADR (Architecture Decision Record)
architect run \
  "Analyze how the authentication system is implemented \
   (JWT, sessions, OAuth, etc.). Generate an ADR (Architecture Decision \
   Record) that documents: context, decision taken, alternatives \
   considered, consequences, and trade-offs." \
  -a plan --mode yolo --json | jq -r '.final_output' > docs/adr/001-auth.md
```

---

## Advanced architectures with MCP

### Development agent with multiple MCP servers

This is the most powerful architecture: architect connected to MCP servers that give it access to GitHub, Jira, Slack, and any API you need.

```
┌──────────────────────────────────────────────────────────────┐
│                    Developer                                   │
│  architect run "implement ticket PROJ-123 and open a PR"      │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   architect (build agent)                       │
│                                                               │
│  Local tools:            MCP tools:                           │
│  ├─ read_file          ├─ jira_get_ticket    (Jira server)   │
│  ├─ edit_file          ├─ jira_add_comment   (Jira server)   │
│  ├─ write_file         ├─ gh_create_pr       (GitHub server) │
│  ├─ search_code        ├─ gh_create_branch   (GitHub server) │
│  ├─ run_command        ├─ slack_post_msg     (Slack server)  │
│  └─ ...                └─ db_query           (DB server)     │
└─────┬──────────┬──────────┬──────────┬──────────┬────────────┘
      │          │          │          │          │
      ▼          ▼          ▼          ▼          ▼
  Filesystem   MCP:Jira  MCP:GitHub MCP:Slack  MCP:DB
  (local)      :3001     :3002      :3003      :3004
```

**Configuration:**

```yaml
# config-full-agent.yaml

llm:
  model: claude-sonnet-4-6
  timeout: 120
  prompt_caching: true

mcp:
  servers:
    - name: jira
      url: http://localhost:3001
      token_env: JIRA_API_TOKEN

    - name: github
      url: http://localhost:3002
      token_env: GITHUB_TOKEN

    - name: slack
      url: http://localhost:3003
      token_env: SLACK_BOT_TOKEN

    - name: database
      url: http://localhost:3004
      token_env: DB_READ_TOKEN

workspace:
  root: /home/dev/projects/myapp

commands:
  enabled: true
  safe_commands:
    - "npm test"
    - "npm run lint"

hooks:
  post_edit:
    - name: eslint
      command: "npx eslint --fix {file}"
      file_patterns: ["*.ts", "*.tsx"]

costs:
  enabled: true
  budget_usd: 3.00
```

**Usage:**

```bash
# The agent reads the Jira ticket, implements the code,
# runs tests, and opens a PR on GitHub
architect run \
  "Read ticket PROJ-123 from Jira. Implement what it asks for. \
   Run the tests. Create a branch feature/PROJ-123, \
   commit the changes, and open a PR on GitHub with the \
   ticket description." \
  -c config-full-agent.yaml \
  --mode yolo \
  --show-costs

# The agent queries the database to understand the schema
# before implementing a feature
architect run \
  "Query the database to see the schema of the 'users' table. \
   Then implement a GET /users/search endpoint that allows \
   searching users by name or email with pagination." \
  -c config-full-agent.yaml \
  --mode yolo
```

### Architect as an MCP server (code implementer)

Architect can function as the "implementation backend" of a larger orchestrator agent. A development assistance agent (for example, a Slack chatbot or an IDE assistant) can delegate code implementation to architect via an MCP wrapper.

```
┌─────────────────────────────────────────────────────────────┐
│           Orchestrator Agent (IDE / Chatbot)                  │
│                                                              │
│  "The user wants to add authentication to the microservice"  │
└──────────┬──────────┬──────────┬─────────────────────────────┘
           │          │          │
           ▼          ▼          ▼
    MCP: Git      MCP: Jira   MCP: Architect
    (branching)   (tickets)   (implementation)
                                    │
                                    ▼
                            ┌───────────────┐
                            │  architect run │
                            │  --mode yolo   │
                            │  --json        │
                            └───────────────┘
                                    │
                                    ▼
                             Code edited
                             Tests passing
                             JSON with result
```

**MCP wrapper implementation for architect:**

```python
# mcp_architect_server.py — Example MCP server that wraps architect
import json
import subprocess

def handle_implement_code(params):
    """MCP tool that executes architect to implement code."""
    prompt = params["prompt"]
    workspace = params.get("workspace", "/workspace")
    budget = params.get("budget", 1.0)

    result = subprocess.run(
        [
            "architect", "run", prompt,
            "--mode", "yolo",
            "--quiet", "--json",
            "-w", workspace,
            "--budget", str(budget),
        ],
        capture_output=True, text=True, timeout=300,
    )

    output = json.loads(result.stdout) if result.stdout else {}
    return {
        "status": output.get("status", "failed"),
        "output": output.get("final_output", ""),
        "exit_code": result.returncode,
        "costs": output.get("costs", {}),
    }
```

### Multi-agent pipeline

Chain multiple architect executions with different agents for complex flows.

```bash
#!/bin/bash
# pipeline-feature.sh — Complete pipeline to implement a feature

set -e
FEATURE="$1"
BUDGET_PER_STEP=0.50

echo "=== Step 1: Planning ==="
architect run \
  "Plan how to implement: ${FEATURE}. \
   List the files to create/modify, the specific \
   changes, and the execution order." \
  -a plan --mode yolo --quiet --json \
  --budget $BUDGET_PER_STEP \
  > /tmp/plan.json

PLAN=$(jq -r '.final_output' /tmp/plan.json)
echo "Plan generated."

echo "=== Step 2: Implementation ==="
architect run \
  "Implement the following plan: ${PLAN}" \
  --mode yolo \
  --allow-commands \
  --budget $BUDGET_PER_STEP \
  --self-eval basic \
  --json > /tmp/impl.json

IMPL_STATUS=$(jq -r '.status' /tmp/impl.json)
echo "Implementation: ${IMPL_STATUS}"

echo "=== Step 3: Review ==="
architect run \
  "Review the changes made. Look for bugs, \
   security issues, and code smells. \
   Be specific with file and line." \
  -a review --mode yolo --quiet --json \
  --budget $BUDGET_PER_STEP \
  > /tmp/review.json

REVIEW=$(jq -r '.final_output' /tmp/review.json)
echo "Review completed."

echo "=== Step 4: Fixes (if there are issues) ==="
if echo "$REVIEW" | grep -qi "bug\|critical\|security"; then
  architect run \
    "The review found these issues: ${REVIEW}. \
     Fix the bugs and security issues found." \
    --mode yolo \
    --allow-commands \
    --budget $BUDGET_PER_STEP \
    --self-eval full

  echo "Fixes applied."
fi

echo "=== Pipeline completed ==="
# Total cost
TOTAL=$(jq -r '.costs.total_usd // 0' /tmp/plan.json /tmp/impl.json /tmp/review.json | \
  awk '{s+=$1} END {printf "%.4f", s}')
echo "Total cost: \$${TOTAL}"
```

### Integration with LiteLLM Proxy for teams

For teams that want to manage API keys, rate limits, and costs centrally.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Dev 1       │  │ Dev 2       │  │ CI/CD       │
│ architect   │  │ architect   │  │ architect   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │   LiteLLM Proxy       │
            │   :8000               │
            │                       │
            │ - Rate limiting       │
            │ - Routing (GPT/Claude)│
            │ - Cost tracking       │
            │ - API key management  │
            │ - Caching             │
            │ - Logging             │
            └───────────┬───────────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
              ▼         ▼         ▼
          OpenAI   Anthropic   Ollama
                               (local)
```

**Configuration:**

```yaml
# config-team.yaml
llm:
  mode: proxy
  model: gpt-4o
  api_base: http://litellm-proxy.internal:8000
  api_key_env: LITELLM_TEAM_KEY
  prompt_caching: true
```

```bash
# Each developer uses their team key
export LITELLM_TEAM_KEY="team-dev-key-..."
architect run "..." -c config-team.yaml --mode yolo
```

---

## AIOps and MLOps

### ML pipeline review

```bash
# Review quality of a training pipeline
architect run \
  "Review the ML pipeline in ml/training/: \
   1. Is there data leakage between train and test? \
   2. Are metrics and artifacts being logged? \
   3. Is preprocessing reproducible? \
   4. Are datasets versioned? \
   5. Are there tests for data transformations?" \
  -a review --mode yolo --json

# Review notebooks
architect run \
  "Analyze the notebooks in notebooks/: \
   is there duplicated code that should be in modules? \
   Are there cells with large outputs that should be cleaned? \
   Are there unused imports?" \
  -a review --mode yolo
```

### Feature engineering code generation

```bash
architect run \
  "In src/features/, create feature engineering functions for: \
   1. Categorical variable encoding (one-hot, target encoding) \
   2. Numerical variable normalization (standard, minmax, robust) \
   3. Date feature extraction (day of week, month, quarter) \
   4. Missing value handling (median, mode, KNN imputer) \
   Include tests with synthetic data. Use scikit-learn and pandas." \
  --mode yolo --self-eval basic
```

### Configuration drift analysis

```bash
# Compare configurations between environments
architect run \
  "Compare the configurations in config/production.yaml and \
   config/staging.yaml. List the differences: \
   values that should be equal but are not, \
   keys that exist in one environment but not the other, \
   and values that seem incorrect (production URLs in staging, etc.)" \
  -a plan --mode yolo --json
```

---

## Configuration patterns

### Configuration for headless CI

```yaml
# config-ci.yaml — No interaction, maximum control
llm:
  model: gpt-4o-mini     # Cheaper for CI
  timeout: 120
  stream: false           # No streaming in CI
  prompt_caching: true

logging:
  level: warn             # Only errors in CI
  verbose: 0

evaluation:
  mode: basic             # Verify task completion
  confidence_threshold: 0.8

commands:
  enabled: true
  allowed_only: true      # Only safe/dev commands in CI

costs:
  enabled: true
  budget_usd: 1.00        # Hard limit per execution
  warn_at_usd: 0.50

indexer:
  enabled: true
  use_cache: false         # No caching in ephemeral CI
```

```bash
architect run "..." -c config-ci.yaml --mode yolo --quiet --json
```

### Configuration for local development

```yaml
# config-dev.yaml — Interactive, with visual feedback
llm:
  model: claude-sonnet-4-6
  timeout: 60
  stream: true            # See responses in real time
  prompt_caching: true

logging:
  level: human            # See what the agent is doing
  verbose: 0

commands:
  enabled: true
  safe_commands:           # Your usual scripts
    - "make test"
    - "make lint"
    - "docker-compose up -d"

hooks:
  post_edit:
    - name: format
      command: "black {file}"
      file_patterns: ["*.py"]
    - name: lint
      command: "ruff check {file} --fix"
      file_patterns: ["*.py"]
    - name: typecheck
      command: "mypy {file} --ignore-missing-imports"
      file_patterns: ["*.py"]

costs:
  enabled: true
  budget_usd: 5.00
  warn_at_usd: 2.00

llm_cache:
  enabled: true           # Cache for development (token savings)
  ttl_hours: 24
```

```bash
architect run "..." -c config-dev.yaml
# With visual streaming, automatic hooks, and cache enabled
```

### Custom agents per team

```yaml
# config-team.yaml
agents:
  # Documentation agent (only writes docs, does not touch code)
  documenter:
    system_prompt: |
      You are a technical documentation agent.
      You only generate and edit .md files in docs/.
      Do not modify source code or tests.
    allowed_tools:
      - read_file
      - write_file
      - edit_file
      - list_files
      - search_code
      - grep
      - find_files
    confirm_mode: confirm-sensitive
    max_steps: 30

  # Testing agent (only writes tests, does not touch production code)
  tester:
    system_prompt: |
      You are a testing agent.
      You only generate and edit files in tests/.
      Read production code to understand what to test,
      but never modify it.
      Use pytest, mocking, and fixtures.
    allowed_tools:
      - read_file
      - write_file
      - edit_file
      - list_files
      - search_code
      - grep
      - find_files
      - run_command
    confirm_mode: yolo
    max_steps: 30

  # Security agent (read-only + reports)
  security:
    system_prompt: |
      You are an application security expert.
      Analyze code for OWASP Top 10 vulnerabilities,
      secret management, and insecure configurations.
      Classify findings as CRITICAL/HIGH/MEDIUM/LOW.
      Never modify files.
    allowed_tools:
      - read_file
      - list_files
      - search_code
      - grep
      - find_files
    confirm_mode: yolo
    max_steps: 25
```

```bash
architect run "document the users API" -a documenter -c config-team.yaml
architect run "generate tests for auth.py" -a tester -c config-team.yaml
architect run "complete security audit" -a security -c config-team.yaml --json
```

---

## More use cases

### Guardrails for teams

Protect the codebase with deterministic rules that the agent cannot ignore.

```yaml
# config-team.yaml
guardrails:
  enabled: true
  protected_files:
    - ".env*"
    - "*.pem"
    - "deploy/**"
    - "Dockerfile"
    - "docker-compose*.yml"
  blocked_commands:
    - "git push"
    - "docker rm"
    - "kubectl delete"
  max_files_modified: 10
  max_lines_changed: 500
  require_test_after_edit: true
  code_rules:
    - pattern: "eval\\("
      message: "Do not use eval() — code injection risk"
      severity: block
    - pattern: "TODO|FIXME"
      message: "Temporary marker detected — resolve before merge"
      severity: warn
  quality_gates:
    - name: tests
      command: "pytest tests/ -x --tb=short"
      required: true
      timeout: 120
    - name: lint
      command: "ruff check src/"
      required: true
      timeout: 30
```

```bash
# The agent works freely but within the guardrails
architect run "refactor the payments module" \
  --mode yolo -c config-team.yaml
# -> If it tries to edit .env -> blocked
# -> If it generates eval() -> blocked
# -> On completion -> pytest + ruff are mandatory
```

### Skills as an internal marketplace

Create reusable skills for your team or community.

```bash
# Create a local skill for project patterns
architect skill create django-patterns
# Edit .architect/skills/django-patterns/SKILL.md

# Share via GitHub
# Push .architect/skills/django-patterns/ to the repo

# Another dev installs the skill
architect skill install your-org/repo/skills/django-patterns
```

**Example SKILL.md for a framework:**

```markdown
---
name: fastapi-patterns
description: "FastAPI patterns for this project"
globs: ["**/routes/*.py", "**/schemas/*.py", "**/deps.py"]
---

# FastAPI Patterns

- Use `Depends()` for dependency injection
- Request/response schemas in schemas/ with Pydantic v2
- Validation with `Field(...)`, never manual validation
- Exceptions with `HTTPException` and correct status codes
- Async endpoints when using I/O (db, http)
```

### Procedural memory for long-running projects

In projects where you interact with the agent over days, memory reduces repeated corrections.

```yaml
memory:
  enabled: true
  auto_detect_corrections: true
```

```bash
# Session 1: the user corrects the agent
architect run "add login endpoint"
# -> Agent generates code with npm
# -> User: "No, use pnpm, not npm"
# -> Correction saved in .architect/memory.md

# Session 2: the agent remembers
architect run "add logout endpoint"
# -> The system prompt includes: "Correction: No, use pnpm, not npm"
# -> Agent uses pnpm directly
```
