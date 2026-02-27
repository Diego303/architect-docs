---
title: "Tools and Execution"
description: "Tool system: filesystem, editing, search, MCP, ExecutionEngine."
icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
order: 6
---

# Tools and execution system

Describes how the tools that the agent can use are defined, registered, and executed.

---

## BaseTool — the interface for every tool

Every tool (local or MCP) implements this abstract class:

```python
class BaseTool(ABC):
    name:        str            # unique identifier (e.g.: "write_file", "mcp_github_create_pr")
    description: str            # description for the LLM (must be precise and concise)
    args_model:  type[BaseModel]  # Pydantic model with the arguments
    sensitive:   bool = False   # True → requires confirmation in "confirm-sensitive"

    @abstractmethod
    def execute(self, **kwargs: Any) -> ToolResult:
        # NEVER raises exceptions. Always returns ToolResult.
        ...

    def get_schema(self) -> dict:
        # Generates the JSON Schema in OpenAI function-calling format
        # {"type": "function", "function": {"name": ..., "description": ..., "parameters": ...}}

    def validate_args(self, args: dict) -> BaseModel:
        # Validates args against args_model; raises Pydantic ValidationError on failure
```

`get_schema()` produces the format that LiteLLM/OpenAI expects for tool calling. The Pydantic `args_model` is automatically converted to JSON Schema.

---

## Summary of all available tools

| Tool | Class | `sensitive` | Module | Purpose |
|------|-------|-------------|--------|---------|
| `read_file` | `ReadFileTool` | No | `filesystem.py` | Reads a file as UTF-8 text |
| `write_file` | `WriteFileTool` | **Yes** | `filesystem.py` | Writes or appends content to a file |
| `delete_file` | `DeleteFileTool` | **Yes** | `filesystem.py` | Deletes a file (requires `allow_delete=true`) |
| `list_files` | `ListFilesTool` | No | `filesystem.py` | Lists files with optional glob and recursion |
| `edit_file` | `EditFileTool` | **Yes** | `filesystem.py` | Replaces an exact block of text in a file |
| `apply_patch` | `ApplyPatchTool` | **Yes** | `patch.py` | Applies a unified diff to a file |
| `search_code` | `SearchCodeTool` | No | `search.py` | Searches patterns with regex in source code |
| `grep` | `GrepTool` | No | `search.py` | Searches literal text (uses system rg/grep if available) |
| `find_files` | `FindFilesTool` | No | `search.py` | Finds files by name or glob pattern |
| `run_command` | `RunCommandTool` | **Dynamic** | `commands.py` | Executes system commands with 4 security layers (F13) |
| `dispatch_subagent` | `DispatchSubagentTool` | No | `dispatch.py` | Delegates sub-tasks to specialized agents with isolated context (v1.0.0) |

---

## Filesystem tools

All live in `tools/filesystem.py`. They receive `workspace_root: Path` in `__init__` and pass it to `validate_path()` on every operation.

### `read_file`

```
ReadFileArgs:
  path: str    # relative to the workspace root
```

Reads the file as UTF-8 text. If the file does not exist or is a directory, returns `ToolResult(success=False)`.

### `write_file`

```
WriteFileArgs:
  path:    str
  content: str
  mode:    str = "overwrite"   # "overwrite" | "append"
```

Automatically creates parent directories if they do not exist. `sensitive=True`.

**When to use**: new files or complete rewrites. For partial changes, use `edit_file` or `apply_patch`.

### `delete_file`

```
DeleteFileArgs:
  path: str
```

Has a double verification:
1. `allow_delete` in `WorkspaceConfig` (off by default).
2. `validate_path()` to prevent traversal.

```python
if not self.allow_delete:
    return ToolResult(success=False, output="Error: deletion disabled.",
                      error="allow_delete=False in WorkspaceConfig")
```

### `list_files`

