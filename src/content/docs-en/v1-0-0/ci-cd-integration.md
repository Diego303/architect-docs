---
title: "CI/CD Integration"
description: "Recipes for GitHub Actions, GitLab CI, Jenkins: review bots, auto-fix, pipelines."
icon: "M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
order: 32
---

# CI/CD Integration — Architect CLI v1.0.0

A comprehensive guide for integrating `architect` into CI/CD pipelines: GitHub Actions, GitLab CI, Jenkins, and advanced patterns. All examples are copy-pasteable and tested.

---

## Why Architect in CI/CD

Architect can act as an autonomous agent within CI/CD pipelines to:

- **Automatically review PRs**: a `review` agent analyzes the diff and posts a comment with findings.
- **Fix code on push**: a `build` agent applies fixes (lint, types, tests) and commits the corrections.
- **Generate code from issues**: when an issue is labeled, an agent implements the task and creates a PR.
- **Iterate until tests pass**: the Ralph Loop runs the agent in a loop until `pytest` (or other checks) go green.
- **Compare models**: competitive evaluation of multiple LLMs on the same task with objective checks.

The key is that Architect is designed for headless execution from day one: no TTY, no interaction, with structured JSON output and semantic exit codes.

---

## Headless execution principles

### Yolo mode (mandatory in CI)

In CI there is no interactive terminal. The `--mode yolo` flag disables all confirmations. Without it, Architect detects the absence of a TTY and fails with `NoTTYError`.

```bash
architect run "tu tarea" --mode yolo
```

### Structured JSON output

The `--json` flag emits a JSON object to stdout with all execution information:

```json
{
  "status": "success",
  "output": "Se han añadido 3 tests unitarios...",
  "steps": 8,
  "tools_used": ["read_file", "search_code", "write_file", "run_command"],
  "duration_seconds": 45.2,
  "costs": {
    "total_cost_usd": 0.0342
  },
  "session_id": "20260224-143022-a1b2c3"
}
```

Possible `status` values are: `success`, `partial`, `failed`.

### Semantic exit codes

| Code | Meaning | CI action |
|------|---------|-----------|
| 0 | Task completed successfully | Green pipeline |
| 1 | Task failed | Red pipeline |
| 2 | Task partially completed | Yellow pipeline (with `--exit-code-on-partial`) |
| 3 | Configuration error | Review config/secrets |
| 4 | Authentication error (API key) | Verify CI secrets |
| 5 | Timeout | Increase timeout or budget |
| 130 | Interrupted (SIGINT/SIGTERM) | Job canceled |

### Essential flags for CI

```bash
architect run "PROMPT" \
  --mode yolo \              # No confirmations (headless)
  --json \                   # JSON output to stdout
  --quiet \                  # Minimum noise on stderr
  --budget 2.00 \            # USD spending limit
  --show-costs \             # Cost summary at the end
  --report FORMAT \          # json | markdown | github
  --report-file PATH \       # Save report to file
  --context-git-diff REF \   # Inject diff as context
  --exit-code-on-partial \   # Exit 2 if status=partial
  --allow-commands \         # Allow command execution (pytest, etc.)
  --self-eval basic          # Post-execution self-evaluation
```

---

## GitHub Actions

### PR Review Bot

Automatically reviews each PR and posts a comment with the analysis.

```yaml
# .github/workflows/architect-review.yml
name: Architect PR Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Necesario para git diff

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install architect
        run: pip install architect-ai-cli

      - name: Run review agent
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
        run: |
          architect run \
            "Revisa los cambios de este PR. Busca bugs, vulnerabilidades, \
             code smells y problemas de rendimiento. Sé conciso y accionable." \
            -a review \
            --mode yolo \
            --quiet \
            --context-git-diff origin/${{ github.base_ref }} \
            --report github \
            --report-file pr-review.md \
            --budget 1.00

      - name: Post review comment
        if: always() && hashFiles('pr-review.md') != ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr comment ${{ github.event.pull_request.number }} \
            --body-file pr-review.md
```

### Auto-fix on push

Runs the agent to fix issues (lint, types, broken tests) and commits the fixes.

```yaml
# .github/workflows/architect-autofix.yml
name: Architect Auto-Fix

on:
  push:
    branches: [develop, "feature/**"]

permissions:
  contents: write

jobs:
  autofix:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.ARCHITECT_PAT }}  # PAT para poder pushear commits

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install architect and project deps
        run: |
          pip install architect-ai-cli
          pip install -e .[dev]

      - name: Run auto-fix agent
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
        run: |
          architect run \
            "Ejecuta ruff check y mypy sobre el proyecto. Corrige todos \
             los errores que encuentres. NO cambies la lógica de negocio, \
             solo corrige errores de estilo, tipos y lint." \
            --mode yolo \
            --quiet \
            --json \
            --budget 1.50 \
            --allow-commands \
            --self-eval basic \
            > result.json

      - name: Commit fixes if any
        run: |
          STATUS=$(jq -r '.status' result.json)
          if [ "$STATUS" = "success" ] || [ "$STATUS" = "partial" ]; then
            git config user.name "architect-bot"
            git config user.email "architect-bot@users.noreply.github.com"
            git add -A
            git diff --cached --quiet || \
              git commit -m "fix: auto-fix lint/type errors via architect" && \
              git push
          fi
```

### Code generation from issues

When an issue is labeled with `architect`, the agent implements the task and creates a PR.

