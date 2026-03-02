---
title: "Extensibility"
description: "Create custom tools, agents, lifecycle hooks, skills, guardrails — with examples."
icon: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
order: 31
---

# Extending Architect CLI

Complete guide to extending architect-cli v1.0.0 with custom tools, agents, hooks, skills, and guardrails.

Architect is a headless AI agent for CLI, written in Python 3.12+, that uses Pydantic v2 for validation, structlog for logging, and LiteLLM as the model abstraction layer. Its architecture is designed to be extensible across five surfaces:

| Surface | What it extends | Where it lives |
|---|---|---|
| **Tools** | Agent capabilities (read, write, search...) | `src/architect/tools/` |
| **Agents** | Roles with distinct prompts and tools | `architect.yaml` or `agents/registry.py` |
| **Hooks** | Automatic actions in the lifecycle | `architect.yaml` `hooks:` section |
| **Skills** | Contextual instructions per project/file | `.architect/skills/`, `.architect.md` |
| **Guardrails** | Deterministic security constraints | `architect.yaml` `guardrails:` section |

---

## 1. Creating a Custom Tool

Tools are the interface between the agent and the outside world. Each tool inherits from `BaseTool`, defines an argument schema with Pydantic, and exposes an `execute()` method that always returns a `ToolResult`.

### 1.1. Anatomy of a Tool

```
BaseTool (abstract)
  ├── name: str              # Unique tool name (e.g., "count_lines")
  ├── description: str       # Description for the LLM
  ├── args_model: type[BaseModel]  # Pydantic argument schema
  ├── sensitive: bool        # If True, requires confirmation in confirm-sensitive mode
  ├── execute(**kwargs) -> ToolResult   # Tool logic
  ├── get_schema() -> dict   # Generates OpenAI-compatible JSON Schema (automatic)
  └── validate_args(args) -> BaseModel  # Validates args against args_model (automatic)
```

The main contract:

- `execute()` **MUST NEVER** throw exceptions to the caller. All errors are captured and returned as `ToolResult(success=False, output="", error="message")`.
- The return is always `ToolResult(success=bool, output=str, error=str|None)`.
- If the tool operates on files, it **must** use `validate_path()` to prevent path traversal.

### 1.2. Step 1 — Define the argument model

Create the Pydantic schema in `src/architect/tools/schemas.py` (or in its own file):

```python
# src/architect/tools/schemas.py (add at the end)

class CountLinesArgs(BaseModel):
    """Arguments for count_lines tool."""

    path: str = Field(
        default=".",
        description="Directory relative to workspace where to count lines",
        examples=[".", "src", "lib"],
    )
    extensions: list[str] = Field(
        default_factory=lambda: [".py", ".js", ".ts", ".go", ".rs"],
        description="File extensions to include (with dot)",
        examples=[[".py", ".js"], [".ts", ".tsx"]],
    )
    exclude_dirs: list[str] = Field(
        default_factory=lambda: ["node_modules", "__pycache__", ".git", ".venv"],
        description="Directories to exclude from counting",
    )

    model_config = {"extra": "forbid"}
```

Key points:
- Always use `model_config = {"extra": "forbid"}` so Pydantic rejects unknown fields.
- Use `Field(description=...)` on each field: the LLM reads these descriptions to understand how to call the tool.
- Defaults should be sensible for the common case.

### 1.3. Step 2 — Implement the Tool

Create the class that inherits from `BaseTool`:

```python
# src/architect/tools/count_lines.py

from collections import Counter
from pathlib import Path
from typing import Any

from ..execution.validators import PathTraversalError, ValidationError, validate_path
from .base import BaseTool, ToolResult
from .schemas import CountLinesArgs


class CountLinesTool(BaseTool):
    """Counts lines of code by language in a directory."""

    def __init__(self, workspace_root: Path):
        self.name = "count_lines"
        self.description = (
            "Counts lines of code grouped by extension/language. "
            "Useful for getting an overview of the project size. "
            "Excludes empty lines and directories like node_modules."
        )
        self.sensitive = False  # Read-only, no confirmation needed
        self.args_model = CountLinesArgs
        self.workspace_root = workspace_root

    def execute(self, **kwargs: Any) -> ToolResult:
        """Counts lines of code in the specified directory."""
        try:
            # 1. Validate arguments with Pydantic
            args = self.validate_args(kwargs)

            # 2. Validate path (CRITICAL for security)
            target_dir = validate_path(args.path, self.workspace_root)

            if not target_dir.is_dir():
                return ToolResult(
                    success=False,
                    output="",
                    error=f"'{args.path}' is not a directory",
                )

            # 3. Tool logic
            counts: Counter[str] = Counter()
            file_counts: Counter[str] = Counter()
            exclude = set(args.exclude_dirs)

            for file_path in target_dir.rglob("*"):
                # Skip excluded directories
                if any(part in exclude for part in file_path.parts):
                    continue

                if file_path.is_file() and file_path.suffix in args.extensions:
                    try:
                        lines = file_path.read_text(encoding="utf-8").splitlines()
                        non_empty = sum(1 for line in lines if line.strip())
                        counts[file_path.suffix] += non_empty
                        file_counts[file_path.suffix] += 1
                    except (UnicodeDecodeError, OSError):
                        continue  # Skip binary or inaccessible files

            # 4. Format result
            if not counts:
                return ToolResult(
                    success=True,
                    output=f"No files found with extensions {args.extensions} in '{args.path}'",
                )

            lines_output = []
            total = 0
            for ext, count in counts.most_common():
                files = file_counts[ext]
                lines_output.append(f"  {ext:8s}  {count:>8,} lines  ({files} files)")
                total += count

            result = (
                f"Line count in '{args.path}':\n\n"
                + "\n".join(lines_output)
                + f"\n\n  {'Total':8s}  {total:>8,} lines"
            )

            return ToolResult(success=True, output=result)

        # 5. NEVER throw exceptions — always return ToolResult
        except PathTraversalError as e:
            return ToolResult(success=False, output="", error=f"Security error: {e}")
        except ValidationError as e:
            return ToolResult(success=False, output="", error=str(e))
        except Exception as e:
            return ToolResult(success=False, output="", error=f"Unexpected error: {e}")
```

### 1.4. Step 3 — Register the Tool

Add the tool to the registry in `src/architect/tools/setup.py`:

```python
# In register_all_tools(), add:
from .count_lines import CountLinesTool

def register_all_tools(registry, workspace_config, commands_config=None):
    register_filesystem_tools(registry, workspace_config)
    register_search_tools(registry, workspace_config)
    # ... existing tools ...

    # Custom tool
    workspace_root = Path(workspace_config.root).resolve()
    registry.register(CountLinesTool(workspace_root))
```

### 1.5. Step 4 — Authorize the Tool in Agents

Tools are only available to agents that list them in `allowed_tools`. For `build` to be able to use `count_lines`, add to the YAML:

```yaml
# architect.yaml
agents:
  build:
    allowed_tools:
      - read_file
      - write_file
      - edit_file
      - apply_patch
      - delete_file
      - list_files
      - search_code
      - grep
      - find_files
      - run_command
      - count_lines    # <-- new tool
```

Or alternatively, edit `DEFAULT_AGENTS` in `src/architect/agents/registry.py` to include it in the `allowed_tools` list for the `build` agent.

### 1.6. Correct Tool Checklist

- [ ] `args_model` with `model_config = {"extra": "forbid"}`
- [ ] `execute()` catches ALL exceptions and returns `ToolResult`
- [ ] Uses `validate_path()` if it operates on files
- [ ] `sensitive = True` if it modifies state (files, network, etc.)
- [ ] Registered in `setup.py`
- [ ] Added to `allowed_tools` of relevant agents
- [ ] Has unit tests

---

## 2. Creating a Custom Agent

An agent is a configuration that combines a system prompt, a subset of tools, and confirmation policies. There are two ways to create custom agents: via YAML (no code changes needed) or via code.

### 2.1. Via YAML (recommended)

The simplest approach. In `architect.yaml`:

```yaml
agents:
  security-audit:
    system_prompt: |
      You are a security audit agent. Your job is to analyze
      the source code looking for security vulnerabilities.

      ## What to look for (by priority)

      1. **Critical**: SQL injection, XSS, path traversal, hardcoded secrets
      2. **High**: Weak authentication, missing input validation, CSRF
      3. **Medium**: Dependencies with CVEs, excessive permissions, logging of sensitive data
      4. **Low**: Missing security headers, suboptimal configurations

      ## Output format

      For each finding, report:
      - Severity: CRITICAL | HIGH | MEDIUM | LOW
      - File and line
      - Problem description
      - Recommended remediation
      - CWE reference if applicable

      ## Rules

      - DO NOT modify any files
      - Use search_code to look for dangerous patterns
      - Review ALL relevant files, not just the obvious ones
      - If you find no vulnerabilities, indicate it explicitly
    allowed_tools:
      - read_file
      - list_files
      - search_code
      - grep
      - find_files
    confirm_mode: yolo     # Read-only, no confirmation needed
    max_steps: 30          # Enough for a complete audit
```

Run it:

```bash
architect run "Audit the security of the authentication module" --agent security-audit
```

