---
title: "Data Models"
description: "All data models: Pydantic, dataclasses, and error hierarchy."
icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
order: 10
---

# Data Models

All system data models. They are the source of truth for communication between components.

---

## Configuration models (`config/schema.py`)

All use Pydantic v2 with `extra = "forbid"` (unknown keys → validation error).

### `LLMConfig`

```python
class LLMConfig(BaseModel):
    provider:       str   = "litellm"    # only supported provider
    mode:           str   = "direct"     # "direct" | "proxy"
    model:          str   = "gpt-4o"     # any LiteLLM model
    api_base:       str | None = None    # custom base URL (LiteLLM Proxy, Ollama, etc.)
    api_key_env:    str   = "LITELLM_API_KEY"  # name of the env var containing the API key
    timeout:        int   = 60           # seconds per LLM call
    retries:        int   = 2            # retries on transient errors
    stream:         bool  = True         # streaming enabled by default
    prompt_caching: bool  = False        # F14: mark system with cache_control (Anthropic/OpenAI)
```

### `AgentConfig`

```python
class AgentConfig(BaseModel):
    system_prompt: str                        # injected as the first message
    allowed_tools: list[str]  = []            # [] = all available tools
    confirm_mode:  str        = "confirm-sensitive"  # "yolo"|"confirm-all"|"confirm-sensitive"
    max_steps:     int        = 20            # Pydantic default=20; varies in DEFAULT_AGENTS:
                                              #   plan=20, build=50, resume=15, review=20
```

### `LoggingConfig`

```python
class LoggingConfig(BaseModel):
    # v3: "human" = agent traceability level (HUMAN=25)
    level:   str        = "human"  # "debug"|"info"|"human"|"warn"|"error"
    file:    Path|None  = None     # path to the .jsonl file (optional)
    verbose: int        = 0        # 0=warn, 1=info, 2=debug, 3+=all
```

### `WorkspaceConfig`

```python
class WorkspaceConfig(BaseModel):
    root:         Path  = Path(".")   # workspace root; all ops confined here
    allow_delete: bool  = False       # gate for delete_file tool
```

### `MCPServerConfig` / `MCPConfig`

```python
class MCPServerConfig(BaseModel):
    name:      str           # identifier; used in prefix: mcp_{name}_{tool}
    url:       str           # HTTP base URL of the MCP server
    token_env: str | None = None   # env var with the Bearer token
    token:     str | None = None   # inline token (not recommended in production)

class MCPConfig(BaseModel):
    servers: list[MCPServerConfig] = []
```

### `IndexerConfig` (F10)

```python
class IndexerConfig(BaseModel):
    enabled:          bool       = True       # if False, no indexing and no tree in the prompt
    max_file_size:    int        = 1_000_000  # bytes; larger files are skipped
    exclude_dirs:     list[str]  = []         # additional dirs (besides .git, node_modules, etc.)
    exclude_patterns: list[str]  = []         # additional patterns (besides *.pyc, *.min.js, etc.)
    use_cache:        bool       = True       # disk cache with 5-minute TTL
```

The indexer always excludes by default: `.git`, `node_modules`, `__pycache__`, `.venv`, `venv`, `dist`, `build`, `.tox`, `.pytest_cache`, `.mypy_cache`.

### `ContextConfig` (F11)

```python
class ContextConfig(BaseModel):
    max_tool_result_tokens: int  = 2000   # Level 1: truncate long tool results (~4 chars/token)
    summarize_after_steps:  int  = 8      # Level 2: compress old messages after N steps
    keep_recent_steps:      int  = 4      # Level 2: recent steps to preserve intact
    max_context_tokens:     int  = 80000  # Level 3: total hard limit (~4 chars/token)
    parallel_tools:         bool = True   # parallelize independent tool calls
```

A value of `0` disables the corresponding mechanism:
- `max_tool_result_tokens=0` → no truncation of tool results.
- `summarize_after_steps=0` → no LLM compression.
- `max_context_tokens=0` → no sliding window (dangerous for long tasks).

### `HookItemConfig` (v4-A1)

```python
class HookItemConfig(BaseModel):
    name:          str           = ""     # hook identifier (e.g.: "python-lint")
    command:       str                    # shell command to execute; supports {file} placeholder
    matcher:       str           = "*"   # regex/glob to filter tools
    file_patterns: list[str]    = []     # glob patterns (e.g.: ["*.py", "*.ts"])
    timeout:       int           = 10    # ge=1, le=300 — maximum seconds
    async_:        bool          = False # alias="async" — run in background
    enabled:       bool          = True  # if False, the hook is ignored
```

Backward-compat alias: `HookConfig = HookItemConfig`.

### `HooksConfig` (v4-A1)

```python
class HooksConfig(BaseModel):
    # 10 lifecycle events
    pre_tool_use:      list[HookItemConfig] = []
    post_tool_use:     list[HookItemConfig] = []
    pre_llm_call:      list[HookItemConfig] = []
    post_llm_call:     list[HookItemConfig] = []
    session_start:     list[HookItemConfig] = []
    session_end:       list[HookItemConfig] = []
    on_error:          list[HookItemConfig] = []
    agent_complete:    list[HookItemConfig] = []
    budget_warning:    list[HookItemConfig] = []
    context_compress:  list[HookItemConfig] = []
    # Backward-compat v3-M4: internally mapped to post_tool_use
    post_edit:         list[HookItemConfig] = []
```

### `GuardrailsConfig` (v4-A2)

```python
class GuardrailsConfig(BaseModel):
    enabled:                bool              = False
    protected_files:        list[str]         = []     # glob patterns (write-only)
    sensitive_files:        list[str]         = []     # glob patterns (read + write)
    blocked_commands:       list[str]         = []     # regex patterns
    max_files_modified:     int | None        = None
    max_lines_changed:      int | None        = None
    max_commands_executed:   int | None        = None
    require_test_after_edit: bool             = False
    quality_gates:          list[QualityGateConfig] = []
    code_rules:             list[CodeRuleConfig]    = []
```