```yaml
# .github/workflows/architect-from-issue.yml
name: Architect Code Generation

on:
  issues:
    types: [labeled]

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  generate:
    if: github.event.label.name == 'architect'
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install architect and project deps
        run: |
          pip install architect-ai-cli
          pip install -e .[dev]

      - name: Create feature branch
        run: |
          BRANCH="architect/issue-${{ github.event.issue.number }}"
          git checkout -b "$BRANCH"
          echo "BRANCH=$BRANCH" >> "$GITHUB_ENV"

      - name: Run build agent
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
        run: |
          architect run \
            "${{ github.event.issue.title }}. ${{ github.event.issue.body }}" \
            --mode yolo \
            --json \
            --quiet \
            --budget 3.00 \
            --allow-commands \
            --self-eval basic \
            --report github \
            --report-file report.md \
            > result.json

      - name: Push and create PR
        if: success()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git config user.name "architect-bot"
          git config user.email "architect-bot@users.noreply.github.com"
          git add -A
          git diff --cached --quiet && echo "Sin cambios" && exit 0
          git commit -m "feat: implement #${{ github.event.issue.number }} via architect"
          git push -u origin "$BRANCH"

          COST=$(jq -r '.costs.total_cost_usd // 0' result.json)

          gh pr create \
            --title "feat: #${{ github.event.issue.number }} — ${{ github.event.issue.title }}" \
            --body "$(cat <<EOF
          Implementación automática del issue #${{ github.event.issue.number }}.

          **Coste**: \$${COST} USD

          $(cat report.md)

          ---
          Generado por architect-cli
          EOF
          )" \
            --base main

      - name: Comment on issue
        if: always()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          STATUS=$(jq -r '.status // "unknown"' result.json 2>/dev/null || echo "error")
          COST=$(jq -r '.costs.total_cost_usd // 0' result.json 2>/dev/null || echo "N/A")

          gh issue comment ${{ github.event.issue.number }} --body \
            "Architect ha terminado. Status: **${STATUS}** | Coste: \$${COST} USD.
             Ver el workflow: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

### Ralph Loop in CI (iterate until tests pass)

```yaml
# .github/workflows/architect-ralph-loop.yml
name: Architect Ralph Loop

on:
  workflow_dispatch:
    inputs:
      task:
        description: "Tarea para el agente"
        required: true
      check_command:
        description: "Comando de verificación"
        required: true
        default: "pytest tests/ -q"
      max_iterations:
        description: "Máximo de iteraciones"
        required: false
        default: "5"

permissions:
  contents: write

jobs:
  ralph-loop:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install architect and project deps
        run: |
          pip install architect-ai-cli
          pip install -e .[dev]

      - name: Run Ralph Loop
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
        run: |
          architect loop "${{ github.event.inputs.task }}" \
            --check "${{ github.event.inputs.check_command }}" \
            --max-iterations ${{ github.event.inputs.max_iterations }} \
            --max-cost 5.00 \
            --quiet

      - name: Commit results
        if: success()
        run: |
          git config user.name "architect-bot"
          git config user.email "architect-bot@users.noreply.github.com"
          git add -A
          git diff --cached --quiet || \
            git commit -m "feat: ralph loop — ${{ github.event.inputs.task }}" && \
            git push
```

### Complete example with secrets, caching, and artifacts

```yaml
# .github/workflows/architect-full.yml
name: Architect Full Pipeline

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  architect:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Cache pip
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-architect
          restore-keys: ${{ runner.os }}-pip-

      - name: Install architect
        run: pip install architect-ai-cli

      - name: Run review
        id: review
        env:
          LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
          ARCHITECT_MODEL: ${{ vars.ARCHITECT_MODEL || 'gpt-4o' }}
        run: |
          architect run \
            "Revisa exhaustivamente los cambios de este PR. Analiza: \
             1) Bugs y errores lógicos \
             2) Vulnerabilidades de seguridad \
             3) Problemas de rendimiento \
             4) Code smells y mantenibilidad \
             5) Cobertura de tests" \
            -a review \
            --mode yolo \
            --quiet \
            --json \
            --budget 2.00 \
            --show-costs \
            --context-git-diff origin/${{ github.base_ref }} \
            --report github \
            --report-file review-report.md \
            --exit-code-on-partial \
            > result.json

          echo "status=$(jq -r '.status' result.json)" >> "$GITHUB_OUTPUT"
          echo "cost=$(jq -r '.costs.total_cost_usd' result.json)" >> "$GITHUB_OUTPUT"

      - name: Post PR comment
        if: always() && hashFiles('review-report.md') != ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr comment ${{ github.event.pull_request.number }} \
            --body-file review-report.md

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: architect-results
          path: |
            result.json
            review-report.md
          retention-days: 30

      - name: Summary
        if: always()
        run: |
          echo "### Architect Review" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Status**: ${{ steps.review.outputs.status }}" >> "$GITHUB_STEP_SUMMARY"
          echo "- **Cost**: \$${{ steps.review.outputs.cost }} USD" >> "$GITHUB_STEP_SUMMARY"
```

---

## GitLab CI

### Complete pipeline: review + build + report

```yaml
# .gitlab-ci.yml
stages:
  - review
  - build
  - report

variables:
  PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"
  ARCHITECT_MODEL: "gpt-4o"

cache:
  paths:
    - .cache/pip/