Available fields in `AgentConfig`:

| Field | Type | Default | Description |
|---|---|---|---|
| `system_prompt` | `str` | (required) | System prompt that defines the role |
| `allowed_tools` | `list[str]` | `[]` | Tools the agent can use |
| `confirm_mode` | `str` | `"confirm-sensitive"` | `"yolo"`, `"confirm-sensitive"`, `"confirm-all"` |
| `max_steps` | `int` | `20` | Maximum loop iterations |

### 2.2. Via Code

For agents that are part of the core, add to `src/architect/agents/registry.py`:

```python
# In agents/prompts.py, add the prompt:
SECURITY_AUDIT_PROMPT = """..."""

DEFAULT_PROMPTS["security-audit"] = SECURITY_AUDIT_PROMPT

# In agents/registry.py, add to the dict:
DEFAULT_AGENTS["security-audit"] = AgentConfig(
    system_prompt=DEFAULT_PROMPTS["security-audit"],
    allowed_tools=["read_file", "list_files", "search_code", "grep", "find_files"],
    confirm_mode="yolo",
    max_steps=30,
)
```

### 2.3. Note about i18n (v1.1.0)

The system prompts for the default agents (`build`, `plan`, `resume`, `review`) are now resolved via the i18n system. This means they change language according to the `language` configuration. Custom agents defined via YAML keep their prompts as you write them — they are not translated.

If you want a custom agent to support multiple languages, you can use the i18n API directly in code:

```python
from architect.i18n import t

CUSTOM_PROMPT = t("my_agent.system_prompt")
```

See [`i18n.md`](/architect-docs/en/docs/v1-1-0/i18n) for details on the internationalization system.

### 2.4. Writing Effective System Prompts

A good system prompt for architect follows this structure:

```
1. ROLE: A sentence defining who the agent is
2. PROCESS: Numbered workflow steps
3. TOOLS: Table of when to use each tool
4. FORMAT: How to structure the output
5. RULES: Explicit constraints (DO NOT / ALWAYS)
```

Tips:

- **Be explicit about what it should NOT do**: if the agent is read-only, say it clearly.
- **Give output examples**: the LLM replicates the format you show it.
- **Limit the scope**: an agent with a clear role performs better than a generic one.
- **Use tables**: the LLM parses them better than long prose lists.

### 2.5. Configuration Precedence

Agents follow this merge order (from lowest to highest priority):

1. `DEFAULT_AGENTS` in code
2. `agents:` in `architect.yaml`
3. CLI flags (`--mode`, `--max-steps`)

A YAML agent can partially override a default one: if you only define `max_steps` in YAML for the `build` agent, it inherits the `system_prompt` and `allowed_tools` from the default.

---

## 3. Lifecycle Hooks — Practical Guide

Hooks are shell commands that run automatically at key points in the agent's lifecycle. They allow integrating architect with external tools without modifying code.

### 3.1. The 10 Events

| Event | When it fires | Can it block? |
|---|---|---|
| `pre_tool_use` | Before executing any tool | Yes (exit 2) |
| `post_tool_use` | After executing any tool | No |
| `pre_llm_call` | Before each LLM call | Yes (exit 2) |
| `post_llm_call` | After each LLM response | No |
| `session_start` | When an agent session starts | No |
| `session_end` | When a session ends | No |
| `on_error` | When a tool fails (success=False) | No |
| `budget_warning` | When spending exceeds warn_at_usd | No |
| `context_compress` | Before compressing the LLM context | No |
| `agent_complete` | When the agent declares the task complete | No |

`pre_*` events can block the action (exit code 2). `post_*` and other events are informational.

### 3.2. Exit Code Protocol

```
Exit 0  →  ALLOW   — The action is permitted.
                      Optional stdout JSON:
                        {"additionalContext": "extra info for the LLM"}
                        {"updatedInput": {"path": "other.py"}} → MODIFY
Exit 2  →  BLOCK   — The action is blocked (pre-hooks only).
                      stderr = reason for blocking (passed to the LLM).
Other   →  WARNING — Hook error. Logged, but does NOT block.
```

### 3.3. Environment Variables

Each hook automatically receives these variables:

| Variable | Always present | Description |
|---|---|---|
| `ARCHITECT_EVENT` | Yes | Event name (e.g., `pre_tool_use`) |
| `ARCHITECT_WORKSPACE` | Yes | Absolute workspace path |
| `ARCHITECT_TOOL_NAME` | In tool events | Tool name (e.g., `write_file`) |
| `ARCHITECT_FILE_PATH` | If a file is involved | File path |

