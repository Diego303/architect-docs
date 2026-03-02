---
title: "Presets"
description: "Project initialization with predefined configurations (python, node-react, ci, paranoid, yolo)."
icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
order: 30
---

# Configuration Presets (Init)

A project initialization system with predefined configurations.

Implemented in `src/architect/config/presets.py`. Available since v1.0.0 (Base plan v4 Phase D — D5).

---

## Concept

`architect init` generates configuration files (`.architect.md` + `config.yaml`) from predefined presets. Each preset includes project conventions, quality hooks, guardrails, and agent configuration optimized for a specific use case.

```bash
# View available presets
architect init --list-presets

# Initialize a Python project
architect init --preset python
# → Creates .architect.md (conventions) + config.yaml (hooks: ruff, mypy, pytest)
```

---

## Available presets

### `python` — Standard Python project

Conventions and tools for modern Python projects.

**`.architect.md`**: PEP 8, type hints, Google-style docstrings, pytest, structlog, black (100 chars)

**`config.yaml`**:
- Hooks: `ruff check {file} --fix`, `mypy {file}`
- Quality gates: `pytest tests/ -x` (required)
- Guardrails: protect `.env`, `*.pem`

### `node-react` — Node.js/React project

Conventions for TypeScript/React projects.

**`.architect.md`**: TypeScript strict, ESLint, Prettier, functional components, Jest/Vitest

**`config.yaml`**:
- Hooks: `eslint --fix {file}`, `prettier --write {file}`
- Quality gates: `npm test` (required)
- Guardrails: protect `.env*`, `*.pem`

### `ci` — Headless CI/CD mode

Minimal and autonomous configuration for CI pipelines.

**`.architect.md`**: autonomous mode instructions, no questions, parseable output

**`config.yaml`**:
- Confirm mode: `yolo`
- Stream: disabled
- Sessions/memory: disabled
- Logging: warn level

### `paranoid` — Maximum security

For environments where security is the top priority.

**`.architect.md`**: minimum impact instructions, do not delete files, request verification

**`config.yaml`**:
- Confirm mode: `confirm-all`
- Max steps: 20
- Strict guardrails: `eval()`, `pickle`, `os.system` blocked
- Quality gates: pytest + ruff (required)
- Auto-review enabled
- Code rules: block severity for dangerous patterns

### `yolo` — No restrictions

For fast development without barriers.

**`config.yaml`**:
- Confirm mode: `yolo`
- Max steps: 100
- No guardrails
- Minimal overhead

---

## CLI

```
architect init [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--preset NAME` | Preset to apply (required if not using `--list-presets`) |
| `--list-presets` | Show available presets with descriptions |
| `--overwrite` | Overwrite existing files (does not overwrite by default) |

### Examples

```bash
# List presets
architect init --list-presets
# → python: Standard Python project (pytest, ruff, mypy)
# → node-react: Node.js/React project (ESLint, Prettier, Jest)
# → ci: Headless CI/CD mode
# → paranoid: Maximum security
# → yolo: No restrictions

# Initialize project
architect init --preset python
# → Created .architect.md
# → Created config.yaml
# → Created .architect/

# Reinitialize with overwrite
architect init --preset paranoid --overwrite
```

---

## API

### `PresetManager`

```python
class PresetManager:
    AVAILABLE_PRESETS: frozenset = {"python", "node-react", "ci", "paranoid", "yolo"}

    def __init__(self, workspace_root: str): ...

    def apply(self, preset_name: str, overwrite: bool = False) -> list[str]:
        """Applies a preset. Returns list of created files."""

    @staticmethod
    def list_presets() -> dict[str, str]:
        """Returns {name: description} for all presets."""
```

### `PRESET_TEMPLATES`

Internal dictionary with the content of each preset:

```python
PRESET_TEMPLATES = {
    "python": {
        ".architect.md": "...",      # Python conventions
        "config.yaml": "...",         # ruff/mypy hooks, guardrails
    },
    "node-react": { ... },
    "ci": { ... },
    "paranoid": { ... },
    "yolo": { ... },
}
```

---

## Generated files

Each preset generates up to 3 elements:

| Element | Description |
|---------|-------------|
| `.architect.md` | Project conventions injected into the agent's system prompt |
| `config.yaml` | Complete Architect YAML configuration |
| `.architect/` | Automatically created directory (for skills, memory, sessions) |

The files are editable — they serve as a starting point that the user can customize.

---

## Execution flow

```
architect init --preset python
  │
  ├── PresetManager(workspace_root)
  │
  ├── Verify that the preset exists
  │
  ├── For each file in the preset:
  │     ├── Does the file exist and --overwrite is not set?
  │     │     └── Yes: skip with warning
  │     └── No: write template content
  │
  ├── Create .architect/ directory if it doesn't exist
  │
  └── Return list of created files
```

---

## Post-init customization

After `architect init`, it is recommended to:

1. **Edit `.architect.md`**: add project-specific conventions
2. **Adjust `config.yaml`**: change model, API base, specific hooks
3. **Create skills**: `architect skill create my-pattern` for recurring patterns
4. **Enable memory**: if you want the agent to learn from corrections

---

## Files

| File | Contents |
|------|----------|
| `src/architect/config/presets.py` | `PresetManager`, `AVAILABLE_PRESETS`, `PRESET_TEMPLATES` |
| `src/architect/cli.py` | `architect init` command |
| `tests/test_presets/` | Unit tests |