# ── Stage: Review ─────────────────────────────────────────────────
architect-review:
  stage: review
  image: python:3.12-slim
  before_script:
    - apt-get update && apt-get install -y --no-install-recommends git
    - pip install architect-ai-cli
  script:
    - |
      architect run \
        "Revisa los cambios de este MR. Busca bugs, vulnerabilidades y code smells." \
        -a review \
        --mode yolo \
        --quiet \
        --json \
        --budget 1.50 \
        --context-git-diff "origin/${CI_MERGE_REQUEST_TARGET_BRANCH_NAME}" \
        --report json \
        --report-file review-report.json \
        > result.json
  artifacts:
    paths:
      - result.json
      - review-report.json
    expire_in: 1 week
    reports:
      dotenv: architect.env
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'

# ── Stage: Build + Tests ──────────────────────────────────────────
architect-build:
  stage: build
  image: python:3.12-slim
  before_script:
    - apt-get update && apt-get install -y --no-install-recommends git
    - pip install architect-ai-cli
    - pip install -e .[dev]
  script:
    - |
      architect run \
        "Ejecuta pytest y corrige todos los tests rotos. \
         NO cambies la lógica de negocio, solo los tests." \
        --mode yolo \
        --quiet \
        --json \
        --budget 2.00 \
        --allow-commands \
        --self-eval basic \
        --report json \
        --report-file build-report.json \
        > build-result.json
    - |
      # Verify result
      STATUS=$(jq -r '.status' build-result.json)
      echo "Architect status: $STATUS"
      if [ "$STATUS" = "failed" ]; then
        echo "Architect falló. Ver build-report.json para detalles."
        exit 1
      fi
  artifacts:
    paths:
      - build-result.json
      - build-report.json
    expire_in: 1 week
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'

# ── Stage: Report ─────────────────────────────────────────────────
architect-report:
  stage: report
  image: python:3.12-slim
  dependencies:
    - architect-review
    - architect-build
  script:
    - |
      echo "=== Review Result ==="
      jq '.' review-report.json 2>/dev/null || echo "No review report"
      echo ""
      echo "=== Build Result ==="
      jq '.' build-report.json 2>/dev/null || echo "No build report"
      echo ""
      echo "=== Costs ==="
      REVIEW_COST=$(jq -r '.costs.total_cost_usd // 0' result.json 2>/dev/null || echo 0)
      BUILD_COST=$(jq -r '.costs.total_cost_usd // 0' build-result.json 2>/dev/null || echo 0)
      echo "Review: \$${REVIEW_COST} USD"
      echo "Build:  \$${BUILD_COST} USD"
  artifacts:
    paths:
      - review-report.json
      - build-report.json
    expire_in: 1 month
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

### Standalone job with Ralph Loop

```yaml
# Añadir al .gitlab-ci.yml existente
architect-ralph:
  stage: build
  image: python:3.12-slim
  before_script:
    - apt-get update && apt-get install -y --no-install-recommends git
    - pip install architect-ai-cli
    - pip install -e .[dev]
  script:
    - |
      architect loop "${ARCHITECT_TASK}" \
        --check "${ARCHITECT_CHECK:-pytest tests/ -q}" \
        --max-iterations ${ARCHITECT_MAX_ITER:-5} \
        --max-cost ${ARCHITECT_MAX_COST:-3.00} \
        --quiet
  rules:
    - if: '$ARCHITECT_TASK'
      when: manual
  timeout: 30m
```

To run:

```bash
# Via GitLab API or UI
# Variables: ARCHITECT_TASK="implementa feature X", ARCHITECT_CHECK="pytest tests/", ARCHITECT_MAX_ITER=5
```

---

## Bitbucket Pipelines

### Complete pipeline: review + build

```yaml
# bitbucket-pipelines.yml
image: python:3.12-slim

definitions:
  caches:
    pip: ~/.cache/pip

  steps:
    - step: &architect-setup
        name: Setup
        script:
          - apt-get update && apt-get install -y --no-install-recommends git jq
          - pip install architect-ai-cli

pipelines:
  pull-requests:
    '**':
      - step:
          name: Architect PR Review
          caches:
            - pip
          script:
            - apt-get update && apt-get install -y --no-install-recommends git jq
            - pip install architect-ai-cli
            - |
              architect run \
                "Revisa los cambios de este PR. Busca bugs, vulnerabilidades, \
                 code smells y problemas de rendimiento. Sé conciso." \
                -a review \
                --mode yolo \
                --quiet \
                --json \
                --budget 1.50 \
                --context-git-diff "origin/${BITBUCKET_PR_DESTINATION_BRANCH}" \
                --report markdown \
                --report-file review.md \
                > result.json || true
            - |
              STATUS=$(jq -r '.status // "unknown"' result.json)
              COST=$(jq -r '.costs.total_cost_usd // 0' result.json)
              echo "Review status: ${STATUS} | Cost: \$${COST} USD"
          artifacts:
            - result.json
            - review.md

      - step:
          name: Architect Auto-Fix
          caches:
            - pip
          script:
            - apt-get update && apt-get install -y --no-install-recommends git jq
            - pip install architect-ai-cli
            - pip install -e .[dev] || true
            - |
              architect run \
                "Ejecuta ruff check y mypy. Corrige los errores encontrados. \
                 NO cambies la lógica de negocio, solo lint y tipos." \
                --mode yolo \
                --quiet \
                --json \
                --budget 2.00 \
                --allow-commands \
                --self-eval basic \
                > result.json
            - |
              STATUS=$(jq -r '.status' result.json)
              if [ "$STATUS" = "success" ] || [ "$STATUS" = "partial" ]; then
                git add -A
                git diff --cached --quiet || \
                  git commit -m "fix: auto-fix lint/type errors via architect" && \
                  git push
              fi
          artifacts:
            - result.json
```