Additionally, each key from the event context is injected as `ARCHITECT_{KEY}` in uppercase.

### 3.4. YAML Configuration

```yaml
hooks:
  pre_tool_use:
    - name: "secret-scanner"
      command: "python scripts/scan_secrets.py"
      matcher: "write_file|edit_file|apply_patch"  # Write tools only
      file_patterns: ["*.py", "*.yaml", "*.env"]   # These files only
      timeout: 5
      enabled: true

  post_tool_use:
    - name: "auto-formatter"
      command: "black {file} --quiet 2>/dev/null; exit 0"
      matcher: "write_file|edit_file|apply_patch"
      file_patterns: ["*.py"]
      timeout: 10

  on_error:
    - name: "slack-notification"
      command: >
        curl -s -X POST "$SLACK_WEBHOOK_URL"
        -H 'Content-Type: application/json'
        -d "{\"text\": \"Architect error in tool $ARCHITECT_TOOL_NAME\"}"
      async: true   # Don't block waiting for response
      timeout: 15

  budget_warning:
    - name: "budget-alert"
      command: >
        curl -s -X POST "$ALERT_WEBHOOK"
        -d "{\"alert\": \"Architect spending exceeded\", \"event\": \"$ARCHITECT_EVENT\"}"
      async: true
      timeout: 10

  session_start:
    - name: "log-session"
      command: "echo \"Session started at $(date)\" >> .architect/sessions.log"

  agent_complete:
    - name: "notify-complete"
      command: "echo 'Task completed' | notify-send -t 5000 'Architect'"
      async: true
```

### 3.5. Filtering with matcher and file_patterns

- **`matcher`**: Regex compared against the tool name. `"*"` (default) matches all. To filter by specific tool: `"write_file"`, or multiple: `"write_file|edit_file|apply_patch"`.
- **`file_patterns`**: List of globs compared against the file path involved. If empty (default), the hook applies to any file. Example: `["*.py", "*.ts"]`.

Both filters combine with AND: the hook only runs if BOTH match.

### 3.6. `{file}` Placeholder

In the `command` field, the `{file}` placeholder is replaced with the file path involved in the action. Useful for formatting post-hooks:

```yaml
post_tool_use:
  - name: "format-python"
    command: "black {file} --quiet"
    matcher: "write_file|edit_file"
    file_patterns: ["*.py"]
```

### 3.7. Async Hooks

Hooks with `async: true` run in a background thread and do not block agent execution. Useful for notifications, external logging, and webhooks. They have no effect on the result (cannot block or modify).

### 3.8. Timeout

Each hook has a timeout (default 10 seconds, configurable from 1 to 300). If the hook exceeds the timeout:
- The process is terminated.
- A WARNING is logged.
- ALLOW is returned (does not block).

For slow hooks (e.g., security analysis), increase the timeout:

```yaml
pre_tool_use:
  - name: "deep-scan"
    command: "python scripts/deep_security_scan.py"
    timeout: 60
```

### 3.9. Backward Compatibility: post_edit

The `post_edit` field exists for backward compatibility with earlier versions. Hooks defined there are added internally to `post_tool_use` with the matcher `write_file|edit_file|apply_patch`. Using `post_tool_use` directly with the appropriate matcher is preferred.

### 3.10. Complete Example: Secret Scanner Pre-Hook

```python
#!/usr/bin/env python3
"""scripts/scan_secrets.py — Hook that blocks writes containing secrets."""

import os
import re
import sys
import json

# Common secret patterns
SECRET_PATTERNS = [
    (r"(?:api[_-]?key|apikey)\s*[:=]\s*['\"][A-Za-z0-9]{20,}", "API key detected"),
    (r"(?:password|passwd|pwd)\s*[:=]\s*['\"][^'\"]+['\"]", "Hardcoded password"),
    (r"(?:secret|token)\s*[:=]\s*['\"][A-Za-z0-9+/]{20,}", "Secret/token detected"),
    (r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----", "Private key detected"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub personal token detected"),
    (r"sk-[A-Za-z0-9]{48}", "OpenAI API key detected"),
]

def main():
    # Read context from stdin (JSON with the tool args)
    stdin_data = sys.stdin.read()
    if not stdin_data:
        sys.exit(0)  # No data, allow

    try:
        data = json.loads(stdin_data)
    except json.JSONDecodeError:
        sys.exit(0)

    # Get the content that will be written
    content = data.get("content", "") or data.get("new_str", "")
    if not content:
        sys.exit(0)  # No content to scan

    # Scan patterns
    for pattern, message in SECRET_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            # Exit 2 = BLOCK. The message goes to stderr.
            print(f"BLOCKED: {message}. Writing secrets in code is not allowed.", file=sys.stderr)
            sys.exit(2)

    # All clean, allow
    sys.exit(0)

if __name__ == "__main__":
    main()
```