```
ListFilesArgs:
  path:      str       = "."
  pattern:   str|None  = None   # glob (e.g.: "*.py", "**/*.md", "src/**/*.ts")
  recursive: bool      = False
```

Returns a list of paths relative to the workspace root.

---

## Incremental editing tools (F9)

Prefer these tools over `write_file` for modifying existing files. They consume fewer tokens and have less risk of introducing errors.

### `edit_file` — exact text substitution

```
EditFileArgs:
  path:    str   # file to modify
  old_str: str   # exact text to replace (must be unique in the file)
  new_str: str   # replacement text
```

**Behavior**:
- Validates that `old_str` appears **exactly once** in the file.
- If it appears 0 times → `ToolResult(success=False, "old_str not found")`.
- If it appears more than once → `ToolResult(success=False, "old_str is not unique")`.
- If successful → returns the unified diff of the change.
- `sensitive=True`.

**When to use**: changing a function, a class, a code block. The `old_str` must be long enough to be unique (include context if necessary).

```python
# Example of agent usage
edit_file(
    path="src/utils.py",
    old_str="def calculate(a, b):\n    return a + b",
    new_str="def calculate(a: int, b: int) -> int:\n    \"\"\"Adds two integers.\"\"\"\n    return a + b",
)
```

### `apply_patch` — full unified diff

```
ApplyPatchArgs:
  path:  str   # file to modify
  patch: str   # unified diff with one or more hunks
```

**Patch format**:
```
--- a/src/utils.py
+++ b/src/utils.py
@@ -10,7 +10,10 @@
 def foo():
-    return 1
+    return 2
+
+def bar():
+    return 3
```

**Behavior**:
1. Attempts to parse and apply the diff with the internal pure-Python parser.
2. If it fails (context does not match, incorrect numbering), tries with the system `patch` command.
3. If both fail → `ToolResult(success=False)` with error description.
- `sensitive=True`.

**When to use**: multiple changes in a file (several hunks), or when the LLM has the complete diff ready.

### Editing hierarchy (BUILD_PROMPT)

The `build` agent's system prompt includes this explicit guide:

```
1. edit_file   — single contiguous block change (preferred)
2. apply_patch — multiple changes in a file or pre-existing diff
3. write_file  — new files or complete file reorganizations
```

---

## Search tools (F10)

Live in `tools/search.py`. They receive `workspace_root: Path`. All are `sensitive=False` (read-only).

### `search_code` — regex with context

```
SearchCodeArgs:
  pattern:        str            # regular expression
  path:           str = "."      # directory to search in (relative to workspace)
  file_pattern:   str = "*.py"   # glob to filter files
  context_lines:  int = 2        # lines before and after each match
  max_results:    int = 50       # result limit
```

Uses Python's `re` module. Returns matches with line number and context.

```bash
# Agent searching all uses of validate_path
search_code(pattern="validate_path", file_pattern="*.py", context_lines=3)
```

### `grep` — literal text search

```
GrepArgs:
  pattern:       str            # literal text (not regex)
  path:          str = "."
  file_pattern:  str = "*"
  recursive:     bool = True
  case_sensitive: bool = True
  max_results:   int = 100
```

**Implementation**: uses `rg` (ripgrep) if installed, then `grep`, then pure Python as fallback. The agent always receives results regardless of the system.

```bash
# Agent searching imports of a specific module
grep(pattern="from architect.core import", file_pattern="*.py")
```

### `find_files` — search files by name

```
FindFilesArgs:
  pattern:   str         # filename glob (e.g.: "*.yaml", "test_*.py", "README*")
  path:      str = "."   # root search directory
  recursive: bool = True
```

```bash
# Agent searching all configuration files
find_files(pattern="*.yaml")
find_files(pattern="*.env*")
find_files(pattern="conftest.py")
```

---

## `run_command` tool — code execution (F13)