### Review with PR comment via API

Bitbucket does not have a native CLI like `gh`, but you can post comments on PRs using the REST API:

```yaml
# bitbucket-pipelines.yml — review step with comment
- step:
    name: Review and Comment
    script:
      - apt-get update && apt-get install -y --no-install-recommends git jq curl
      - pip install architect-ai-cli
      - |
        architect run \
          "Revisa los cambios de este PR." \
          -a review \
          --mode yolo \
          --quiet \
          --context-git-diff "origin/${BITBUCKET_PR_DESTINATION_BRANCH}" \
          --report markdown \
          --report-file review.md \
          --budget 1.00 \
          > result.json || true
      - |
        # Publicar comentario en el PR via Bitbucket API
        if [ -f review.md ]; then
          REVIEW_CONTENT=$(cat review.md | jq -Rs .)
          curl -s -X POST \
            -H "Content-Type: application/json" \
            -u "${BITBUCKET_USER}:${BITBUCKET_APP_PASSWORD}" \
            "https://api.bitbucket.org/2.0/repositories/${BITBUCKET_REPO_FULL_NAME}/pullrequests/${BITBUCKET_PR_ID}/comments" \
            -d "{\"content\": {\"raw\": ${REVIEW_CONTENT}}}"
        fi
```

Variables required as **Repository Variables** (Settings > Repository variables):

| Variable | Description | Secured |
|----------|-------------|---------|
| `LITELLM_API_KEY` | LLM provider API key | Yes |
| `BITBUCKET_USER` | User for API (or use App Password) | No |
| `BITBUCKET_APP_PASSWORD` | App Password with `pullrequest:write` permissions | Yes |

**Automatic Bitbucket variables** (available without configuration):

| Variable | Example |
|----------|---------|
| `BITBUCKET_PR_DESTINATION_BRANCH` | `main` |
| `BITBUCKET_PR_ID` | `42` |
| `BITBUCKET_REPO_FULL_NAME` | `team/my-repo` |
| `BITBUCKET_BRANCH` | `feature/my-branch` |
| `BITBUCKET_COMMIT` | `a1b2c3d4` |

### Pipeline with Ralph Loop (manual trigger)

```yaml
# bitbucket-pipelines.yml
pipelines:
  custom:
    architect-ralph:
      - variables:
          - name: TASK
            default: "implementa feature X"
          - name: CHECK_CMD
            default: "pytest tests/ -q"
          - name: MAX_ITER
            default: "5"
      - step:
          name: Ralph Loop
          max-time: 30  # minutos
          caches:
            - pip
          script:
            - apt-get update && apt-get install -y --no-install-recommends git
            - pip install architect-ai-cli
            - pip install -e .[dev] || true
            - |
              architect loop "${TASK}" \
                --check "${CHECK_CMD}" \
                --max-iterations ${MAX_ITER} \
                --max-cost 5.00 \
                --quiet
            - |
              # Commit y push si hay cambios
              git add -A
              git diff --cached --quiet || \
                git commit -m "feat: ralph loop — ${TASK}" && \
                git push
```

To run: Pipelines > Run pipeline > Custom: `architect-ralph` > Fill in variables.

### Generation from issue (via webhook + custom pipeline)

```yaml
# bitbucket-pipelines.yml
pipelines:
  custom:
    architect-from-issue:
      - variables:
          - name: ISSUE_TITLE
          - name: ISSUE_BODY
          - name: ISSUE_ID
      - step:
          name: Implement Issue
          max-time: 20
          script:
            - apt-get update && apt-get install -y --no-install-recommends git jq
            - pip install architect-ai-cli
            - pip install -e .[dev] || true
            - |
              BRANCH="architect/issue-${ISSUE_ID}"
              git checkout -b "$BRANCH"
            - |
              architect run \
                "${ISSUE_TITLE}. ${ISSUE_BODY}" \
                --mode yolo \
                --json \
                --quiet \
                --budget 3.00 \
                --allow-commands \
                --self-eval basic \
                > result.json
            - |
              STATUS=$(jq -r '.status' result.json)
              if [ "$STATUS" = "success" ] || [ "$STATUS" = "partial" ]; then
                git add -A
                git diff --cached --quiet && echo "Sin cambios" && exit 0
                git commit -m "feat: implement #${ISSUE_ID} via architect"
                git push -u origin "architect/issue-${ISSUE_ID}"

                # Crear PR via API
                curl -s -X POST \
                  -H "Content-Type: application/json" \
                  -u "${BITBUCKET_USER}:${BITBUCKET_APP_PASSWORD}" \
                  "https://api.bitbucket.org/2.0/repositories/${BITBUCKET_REPO_FULL_NAME}/pullrequests" \
                  -d "{
                    \"title\": \"feat: #${ISSUE_ID} — ${ISSUE_TITLE}\",
                    \"source\": {\"branch\": {\"name\": \"architect/issue-${ISSUE_ID}\"}},
                    \"destination\": {\"branch\": {\"name\": \"main\"}},
                    \"description\": \"Implementación automática del issue #${ISSUE_ID}.\\n\\nGenerado por architect-cli.\"
                  }"
              fi
          artifacts:
            - result.json
```

### Bitbucket-specific considerations

1. **No `gh` CLI**: Bitbucket does not have an official CLI like GitHub. Use `curl` with the REST API v2.0 to create PRs and comments.

2. **App Passwords**: For authenticated operations (push, create PR, comment), create an App Password in Personal settings > App passwords with permissions:
   - `repository:write` — for push
   - `pullrequest:write` — for creating PRs and comments