Configuration:

```yaml
hooks:
  pre_tool_use:
    - name: "secret-scanner"
      command: "python scripts/scan_secrets.py"
      matcher: "write_file|edit_file|apply_patch"
      timeout: 5
```

---

## 4. Skills and .architect.md

Skills are the mechanism for injecting contextual instructions into the agent's system prompt. There are two levels:

### 4.1. Project Instructions

Global instruction files that are always injected into the system prompt. Architect looks for (in order of priority, uses the first one found):

1. `.architect.md`
2. `AGENTS.md`
3. `CLAUDE.md`

These files are placed at the project root and contain general instructions. Example:

```markdown
<!-- .architect.md -->
# Project Instructions

## Stack
- Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic
- Frontend: React 18, TypeScript, TailwindCSS
- Database: PostgreSQL 16

## Code conventions
- Use type hints on all public functions
- Docstrings in Google format
- Tests with pytest, minimum 80% coverage
- Variable names in snake_case, classes in PascalCase

## Structure
- `src/api/` — FastAPI endpoints
- `src/models/` — SQLAlchemy models
- `src/services/` — Business logic
- `tests/` — Unit and integration tests

## Rules
- NEVER modify existing Alembic migrations
- ALWAYS create a new migration for schema changes
- Endpoints MUST have Pydantic validation on input and output
```

### 4.2. Contextual Skills

Skills are instructions that activate only when the agent works with files that match certain glob patterns. They live in `.architect/skills/<name>/SKILL.md`.

Structure:

```
.architect/
  skills/
    django/
      SKILL.md
    react/
      SKILL.md
    database/
      SKILL.md
  installed-skills/   # Skills installed via `architect install-skill`
    ...
```

Each `SKILL.md` has an optional YAML frontmatter followed by markdown content:

```markdown
---
name: django
description: Conventions for Django development
globs:
  - "*.py"
  - "*/views.py"
  - "*/models.py"
  - "*/serializers.py"
  - "*/urls.py"
---

# Django Conventions

## Models
- Use `models.TextChoices` for fields with fixed options
- Each model must have `__str__` and `class Meta` with ordering
- Use explicit `related_name` on ForeignKey and M2M
- NEVER use `on_delete=CASCADE` without thinking about the consequences

## Views
- Prefer class-based views (APIView, ViewSet)
- Use `get_object_or_404` instead of try/except
- Serializer validation in the serializer, NOT in the view

## URLs
- Use `path()` with descriptive names
- Namespace per app: `app_name = "users"`

## Tests
- Each view needs tests for:
  1. Happy path (200/201)
  2. Validation (400)
  3. Auth (401/403)
  4. Not found (404)
```

### 4.3. When a Skill Activates

The `SkillsLoader` looks for skills whose `globs` pattern matches any active file in the session. For example, if the agent is editing `src/users/views.py`, the `django` skill would activate because it matches `*/views.py`.

The hierarchy:

1. **Project instructions** (`.architect.md`) are ALWAYS injected.
2. **Skills** are injected only if there are active files matching their globs.

### 4.4. When to Use Each

| Case | Mechanism |
|---|---|
| Rules that apply to the ENTIRE project | `.architect.md` |
| Conventions for a specific framework/language | Skill with appropriate globs |
| Instructions for a file type | Skill with extension glob (`*.py`) |
| Complex step-by-step workflow | Skill with detailed description |

### 4.5. Complete Example: Skill for Django Development

Create the directory and file:

```bash
mkdir -p .architect/skills/django
```

File `.architect/skills/django/SKILL.md`:

```markdown
---
name: django
description: Conventions and best practices for Django development in this project
globs:
  - "**/*.py"
  - "**/models.py"
  - "**/views.py"
  - "**/serializers.py"
  - "**/admin.py"
  - "**/urls.py"
  - "**/tests/*.py"
  - "**/tests.py"
---

# Project Django Conventions

## App Structure
Each Django app follows this structure:
```
apps/<name>/
  ├── models.py        # App models
  ├── views.py         # ViewSets and APIViews
  ├── serializers.py   # DRF Serializers
  ├── urls.py          # URL patterns
  ├── admin.py         # Admin site config
  ├── signals.py       # Signal handlers
  ├── tasks.py         # Celery tasks
  ├── services.py      # Business logic
  └── tests/
      ├── test_models.py
      ├── test_views.py
      └── test_services.py