### `QualityGateConfig` (v4-A2)

```python
class QualityGateConfig(BaseModel):
    name:     str              # gate name (e.g.: "lint", "tests")
    command:  str              # shell command to execute
    required: bool = True      # if False, informational only
    timeout:  int  = 60        # ge=1, le=600 — seconds
```

### `CodeRuleConfig` (v4-A2)

```python
class CodeRuleConfig(BaseModel):
    pattern:  str                             # regex to search in written code
    message:  str                             # message for the agent
    severity: Literal["warn", "block"] = "warn"
```

### `SkillsConfig` (v4-A3)

```python
class SkillsConfig(BaseModel):
    auto_discover: bool = True   # discover skills in .architect/skills/
    inject_by_glob: bool = True  # inject skills based on active files
```

### `MemoryConfig` (v4-A4)

```python
class MemoryConfig(BaseModel):
    enabled:                  bool = False  # enable procedural memory
    auto_detect_corrections:  bool = True   # detect corrections automatically
```

### `EvaluationConfig` (F12)

```python
class EvaluationConfig(BaseModel):
    mode:                 Literal["off", "basic", "full"] = "off"
    max_retries:          int   = 2    # ge=1, le=5 — retries in "full" mode
    confidence_threshold: float = 0.8  # ge=0.0, le=1.0 — threshold to accept result
```

- `mode="off"`: no evaluation (default, does not consume extra tokens).
- `mode="basic"`: one extra LLM call after execution. If it fails, status → `"partial"`.
- `mode="full"`: up to `max_retries` evaluation + correction cycles with a new prompt.

### `CommandsConfig` (F13)

```python
class CommandsConfig(BaseModel):
    enabled:          bool       = True    # if False, run_command is not registered
    default_timeout:  int        = 30      # default seconds (ge=1, le=600)
    max_output_lines: int        = 200     # lines before truncation (ge=10, le=5000)
    blocked_patterns: list[str]  = []      # extra regexes to block
    safe_commands:    list[str]  = []      # additional commands classified as 'safe'
    allowed_only:     bool       = False   # if True, dangerous commands rejected in execute()
```

CLI override: `--allow-commands` (enabled=True) / `--no-commands` (enabled=False).

### `CostsConfig` (F14)

```python
class CostsConfig(BaseModel):
    enabled:      bool        = True   # if False, CostTracker is not instantiated
    prices_file:  Path | None = None   # custom prices; if None, uses default_prices.json
    budget_usd:   float | None = None  # USD limit; BudgetExceededError if exceeded
    warn_at_usd:  float | None = None  # warning threshold (log warning, does not stop)
```

CLI override: `--budget FLOAT` (equivalent to `budget_usd`).

### `LLMCacheConfig` (F14)

```python
class LLMCacheConfig(BaseModel):
    enabled:   bool = False              # if True, enables LocalLLMCache
    dir:       Path = Path("~/.architect/cache")  # directory on disk
    ttl_hours: int  = 24                 # ge=1, le=8760 — hours of validity
```

CLI override: `--cache` (enabled=True), `--no-cache` (enabled=False), `--cache-clear` (clears before running).

### `AppConfig` (root)

```python
class AppConfig(BaseModel):
    llm:        LLMConfig        = LLMConfig()
    agents:     dict[str, AgentConfig] = {}   # custom agents from YAML
    logging:    LoggingConfig    = LoggingConfig()
    workspace:  WorkspaceConfig  = WorkspaceConfig()
    mcp:        MCPConfig        = MCPConfig()
    indexer:    IndexerConfig    = IndexerConfig()   # F10
    context:    ContextConfig    = ContextConfig()   # F11
    evaluation: EvaluationConfig = EvaluationConfig() # F12
    commands:   CommandsConfig   = CommandsConfig()   # F13
    costs:      CostsConfig      = CostsConfig()      # F14
    llm_cache:  LLMCacheConfig   = LLMCacheConfig()   # F14
    hooks:      HooksConfig      = HooksConfig()      # v4-A1 (backward-compat v3-M4)
    guardrails: GuardrailsConfig = GuardrailsConfig() # v4-A2
    skills:     SkillsConfig     = SkillsConfig()     # v4-A3
    memory:     MemoryConfig     = MemoryConfig()     # v4-A4
    sessions:   SessionsConfig   = SessionsConfig()   # v4-B1
    ralph:      RalphLoopConfig  = RalphLoopConfig()  # v4-C1
    language:   Literal["en", "es"] = "en"   # v1.1.0: system message language
    parallel:   ParallelRunsConfig = ParallelRunsConfig() # v4-C2
    checkpoints: CheckpointsConfig = CheckpointsConfig() # v4-C4
    auto_review: AutoReviewConfig = AutoReviewConfig()  # v4-C5
    telemetry:  TelemetryConfig  = TelemetryConfig()   # v1.0.0 (D4)
    health:     HealthConfig     = HealthConfig()       # v1.0.0 (D2)
```

---

## LLM Models (`llm/adapter.py`)

### `ToolCall`

Represents a tool call that the LLM requests to execute.

```python
class ToolCall(BaseModel):
    id:        str             # unique ID assigned by the LLM (e.g.: "call_abc123")
    name:      str             # tool name (e.g.: "edit_file")
    arguments: dict[str, Any]  # already-parsed arguments (adapter handles JSON string → dict)
```

### `LLMResponse`

Normalized LLM response, regardless of the provider.