3. **Execution limits**: Bitbucket Pipelines has a limit of **120 minutes** per step and **500 minutes/month** on the free plan. Always configure `max-time` and `--budget` to control usage.

4. **Artifacts**: Artifacts in Bitbucket are shared between steps of the same pipeline. Use `artifacts:` to pass `result.json` between steps.

5. **Secured variables**: Variables marked as "Secured" in Bitbucket are not shown in logs and are not exported to forks. Always use Secured for `LITELLM_API_KEY` and `BITBUCKET_APP_PASSWORD`.

6. **git push in pipelines**: Bitbucket Pipelines have an implicit authentication token for the repo. If you need push, enable "Pipelines > Settings > Enable push" or use an App Password.

---

## Jenkins

### Complete declarative pipeline

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'python:3.12-slim'
            args '--network host'
        }
    }

    environment {
        LITELLM_API_KEY     = credentials('litellm-api-key')
        ARCHITECT_MODEL     = 'gpt-4o'
        PIP_CACHE_DIR       = "${WORKSPACE}/.cache/pip"
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
        timestamps()
    }

    stages {
        stage('Setup') {
            steps {
                sh '''
                    apt-get update && apt-get install -y --no-install-recommends git jq
                    pip install architect-ai-cli
                    pip install -e .[dev] || true
                '''
            }
        }

        stage('Review') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    architect run \
                        "Revisa los cambios de este PR. Busca bugs y vulnerabilidades." \
                        -a review \
                        --mode yolo \
                        --quiet \
                        --json \
                        --budget 1.50 \
                        --context-git-diff origin/${CHANGE_TARGET} \
                        --report markdown \
                        --report-file review.md \
                        > review-result.json || true
                '''

                script {
                    def result = readJSON file: 'review-result.json'
                    echo "Review status: ${result.status}"
                    echo "Review cost: \$${result.costs?.total_cost_usd ?: 0} USD"
                }

                archiveArtifacts artifacts: 'review-result.json, review.md', allowEmptyArchive: true
            }
        }

        stage('Build & Fix') {
            steps {
                sh '''
                    architect run \
                        "Ejecuta los tests y corrige errores encontrados." \
                        --mode yolo \
                        --quiet \
                        --json \
                        --budget 2.00 \
                        --allow-commands \
                        --self-eval basic \
                        > build-result.json

                    STATUS=$(jq -r '.status' build-result.json)
                    echo "Build status: $STATUS"

                    if [ "$STATUS" = "failed" ]; then
                        echo "Architect reportó un fallo."
                        exit 1
                    fi
                '''

                archiveArtifacts artifacts: 'build-result.json', allowEmptyArchive: true
            }
        }

        stage('Cost Report') {
            steps {
                sh '''
                    echo "=== Cost Summary ==="
                    for f in *-result.json; do
                        if [ -f "$f" ]; then
                            COST=$(jq -r '.costs.total_cost_usd // 0' "$f")
                            echo "$f: \$${COST} USD"
                        fi
                    done
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: '*.json, *.md', allowEmptyArchive: true
        }
        failure {
            echo 'The architect pipeline failed. Review the artifacts for details.'
        }
    }
}
```

---

## Advanced patterns

### Pipeline mode in CI (multi-step YAML workflow)

Define a complete workflow in YAML and run it in CI:

```yaml
# .architect/pipelines/feature-pipeline.yaml
name: feature-pipeline
variables:
  base_branch: origin/main
steps:
  - name: plan
    agent: plan
    prompt: |
      Analiza el proyecto y planifica cómo implementar: {{feature}}.
      Lista los archivos a crear/modificar y el orden de los cambios.
    output_var: plan

  - name: implement
    agent: build
    prompt: |
      Ejecuta este plan paso a paso:
      {{plan}}
    model: gpt-4o
    checks:
      - "pytest tests/ -q"
      - "ruff check src/"
    checkpoint: true

  - name: review
    agent: review
    prompt: "Revisa la implementación de {{feature}}. Sé crítico."
    output_var: review_notes

  - name: fix
    agent: build
    prompt: "Corrige estos problemas: {{review_notes}}"
    condition: "auto_fix == 'true'"
    checks:
      - "pytest tests/ -q"
    checkpoint: true
```

Run in CI:

```yaml
# GitHub Actions
- name: Run feature pipeline
  env:
    LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
  run: |
    architect pipeline .architect/pipelines/feature-pipeline.yaml \
      --var feature="autenticación JWT" \
      --var auto_fix=true
```

### Parallel evaluation (compare models in CI)

Run the same task with multiple models and compare results:

```yaml
# GitHub Actions
- name: Eval — compare models
  env:
    LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
  run: |
    architect eval "Implementa un endpoint GET /health con test" \
      --models gpt-4o,claude-sonnet-4-6 \
      --check "pytest tests/test_health.py -q" \
      --budget-per-model 1.50

- name: Cleanup worktrees
  if: always()
  run: architect parallel-cleanup
```

For parallel execution of independent tasks:

```yaml
- name: Parallel tasks
  env:
    LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
  run: |
    architect parallel \
      --task "genera tests para src/auth.py" \
      --task "genera tests para src/users.py" \
      --task "genera tests para src/billing.py" \
      --workers 3 \
      --budget-per-worker 1.00 \
      --timeout-per-worker 300

- name: Cleanup
  if: always()
  run: architect parallel-cleanup