Lives in `tools/commands.py`. Available only for the `build` agent by default. Enabled/disabled with `commands.enabled` in config or the `--allow-commands`/`--no-commands` flags.

```
RunCommandArgs:
  command: str          # command to execute (shell string)
  cwd:     str | None   # working directory relative to workspace (default: workspace root)
  timeout: int = 30     # seconds (1-600; overrides the config default_timeout)
  env:     dict | None  # additional environment variables (added to the process's)
```

### 4 security layers

**Layer 1 — Blocklist** (`BLOCKED_PATTERNS`): regexes that block destructive commands **always**, regardless of the confirmation mode. Includes: `rm -rf /`, `rm -rf ~`, `sudo`, `su`, `chmod 777`, `curl|bash`, `wget|bash`, `dd of=/dev/`, `> /dev/sd*`, `mkfs`, fork bomb, `pkill -9 -f`, `killall -9`.

**Layer 2 — Dynamic classification** (`classify_sensitivity()`): each command is classified as:
- `'safe'` — read-only/query commands: `ls`, `cat`, `head`, `tail`, `wc`, `grep`, `rg`, `tree`, `file`, `which`, `echo`, `pwd`, `env`, `date`, `python --version`, `git status`, `git log`, `git diff`, `git show`, `git branch` (view), `npm list`, `cargo check`, etc.
- `'dev'` — development tools: `pytest`, `python -m pytest`, `mypy`, `ruff`, `black`, `eslint`, `make`, `cargo build`, `go build`, `mvn`, `gradle`, `tsc`, `npm run`, `pnpm run`, `yarn run`, `docker ps`, `kubectl get`, etc.
- `'dangerous'` — any command not explicitly recognized as safe or dev.

**Layer 3 — Timeouts + output limit**: `subprocess.run(..., timeout=N, stdin=subprocess.DEVNULL)`. The process is headless (no stdin). Output is truncated to `max_output_lines` preserving the beginning and end.

**Layer 4 — Directory sandboxing**: the subprocess `cwd` is validated with `validate_path()` — always within the workspace.

### Dynamic confirmation table

The sensitivity of `run_command` is not static (`tool.sensitive`). `ExecutionEngine._should_confirm_command()` queries `classify_sensitivity()` at runtime:

| Classification | `yolo` | `confirm-sensitive` | `confirm-all` |
|----------------|--------|---------------------|---------------|
| `safe` | No | No | Yes |
| `dev` | No | **Yes** | Yes |
| `dangerous` | No | **Yes** | Yes |

The `yolo` mode **never** confirms any command (`safe`, `dev`, or `dangerous`). Security against destructive commands is guaranteed exclusively through Layer 1 (blocklist), which always blocks regardless of the confirmation mode.

### `allowed_only`

If `commands.allowed_only: true`, commands classified as `dangerous` are rejected in `execute()` without reaching confirmation. Useful in CI where only a strict whitelist should be allowed.

```python
# Example with allowed_only=True:
run_command(command="npm install --global malicious-pkg")
# → ToolResult(success=False, "Command classified as 'dangerous' and allowed_only=True")
```

---

## `dispatch_subagent` tool — delegation to sub-agents (v1.0.0)