```python
class LLMResponse(BaseModel):
    content:      str | None         # response text (None if there are tool_calls)
    tool_calls:   list[ToolCall]     # list of requested tool calls ([] if none)
    finish_reason: str               # "stop" | "tool_calls" | "length" | ...
    usage:        dict | None        # {"prompt_tokens": N, "completion_tokens": N,
                                     #  "total_tokens": N, "cache_read_input_tokens": N}
```

`cache_read_input_tokens` is available when the provider uses prompt caching (Anthropic). The `CostTracker` uses it to calculate the reduced cost of cached tokens.

The most important `finish_reason` values:
- `"stop"` + `tool_calls=[]`: the agent finished. `content` is the final response.
- `"tool_calls"` or `"stop"` + `tool_calls != []`: there are tools to execute.
- `"length"`: the LLM ran out of tokens; the loop can continue.

### `StreamChunk`

Text streaming chunk.

```python
class StreamChunk(BaseModel):
    type: str   # always "content" (for future extension)
    data: str   # text fragment from the LLM
```

---

## Agent state (`core/state.py`)

### `StopReason` (enum, v3)

```python
class StopReason(Enum):
    """Reason why the agent stopped."""
    LLM_DONE         = "llm_done"          # Natural: the LLM did not request more tools
    MAX_STEPS         = "max_steps"         # Watchdog: step limit reached
    BUDGET_EXCEEDED   = "budget_exceeded"   # Watchdog: cost limit exceeded
    CONTEXT_FULL      = "context_full"      # Watchdog: context window full
    TIMEOUT           = "timeout"           # Watchdog: total time exceeded
    USER_INTERRUPT    = "user_interrupt"    # The user pressed Ctrl+C / SIGTERM
    LLM_ERROR         = "llm_error"        # Unrecoverable LLM error
```

Distinguishes natural termination (`LLM_DONE`) from forced stops by safety nets. Stored in `AgentState.stop_reason` and included in the JSON output.

### `ToolCallResult` (frozen dataclass)

Immutable result of a tool execution.

```python
@dataclass(frozen=True)
class ToolCallResult:
    tool_name:    str
    args:         dict[str, Any]
    result:       ToolResult      # from tools/base.py
    was_confirmed: bool = True
    was_dry_run:  bool  = False
    timestamp:    float = field(default_factory=time.time)
```

### `StepResult` (frozen dataclass)

Immutable result of a complete loop iteration.

```python
@dataclass(frozen=True)
class StepResult:
    step_number:     int
    llm_response:    LLMResponse
    tool_calls_made: list[ToolCallResult]
    timestamp:       float = field(default_factory=time.time)
```

### `AgentState` (mutable dataclass)

Accumulated state throughout the agent's execution.

```python
@dataclass
class AgentState:
    messages:     list[dict]           # OpenAI history (grows each step)
    steps:        list[StepResult]     # step history (append-only)
    status:       str = "running"      # "running" | "success" | "partial" | "failed"
    stop_reason:  StopReason | None = None  # v3: stop reason (None while running)
    final_output: str | None = None    # final response when status != "running"
    start_time:   float = field(...)
    model:        str | None = None    # model used (for output)
    cost_tracker: CostTracker | None = None   # F14: cost tracker (injected by CLI)

    # Computed properties
    current_step:     int    # len(steps)
    total_tool_calls: int    # sum of all tool calls across all steps
    is_finished:      bool   # status != "running"

    def to_output_dict(self) -> dict:
        # Serialization for --json
        result = {
            "status":           self.status,
            "stop_reason":      self.stop_reason.value if self.stop_reason else None,
            "output":           self.final_output or "",
            "steps":            len(self.steps),
            "tools_used":       [...],  # list of {name, partial args, success}
            "duration_seconds": time.time() - self.start_time,
            "model":            self.model,
        }
        # F14: include costs if data is available
        if self.cost_tracker and self.cost_tracker.has_data():
            result["costs"] = self.cost_tracker.summary()
        return result
```

The `status` field can be modified externally by the `SelfEvaluator` (F12) or by `BudgetExceededError` (F14).

---

## Costs module (`costs/`) — F14

### `ModelPricing` (dataclass)

```python
@dataclass
class ModelPricing:
    input_per_million:        float          # USD per million input tokens
    output_per_million:       float          # USD per million output tokens
    cached_input_per_million: float | None   # USD/M for cached tokens (None = use input_per_million)
```

### `PriceLoader`

Loads prices from `costs/default_prices.json` (or a custom file via `CostsConfig.prices_file`).

```python
class PriceLoader:
    def __init__(self, custom_prices_file: Path | None = None): ...

    def get_prices(self, model: str) -> ModelPricing:
        # 1. Exact match (e.g.: "gpt-4o" → prices["gpt-4o"])
        # 2. Prefix match (e.g.: "claude-sonnet-4-6-20250514" → prices["claude-sonnet-4-6"])
        # 3. Generic fallback: input=3.0, output=15.0, cached=None
        # NEVER raises exceptions
```

Models embedded in `default_prices.json`: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`, `gemini/gemini-2.0-flash`, `deepseek/deepseek-chat`, `ollama` (zero cost).

### `StepCost` (dataclass)

```python
@dataclass
class StepCost:
    step:          int    # agent step number
    model:         str    # model used (e.g.: "gpt-4o")
    input_tokens:  int    # total input tokens (includes cached)
    output_tokens: int    # output tokens
    cached_tokens: int    # tokens served from provider cache
    cost_usd:      float  # step cost in USD
    source:        str    # "agent" | "eval" | "summary"