```

### Session persistence between CI runs

Resume interrupted work in a subsequent run:

```yaml
# GitHub Actions — first run
- name: Start implementation
  id: architect
  env:
    LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
  run: |
    architect run "refactoriza todo el módulo de auth" \
      --mode yolo \
      --json \
      --quiet \
      --budget 2.00 \
      > result.json

    echo "session_id=$(jq -r '.session_id // empty' result.json)" >> "$GITHUB_OUTPUT"
    echo "status=$(jq -r '.status' result.json)" >> "$GITHUB_OUTPUT"

- name: Save session
  if: steps.architect.outputs.status == 'partial'
  uses: actions/upload-artifact@v4
  with:
    name: architect-session
    path: .architect/sessions/
    retention-days: 7
```

```yaml
# GitHub Actions — second run (resume)
- name: Download session
  uses: actions/download-artifact@v4
  with:
    name: architect-session
    path: .architect/sessions/

- name: Resume implementation
  env:
    LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
  run: |
    architect resume "${{ needs.previous.outputs.session_id }}" \
      --mode yolo \
      --json \
      --quiet \
      --budget 3.00 \
      > result.json
```

### Cost reporting and budget alerts

```yaml
# GitHub Actions — cost verification step
- name: Check cost threshold
  if: always()
  run: |
    COST=$(jq -r '.costs.total_cost_usd // 0' result.json)
    THRESHOLD=5.00

    echo "Cost: \$${COST} USD | Threshold: \$${THRESHOLD} USD"

    # Alert if cost exceeds threshold
    if echo "$COST $THRESHOLD" | awk '{exit !($1 > $2)}'; then
      echo "::warning::Architect cost (\$${COST}) exceeded the threshold of \$${THRESHOLD}"
    fi

    # Publish to summary
    echo "### Architect Costs" >> "$GITHUB_STEP_SUMMARY"
    echo "| Metric | Value |" >> "$GITHUB_STEP_SUMMARY"
    echo "|--------|-------|" >> "$GITHUB_STEP_SUMMARY"
    echo "| Total cost | \$${COST} USD |" >> "$GITHUB_STEP_SUMMARY"
    echo "| Threshold | \$${THRESHOLD} USD |" >> "$GITHUB_STEP_SUMMARY"
```

### Using --context-git-diff for PR-aware tasks

The `--context-git-diff` flag injects the diff relative to a reference as agent context. This allows the agent to work only on the PR changes.

```bash
# Review only PR changes
architect run "revisa estos cambios" \
  -a review \
  --mode yolo \
  --context-git-diff origin/main

# Build that fixes only files modified in the PR
architect run "corrige errores de lint en los archivos modificados" \
  --mode yolo \
  --context-git-diff origin/main \
  --allow-commands
```

In GitHub Actions, the reference is typically `origin/${{ github.base_ref }}`. In GitLab CI, it is `origin/${CI_MERGE_REQUEST_TARGET_BRANCH_NAME}`.

---

## Parsing JSON output

### Recipes with jq

```bash
# ── Extract basic fields ─────────────────────────────────────────

# Execution status
jq -r '.status' result.json

# Agent output (free text)
jq -r '.output' result.json

# Total cost in USD
jq -r '.costs.total_cost_usd' result.json

# Session ID (for later resume)
jq -r '.session_id' result.json

# Number of steps
jq -r '.steps' result.json

# Duration in seconds
jq -r '.duration_seconds' result.json

# ── Lists and arrays ───────────────────────────────────────────────

# Tools used (list)
jq -r '.tools_used[]' result.json

# Tools used (comma-separated)
jq -r '.tools_used | join(", ")' result.json

# Count tools used
jq '.tools_used | length' result.json

# ── Report analysis ───────────────────────────────────────────────

# Modified files (from JSON report)
jq -r '.files_modified[].path' report.json

# Only created files
jq -r '.files_modified[] | select(.action == "created") | .path' report.json

# Total lines added
jq '[.files_modified[].lines_added] | add' report.json

# Quality gates that failed
jq '.quality_gates[] | select(.passed == false)' report.json

# ── Timeline and performance ────────────────────────────────────

# Most expensive tool
jq '.timeline | sort_by(.cost) | last' report.json

# Slowest step
jq '.timeline | sort_by(.duration) | last' report.json

# Average cost per step
jq '.timeline | (map(.cost) | add) / length' report.json
```

### Bash error handling patterns

```bash
#!/bin/bash
# architect-ci.sh — Robust CI script

set -euo pipefail

RESULT_FILE="architect-result.json"

# Run architect (capture exit code without aborting due to set -e)
EXIT_CODE=0
architect run "$TASK" \
  --mode yolo \
  --json \
  --quiet \
  --budget "${BUDGET:-2.00}" \
  > "$RESULT_FILE" || EXIT_CODE=$?

# Verify the JSON file is valid
if ! jq empty "$RESULT_FILE" 2>/dev/null; then
  echo "ERROR: architect did not produce valid JSON (exit code: $EXIT_CODE)"
  cat "$RESULT_FILE" >&2
  exit 1
fi

STATUS=$(jq -r '.status // "unknown"' "$RESULT_FILE")
COST=$(jq -r '.costs.total_cost_usd // 0' "$RESULT_FILE")
SESSION=$(jq -r '.session_id // empty' "$RESULT_FILE")

echo "Status: $STATUS | Cost: \$${COST} | Session: ${SESSION:-N/A}"