Lives in `tools/dispatch.py`. Available only for the `build` agent by default. Allows delegating sub-tasks to specialized agents that run with **isolated context** (no access to the parent agent's history).

```
DispatchSubagentArgs:
  task:       str            # sub-task description
  agent_type: str            # "explore", "test", or "review"
  context:    str | None     # additional context for the sub-agent
```

### Sub-agent types

| Type | Available tools | Purpose |
|------|----------------|---------|
| `explore` | `read_file`, `list_files`, `search_code`, `grep`, `find_files` | Investigate and explore code |
| `test` | `read_file`, `list_files`, `search_code`, `grep`, `find_files`, `run_command` | Run tests and verify |
| `review` | `read_file`, `list_files`, `search_code`, `grep`, `find_files` | Review code, find issues |

### Security

- Sub-agents can **never** modify files (they do not have `write_file`, `edit_file`, `apply_patch`)
- They run with `confirm_mode="yolo"` (no interactive confirmation)
- They inherit the `workspace_root` from the parent agent
- The result is returned as a `ToolResult` to the parent agent for decision-making

### When to use it

The `build` agent can delegate tasks when it needs information without polluting its own context:

```python
# Example: the build agent delegates exploration
dispatch_subagent(
    task="Find all files that import jwt and list the usage patterns",
    agent_type="explore",
)
# → ToolResult with the exploration summary
```

---

## Path validation — security

`execution/validators.py` is the sole security gate for all file operations.

```python
def validate_path(path: str, workspace_root: Path) -> Path:
    resolved = (workspace_root / path).resolve()
    if not resolved.is_relative_to(workspace_root.resolve()):
        raise PathTraversalError(f"Path '{path}' escapes the workspace")
    return resolved
```

The key is `Path.resolve()`:
- Collapses `../..` → real absolute path.
- Resolves symlinks → prevents escapes via symlinks.
- Makes `../../etc/passwd` → `/etc/passwd`, which is clearly not `is_relative_to(workspace)`.
- Absolute paths like `/etc/passwd` also fail (Python ignores workspace_root with absolute paths, and then `is_relative_to` fails).

**All user paths go through `validate_path()` before any I/O operation.**

---

## ToolRegistry

Central in-memory store.

```python
class ToolRegistry:
    _tools: dict[str, BaseTool]

    register(tool, allow_override=False)
    # Raises DuplicateToolError if it already exists and allow_override=False

    get(name) -> BaseTool
    # Raises ToolNotFoundError if it does not exist

    list_all() -> list[BaseTool]     # sorted by name
    get_schemas(allowed=None) -> list[dict]
    # allowed=None → schemas of all tools
    # allowed=["read_file","list_files"] → only those two
    # Names not found are silently ignored (does not raise an error)

    filter_by_names(names) -> list[BaseTool]
    has_tool(name) -> bool
    count() -> int
    clear()  # for testing
```

`get_schemas(allowed_tools)` is the critical method called on each loop iteration to obtain the schemas sent to the LLM.

### `register_all_tools()` function

`tools/setup.py` defines how all tools are registered:

```python
def register_filesystem_tools(registry, workspace_config):
    root = workspace_config.root.resolve()
    registry.register(ReadFileTool(root))
    registry.register(WriteFileTool(root))
    registry.register(DeleteFileTool(root, workspace_config.allow_delete))
    registry.register(ListFilesTool(root))
    registry.register(EditFileTool(root))
    registry.register(ApplyPatchTool(root))

def register_search_tools(registry, workspace_config):
    root = workspace_config.root.resolve()
    registry.register(SearchCodeTool(root))
    registry.register(GrepTool(root))
    registry.register(FindFilesTool(root))

def register_command_tools(registry, workspace_config, commands_config):
    if not commands_config.enabled:
        return
    root = workspace_config.root.resolve()
    registry.register(RunCommandTool(root, commands_config))

def register_all_tools(registry, workspace_config, commands_config=None):
    register_filesystem_tools(registry, workspace_config)
    register_search_tools(registry, workspace_config)
    if commands_config is None:
        commands_config = CommandsConfig()
    register_command_tools(registry, workspace_config, commands_config)
```

The CLI uses `register_all_tools()` — all tools are always available in the registry. Filtering by agent is done through `allowed_tools` in `AgentConfig`. The `run_command` tool is registered only if `commands_config.enabled=True`.

---

## ExecutionEngine — the execution pipeline

Mandatory entry point for ALL tool execution. **Never raises exceptions.**

```python
class ExecutionEngine:
    registry:      ToolRegistry
    config:        AppConfig
    dry_run:       bool = False
    policy:        ConfirmationPolicy
    hook_executor: HookExecutor | None = None       # v4-A1: lifecycle hooks
    guardrails:    GuardrailsEngine | None = None    # v4-A2: deterministic rules
    hooks:         PostEditHooks | None = None       # v3-M4: legacy (backward-compat)

    def execute_tool_call(self, tool_name: str, args: dict) -> ToolResult:
```

### The 10 pipeline steps (v4)

```
1.  registry.get(tool_name)
    ✗ ToolNotFoundError → return ToolResult(success=False, "Tool not found")

2.  tool.validate_args(args)
    ✗ ValidationError → return ToolResult(success=False, "Invalid arguments: ...")

3.  guardrails.check_*()  [v4-A2: if guardrails configured]
    → check_file_access() for filesystem tools
    → check_command() for run_command
    → check_edit_limits() for edit/write/patch
    → check_code_rules() for written content
    ✗ Blocked → return ToolResult(success=False, "Guardrail: {reason}")

4.  hook_executor.run_event(PRE_TOOL_USE)  [v4-A1: pre-hooks]
    → HookDecision.BLOCK → return ToolResult(success=False, "Blocked by hook: {reason}")
    → HookDecision.MODIFY → update args with updated_input

5.  policy.should_confirm(tool)
    → True: policy.request_confirmation(tool_name, args, dry_run)
        ✗ NoTTYError → return ToolResult(success=False, "No TTY available for confirmation")
        ✗ user cancels → return ToolResult(success=False, "Action cancelled by user")

6.  if dry_run:
    → if dry_run_tracker: record action (tool_name, args) in DryRunTracker
    → return ToolResult(success=True, "[DRY-RUN] Would execute: tool_name(args)")
    Note: only WRITE_TOOLS are recorded in the tracker; READ_TOOLS are
    executed normally so the agent can read files and plan.

7.  tool.execute(**validated_args.model_dump())
    (tool.execute() does not raise — if there is an internal exception, the tool catches it)

8.  hook_executor.run_event(POST_TOOL_USE)  [v4-A1: post-hooks]
    → additional_context is appended to ToolResult
    (also: run_post_edit_hooks legacy for backward-compat v3-M4)

9.  log result (structlog)

10. return ToolResult
```

There is an outer `try/except Exception` that catches any unexpected error from step 5 and converts it to `ToolResult(success=False)`.

The error result is returned to the agent as a tool message, and the LLM can decide to try something else. **Tool errors do not break the loop.**

---

## ConfirmationPolicy

Implements the interactive confirmation logic.

```python
class ConfirmationPolicy:
    mode: str   # "yolo" | "confirm-all" | "confirm-sensitive"

    def should_confirm(self, tool: BaseTool) -> bool:
        if mode == "yolo":             return False   # never confirms
        if mode == "confirm-all":      return True    # always confirms
        if mode == "confirm-sensitive": return tool.sensitive  # only if sensitive=True
```

```python
    def request_confirmation(self, tool_name, args, dry_run=False) -> bool:
        if not sys.stdin.isatty():
            raise NoTTYError(
                "Confirm mode requires an interactive TTY. "
                "In CI use --mode yolo or --dry-run."
            )
        # Shows: "Execute 'write_file' with args=...? [y/n/a]"
        # 'y' → True (execute)
        # 'n' → False (cancel this tool, loop continues)
        # 'a' → sys.exit(130) (abort everything)
```

Default sensitivity for each tool:

| Tool | `sensitive` | Requires confirmation in `confirm-sensitive` |
|------|-------------|----------------------------------------------|
| `read_file`, `list_files`, `search_code`, `grep`, `find_files` | No | No |
| `write_file`, `delete_file`, `edit_file`, `apply_patch` | **Yes** | **Yes** |
| All MCP tools | **Yes** | **Yes** |
| `run_command` (safe) | Dynamic | No |
| `run_command` (dev) | Dynamic | **Yes** |
| `run_command` (dangerous) | Dynamic | **Yes** |

For `run_command`, `ExecutionEngine` calls `_should_confirm_command()` which queries `tool.classify_sensitivity(command)` instead of using the static `tool.sensitive` attribute.

---

## HookExecutor — lifecycle hooks (v4-A1)

Starting from v0.16.0, the hooks system supports **10 lifecycle events**. Hooks are executed as shell subprocesses and receive context via `ARCHITECT_*` environment variables.

### Events and types

| Event | Type | Can BLOCK |
|-------|------|:---------:|
| `pre_tool_use` | Pre-hook | Yes |
| `post_tool_use` | Post-hook | No |
| `pre_llm_call` | Pre-hook | Yes |
| `post_llm_call` | Post-hook | No |
| `session_start` | Notification | No |
| `session_end` | Notification | No |
| `on_error` | Notification | No |
| `budget_warning` | Notification | No |
| `context_compress` | Notification | No |
| `agent_complete` | Notification | No |

### Exit code protocol

- **Exit 0** → ALLOW. stdout may contain JSON with `additionalContext` or `updatedInput`.
- **Exit 2** → BLOCK (pre-hooks only). stderr contains the reason.
- **Other** → Error. Logged as warning, does not break the loop. Decision = ALLOW.

### Configuration

```yaml
hooks:
  pre_tool_use:
    - name: validate-secrets
      command: "bash scripts/check.sh"
      matcher: "write_file|edit_file"
      file_patterns: ["*.py"]
      timeout: 5
  post_tool_use:
    - name: python-lint
      command: "ruff check {file} --no-fix"
      file_patterns: ["*.py"]
      timeout: 15
```

### Backward compatibility v3-M4

`hooks.post_edit` still works and is internally mapped to `post_tool_use` with an automatic matcher for `edit_file|write_file|apply_patch`. The legacy `PostEditHooks` is still available.

If a hook fails (exit code != 0), its output is appended to the tool result. In the HUMAN log it is shown with icons:

```
      🔍 Hook python-lint: ⚠️
```

And in the tool result received by the LLM:

```
[Hook python-lint: FAILED (exit 1)]
src/main.py:15:5: F841 local variable 'x' is assigned to but never used
```

---

## GuardrailsEngine — deterministic security (v4-A2)

Deterministic rules engine evaluated **BEFORE** hooks in the execution pipeline. Cannot be disabled by the LLM.

### Available checks

| Check | Method | When |
|-------|--------|------|
| Protected files | `check_file_access()` | On filesystem tools (write, edit, delete) |
| Blocked commands | `check_command()` | On `run_command` |
| Edit limits | `check_edit_limits()` | On editing tools |
| Code rules | `check_code_rules()` | On written content |
| Quality gates | `run_quality_gates()` | On agent completion |

Guardrails are configured in the YAML `guardrails:` section. If a guardrail blocks, the pre_tool_use hooks are not even executed.

---

## MCPToolAdapter — remote tools as local

`MCPToolAdapter` inherits from `BaseTool` and makes a tool from an MCP server indistinguishable from a local tool.

```python
class MCPToolAdapter(BaseTool):
    name = f"mcp_{server_name}_{original_name}"
    # Prefix prevents collisions when two servers have tools with the same name

    sensitive = True   # all MCP tools are sensitive by default

    args_model = _build_args_model(tool_definition["inputSchema"])
    # Dynamically generates a Pydantic model from the MCP server's JSON Schema

    def execute(self, **kwargs) -> ToolResult:
        result = client.call_tool(original_name, kwargs)
        return ToolResult(success=True, output=_extract_content(result))
```

The `args_model` generator translates JSON Schema types to Python:
```
"string"  → str
"integer" → int
"number"  → float
"boolean" → bool
"array"   → list
"object"  → dict
```

Required fields → `(type, ...)` (Pydantic required).
Optional fields → `(type | None, None)` (Pydantic optional with default None).

### Auto-injection of MCP tools into `allowed_tools`

Starting from v0.16.2, discovered MCP tools are automatically injected into the active agent's `allowed_tools`. This solves the problem where an agent with explicit `allowed_tools` (like `build`) filtered out MCP tools because they were not in its list.

```python
# In cli.py, after resolving agent_config:
if agent_config.allowed_tools:
    mcp_tool_names = [t.name for t in registry.list_all() if t.name.startswith("mcp_")]
    agent_config.allowed_tools.extend(mcp_tool_names)
```

This means that a `build` agent with `allowed_tools: [read_file, write_file, ...]` will also automatically have access to `mcp_github_create_pr`, `mcp_database_query`, etc. without needing to configure them manually.

---

## Tool call lifecycle

```
LLMResponse.tool_calls = [ToolCall(id="call_abc", name="edit_file", arguments={...})]
                              │
                              ▼
ExecutionEngine.execute_tool_call("edit_file", {path:"main.py", old_str:"...", new_str:"..."})
  │
  ├─ registry.get("edit_file")               → EditFileTool
  ├─ validate_args({path:..., old_str:..., new_str:...}) → EditFileArgs(...)
  │
  ├─ [v4-A2] guardrails.check_file_access("main.py", "edit_file") → (True, "")
  ├─ [v4-A2] guardrails.check_edit_limits("main.py", lines_added, lines_removed) → (True, "")
  │
  ├─ [v4-A1] hook_executor.run_event(PRE_TOOL_USE, context) → [HookResult(ALLOW)]
  │
  ├─ policy.should_confirm(edit_file)         → True (sensitive=True, mode=confirm-sensitive)
  ├─ request_confirmation("edit_file", ...)   → user: y
  ├─ edit_file.execute(path="main.py", old_str="...", new_str="...")
  │     └─ validate_path("main.py", workspace) → /workspace/main.py ✓
  │     └─ file.read_text() → content
  │     └─ assert old_str appears exactly 1 time
  │     └─ content.replace(old_str, new_str, 1)
  │     └─ file.write_text(new_content)
  │     └─ ToolResult(success=True, output="[unified diff of the change]")
  │
  ├─ [v4-A1] hook_executor.run_event(POST_TOOL_USE, context)
  │     └─ hook "python-lint": ruff check /workspace/main.py --no-fix
  │     └─ hook "python-typecheck": mypy /workspace/main.py --no-error-summary
  │     └─ hook results are appended to ToolResult.output
  └─ return ToolResult

 ContextBuilder.append_tool_results(messages, [ToolCall(...)], [ToolResult(...)])
  → messages += [
      {"role":"assistant", "tool_calls":[{"id":"call_abc","function":{...}}]},
      {"role":"tool", "tool_call_id":"call_abc", "content":"[diff + hook results...]"}
    ]
```

The tool result (success or error) always returns to the LLM as a `tool` message, including the output of post-edit hooks if applicable. The LLM decides what to do next and can self-correct errors detected by the hooks.

The complete pipeline with v4 Phase A + B:
```
Guardrails (deterministic) → Pre-hooks (shell) → Confirmation → Dry-run check → Execution → Post-hooks → LLM
```

### DryRunTracker (v4-B4)

When `--dry-run` is active, write tools (`WRITE_TOOLS`: `write_file`, `edit_file`, `apply_patch`, `delete_file`, `run_command`) are not executed. Instead:

1. The `DryRunTracker` records each action as `PlannedAction(tool_name, description, tool_input)`
2. `_summarize_action(tool_name, tool_input)` generates a human-readable description
3. At the end, `get_plan_summary()` generates the complete summary of planned actions

Read tools (`READ_TOOLS`: `read_file`, `list_files`, `search_code`, `grep`, `find_files`) are executed normally so the agent can analyze the code and plan.