```

### `CostTracker`

```python
class CostTracker:
    def __init__(
        self,
        price_loader: PriceLoader,
        budget_usd:   float | None = None,   # limit; BudgetExceededError if exceeded
        warn_at_usd:  float | None = None,   # warning threshold (log warning, no exception)
    ): ...

    def record(self, step: int, model: str, usage: dict, source: str = "agent") -> None:
        # Extracts prompt_tokens, completion_tokens, cache_read_input_tokens
        # Calculates differentiated cost: cached_tokens x cached_rate + non_cached x input_rate + output x output_rate
        # Raises BudgetExceededError if total_cost_usd > budget_usd
        # NEVER raises other exceptions

    # Aggregation properties
    total_input_tokens:  int    # sum of all input_tokens
    total_output_tokens: int    # sum of all output_tokens
    total_cached_tokens: int    # sum of all cached_tokens
    total_cost_usd:      float  # total cost in USD
    step_count:          int    # number of recorded steps

    def has_data(self) -> bool: ...     # True if step_count > 0
    def summary(self) -> dict: ...      # totals + breakdown by_source
    def format_summary_line(self) -> str:  # "$0.0042 (12,450 in / 3,200 out / 500 cached)"
```

`summary()` returns:
```python
{
    "total_input_tokens":  12450,
    "total_output_tokens": 3200,
    "total_cached_tokens": 500,
    "total_tokens":        15650,
    "total_cost_usd":      0.004213,
    "by_source":           {"agent": 0.003800, "eval": 0.000413},
}
```

### `BudgetExceededError`

Raised by `CostTracker.record()` when `total_cost_usd > budget_usd`. The `AgentLoop` catches it, sets `state.status = "partial"`, and terminates the loop.

```python
class BudgetExceededError(Exception):
    pass
```

---

## Lifecycle Hooks (`core/hooks.py`) — v4-A1

### `HookEvent` (enum)

```python
class HookEvent(Enum):
    PRE_TOOL_USE      = "pre_tool_use"
    POST_TOOL_USE     = "post_tool_use"
    PRE_LLM_CALL      = "pre_llm_call"
    POST_LLM_CALL     = "post_llm_call"
    SESSION_START     = "session_start"
    SESSION_END       = "session_end"
    ON_ERROR          = "on_error"
    BUDGET_WARNING    = "budget_warning"
    CONTEXT_COMPRESS  = "context_compress"
    AGENT_COMPLETE    = "agent_complete"
```

### `HookDecision` (enum)

```python
class HookDecision(Enum):
    ALLOW  = "allow"    # Allow the action
    BLOCK  = "block"    # Block the action (pre-hooks only)
    MODIFY = "modify"   # Modify input and allow
```

### `HookResult` (dataclass)

```python
@dataclass
class HookResult:
    decision:           HookDecision = HookDecision.ALLOW
    reason:             str | None = None     # reason for block/error
    additional_context: str | None = None     # extra context for the LLM
    updated_input:      dict[str, Any] | None = None  # modified input (MODIFY)
    duration_ms:        float = 0.0
```

### `HooksRegistry`

```python
class HooksRegistry:
    hooks: dict[HookEvent, list[HookConfig]]

    def get_hooks(self, event: HookEvent) -> list[HookConfig]: ...
    def has_hooks(self) -> bool: ...
```

### `HookExecutor`

```python
class HookExecutor:
    def __init__(self, registry: HooksRegistry, workspace_root: str): ...
    def execute_hook(self, hook, event, context, stdin_data) -> HookResult: ...
    def run_event(self, event, context, stdin_data) -> list[HookResult]: ...
    def run_post_edit(self, tool_name, args) -> str | None: ...  # backward-compat v3
```

**Exit code protocol**: 0=ALLOW, 2=BLOCK, other=Error (warning, does not break loop).
**Env vars**: `ARCHITECT_EVENT`, `ARCHITECT_WORKSPACE`, `ARCHITECT_TOOL`, `ARCHITECT_FILE`.

### `HookRunResult` (legacy, v3-M4)

```python
@dataclass
class HookRunResult:
    hook_name:  str
    success:    bool
    output:     str    # truncated to 1000 chars
    exit_code:  int
```

`PostEditHooks` (legacy) remains available for backward compatibility.

---

## GuardrailsEngine (`core/guardrails.py`) — v4-A2

Deterministic security engine evaluated BEFORE hooks. Supports `protected_files` (write-only) and `sensitive_files` (read + write, v1.1.0).

```python
class GuardrailsEngine:
    def __init__(self, config: GuardrailsConfig, workspace_root: str): ...

    def check_file_access(self, file_path: str, action: str) -> tuple[bool, str]:
        # sensitive_files: blocks ALL actions (read + write)
        # protected_files: blocks only write actions
        ...
    def check_command(self, command: str) -> tuple[bool, str]: ...
    def check_edit_limits(self, file_path: str, lines_added: int, lines_removed: int) -> tuple[bool, str]: ...
    def check_code_rules(self, content: str, file_path: str) -> list[tuple[str, str]]: ...
    def should_force_test(self) -> bool: ...
    def run_quality_gates(self) -> list[dict]: ...
```

Internal tracking: `_files_modified`, `_lines_changed`, `_commands_executed`, `_edits_since_last_test`.

---

## Skills (`skills/loader.py`) — v4-A3

### `SkillInfo` (dataclass)

```python
@dataclass
class SkillInfo:
    name:        str
    description: str = ""
    globs:       list[str] = field(default_factory=list)
    content:     str = ""
    source:      str = ""    # "local" | "installed" | "project"
```

### `SkillsLoader`

```python
class SkillsLoader:
    def __init__(self, workspace_root: str): ...
    def load_project_context(self) -> str | None: ...       # .architect.md / AGENTS.md / CLAUDE.md
    def discover_skills(self) -> list[SkillInfo]: ...        # .architect/skills/ + installed-skills/
    def get_relevant_skills(self, file_paths: list[str]) -> list[SkillInfo]: ...
    def build_system_context(self, active_files: list[str] | None) -> str: ...