# Handle each exit code
case $EXIT_CODE in
  0)
    echo "Task completed successfully."
    ;;
  1)
    echo "ERROR: Task failed."
    jq -r '.output' "$RESULT_FILE" >&2
    exit 1
    ;;
  2)
    echo "WARN: Task partially completed."
    echo "Session ID for resume: $SESSION"
    # Optionally: continue or fail
    ;;
  3)
    echo "ERROR: Configuration problem."
    exit 3
    ;;
  4)
    echo "ERROR: Invalid or expired API key."
    exit 4
    ;;
  5)
    echo "ERROR: Timeout. Session: $SESSION"
    exit 5
    ;;
  130)
    echo "INFO: Execution interrupted."
    exit 130
    ;;
  *)
    echo "ERROR: Unexpected exit code: $EXIT_CODE"
    exit "$EXIT_CODE"
    ;;
esac
```

---

## Secrets management

### API keys as CI secrets (never in config)

Architect uses environment variables for secrets. **Never** store API keys in YAML configuration files or in source code.

| Platform | How to configure |
|----------|-----------------|
| GitHub Actions | Settings > Secrets and variables > Actions > New repository secret |
| GitLab CI | Settings > CI/CD > Variables (masked + protected) |
| Jenkins | Credentials > Add > Secret text |

### LITELLM_API_KEY

The primary variable for the LLM provider:

```yaml
# GitHub Actions
env:
  LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}

# GitLab CI
variables:
  LITELLM_API_KEY: $LITELLM_API_KEY  # Configurada como variable CI/CD masked

# Jenkins
environment {
    LITELLM_API_KEY = credentials('litellm-api-key')
}
```

If you use a shared LiteLLM Proxy, the proxy key is different from the direct provider key:

```yaml
env:
  LITELLM_API_KEY: ${{ secrets.LITELLM_PROXY_KEY }}
  ARCHITECT_API_BASE: "http://litellm-proxy.internal:8000"
```

### MCP server tokens

If Architect connects to remote MCP servers (external tools), their tokens must also be secrets:

```yaml
# config.yaml — referencia por env var, nunca token directo
mcp:
  servers:
    - name: jira
      url: https://mcp-jira.internal/sse
      token_env: MCP_JIRA_TOKEN   # Resuelve desde $MCP_JIRA_TOKEN

    - name: github
      url: https://mcp-github.internal/sse
      token_env: MCP_GITHUB_TOKEN
```

```yaml
# GitHub Actions
env:
  LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
  MCP_JIRA_TOKEN: ${{ secrets.MCP_JIRA_TOKEN }}
  MCP_GITHUB_TOKEN: ${{ secrets.MCP_GITHUB_TOKEN }}
```

### Secrets checklist

- [ ] `LITELLM_API_KEY` as CI secret (masked/protected)
- [ ] MCP tokens via `token_env` (never direct `token` in YAML)
- [ ] `ARCHITECT_PAT` (Personal Access Token) if the bot needs to push commits
- [ ] Never include `.env`, `credentials.json`, or files with secrets in the workspace
- [ ] Verify that CI logs do not print secrets (Architect sanitizes them, but other steps might not)

---

## Cost control in CI

### Budget per execution

Each invocation should have an explicit budget. Without one, there is no spending limit.

```bash
# Fixed budget per run
architect run "..." --mode yolo --budget 2.00

# Budget for Ralph Loop
architect loop "..." --check "pytest" --max-cost 5.00

# Budget per worker in parallel
architect parallel --task "..." --budget-per-worker 1.00
```

### Budget alerts

Architect emits a warning when approaching the limit. In YAML config:

```yaml
costs:
  enabled: true
  budget_usd: 2.00     # Hard limit (for the execution)
  warn_at_usd: 1.50    # Warning when reaching this threshold
```

For CI-level alerts:

```bash
# Check cost after execution
COST=$(jq -r '.costs.total_cost_usd // 0' result.json)
MAX_EXPECTED=3.00

if echo "$COST $MAX_EXPECTED" | awk '{exit !($1 > $2)}'; then
  echo "::warning::High cost: \$${COST} USD (maximum expected: \$${MAX_EXPECTED})"
fi
```

### Model selection strategies

Use cheaper models for simple tasks and reserve expensive models for complex tasks:

| Task | Recommended model | Approximate cost |
|------|-------------------|------------------|
| PR review | `gpt-4o-mini`, `claude-haiku` | $0.01-0.05 per review |
| Lint/type fix | `gpt-4o-mini` | $0.02-0.10 per fix |
| Complex implementation | `gpt-4o`, `claude-sonnet-4-6` | $0.10-0.50 per task |
| Test generation | `gpt-4o` | $0.05-0.30 per module |

```yaml
# GitHub Actions — model by job
- name: Quick review (cheap model)
  env:
    ARCHITECT_MODEL: gpt-4o-mini
  run: architect run "..." -a review --mode yolo --budget 0.50

- name: Full implementation (capable model)
  env:
    ARCHITECT_MODEL: gpt-4o
  run: architect run "..." --mode yolo --budget 3.00
```

### Caching strategies

The Architect LLM cache stores responses to avoid repeated calls to the provider:

```bash
# Enable cache (useful for CI retries with the same prompt)
architect run "..." --mode yolo --cache

# Clear cache before execution (force fresh responses)
architect run "..." --mode yolo --cache-clear
```

In CI, the cache is useful if the same job is re-executed with the same prompt (retry). For different jobs, the cache does not add value since the prompts are different.

```yaml
# Persist cache between runs (GitHub Actions)
- name: Cache architect LLM
  uses: actions/cache@v4
  with:
    path: ~/.architect/cache
    key: architect-llm-${{ hashFiles('**/*.py') }}
    restore-keys: architect-llm-
