---
title: "Containers"
description: "Containerfiles, Kubernetes Deployments, Docker, CI/CD configuration."
icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
order: 15
---

# Architect CLI in Containers

Complete guide to running `architect` in Docker, Kubernetes, and Red Hat OpenShift containers.

## Table of Contents

- [Container requirements](#container-requirements)
- [Environment variables](#environment-variables)
- [Working directories](#working-directories)
- [Containerfile — Docker (root)](#containerfile--docker-root)
- [Containerfile — Docker (non-root)](#containerfile--docker-non-root)
- [Containerfile — Red Hat OpenShift (non-root, /tmp)](#containerfile--red-hat-openshift-non-root-tmp)
- [Docker example: direct execution](#docker-example-direct-execution)
- [Kubernetes example: Deployment](#kubernetes-example-deployment)
- [OpenShift example: Deployment with SecurityContext](#openshift-example-deployment-with-securitycontext)
- [YAML configuration for containers](#yaml-configuration-for-containers)
- [Usage patterns](#usage-patterns)
- [Troubleshooting](#troubleshooting)

---

## Container requirements

| Requirement | Details |
|-------------|---------|
| **Python** | 3.12+ |
| **System** | Linux (glibc or musl) |
| **Git** | Required for cloning the repository, installing architect, and for agent tools |
| **POSIX tools** | `ls`, `cat`, `find`, `grep`, `wc`, `head`, `tail` (included in base images) |
| **Network** | Outbound HTTPS access to the LLM provider (OpenAI, Anthropic, etc.) |
| **Disk** | ~200 MB for base image + Python dependencies |

Architect does **not** require:
- TTY access (in `yolo` mode there are no interactive confirmations).
- Root privileges to function.
- Access to databases or external services (except the LLM API and optional MCP servers).

---

## Environment variables

### Required

| Variable | Description |
|----------|-------------|
| `LITELLM_API_KEY` | LLM provider API key. The name of this variable can be changed with `llm.api_key_env` in the configuration YAML. |

### Optional (overrides)

| Variable | Description | Example |
|----------|-------------|---------|
| `ARCHITECT_MODEL` | LLM model override | `gpt-4o`, `claude-sonnet-4-6` |
| `ARCHITECT_API_BASE` | API base URL override | `http://litellm-proxy:8000` |
| `ARCHITECT_LOG_LEVEL` | Logging level override | `debug`, `info`, `human`, `warn` |
| `ARCHITECT_LANGUAGE` | System message language (v1.1.0) | `en` (default), `es` |
| `ARCHITECT_WORKSPACE` | Workspace root override | `/workspace` |
| `HOME` | User home directory (affects `~/.architect/`) | `/tmp`, `/home/architect` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint for OpenTelemetry traces | `http://jaeger:4318` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Additional headers for OTLP | `Authorization=Bearer token` |

### For non-root containers (OpenShift)

| Variable | Recommended value | Reason |
|----------|-------------------|--------|
| `HOME` | `/tmp` | Allows writing to `~/.architect/` without special permissions |

---

## Working directories

Architect writes to the following directories at runtime:

| Directory | Purpose | Configurable |
|-----------|---------|--------------|
| `~/.architect/index_cache/` | Repository index cache (TTL 5 min) | Not directly (depends on `HOME`) |
| `~/.architect/cache/` | Local LLM response cache (development) | Yes: `llm_cache.dir` |
| Workspace root | Directory where the agent reads/writes files | Yes: `workspace.root`, `-w`, `ARCHITECT_WORKSPACE` |
| Log file | JSON log file (optional) | Yes: `logging.file`, `--log-file` |

**All these directories are created automatically with silent failure** -- if the container does not have write permissions to `~/.architect/`, the system works without cache (only loses performance on consecutive runs).

In **non-root** containers, set `HOME=/tmp` so that `~/.architect/` resolves to `/tmp/.architect/`, a directory where any user can write.

---

## Containerfile — Docker (root)

Base image for Docker running as root. The simplest option for local environments and CI/CD.

```dockerfile
# -- Containerfile.root -----------------------------------------------------
# Docker image for architect CLI (root)
# Build: docker build -t architect:latest -f Containerfile.root .
# ---------------------------------------------------------------------------

FROM python:3.12-slim AS base

LABEL maintainer="architect contributors"
LABEL description="architect CLI - Headless agentic tool for orchestrating AI agents"

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install architect from PyPI
RUN pip install --no-cache-dir architect-ai-cli

# Default working directory (source code mount point)
RUN mkdir -p /workspace
WORKDIR /workspace

# Create cache directories
RUN mkdir -p /root/.architect/cache /root/.architect/index_cache

# Default environment variables
ENV ARCHITECT_WORKSPACE=/workspace
ENV ARCHITECT_LOG_LEVEL=human

# Entrypoint
ENTRYPOINT ["architect"]
CMD ["--help"]
```

**Usage:**

```bash
# Build
docker build -t architect:latest -f Containerfile.root .

# Basic execution
docker run --rm \
  -e LITELLM_API_KEY="sk-..." \
  -v $(pwd):/workspace \
  architect:latest run "analyze this project" --mode yolo

# With custom YAML configuration
docker run --rm \
  -e LITELLM_API_KEY="sk-..." \
  -v $(pwd):/workspace \
  -v $(pwd)/config.yaml:/etc/architect/config.yaml:ro \
  architect:latest run "refactor main.py" \
    -c /etc/architect/config.yaml \
    --mode yolo
```

---

## Containerfile — Docker (non-root)

Image for Docker running as an unprivileged user. Recommended for production and CI/CD with security requirements.

```dockerfile
# -- Containerfile.nonroot --------------------------------------------------
# Docker image for architect CLI (non-root)
# Build: docker build -t architect:nonroot -f Containerfile.nonroot .
# ---------------------------------------------------------------------------

FROM python:3.12-slim AS base

LABEL maintainer="architect contributors"
LABEL description="architect CLI - non-root"

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged user
RUN groupadd --gid 1000 architect && \
    useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash architect

# Install architect from PyPI (as root, before switching user)
RUN pip install --no-cache-dir architect-ai-cli

# Create working directories with correct permissions
RUN mkdir -p /workspace && chown architect:architect /workspace
RUN mkdir -p /home/architect/.architect/cache \
             /home/architect/.architect/index_cache && \
    chown -R architect:architect /home/architect/.architect

# Switch to non-root user
USER architect

WORKDIR /workspace

# Environment variables
ENV HOME=/home/architect
ENV ARCHITECT_WORKSPACE=/workspace
ENV ARCHITECT_LOG_LEVEL=human

ENTRYPOINT ["architect"]
CMD ["--help"]
```

**Usage:**

```bash
# Build
docker build -t architect:nonroot -f Containerfile.nonroot .

# Execution
docker run --rm \
  -e LITELLM_API_KEY="sk-..." \
  -v $(pwd):/workspace \
  architect:nonroot run "add unit tests" --mode yolo
```

---

## Containerfile — Red Hat OpenShift (non-root, /tmp)

Red Hat OpenShift runs containers with an **arbitrary and random UID** assigned by the namespace, belonging to the `root` group (GID 0). This means:

- The UID cannot be predicted at build time.
- The user's `HOME` directory does not exist in the filesystem.
- Only `/tmp` and directories with `root` group permissions are writable.

The solution is to **redirect `HOME` to `/tmp`** so that `~/.architect/` resolves to `/tmp/.architect/`. Architect automatically creates its cache directories with `mkdir -p` and silent failure, so it works in this scenario without code modifications.

```dockerfile
# -- Containerfile.openshift ------------------------------------------------
# Image for Red Hat OpenShift (non-root, arbitrary UID)
# Build: podman build -t architect:openshift -f Containerfile.openshift .
#
# OpenShift assigns a random UID on each deployment. This image
# uses HOME=/tmp so that architect can create ~/.architect/ inside
# /tmp, which is always writable.
# ---------------------------------------------------------------------------

FROM registry.access.redhat.com/ubi9/python-312:latest

LABEL maintainer="architect contributors"
LABEL description="architect CLI for OpenShift (non-root, arbitrary UID)"
LABEL io.openshift.tags="ai,agent,llm,cli"
LABEL io.k8s.description="Headless agentic CLI tool for orchestrating AI agents"

# As root to install dependencies
USER 0

# Install git (required for cloning the repo and for agent tools)
RUN dnf install -y --nodocs git-core && \
    dnf clean all && \
    rm -rf /var/cache/dnf

# Install architect from PyPI
RUN pip install --no-cache-dir architect-ai-cli

# Create workspace with permissions for GID 0 (root group in OpenShift)
RUN mkdir -p /workspace && \
    chgrp -R 0 /workspace && \
    chmod -R g=u /workspace

# Prepare /tmp for architect cache (already writable, but ensure structure)
# OpenShift guarantees that /tmp is writable for any UID
RUN mkdir -p /tmp/.architect/cache /tmp/.architect/index_cache && \
    chgrp -R 0 /tmp/.architect && \
    chmod -R g=u /tmp/.architect

# -- Critical configuration for OpenShift ----------------------------------
# HOME=/tmp -> ~/.architect/ resolves to /tmp/.architect/
# This allows architect to create caches without special permissions.
# This is the same pattern used by aider, pip, and other Python tools
# when running in containers with arbitrary UID.
ENV HOME=/tmp
ENV ARCHITECT_WORKSPACE=/workspace
ENV ARCHITECT_LOG_LEVEL=human

# Port (not required unless for custom HTTP health checks)
# EXPOSE 8080

WORKDIR /workspace

# Switch to non-root user (OpenShift will override the UID)
USER 1001

ENTRYPOINT ["architect"]
CMD ["--help"]
```

**Key notes for OpenShift:**

1. **`HOME=/tmp`**: The most important variable. Without it, `Path.home()` in Python fails or points to a non-existent directory with arbitrary UID.

2. **`chgrp -R 0` + `chmod -R g=u`**: Standard OpenShift pattern. The random UID always belongs to GID 0, so granting group permissions is equivalent to granting user permissions.

3. **UBI 9 base**: Red Hat Universal Base Image 9 with Python 3.12. Supported and certified for OpenShift.

4. **Installation via PyPI**: Installed directly from PyPI with `pip install architect-ai-cli`.

---

## Docker example: direct execution

### Basic case — project analysis

```bash
docker run --rm \
  -e LITELLM_API_KEY="${LITELLM_API_KEY}" \
  -v "$(pwd):/workspace" \
  architect:latest run \
    "analyze the project structure and generate a summary" \
    --mode yolo \
    --quiet \
    --json
```

### Case with specific model and budget

```bash
docker run --rm \
  -e LITELLM_API_KEY="${LITELLM_API_KEY}" \
  -e ARCHITECT_MODEL="claude-sonnet-4-6" \
  -v "$(pwd):/workspace" \
  architect:latest run \
    "refactor utils.py to use dataclasses" \
    --mode yolo \
    --budget 0.50 \
    --show-costs
```

### Case with LiteLLM Proxy (team/enterprise)

```bash
docker run --rm \
  -e LITELLM_API_KEY="team-key-..." \
  -e ARCHITECT_API_BASE="http://litellm-proxy:8000" \
  -v "$(pwd):/workspace" \
  architect:latest run \
    "generate API documentation for all endpoints" \
    --mode yolo
```

### Case with config YAML and logs

```bash
docker run --rm \
  -e LITELLM_API_KEY="${LITELLM_API_KEY}" \
  -v "$(pwd):/workspace" \
  -v "$(pwd)/config.yaml:/etc/architect/config.yaml:ro" \
  -v "$(pwd)/logs:/var/log/architect" \
  architect:latest run \
    "add email validation to user.py" \
    -c /etc/architect/config.yaml \
    --log-file /var/log/architect/session.jsonl \
    --mode yolo
```

### CI pipeline case (JSON output for parsing)

```bash
# In a CI step (GitHub Actions, GitLab CI, Jenkins, etc.)
RESULT=$(docker run --rm \
  -e LITELLM_API_KEY="${LITELLM_API_KEY}" \
  -v "$(pwd):/workspace" \
  architect:latest run \
    "review the code and list security issues" \
    --mode yolo \
    --quiet \
    --json \
    -a review)

echo "${RESULT}" | jq '.final_output'
```

---

## Kubernetes example: Deployment

### Deployment + ConfigMap + Secret

```yaml
# -- Secret: LLM API key ---------------------------------------------------
apiVersion: v1
kind: Secret
metadata:
  name: architect-llm-secret
  namespace: ai-tools
type: Opaque
stringData:
  LITELLM_API_KEY: "sk-your-api-key-here"

---
# -- ConfigMap: architect YAML configuration --------------------------------
apiVersion: v1
kind: ConfigMap
metadata:
  name: architect-config
  namespace: ai-tools
data:
  config.yaml: |
    llm:
      model: gpt-4o
      timeout: 120
      stream: false
      prompt_caching: true

    workspace:
      root: /workspace

    logging:
      level: human
      file: /var/log/architect/session.jsonl

    indexer:
      enabled: true
      use_cache: true

    commands:
      enabled: true
      default_timeout: 60
      allowed_only: true

    evaluation:
      mode: basic

    costs:
      enabled: true
      budget_usd: 2.0
      warn_at_usd: 1.0

    telemetry:
      enabled: false
      exporter: otlp
      endpoint: http://jaeger:4318

    health:
      enabled: false

---
# -- Deployment -------------------------------------------------------------
apiVersion: apps/v1
kind: Deployment
metadata:
  name: architect-agent
  namespace: ai-tools
  labels:
    app: architect
spec:
  replicas: 1
  selector:
    matchLabels:
      app: architect
  template:
    metadata:
      labels:
        app: architect
    spec:
      # Security: non-root
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000

      containers:
        - name: architect
          image: architect:nonroot
          imagePullPolicy: IfNotPresent

          # Command: overridden depending on the task
          command: ["architect"]
          args:
            - "run"
            - "analyze the project and generate a quality report"
            - "-c"
            - "/etc/architect/config.yaml"
            - "--mode"
            - "yolo"
            - "--quiet"
            - "--json"

          env:
            - name: LITELLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: architect-llm-secret
                  key: LITELLM_API_KEY
            - name: ARCHITECT_WORKSPACE
              value: "/workspace"
            - name: HOME
              value: "/home/architect"

          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"

          volumeMounts:
            - name: workspace
              mountPath: /workspace
            - name: config
              mountPath: /etc/architect
              readOnly: true
            - name: logs
              mountPath: /var/log/architect
            - name: cache
              mountPath: /home/architect/.architect

          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false
            capabilities:
              drop: ["ALL"]

      volumes:
        - name: workspace
          # Option A: PVC with source code
          persistentVolumeClaim:
            claimName: workspace-pvc
          # Option B: EmptyDir for ephemeral tasks
          # emptyDir: {}
        - name: config
          configMap:
            name: architect-config
        - name: logs
          emptyDir: {}
        - name: cache
          emptyDir: {}

      restartPolicy: Always
```

### Job (for one-off tasks)

If architect runs as a one-off task (CI, batch) instead of a persistent service, use a **Job**:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: architect-review
  namespace: ai-tools
spec:
  backoffLimit: 1
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000

      containers:
        - name: architect
          image: architect:nonroot
          command: ["architect"]
          args:
            - "run"
            - "review the code and generate a security report"
            - "--mode"
            - "yolo"
            - "--quiet"
            - "--json"
            - "-a"
            - "review"
            - "--budget"
            - "1.0"

          env:
            - name: LITELLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: architect-llm-secret
                  key: LITELLM_API_KEY
            - name: ARCHITECT_WORKSPACE
              value: "/workspace"
            - name: HOME
              value: "/home/architect"

          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "1"
              memory: "512Mi"

          volumeMounts:
            - name: workspace
              mountPath: /workspace

      volumes:
        - name: workspace
          persistentVolumeClaim:
            claimName: workspace-pvc

      restartPolicy: Never
```

---

## OpenShift example: Deployment with SecurityContext

OpenShift applies stricter **Security Context Constraints (SCC)** than vanilla Kubernetes. The `restricted-v2` SCC (default) enforces:

- Random UID (cannot choose `runAsUser`).
- No `allowPrivilegeEscalation`.
- Only `NET_BIND_SERVICE` capabilities (if needed).
- `readOnlyRootFilesystem` optional but recommended.

```yaml
# -- Secret: API key --------------------------------------------------------
apiVersion: v1
kind: Secret
metadata:
  name: architect-llm-secret
  namespace: ai-agents
type: Opaque
stringData:
  LITELLM_API_KEY: "sk-your-api-key-here"

---
# -- ConfigMap: configuration for OpenShift ---------------------------------
apiVersion: v1
kind: ConfigMap
metadata:
  name: architect-config
  namespace: ai-agents
data:
  config.yaml: |
    llm:
      model: gpt-4o
      timeout: 120
      stream: false
      prompt_caching: true

    workspace:
      root: /workspace

    logging:
      level: human
      # Logs in /tmp (writable on OpenShift)
      file: /tmp/architect-logs/session.jsonl

    indexer:
      enabled: true
      use_cache: true

    # Cache in /tmp (HOME=/tmp -> ~/.architect/ = /tmp/.architect/)
    llm_cache:
      enabled: false
      dir: /tmp/.architect/cache

    commands:
      enabled: true
      default_timeout: 60
      allowed_only: true

    evaluation:
      mode: basic

    costs:
      enabled: true
      budget_usd: 2.0

    telemetry:
      enabled: false
      exporter: otlp
      endpoint: http://jaeger:4318

    health:
      enabled: false

---
# -- DeploymentConfig / Deployment ------------------------------------------
apiVersion: apps/v1
kind: Deployment
metadata:
  name: architect-agent
  namespace: ai-agents
  labels:
    app: architect
    app.kubernetes.io/name: architect
    app.kubernetes.io/component: agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: architect
  template:
    metadata:
      labels:
        app: architect
    spec:
      # OpenShift SCC restricted-v2: do not specify runAsUser (will be random)
      securityContext:
        runAsNonRoot: true
        # Do not specify runAsUser -- OpenShift assigns a random UID
        # The UID always belongs to GID 0 (root group)

      containers:
        - name: architect
          image: image-registry.openshift-image-registry.svc:5000/ai-agents/architect:openshift
          imagePullPolicy: Always

          command: ["architect"]
          args:
            - "run"
            - "analyze the project and generate a quality report"
            - "-c"
            - "/etc/architect/config.yaml"
            - "--mode"
            - "yolo"
            - "--quiet"
            - "--json"

          env:
            # API key from Secret
            - name: LITELLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: architect-llm-secret
                  key: LITELLM_API_KEY

            # -- CRITICAL: HOME=/tmp --
            # Without this, Path.home() fails with arbitrary UID.
            # ~/.architect/ resolves to /tmp/.architect/
            - name: HOME
              value: "/tmp"

            - name: ARCHITECT_WORKSPACE
              value: "/workspace"

            # Optional: model override via env var
            # - name: ARCHITECT_MODEL
            #   value: "claude-sonnet-4-6"

          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"

          volumeMounts:
            - name: workspace
              mountPath: /workspace
            - name: config
              mountPath: /etc/architect
              readOnly: true
            # /tmp is already writable -- no extra volume needed
            # but you can mount emptyDir if you want to persist logs between restarts
            - name: tmp-data
              mountPath: /tmp

          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
            # readOnlyRootFilesystem: true  # Uncomment if the SCC requires it
            # If we enable readOnly, /tmp must be a mounted volume

      volumes:
        - name: workspace
          persistentVolumeClaim:
            claimName: workspace-pvc
        - name: config
          configMap:
            name: architect-config
        - name: tmp-data
          emptyDir:
            sizeLimit: 500Mi

      restartPolicy: Always
```

### BuildConfig for OpenShift (internal build)

If you prefer OpenShift to build the image from the repository:

```yaml
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata:
  name: architect-build
  namespace: ai-agents
spec:
  source:
    type: Git
    git:
      uri: "https://github.com/Diego303/architect-cli.git"
      ref: main
  strategy:
    type: Docker
    dockerStrategy:
      dockerfilePath: Containerfile.openshift
  output:
    to:
      kind: ImageStreamTag
      name: "architect:openshift"
  triggers:
    - type: ConfigChange
```

---

## YAML configuration for containers

Example `config.yaml` optimized for container execution:

```yaml
# config-container.yaml — Configuration optimized for containers
# Mount as ConfigMap at /etc/architect/config.yaml

llm:
  model: gpt-4o
  timeout: 120
  retries: 3
  # Streaming disabled in containers (no interactive terminal)
  stream: false
  # Prompt caching recommended to reduce costs on repeated runs
  prompt_caching: true

workspace:
  root: /workspace
  allow_delete: false

logging:
  level: human
  verbose: 0
  # Logs in writable directory (adjust per environment)
  # Docker/K8s: /var/log/architect/
  # OpenShift:  /tmp/architect-logs/
  # file: /var/log/architect/session.jsonl

indexer:
  enabled: true
  use_cache: true

context:
  max_tool_result_tokens: 2000
  summarize_after_steps: 8
  max_context_tokens: 80000
  parallel_tools: true

evaluation:
  # basic recommended for CI — verifies the task was completed
  mode: basic
  confidence_threshold: 0.8

commands:
  enabled: true
  default_timeout: 60
  max_output_lines: 200
  # In CI/production: only safe and development commands
  allowed_only: true

costs:
  enabled: true
  # Budget per execution (adjust per task)
  budget_usd: 2.0
  warn_at_usd: 1.0

llm_cache:
  # Disabled by default in ephemeral containers
  enabled: false
  dir: ~/.architect/cache
  ttl_hours: 24

telemetry:
  # OpenTelemetry traces (v1.0.0)
  # Enable if there is an OTLP collector accessible from the container
  enabled: false
  exporter: otlp          # otlp, console, json_file
  endpoint: ""            # http://jaeger:4318 or http://otel-collector:4318
  # endpoint: http://jaeger:4318

health:
  # Code health metrics (v1.0.0)
  enabled: false

hooks:
  post_edit: []
```

---

## Usage patterns

### 1. One-shot task (Job / docker run)

The most common pattern: run a task and get the result.

```bash
# Docker
docker run --rm \
  -e LITELLM_API_KEY="$KEY" \
  -v ./src:/workspace \
  architect:latest run "add docstrings to all modules" \
    --mode yolo --quiet --json

# Kubernetes Job (see example above)
kubectl apply -f job-architect.yaml
kubectl logs job/architect-review
```

### 2. Agent in CI/CD pipeline

```yaml
# GitHub Actions
- name: Code Review with Architect
  run: |
    docker run --rm \
      -e LITELLM_API_KEY="${{ secrets.LITELLM_API_KEY }}" \
      -v ${{ github.workspace }}:/workspace \
      architect:nonroot run \
        "review the changes from the last commit and generate a report" \
        -a review --mode yolo --quiet --json \
      > review.json

    # Parse result
    cat review.json | jq -r '.final_output'
```

### 3. Agent with LiteLLM Proxy (team)

When there is a shared LiteLLM proxy to manage keys and rate limits:

```bash
docker run --rm \
  -e LITELLM_API_KEY="team-key" \
  -e ARCHITECT_API_BASE="http://litellm-proxy.internal:8000" \
  -v ./:/workspace \
  architect:latest run "optimize the SQL queries" --mode yolo
```

### 4. Agent with local model (Ollama)

For completely local execution without internet access:

```bash
# Ollama running on the host or in another container
docker run --rm \
  --network host \
  -e ARCHITECT_MODEL="ollama/llama3" \
  -e ARCHITECT_API_BASE="http://localhost:11434" \
  -e LITELLM_API_KEY="dummy" \
  -v ./:/workspace \
  architect:latest run "explain the project architecture" \
    --mode yolo -a review
```

### 5. Multiple agents in parallel

```bash
# Launch analysis and review in parallel
docker run --rm -d --name architect-review \
  -e LITELLM_API_KEY="$KEY" \
  -v ./:/workspace:ro \
  architect:latest run "security review" -a review --mode yolo --json

docker run --rm -d --name architect-docs \
  -e LITELLM_API_KEY="$KEY" \
  -v ./:/workspace \
  architect:latest run "generate README.md" --mode yolo

# Wait for results
docker wait architect-review architect-docs
docker logs architect-review > review.json
docker logs architect-docs
```

---

## Troubleshooting

### `Path.home()` fails with arbitrary UID (OpenShift)

```
RuntimeError: Could not determine home directory
```

**Solution**: Set `HOME=/tmp` in the container's environment variables.

```yaml
env:
  - name: HOME
    value: "/tmp"
```

### Permission denied when writing cache

```
[warning] llm_cache.dir_create_failed path=/home/nonexistent/.architect/cache
```

**Solution**: This is a non-blocking warning -- architect works without cache. To eliminate it, ensure that `HOME` points to a writable directory or configure `llm_cache.dir` to a writable path.

### Timeout connecting to the LLM

```
Error: Timeout: Connection timed out
```

**Solution**:
- Verify that the container has network access to the LLM provider.
- On OpenShift, verify the namespace's NetworkPolicies.
- If using a proxy, verify `ARCHITECT_API_BASE`.
- Increase the timeout: `--timeout 300` or `llm.timeout: 300` in config.

### The container hangs without exiting

If the agent does not finish, it may be waiting for interactive confirmation.

**Solution**: Always use `--mode yolo` in containers. Without a terminal, the `confirm-all` and `confirm-sensitive` modes block execution.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Task completed successfully |
| 1 | Task failed |
| 2 | Task partially completed |
| 3 | Configuration error |
| 4 | Authentication error (invalid API key) |
| 5 | Timeout |
| 130 | Interrupted (SIGINT/SIGTERM) |

Use the exit code in CI/CD pipelines to determine if the step was successful:

```bash
docker run --rm ... architect:latest run "..." --mode yolo
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "Architect failed with code: $EXIT_CODE"
  exit 1
fi
```

### The workspace is empty inside the container

Verify that the volume is mounted correctly:

```bash
# Verify that the host path exists
ls -la $(pwd)

# Run with debug to see the workspace
docker run --rm \
  -e LITELLM_API_KEY="$KEY" \
  -v "$(pwd):/workspace" \
  architect:latest run "list the files" --mode yolo -v
```

In Kubernetes, verify that the PVC is bound and the pod mounts it:

```bash
kubectl describe pod architect-agent-xxx | grep -A5 Volumes
kubectl exec architect-agent-xxx -- ls -la /workspace
```