```

### `SkillInstaller`

```python
class SkillInstaller:
    def __init__(self, workspace_root: str): ...
    def install_from_github(self, repo_spec: str) -> bool: ...   # sparse checkout
    def create_local(self, name: str) -> Path: ...               # SKILL.md template
    def list_installed(self) -> list[dict[str, str]]: ...        # {name, source, path}
    def uninstall(self, name: str) -> bool: ...
```

---

## Procedural Memory (`skills/memory.py`) — v4-A4

```python
class ProceduralMemory:
    CORRECTION_PATTERNS = [
        (r"no[,.]?\s+(usa|utiliza|haz|pon|cambia|es)\b", "direct_correction"),
        (r"(eso no|eso está mal|no es correcto|está mal)", "negation"),
        (r"(en realidad|realmente|de hecho)\b", "clarification"),
        (r"(debería ser|el correcto es|el comando es)\b", "should_be"),
        (r"(no funciona así|así no)\b", "wrong_approach"),
        (r"(siempre|nunca)\s+(usa|hagas|pongas)\b", "absolute_rule"),
    ]

    def __init__(self, workspace_root: str): ...
    def detect_correction(self, user_msg: str, prev_agent_action: str | None) -> str | None: ...
    def add_correction(self, correction: str) -> None: ...    # dedup + persist
    def add_pattern(self, pattern: str) -> None: ...
    def get_context(self) -> str: ...                          # for injection into system prompt
    def analyze_session_learnings(self, conversation: list[dict]) -> list[str]: ...
```

Persists in `.architect/memory.md` with the format: `- [YYYY-MM-DD] Correction: {text}`.

---

## Local LLM Cache (`llm/cache.py`) — F14

### `LocalLLMCache`

```python
class LocalLLMCache:
    def __init__(self, cache_dir: Path, ttl_hours: int = 24): ...

    def get(
        self,
        messages: list[dict],
        tools: list[dict] | None,
    ) -> LLMResponse | None:
        # Returns LLMResponse if there is a valid hit (not expired)
        # Returns None on miss, expiration, or error — NEVER raises

    def set(
        self,
        messages: list[dict],
        tools: list[dict] | None,
        response: LLMResponse,
    ) -> None:
        # Saves response to disk — fails silently on error

    def clear(self) -> int: ...   # deletes all .json files; returns count
    def stats(self) -> dict: ...  # {entries, expired, total_size_bytes, dir}

    def _make_key(self, messages, tools) -> str:
        # SHA-256[:24] of json.dumps({"messages":..., "tools":...}, sort_keys=True)
        # Deterministic regardless of key order
```

One `.json` file per entry in `cache_dir`. TTL based on the file's `mtime`. The `LLMAdapter` queries it before calling LiteLLM and saves the response on a miss.

---

## Evaluator (`core/evaluator.py`) — F12

### `EvalResult` (dataclass)

Result of an agent evaluation by the `SelfEvaluator`.

```python
@dataclass
class EvalResult:
    completed:    bool              # Was the task completed correctly?
    confidence:   float             # confidence level [0.0, 1.0] (clamped)
    issues:       list[str] = []    # list of detected issues
    suggestion:   str = ""          # suggestion to improve the result
    raw_response: str = ""          # raw LLM response (debugging)
```

**EvalResult example with issues**:
```python
EvalResult(
    completed=False,
    confidence=0.35,
    issues=["The file tests/test_utils.py was not created", "The imports were not updated"],
    suggestion="Create the file tests/test_utils.py with pytest and update the imports in src/",
    raw_response='{"completed": false, "confidence": 0.35, ...}'
)
```

---

## Tool result (`tools/base.py`)

### `ToolResult`

The only possible return type from any tool. Exceptions are never raised.

```python
class ToolResult(BaseModel):
    success: bool
    output:  str           # always present; on failure contains error description
    error:   str | None    # technical error message (None on success)
```

---

## Tool argument models (`tools/schemas.py`)

All with `extra = "forbid"`.

### Filesystem tools

```python
class ReadFileArgs(BaseModel):
    path: str                          # relative to workspace root

class WriteFileArgs(BaseModel):
    path:    str
    content: str
    mode:    str = "overwrite"         # "overwrite" | "append"

class DeleteFileArgs(BaseModel):
    path: str

class ListFilesArgs(BaseModel):
    path:      str       = "."
    pattern:   str|None  = None        # glob (e.g.: "*.py", "**/*.md")
    recursive: bool      = False
```

### Editing tools (F9)

```python
class EditFileArgs(BaseModel):
    path:    str           # file to modify
    old_str: str           # exact text to replace (must be unique in the file)
    new_str: str           # replacement text

class ApplyPatchArgs(BaseModel):
    path:  str             # file to modify
    patch: str             # unified diff (format --- +++ @@ ...)
```

### Command execution tool (F13)

```python
class RunCommandArgs(BaseModel):
    command: str                     # command to execute (shell string)
    cwd:     str | None = None       # working directory (relative to workspace)
    timeout: int = 30                # seconds (ge=1, le=600)
    env:     dict[str, str] | None = None  # additional environment variables
```

### Search tools (F10)

```python
class SearchCodeArgs(BaseModel):
    pattern:       str            # Python regular expression
    path:          str = "."      # search directory
    file_pattern:  str = "*.py"   # glob to filter files
    context_lines: int = 2        # context lines per match
    max_results:   int = 50

class GrepArgs(BaseModel):
    pattern:        str            # literal text
    path:           str = "."
    file_pattern:   str = "*"
    recursive:      bool = True
    case_sensitive: bool = True
    max_results:    int = 100

class FindFilesArgs(BaseModel):
    pattern:   str            # filename glob (e.g.: "*.yaml")
    path:      str = "."
    recursive: bool = True