```

### Monitor monthly spending

Aggregate costs from all runs of the month:

```bash
#!/bin/bash
# monthly-cost-report.sh — run as cron job or scheduled workflow

TOTAL=0
for f in /path/to/ci-results/*.json; do
  COST=$(jq -r '.costs.total_cost_usd // 0' "$f" 2>/dev/null)
  TOTAL=$(echo "$TOTAL + $COST" | bc)
done

echo "Monthly architect spending: \$${TOTAL} USD"

MONTHLY_LIMIT=100.00
if echo "$TOTAL $MONTHLY_LIMIT" | awk '{exit !($1 > $2)}'; then
  echo "ALERT: Monthly spending (\$${TOTAL}) exceeds the limit of \$${MONTHLY_LIMIT}"
  # Send notification (Slack, email, etc.)
fi
```

Scheduled workflow for GitHub Actions:

```yaml
# .github/workflows/cost-monitor.yml
name: Monthly Cost Monitor

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9:00

jobs:
  cost-report:
    runs-on: ubuntu-latest
    steps:
      - name: Download all architect artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: architect-results-*
          merge-multiple: true

      - name: Calculate monthly cost
        run: |
          TOTAL=0
          for f in *.json; do
            COST=$(jq -r '.costs.total_cost_usd // 0' "$f" 2>/dev/null || echo 0)
            TOTAL=$(echo "$TOTAL + $COST" | bc)
          done

          echo "### Weekly Cost Report" >> "$GITHUB_STEP_SUMMARY"
          echo "Total spending: \$${TOTAL} USD" >> "$GITHUB_STEP_SUMMARY"
```

---

## Integration checklist

Step-by-step guide to set up Architect in a new CI pipeline.

### 1. Prerequisites

- [ ] Python 3.12+ available on the runner (or use Docker image `python:3.12-slim`)
- [ ] Git installed on the runner
- [ ] LLM provider API key (OpenAI, Anthropic, etc.) or access to LiteLLM Proxy
- [ ] Outbound HTTPS network access to the LLM provider from the runner

### 2. Configure secrets

- [ ] Create `LITELLM_API_KEY` secret on the CI platform
- [ ] (Optional) Create `ARCHITECT_PAT` secret if the bot needs to push commits
- [ ] (Optional) Create secrets for MCP tokens (`MCP_*_TOKEN`)
- [ ] Verify that secrets are masked in logs

### 3. Install Architect

- [ ] Add installation step: `pip install architect-ai-cli`
- [ ] (Optional) Install project dependencies: `pip install -e .[dev]`
- [ ] Verify installation: `architect --version`

### 4. Configure the command

- [ ] Define the specific prompt for the task
- [ ] Select agent (`-a review`, `-a build`, `-a plan`)
- [ ] Add mandatory flags: `--mode yolo --json --quiet`
- [ ] Configure budget: `--budget N.NN`
- [ ] (Optional) Add `--context-git-diff` for PRs
- [ ] (Optional) Add `--report github` for PR comments
- [ ] (Optional) Add `--allow-commands` if the agent needs to run tests
- [ ] (Optional) Add `--self-eval basic` for self-verification

### 5. Capture and process results

- [ ] Redirect stdout to JSON file: `> result.json`
- [ ] Verify exit code with explicit handling
- [ ] Parse relevant fields with `jq`
- [ ] (Optional) Post PR comment with the report
- [ ] (Optional) Upload artifacts (result.json, report)

### 6. Configure protections

- [ ] Job timeout (10-30 minutes depending on the task)
- [ ] Budget per execution (always explicit)
- [ ] `--exit-code-on-partial` if partial should be failure
- [ ] Cleanup step (`if: always()`) for worktrees: `architect parallel-cleanup`

### 7. Test and adjust

- [ ] Run the pipeline manually with a simple task
- [ ] Verify that secrets resolve correctly (exit code 4 = invalid API key)
- [ ] Verify that JSON output parses correctly
- [ ] Adjust budget and timeout based on observed actual costs
- [ ] (Optional) Add pip cache to speed up installation

### 8. Monitor in production

- [ ] Review costs weekly
- [ ] Configure alerts if spending exceeds a threshold
- [ ] Review logs of failed executions (exit code 1 or 5)
- [ ] Update Architect periodically: `pip install --upgrade architect-ai-cli`

---

## Related files

- **Containers**: [`containers.md`](/architect-docs/docs/v1-0-0/containers) -- Dockerfiles, Kubernetes and OpenShift
- **Reports**: [`reports.md`](/architect-docs/docs/v1-0-0/reports) -- JSON, Markdown and GitHub formats
- **Sessions**: [`sessions.md`](/architect-docs/docs/v1-0-0/sessions) -- persistence and resume
- **Ralph Loop**: [`ralph-loop.md`](/architect-docs/docs/v1-0-0/ralph-loop) -- automatic iteration with checks
- **Parallel**: [`parallel.md`](/architect-docs/docs/v1-0-0/parallel) -- parallel execution in worktrees
- **Pipelines**: [`pipelines.md`](/architect-docs/docs/v1-0-0/pipelines) -- multi-step YAML workflows
- **Security**: [`security.md`](/architect-docs/docs/v1-0-0/security) -- complete security model
- **Dry Run**: [`dryrun.md`](/architect-docs/docs/v1-0-0/dryrun) -- execution simulation
- **Quick Guide**: [`fast-usage.md`](/architect-docs/docs/v1-0-0/fast-usage) -- daily usage reference