```

## Model Rules
- Inherit from `BaseModel` (has `created_at`, `updated_at`, `id` UUID)
- Always use `class Meta: ordering = ["-created_at"]`
- Custom querysets go in a separate `Manager`

## View Rules (DRF)
- Use `ModelViewSet` for complete CRUDs
- Explicit `permission_classes` on each viewset
- Pagination: `PageNumberPagination` with `page_size = 20`

## Test Rules
- Use DRF's `APITestCase`
- Factory Boy for data generation: `apps/<name>/tests/factories.py`
- `setUp` for authentication, `setUpTestData` for shared data
```

### 4.6. Procedural Memory

In addition to skills, architect maintains a **procedural memory** in `.architect/memory.md`. This file is automatically generated when the system detects user corrections (phrases like "no, use X", "that's wrong", "always do Y"). Corrections are persisted and injected into future sessions.

It can be manually edited to add permanent rules:

```markdown
# Project Memory

> Auto-generated by architect. Manually editable.

- [2026-01-15] Correction: Always use python3.12 instead of python
- [2026-01-16] Pattern: Imports must follow the order: stdlib, third-party, local
- [2026-02-01] Correction: Do not use print(), use structlog for all logging
```

---

## 5. Custom Guardrails

Guardrails are architect's deterministic security layer. They are evaluated **BEFORE** hooks and cannot be disabled by the LLM. They are rigid rules, not heuristics.

### 5.1. Sensitive Files (v1.1.0) -- Read + Write

Glob patterns for files that the agent CANNOT read or modify. Use this for secrets that should not reach the LLM:

```yaml
guardrails:
  enabled: true
  sensitive_files:
    - ".env"
    - ".env.*"
    - "*.pem"
    - "*.key"
    - "*.p12"
    - "credentials.json"
    - "*.secret"
```

When the agent attempts to read or write a sensitive file, it receives a clear error: `"Sensitive file blocked by guardrail: .env (pattern: .env)"`. Shell reads (`cat .env`, `head *.pem`, `tail .env`) and redirections (`echo "data" > .env`) are also detected.

### 5.2. Protected Files -- Write Only

Glob patterns for files that the agent CANNOT modify or delete, but CAN read:

```yaml
guardrails:
  enabled: true
  protected_files:
    - "docker-compose.prod.yaml"
    - "Makefile"
    - "*.lock"           # Don't touch lockfiles
    - "deploy/**"
```

When the agent attempts to write/edit/delete a protected file, it receives an error: `"Protected file blocked by guardrail: Makefile (pattern: Makefile)"`. The agent can read protected files; only writing is blocked. Shell redirections are also detected.

### 5.3. Blocked Commands

Regex patterns for commands that the agent CANNOT execute:

```yaml
guardrails:
  enabled: true
  blocked_commands:
    - 'rm\s+-[rf]+\s+/'            # rm -rf /
    - 'sudo\s+'                     # Any sudo
    - 'chmod\s+777'                 # Insecure permissions
    - 'git\s+push\s+.*--force'      # Force push
    - 'curl.*\|\s*bash'             # Pipe to bash
    - 'wget.*\|\s*sh'              # Pipe to shell
    - 'DROP\s+TABLE'                # Destructive SQL
    - 'TRUNCATE\s+TABLE'            # Destructive SQL
    - 'npm\s+publish'               # Don't publish
    - 'pip\s+install\s+(?!-e)'      # Only pip install -e allowed
```

Patterns are evaluated with `re.search()` case-insensitive.

### 5.4. Edit Limits

```yaml
guardrails:
  enabled: true
  max_files_modified: 15       # Maximum distinct files modified
  max_lines_changed: 2000      # Maximum total lines changed
  max_commands_executed: 50     # Maximum shell commands executed
```

These limits accumulate throughout the session. When a limit is reached, the agent receives an error and cannot make more changes of that type. This prevents the agent from "going haywire" modifying files indiscriminately.

### 5.5. Code Rules

Regex patterns scanned on all content the agent writes. Useful for enforcing conventions or preventing dangerous patterns:

```yaml
guardrails:
  enabled: true
  code_rules:
    - pattern: 'eval\s*\('
      message: "Do not use eval(). It's a security risk. Use ast.literal_eval() if you need to parse."
      severity: block         # block = prevents the write

    - pattern: 'import\s+pickle'
      message: "pickle is insecure for untrusted data. Use json or msgpack."
      severity: warn          # warn = allows but warns the LLM

    - pattern: 'TODO|FIXME|HACK|XXX'
      message: "Do not leave TODO/FIXME in new code. Implement the full functionality."
      severity: warn

    - pattern: 'print\s*\('
      message: "Use structlog for logging, not print(). Example: logger.info('msg', key=value)"
      severity: warn

    - pattern: 'from\s+\.\s+import\s+\*'
      message: "Do not use wildcard imports. Import names explicitly."
      severity: block

    - pattern: 'password\s*=\s*["\'][^"\']+["\']'
      message: "Hardcoded password detected. Use environment variables."
      severity: block
```