```

---

## Indexer models (`indexer/tree.py`) — F10

```python
@dataclass
class FileInfo:
    path:     Path     # path relative to workspace root
    size:     int      # bytes
    ext:      str      # extension (e.g.: ".py", ".ts", ".yaml")
    language: str      # language name (e.g.: "Python", "TypeScript")
    lines:    int      # number of lines (0 if unreadable)

@dataclass
class RepoIndex:
    root:         Path
    files:        list[FileInfo]
    total_files:  int
    total_lines:  int
    languages:    dict[str, int]   # {language: number of files}
    build_time_ms: float

    def format_tree(self) -> str:
        # Returns the workspace tree as a string for the system prompt
        # <=300 files → detailed tree with Unicode connectors
        # >300 files → compact view grouped by root directory
```

The `RepoIndexer` builds the `RepoIndex` by traversing the workspace with `os.walk()`, filtering excluded directories and files. The `IndexCache` serializes/deserializes the index in JSON with a 5-minute TTL.

---

## Sessions (`features/sessions.py`) — v4-B1

### `SessionsConfig`

```python
class SessionsConfig(BaseModel):
    auto_save:          bool = True    # save state after each step
    cleanup_after_days: int  = 7       # days after which `cleanup` deletes sessions
```

### `SessionState` (dataclass)

```python
@dataclass
class SessionState:
    session_id:      str              # format: YYYYMMDD-HHMMSS-hexhex
    task:            str              # original user prompt
    agent:           str              # agent name (build, plan, etc.)
    model:           str              # LLM model used
    status:          str              # running, success, partial, failed
    steps_completed: int              # steps executed
    messages:        list[dict]       # LLM message history
    files_modified:  list[str]        # files touched during the session
    total_cost:      float            # accumulated cost in USD
    started_at:      str              # ISO 8601 timestamp
    updated_at:      str              # ISO 8601 timestamp (updated on each save)
    stop_reason:     str | None       # stop reason (llm_done, timeout, etc.)
    metadata:        dict             # arbitrary additional data
```

Methods: `to_dict()` / `from_dict()` for JSON serialization.

Sessions with more than 50 messages are automatically truncated: the last 30 messages are preserved and `truncated: true` is set in metadata.

### `SessionManager`

```python
class SessionManager:
    def __init__(self, workspace_root: str): ...
    def save(self, state: SessionState) -> None: ...
    def load(self, session_id: str) -> SessionState | None: ...  # None if not found or corrupt JSON
    def list_sessions(self) -> list[dict]: ...                    # summarized metadata, newest first
    def cleanup(self, older_than_days: int = 7) -> int: ...       # returns count of deleted sessions
    def delete(self, session_id: str) -> bool: ...
```

### `generate_session_id`

```python
def generate_session_id() -> str:
    # Format: YYYYMMDD-HHMMSS-hexhex
    # Example: 20260223-143022-a1b2c3
```

---

## Reports (`features/report.py`) — v4-B2

### `ExecutionReport` (dataclass)

```python
@dataclass
class ExecutionReport:
    task:             str
    agent:            str
    model:            str
    status:           str                    # success, partial, failed
    duration_seconds: float
    steps:            int
    total_cost:       float
    stop_reason:      str | None = None
    files_modified:   list[dict] = field(default_factory=list)
    quality_gates:    list[dict] = field(default_factory=list)
    errors:           list[str]  = field(default_factory=list)
    git_diff:         str | None = None
    timeline:         list[dict] = field(default_factory=list)
```

### `ReportGenerator`

```python
class ReportGenerator:
    def __init__(self, report: ExecutionReport): ...
    def to_json(self) -> str: ...                  # full JSON, parseable by jq
    def to_markdown(self) -> str: ...              # Markdown with tables and sections
    def to_github_pr_comment(self) -> str: ...     # GitHub with collapsible <details>
```

### `collect_git_diff`

```python
def collect_git_diff(workspace_root: str) -> str | None:
    # Runs `git diff HEAD`, truncates to 50KB
    # Returns None if not a git repo or no changes
```

Status icons: `success` → OK, `partial` → WARN, `failed` → FAIL.

---

## Dry Run (`features/dryrun.py`) — v4-B4

### `PlannedAction` (dataclass)

```python
@dataclass
class PlannedAction:
    tool_name:   str
    description: str
    tool_input:  dict
```

### `DryRunTracker`

```python
class DryRunTracker:
    actions: list[PlannedAction]

    def record_action(self, tool_name: str, tool_input: dict) -> None: ...
    def get_plan_summary(self) -> str: ...    # formatted summary of all actions
    @property
    def action_count(self) -> int: ...
```

Constants: `WRITE_TOOLS` (frozenset) and `READ_TOOLS` (frozenset), disjoint. Only actions from `WRITE_TOOLS` are recorded in the tracker.

`_summarize_action(tool_name, tool_input)` generates readable descriptions with 5 code paths (path, command, long command, fallback keys, empty dict).

---

## Ralph Loop (`features/ralph.py`) — v4-C1

### `RalphConfig` (dataclass)

```python
@dataclass
class RalphConfig:
    task:            str                      # task/prompt for the agent
    checks:          list[str]                # shell commands that must pass (exit 0)
    max_iterations:  int   = 25              # iteration limit
    max_cost:        float | None = None     # maximum total cost in USD
    max_time:        int | None   = None     # maximum total time in seconds
    completion_tag:  str   = "COMPLETE"      # tag the agent emits when declaring completion
    agent:           str   = "build"         # agent to use in each iteration
    model:           str | None = None       # LLM model (None = config default)
    use_worktree:    bool  = False           # run in an isolated git worktree
```

### `LoopIteration` (dataclass)

```python
@dataclass
class LoopIteration:
    number:        int          # iteration number (1-based)
    status:        str          # "success", "partial", "failed"
    checks_passed: list[str]   # checks that passed
    checks_failed: list[str]   # checks that failed
    cost:          float        # USD cost of this iteration
    duration:      float        # seconds
