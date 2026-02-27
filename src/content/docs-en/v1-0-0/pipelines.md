---
title: "Pipelines"
description: "Multi-step YAML workflows: variables, conditions, output_var, checkpoints, dry-run."
icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
order: 21
---

# Pipeline Mode — Multi-Step YAML Workflows

Pipeline Mode executes workflows defined in YAML with sequential steps. Each step can have its own agent, model, prompt, checks, conditions, and variables.

---

## Concept

A pipeline defines a sequence of tasks where each step can depend on previous ones. Steps communicate with each other through **variables** (`{{name}}`) and can be conditioned, verified with checks, and protected with git checkpoints.

```yaml
name: feature-pipeline
steps:
  - name: analyze
    agent: plan
    prompt: "Analiza los requisitos de {{feature}}"
    output_var: analysis

  - name: implement
    agent: build
    prompt: "Implementa según este análisis: {{analysis}}"
    checks:
      - "pytest tests/ -q"
    checkpoint: true

  - name: review
    agent: review
    prompt: "Revisa la implementación de {{feature}}"
    condition: "run_review == 'true'"
```

---

## Basic usage

```bash
# Run a pipeline
architect pipeline workflow.yaml --var feature="user auth"

# See what it would do without executing (dry-run)
architect pipeline workflow.yaml --var feature="user auth" --dry-run

# Resume from a specific step
architect pipeline workflow.yaml --var feature="user auth" --from-step implement

# With multiple variables
architect pipeline workflow.yaml \
  --var feature="payment gateway" \
  --var env=staging \
  --var run_review=true
```

---

## Command options

| Option | Default | Description |
|--------|---------|-------------|
| `PIPELINE_FILE` | (required) | YAML file with the pipeline definition |
| `--var KEY=VALUE` | — | Variable for the pipeline (repeatable) |
| `--from-step NAME` | — | Resume from a specific step (skips previous ones) |
| `--dry-run` | `false` | Show plan without running agents |
| `-c, --config PATH` | — | Architect YAML configuration file |
| `--quiet` | `false` | Final result only |

---

## Pipeline YAML format

### Full structure

```yaml
name: mi-pipeline                    # Identifying name
variables:                           # Initial variables (optional)
  key: value
steps:
  - name: step-id                    # Unique step identifier
    agent: build                     # Agent: build, plan, review, resume, or custom
    prompt: "Prompt con {{var}}"     # Prompt with variable substitution
    model: gpt-4o                    # LLM model (optional, override)
    condition: "var == 'true'"       # Condition for execution (optional)
    output_var: result               # Save output as variable (optional)
    checks:                          # Post-step verification commands (optional)
      - "pytest tests/"
      - "ruff check src/"
    checkpoint: true                 # Create git checkpoint (optional)
    timeout: 300                     # Timeout in seconds (optional)
```

### Step fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `str` | (required) | Step identifier |
| `agent` | `str` | `"build"` | Agent to use |
| `prompt` | `str` | `""` | Prompt with `{{variables}}` support |
| `model` | `str\|null` | `null` | LLM model (null = use config default) |
| `condition` | `str\|null` | `null` | Conditional expression. If it evaluates to falsy, the step is skipped |
| `output_var` | `str\|null` | `null` | Variable name to store the agent's output |
| `checks` | `list[str]` | `[]` | Post-step shell commands (exit 0 = pass) |
| `checkpoint` | `bool` | `false` | Create git checkpoint when the step completes |
| `timeout` | `int\|null` | `null` | Timeout in seconds |

---

## Features

### Variables (`{{name}}`)

Variables are substituted into prompts before execution. They are defined from three sources (lowest to highest priority):

1. `variables` section in the YAML
2. CLI flag `--var KEY=VALUE` (overrides YAML)
3. `output_var` from previous steps (added dynamically)

```yaml
name: var-demo
variables:
  project: myapp
  lang: python
steps:
  - name: analyze
    agent: plan
    prompt: "Analiza el proyecto {{project}} escrito en {{lang}}"
    output_var: analysis

  - name: implement
    agent: build
    prompt: |
      Implementa las mejoras sugeridas:
      {{analysis}}
```

Substitution uses the regex `\{\{(.+?)\}\}`. Undefined variables are left as `{{name}}` (they are not removed).

### Conditions (`condition`)

A step with `condition` is evaluated before execution. If the condition is false, the step is skipped with status `"skipped"`.

Evaluation is simple:
- `"true"`, `"yes"`, `"1"` → True
- `"false"`, `"no"`, `"0"`, `""` → False
- Any other non-empty string → True

Variables are resolved in the condition before evaluation:

```yaml
steps:
  - name: setup
    prompt: "..."

  - name: deploy
    prompt: "Deploy a producción"
    condition: "deploy_enabled == 'true'"
    # If --var deploy_enabled=true → executes
    # If --var deploy_enabled=false → skipped
```

### Output variables (`output_var`)

Captures the agent's final output and stores it as a variable for subsequent steps:

```yaml
steps:
  - name: analyze
    agent: plan
    prompt: "Analiza el código y lista las 3 mejoras más importantes"
    output_var: improvements

  - name: implement
    agent: build
    prompt: "Implementa estas mejoras: {{improvements}}"
```

The captured value is the `final_output` from the `AgentState` — the text the agent produces as its final response.

### Checks

Checks are shell commands that run after each step:

```yaml
steps:
  - name: implement
    prompt: "Implementa la feature"
    checks:
      - "pytest tests/ -q"
      - "ruff check src/"
```

- Each check is executed as `subprocess.run(cmd, shell=True, timeout=120)`
- **Exit 0** = check passed
- The result is stored in `PipelineStepResult.checks_passed`
- Checks do not block pipeline execution — the next step runs regardless