Severity:
- `"warn"`: The write is allowed, but the message is appended to the LLM as a warning.
- `"block"`: The write is blocked and the LLM receives the error message to correct it.

### 5.6. Quality Gates

Commands that run when the agent declares it has finished. If a required gate fails, the result is passed to the agent to correct:

```yaml
guardrails:
  enabled: true
  quality_gates:
    - name: "lint"
      command: "ruff check . --select E,W"
      required: true
      timeout: 30

    - name: "type-check"
      command: "mypy src/ --ignore-missing-imports"
      required: true
      timeout: 60

    - name: "tests"
      command: "pytest tests/ -x -q --tb=short"
      required: true
      timeout: 120

    - name: "format-check"
      command: "black . --check --quiet"
      required: false    # Informational only, does not block
      timeout: 30
```

Each gate has:
- `name`: Descriptive name.
- `command`: Shell command. Exit 0 = passed, other = failed.
- `required`: If `true`, a failure prevents the agent from finishing without correcting.
- `timeout`: Maximum execution seconds.

### 5.7. require_test_after_edit

```yaml
guardrails:
  enabled: true
  require_test_after_edit: true
```

When active, the agent is forced to run tests after making edits. The internal counter resets each time the agent runs a test command.

### 5.8. Complete Example: Enterprise Configuration

```yaml
guardrails:
  enabled: true

  # Untouchable files
  protected_files:
    - ".env"
    - ".env.*"
    - "*.pem"
    - "*.key"
    - "credentials.json"
    - "*.lock"
    - "docker-compose.prod.yaml"
    - "infrastructure/**"
    - ".github/workflows/**"

  # Dangerous commands
  blocked_commands:
    - 'rm\s+-[rf]+\s+/'
    - 'sudo\s+'
    - 'chmod\s+777'
    - 'git\s+push'
    - 'git\s+checkout\s+(main|master|prod)'
    - 'curl.*\|\s*(bash|sh)'
    - 'npm\s+publish'
    - 'docker\s+push'
    - 'kubectl\s+(delete|apply|create)'

  # Conservative limits
  max_files_modified: 10
  max_lines_changed: 1000
  max_commands_executed: 30
  require_test_after_edit: true

  # Code rules
  code_rules:
    - pattern: 'eval\s*\('
      message: "eval() prohibited by security policy"
      severity: block
    - pattern: 'exec\s*\('
      message: "exec() prohibited by security policy"
      severity: block
    - pattern: 'from\s+\.\s+import\s+\*'
      message: "Wildcard imports prohibited"
      severity: block
    - pattern: '(password|secret|token|api_key)\s*=\s*["\'][^"\']+["\']'
      message: "Hardcoded secret detected. Use environment variables."
      severity: block
    - pattern: 'print\s*\('
      message: "Use logging instead of print()"
      severity: warn

  # Required quality gates
  quality_gates:
    - name: "ruff"
      command: "ruff check . --select E,W,F"
      required: true
      timeout: 30
    - name: "mypy"
      command: "mypy src/ --strict"
      required: true
      timeout: 120
    - name: "pytest"
      command: "pytest tests/ -x -q --tb=short"
      required: true
      timeout: 180
    - name: "black"
      command: "black . --check"
      required: false
      timeout: 30
```

---

## 6. Integration Tips

### 6.1. Execution Order (Internal Pipeline)

When the agent executes a tool, the internal pipeline is:

```
1. LLM decides tool call
2. GUARDRAILS: check_file_access / check_command / check_edit_limits
   └── If BLOCK → error to LLM, nothing is executed
3. PRE-HOOKS: run_event(PRE_TOOL_USE, context)
   └── If BLOCK → error to LLM, tool is not executed
   └── If MODIFY → modified args are used
4. TOOL EXECUTION: tool.execute(**args) → ToolResult
5. CODE RULES: check_code_rules (if the tool wrote content)
   └── If severity=block → the write is undone
6. POST-HOOKS: run_event(POST_TOOL_USE, context)
   └── Informational (does not block)
7. Result is passed to LLM as tool_result
```

Implications:
- A guardrail blocks BEFORE a hook has a chance to act.
- A pre-hook can modify a tool's arguments (e.g., change the path).
- Code rules are evaluated AFTER writing but BEFORE confirming to the LLM.
- Post-hooks are ideal for formatting (black, prettier) because they run after the write.