```

### `RalphLoopResult` (dataclass)

```python
@dataclass
class RalphLoopResult:
    success:       bool                    # True if all checks passed
    iterations:    list[LoopIteration]     # iteration history
    total_cost:    float                   # total accumulated cost in USD
    total_duration: float                  # total duration in seconds
    stop_reason:   str                     # "checks_passed", "max_iterations", "max_cost", "max_time", "agent_failed"
```

### `RalphLoop`

```python
class RalphLoop:
    def __init__(
        self,
        agent_factory: Callable[..., Any],
        config: RalphConfig,
    ) -> None: ...

    def run(self) -> RalphLoopResult: ...
    def _run_checks(self, checks: list[str]) -> tuple[list[str], list[str]]: ...
    def _build_iteration_prompt(self, iteration: int, failed: list[str], outputs: dict) -> str: ...
```

### `RalphLoopConfig` (Pydantic — `config/schema.py`)

```python
class RalphLoopConfig(BaseModel):
    max_iterations: int        = 25        # 1-100
    max_cost:       float | None = None    # USD, None = no limit
    max_time:       int | None   = None    # seconds, None = no limit
    completion_tag: str        = "COMPLETE"
    agent:          str        = "build"
```

---

## Pipeline Mode (`features/pipelines.py`) — v4-C3

### `PipelineStep` (dataclass)

```python
@dataclass
class PipelineStep:
    name:       str                          # unique step name
    prompt:     str                          # prompt (supports {{variables}})
    agent:      str          = "build"       # agent to use
    model:      str | None   = None          # LLM model (None = default)
    max_steps:  int          = 50            # maximum agent steps
    condition:  str | None   = None          # shell condition (exit 0 = execute)
    output_var: str | None   = None          # capture output in variable {{name}}
    checks:     list[str]    = field(default_factory=list)  # post-step checks
    checkpoint: bool         = False         # create git checkpoint after completion
```

### `PipelineConfig` (dataclass)

```python
@dataclass
class PipelineConfig:
    name:      str                       # pipeline name
    steps:     list[PipelineStep]        # list of steps to execute
    variables: dict[str, str] = field(default_factory=dict)  # initial variables
```

### `PipelineStepResult` (dataclass)

```python
@dataclass
class PipelineStepResult:
    step_name:  str          # step name
    status:     str          # "success", "partial", "failed", "skipped"
    output:     str          # agent output
    cost:       float        # step cost in USD
    duration:   float        # seconds
```

### `PipelineRunner`

```python
class PipelineRunner:
    def __init__(
        self,
        agent_factory: Callable[..., Any],
        config: PipelineConfig,
    ) -> None: ...

    def run(self, from_step: str | None = None, dry_run: bool = False) -> list[PipelineStepResult]: ...
    def _substitute_variables(self, text: str, variables: dict) -> str: ...
    def _check_condition(self, condition: str) -> bool: ...
    def _run_checks(self, checks: list[str]) -> tuple[list[str], list[str]]: ...
    def _create_checkpoint(self, step_name: str) -> None: ...
```

---

## Parallel Runs (`features/parallel.py`) — v4-C2

### `ParallelConfig` (dataclass)

```python
@dataclass
class ParallelConfig:
    tasks:             list[str]         # tasks to execute
    workers:           int = 3           # number of parallel workers
    models:            list[str] = field(default_factory=list)  # round-robin models
    agent:             str = "build"
    budget_per_worker: float | None = None   # USD per worker
    timeout_per_worker: int | None = None    # seconds per worker
```

### `WorkerResult` (dataclass)

```python
@dataclass
class WorkerResult:
    worker_id:      int          # 1-based
    branch:         str          # "architect/parallel-1"
    model:          str          # model used
    status:         str          # "success", "partial", "failed", "timeout"
    steps:          int          # agent steps
    cost:           float        # cost in USD
    duration:       float        # seconds
    files_modified: list[str]    # changed files
    worktree_path:  str          # worktree path
```

### `ParallelRunner`

```python
class ParallelRunner:
    WORKTREE_PREFIX = ".architect-parallel"

    def __init__(
        self,
        config: ParallelConfig,
        workspace_root: str,
    ) -> None: ...

    def run(self) -> list[WorkerResult]: ...
    def cleanup_worktrees(self) -> None: ...
    def _create_worktrees(self) -> None: ...
    def _run_worker(self, worker_id: int, task: str, model: str) -> WorkerResult: ...
```

### `ParallelRunsConfig` (Pydantic — `config/schema.py`)

```python
class ParallelRunsConfig(BaseModel):
    workers:            int = 3            # 1-10
    agent:              str = "build"
    max_steps:          int = 50
    budget_per_worker:  float | None = None
    timeout_per_worker: int | None = None
```

---

## Checkpoints (`features/checkpoints.py`) — v4-C4

### `Checkpoint` (dataclass)

```python
@dataclass(frozen=True)
class Checkpoint:
    step:          int          # step number
    commit_hash:   str          # full git hash
    message:       str          # descriptive message
    timestamp:     float        # Unix timestamp
    files_changed: list[str]    # modified files

    def short_hash(self) -> str:
        return self.commit_hash[:7]
```

### `CheckpointManager`

```python
CHECKPOINT_PREFIX = "architect:checkpoint"

class CheckpointManager:
    def __init__(self, workspace_root: str) -> None: ...
    def create(self, step: int, message: str = "") -> Checkpoint | None: ...  # None if no changes
    def list_checkpoints(self) -> list[Checkpoint]: ...  # most recent first
    def rollback(self, step: int | None = None, commit: str | None = None) -> bool: ...
    def get_latest(self) -> Checkpoint | None: ...
    def has_changes_since(self, commit_hash: str) -> bool: ...