### Checkpoints

With `checkpoint: true`, an automatic git commit is created when the step completes:

```yaml
steps:
  - name: implement
    prompt: "Implementa la feature"
    checkpoint: true
    # → git add -A && git commit -m "architect:checkpoint:implement"
```

The commit uses the prefix `architect:checkpoint:<step_name>`. This allows:
- Viewing what changed in each step: `git log --oneline --grep="architect:checkpoint"`
- Rolling back to a specific step with `CheckpointManager.rollback()`

### Dry-run

With `--dry-run`, the pipeline shows the plan without running agents:

```bash
architect pipeline workflow.yaml --var feature="auth" --dry-run
```

Output:
```
Pipeline: feature-pipeline
  Step 1: analyze (plan) — "Analiza los requisitos de auth"
  Step 2: implement (build) — "Implementa según este análisis: {{analysis}}"
    Checks: pytest tests/ -q, ruff check src/
    Checkpoint: sí
  Step 3: review (review) — "Revisa la implementación de auth"
    Condition: run_review == 'true'
```

### From-step (resume)

With `--from-step`, the pipeline skips previous steps and starts from the specified one:

```bash
# The "analyze" step already ran. Resume from "implement"
architect pipeline workflow.yaml --from-step implement
```

---

## Internal flow

```
architect pipeline workflow.yaml --var feature="auth"
  │
  ├── 1. PipelineRunner.from_yaml(path, variables)
  │       ├── yaml.safe_load(file)
  │       ├── Merge variables YAML + CLI
  │       └── Construir PipelineConfig con steps
  │
  ├── 2. runner.run(from_step=None, dry_run=False)
  │       │
  │       ├── Para cada step:
  │       │   ├── 2a. _eval_condition(condition) → skip si False
  │       │   ├── 2b. _resolve_vars(prompt) → sustituir {{variables}}
  │       │   ├── 2c. agent_factory(agent=step.agent, model=step.model)
  │       │   │       └── AgentLoop fresco con ContextBuilder, CostTracker, etc.
  │       │   ├── 2d. agent.run(resolved_prompt) → AgentState
  │       │   ├── 2e. Si output_var: variables[output_var] = state.final_output
  │       │   ├── 2f. Si checks: _run_checks(checks) → checks_passed
  │       │   ├── 2g. Si checkpoint: _create_checkpoint(step_name)
  │       │   └── 2h. Registrar PipelineStepResult
  │       │
  │       └── Retornar list[PipelineStepResult]
  │
  └── 3. Mostrar resultados
```

---

## Python API

### PipelineConfig

```python
@dataclass
class PipelineConfig:
    name: str                          # Pipeline name
    steps: list[PipelineStep]          # Sequential steps
    variables: dict[str, str]          # Initial variables
```

### PipelineStep

```python
@dataclass
class PipelineStep:
    name: str                          # Identifier
    agent: str = "build"               # Agent to use
    prompt: str = ""                   # Prompt (supports {{variables}})
    model: str | None = None           # LLM model override
    checkpoint: bool = False           # Create git checkpoint
    condition: str | None = None       # Condition for execution
    output_var: str | None = None      # Variable to store output
    checks: list[str] = []            # Verification commands
    timeout: int | None = None         # Timeout in seconds
```

### PipelineRunner

```python
class PipelineRunner:
    def __init__(
        self,
        config: PipelineConfig,
        agent_factory: Callable[..., Any],
        workspace_root: str | None = None,
    ) -> None: ...

    def run(
        self,
        from_step: str | None = None,
        dry_run: bool = False,
    ) -> list[PipelineStepResult]: ...

    def get_plan_summary(self) -> str: ...

    @classmethod
    def from_yaml(
        cls,
        path: str,
        variables: dict[str, str],
        agent_factory: Callable[..., Any],
        workspace_root: str | None = None,
    ) -> "PipelineRunner": ...
```

### PipelineStepResult

```python
@dataclass
class PipelineStepResult:
    step_name: str                     # Step identifier
    status: str                        # "success", "partial", "failed", "skipped", "dry_run"
    cost: float = 0.0                  # Cost in USD
    duration: float = 0.0              # Seconds
    checks_passed: bool = True         # True if all checks passed
    error: str | None = None           # Error message
```

---

## Examples

### Complete feature pipeline

```yaml
name: feature-pipeline
variables:
  branch: feature/auth
steps:
  - name: plan
    agent: plan
    prompt: |
      Analiza el proyecto y planifica cómo implementar
      autenticación JWT. Lista los archivos a modificar
      y el orden de los cambios.
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

  - name: docs
    agent: build
    prompt: "Actualiza la documentación para reflejar los cambios de autenticación"
    checkpoint: true
```

### CI/CD pipeline

```yaml
name: ci-review
variables:
  base_branch: origin/main
steps:
  - name: review
    agent: review
    prompt: "Revisa los cambios de este PR respecto a {{base_branch}}"
    output_var: review_result

  - name: fix
    agent: build
    prompt: "Corrige estos problemas encontrados en la review: {{review_result}}"
    condition: "auto_fix == 'true'"
    checks:
      - "pytest tests/ -q"
```

```bash
architect pipeline ci-review.yaml \
  --var base_branch=origin/main \
  --var auto_fix=true
```

### Pipeline with multiple models

```yaml
name: multi-model
steps:
  - name: draft
    agent: build
    model: gpt-4o-mini          # Fast model for the draft
    prompt: "Genera un primer borrador de tests para auth.py"
    output_var: draft

  - name: refine
    agent: build
    model: claude-sonnet-4-6    # More capable model for refinement
    prompt: "Mejora y completa estos tests: {{draft}}"
    checks:
      - "pytest tests/test_auth.py -v"
```