### 6.2. Testing Custom Extensions

**Tools**: Test the `execute()` directly.

```python
import pytest
from pathlib import Path
from architect.tools.count_lines import CountLinesTool

@pytest.fixture
def tool(tmp_path):
    # Create test files
    (tmp_path / "main.py").write_text("line1\nline2\nline3\n")
    (tmp_path / "utils.py").write_text("a\nb\n")
    (tmp_path / "readme.md").write_text("# Readme\n")
    return CountLinesTool(workspace_root=tmp_path)

def test_count_lines_basic(tool):
    result = tool.execute(path=".", extensions=[".py"])
    assert result.success is True
    assert "5 lines" in result.output or "5" in result.output

def test_count_lines_no_files(tool):
    result = tool.execute(path=".", extensions=[".rs"])
    assert result.success is True
    assert "No files found" in result.output

def test_count_lines_path_traversal(tool):
    result = tool.execute(path="../../etc")
    assert result.success is False
    assert "security" in result.error.lower()
```

**Hooks**: Test the script as a standalone program.

```bash
# Simulate a pre_tool_use with suspicious content
echo '{"content": "api_key = \"sk-12345\""}' | \
  ARCHITECT_EVENT=pre_tool_use \
  ARCHITECT_TOOL_NAME=write_file \
  python scripts/scan_secrets.py
echo "Exit code: $?"   # Should be 2 (BLOCK)
```

**Guardrails**: The `GuardrailsEngine` class is directly testable.

```python
from architect.config.schema import GuardrailsConfig
from architect.core.guardrails import GuardrailsEngine

config = GuardrailsConfig(
    enabled=True,
    sensitive_files=[".env", "*.pem"],    # blocks read + write
    protected_files=["*.lock"],           # blocks write only
    blocked_commands=[r"rm\s+-rf"],
)
engine = GuardrailsEngine(config, workspace_root="/tmp/test")

# sensitive_files: blocks both read and write
allowed, reason = engine.check_file_access(".env", "read_file")
assert allowed is False  # cannot read secrets

allowed, reason = engine.check_file_access(".env", "write_file")
assert allowed is False  # cannot write secrets

# protected_files: blocks write only, allows read
allowed, reason = engine.check_file_access("package.lock", "read_file")
assert allowed is True   # can read protected files

allowed, reason = engine.check_file_access("package.lock", "write_file")
assert allowed is False  # cannot write protected files

allowed, reason = engine.check_file_access("src/main.py", "write_file")
assert allowed is True   # normal files: full access
```

### 6.3. Configuration Versioning

Recommendations for maintaining custom configurations in the repository:

```
project/
├── architect.yaml          # Main config (versioned in git)
├── .architect.md           # Project instructions (versioned)
├── .architect/
│   ├── skills/             # Project skills (versioned)
│   │   ├── django/SKILL.md
│   │   └── react/SKILL.md
│   ├── memory.md           # Procedural memory (versioned)
│   └── installed-skills/   # External skills (optionally in .gitignore)
├── scripts/
│   ├── scan_secrets.py     # Custom hooks (versioned)
│   └── format_hook.sh
```

- **Version** `architect.yaml`, `.architect.md`, skills, and hook scripts.
- **Do not version** (add to `.gitignore`) generated files like `.architect/sessions/`, caches, and logs.
- Consider a shared base `architect.yaml` and an `architect.local.yaml` (in `.gitignore`) for developer-local overrides.

### 6.4. Combining Surfaces

The five surfaces complement each other:

| Need | Surface |
|---|---|
| "The agent must be able to do X" | Custom tool |
| "The agent must act as Y" | Custom agent |
| "Before/after Z, run W" | Hook |
| "When working with type A files, follow these rules" | Skill |
| "NEVER touch/do this" | Guardrail |

Example of complete integration: a team working with Django + React wants architect to:

1. **Custom tool** `count_lines` so the agent knows the project size.
2. **Agent** `security-audit` specialized in finding vulnerabilities.
3. **Hook** `pre_tool_use` that scans for secrets before each write.
4. **Hook** `post_tool_use` that runs `black` after each write on `*.py`.
5. **Skill** `django` activated by `*.py` with framework conventions.
6. **Skill** `react` activated by `*.tsx` with component conventions.
7. **Guardrails** that protect `.env`, `*.pem`, block `rm -rf` and `git push`, limit to 15 modified files, and force tests before declaring complete.
8. **Quality gates** that run `ruff`, `mypy`, and `pytest` at the end.

All of this is configured without touching architect's core, using only `architect.yaml`, files in `.architect/`, and scripts in `scripts/`.