```

### `CheckpointsConfig` (Pydantic — `config/schema.py`)

```python
class CheckpointsConfig(BaseModel):
    enabled:       bool = False    # True = enable automatic checkpoints
    every_n_steps: int  = 5        # 1-50
```

---

## Auto-Review (`agents/reviewer.py`) — v4-C5

### `ReviewResult` (dataclass)

```python
@dataclass
class ReviewResult:
    has_issues:  bool       # True if issues were found
    review_text: str        # full review text
    cost:        float      # review cost in USD
```

### `AutoReviewer`

```python
class AutoReviewer:
    def __init__(
        self,
        agent_factory: Callable[..., Any],
        review_model: str | None = None,
    ) -> None: ...

    def review_changes(self, task: str, git_diff: str) -> ReviewResult: ...

    @staticmethod
    def build_fix_prompt(review_text: str) -> str: ...

    @staticmethod
    def get_recent_diff(workspace_root: str, commits_back: int = 1) -> str: ...
```

### `AutoReviewConfig` (Pydantic — `config/schema.py`)

```python
class AutoReviewConfig(BaseModel):
    enabled:        bool = False       # True = enable auto-review
    review_model:   str | None = None  # model for the reviewer (None = same as builder)
    max_fix_passes: int = 1            # 0-3 (0 = report only)
```

### `TelemetryConfig` (Pydantic — `config/schema.py`, v1.0.0)

```python
class TelemetryConfig(BaseModel):
    enabled:    bool = False                         # True = enable OpenTelemetry traces
    exporter:   str = "console"                      # "otlp" | "console" | "json-file"
    endpoint:   str = "http://localhost:4317"        # gRPC endpoint for OTLP
    trace_file: str | None = None                    # file path for json-file
```

### `HealthConfig` (Pydantic — `config/schema.py`, v1.0.0)

```python
class HealthConfig(BaseModel):
    enabled:          bool = False                   # True = automatic analysis
    include_patterns: list[str] = ["**/*.py"]        # file patterns to analyze
    exclude_dirs:     list[str] = [".git", "venv", "__pycache__", "node_modules"]
```

### `HealthSnapshot` (dataclass — `core/health.py`, v1.0.0)

```python
@dataclass
class HealthSnapshot:
    files_analyzed: int
    total_functions: int
    avg_complexity: float
    max_complexity: int
    long_functions: int           # > 50 lines
    duplicate_blocks: int         # duplicate blocks
    functions: list[FunctionMetric]
```

### `HealthDelta` (dataclass — `core/health.py`, v1.0.0)

```python
@dataclass
class HealthDelta:
    before: HealthSnapshot
    after: HealthSnapshot
    def to_report(self) -> str: ...  # markdown table
```

### `FunctionMetric` (frozen dataclass — `core/health.py`, v1.0.0)

```python
@dataclass(frozen=True)
class FunctionMetric:
    file: str
    name: str
    lines: int
    complexity: int
```

### `CompetitiveConfig` (dataclass — `features/competitive.py`, v1.0.0)

```python
@dataclass
class CompetitiveConfig:
    task: str
    models: list[str]
    checks: list[str]
    agent: str = "build"
    max_steps: int = 50
    budget_per_model: float | None = None
    timeout_per_model: int | None = None
    config_path: str | None = None
    api_base: str | None = None
```

### `CompetitiveResult` (dataclass — `features/competitive.py`, v1.0.0)

```python
@dataclass
class CompetitiveResult:
    model: str
    status: str                   # success | partial | failed | timeout
    steps: int
    cost: float
    duration: float
    files_modified: list[str]
    checks_passed: int
    checks_total: int
    worktree_path: str
    score: float                  # 0-100
```

### `DispatchSubagentArgs` (Pydantic — `tools/dispatch.py`, v1.0.0)

```python
class DispatchSubagentArgs(BaseModel):
    agent_type: str     # "explore" | "test" | "review"
    task: str           # sub-task description
    context: str = ""   # additional context
```

---

## Error hierarchy

```
Exception
├── MCPError                        mcp/client.py
│   ├── MCPConnectionError          HTTP connection error to the MCP server
│   └── MCPToolCallError            error in remote tool execution
│
├── PathTraversalError              execution/validators.py
│   # Attempt to access outside the workspace (../../etc/passwd)
│
├── ValidationError                 execution/validators.py
│   # File or directory not found during validation
│
├── PatchError                      tools/patch.py
│   # Error parsing or applying a unified diff in apply_patch
│
├── NoTTYError                      execution/policies.py
│   # Interactive confirmation needed but no TTY available (CI/headless)
│
├── ToolNotFoundError               tools/registry.py
│   # Requested tool not registered in the registry
│
├── DuplicateToolError              tools/registry.py
│   # Attempt to register a tool with an already existing name (without allow_override=True)
│
├── AgentNotFoundError              agents/registry.py
│   # Agent name not found in DEFAULT_AGENTS or in YAML
│
├── StepTimeoutError(TimeoutError)  core/timeout.py
│   # Agent step exceeded the configured maximum time
│   # .seconds: int — time in seconds that was exceeded
│
├── BudgetExceededError             costs/tracker.py
│   # Total session cost exceeded the configured budget_usd
│   # Raised by CostTracker.record() → caught by AgentLoop → state.status="partial"
│
├── GuardrailViolation              core/guardrails.py       # v4-A2
│   # Deterministic guardrail violation (file access, command block, edit limits)
│   # Caught by ExecutionEngine → ToolResult(success=False)
│
└── BlockedCommandError             tools/commands.py
    # Command in the static blocklist (always blocked)
```

These exceptions are for internal signaling -- most are caught in `ExecutionEngine` or `AgentLoop` and converted into a `ToolResult(success=False)` or an agent status change, respectively. **None of them should propagate to the end user.**
