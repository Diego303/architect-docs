---
title: "Logging System"
description: "3 pipelines, HUMAN level, icons, HumanFormatter, structlog."
icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
order: 11
---

# Logging system

Describes the full logging architecture of the project: three independent pipelines, the custom HUMAN level, the visual format with icons, and the integration with the agent loop.

---

## Architecture: three pipelines

The system uses **structlog** on top of the Python stdlib with three independent pipelines. Each one has its own handler, level, and format.

```
structlog.configure(
    processors=[..., wrap_for_formatter],  <- always wrap_for_formatter
    logger_factory=LoggerFactory(),        <- stdlib loggers
)
    |
    v
logging.root
    |-- [1] FileHandler        (JSON Lines, DEBUG+)       <- only if --log-file
    |-- [2] HumanLogHandler    (stderr, HUMAN=25 only)    <- always active (except --quiet/--json)
    +-- [3] StreamHandler      (stderr, WARNING+ / -v)    <- technical console, excludes HUMAN
```

### Pipeline 1 -- JSON file (optional)

Activated with `--log-file PATH`. Captures **all** events (DEBUG+) in JSON Lines format.

```bash
architect run "..." --log-file logs/session.jsonl
cat logs/session.jsonl | jq 'select(.event == "agent.tool_call.execute")'
```

### Pipeline 2 -- Human handler (agent traceability)

Active by default. Only processes events at `HUMAN` level (25). Produces readable output with icons on stderr.

```
🔄 Step 1 → LLM call (5 messages)
   ✓ LLM responded with 2 tool calls

   🔧 read_file → src/main.py
      ✓ OK

   🔧 edit_file → src/main.py (3→5 lines)
      ✓ OK
      🔍 Hook python-lint: ✓

🔄 Step 2 → LLM call (9 messages)
   ✓ LLM responded with final text

✅ Agent completed (2 steps)
   Reason: LLM decided it was done
   Cost: $0.0042
```

Disabled with `--quiet` or `--json`.

### Pipeline 3 -- Technical console

Controlled by `-v` / `-vv` / `-vvv`. Shows technical logs (INFO/DEBUG) on stderr. **Excludes** HUMAN events to avoid duplicates.

| Flag | Level | What it shows |
|------|-------|------------|
| (no -v) | WARNING | Problems only |
| `-v` | INFO | System operations, config, registrations |
| `-vv` | DEBUG | Full args, LLM responses, timing |
| `-vvv` | DEBUG | Everything, including HTTP |

---

## HUMAN level (25)

Custom level between INFO (20) and WARNING (30):

```python
# logging/levels.py
HUMAN = 25
logging.addLevelName(HUMAN, "HUMAN")
```

HUMAN events represent the **agent traceability** -- what it is doing step by step. They are not technical logs but information for the end user.

---

## HumanFormatter -- visual event formatting

Each event type has its own format with icons:

### Loop events

| Event | Format | Icon |
|--------|---------|-------|
| `agent.llm.call` | `🔄 Step N → LLM call (M messages)` | 🔄 |
| `agent.llm.response` (tools) | `✓ LLM responded with N tool calls` | ✓ |
| `agent.llm.response` (text) | `✓ LLM responded with final text` | ✓ |
| `agent.complete` | `✅ Agent completed (N steps)` + reason + cost | ✅ |

### Tool events

| Event | Format | Icon |
|--------|---------|-------|
| `agent.tool_call.execute` (local) | `🔧 tool → args_summary` | 🔧 |
| `agent.tool_call.execute` (MCP) | `🌐 tool → summary (MCP: server)` | 🌐 |
| `agent.tool_call.complete` (ok) | `✓ OK` | ✓ |
| `agent.tool_call.complete` (error) | `✗ ERROR: message` | ✗ |
| `agent.hook.complete` (named) | `🔍 Hook name: ✓/⚠️ detail` | 🔍 |

### Safety nets

| Event | Format | Icon |
|--------|---------|-------|
| `safety.user_interrupt` | `⚠️ Interrupted by user` | ⚠️ |
| `safety.max_steps` | `⚠️ Step limit reached (N/M)` | ⚠️ |
| `safety.budget_exceeded` | `⚠️ Budget exceeded ($X/$Y)` | ⚠️ |
| `safety.timeout` | `⚠️ Timeout reached` | ⚠️ |
| `safety.context_full` | `⚠️ Context full` | ⚠️ |

### Errors and lifecycle

| Event | Format | Icon |
|--------|---------|-------|
| `agent.llm_error` | `❌ LLM error: message` | ❌ |
| `agent.step_timeout` | `⚠️ Step timeout (Ns)` | ⚠️ |
| `agent.closing` | `🔄 Closing (reason, N steps)` | 🔄 |
| `agent.loop.complete` (success) | `(N steps, M tool calls)` + cost | -- |
| `agent.loop.complete` (partial) | `⚡ Stopped (status -- reason, N steps)` | ⚡ |

### Context

| Event | Format | Icon |
|--------|---------|-------|
| `context.compressing` | `📦 Compressing context -- N exchanges` | 📦 |
| `context.window_enforced` | `📦 Context window: removed N messages` | 📦 |

---

## Args summarizer (`_summarize_args`)

Each tool has an optimized summary so the user can understand at a glance what the agent is doing:

| Tool | Summary example |
|------|-------------------|
| `read_file` | `src/main.py` |
| `write_file` | `src/main.py (42 lines)` |
| `edit_file` | `src/main.py (3→5 lines)` |
| `apply_patch` | `src/main.py (+5 -3)` |
| `search_code` | `"validate_path" in src/` |
| `grep` | `"import jwt" in src/` |
| `run_command` | `pytest tests/ -x` |
| MCP tools | first argument truncated to 60 chars |
| Unknown tool without args | `(no args)` |

---

## HumanLog -- typed helper

The `AgentLoop` emits HUMAN events through `HumanLog`, which provides typed methods:

```python
hlog = HumanLog(structlog.get_logger())

hlog.llm_call(step=0, messages_count=5)          # 🔄 Step 1 → LLM (5 messages)
hlog.llm_response(tool_calls=2)                   # ✓ LLM responded with 2 tool calls
hlog.tool_call("read_file", {"path": "main.py"})  # 🔧 read_file → main.py
hlog.tool_call("mcp_docs_search", {"q": "..."}, is_mcp=True, mcp_server="docs")
                                                    # 🌐 mcp_docs_search → ... (MCP: docs)
hlog.tool_result("read_file", success=True)        # ✓ OK
hlog.hook_complete("edit_file", hook="ruff", success=True)
                                                    # 🔍 Hook ruff: ✓
hlog.agent_done(step=3, cost="$0.0042")            # ✅ Agent completed (3 steps)
hlog.safety_net("max_steps", step=50, max_steps=50)
                                                    # ⚠️ Step limit reached
hlog.closing("max_steps", steps=50)                # 🔄 Closing (max_steps, 50 steps)
hlog.llm_error("timeout")                          # ❌ LLM error: timeout
hlog.step_timeout(seconds=60)                      # ⚠️ Step timeout (60s)
hlog.loop_complete("success", None, 3, 5)          # (3 steps, 5 tool calls)
```

---

## HumanLogHandler -- structured event extraction

`HumanLogHandler` is a stdlib `logging.Handler` that:

1. Filters only events at the exact `HUMAN` level (25)
2. Extracts the event dict from `record.msg` (placed by `wrap_for_formatter`)
3. Passes the event to `HumanFormatter.format_event()`
4. Writes the formatted result to stderr

### Event dict extraction

When structlog uses `wrap_for_formatter`, the event dict is stored as a `dict` in `record.msg`:

```python
def emit(self, record):
    if isinstance(record.msg, dict) and not record.args:
        # structlog event: extract from dict
        event = record.msg["event"]        # "agent.llm.call"
        kw = {k: v for k, v in record.msg.items() if k not in _STRUCTLOG_META}
    else:
        # Fallback: extract from record attributes
        event = getattr(record, "event", None) or record.getMessage()
```

The filtered structlog fields (`_STRUCTLOG_META`) are: `event`, `level`, `log_level`, `logger`, `logger_name`, `timestamp`. These are processor metadata, not event kwargs.

---

## Configuration (`logging/setup.py`)

### `configure_logging(config, json_output, quiet)`

```python
def configure_logging(config: LoggingConfig, json_output=False, quiet=False):
    # 1. Clear previous configuration
    logging.root.handlers.clear()
    structlog.reset_defaults()

    # 2. Pipeline 1: JSON file (if config.file is set)
    if config.file:
        file_handler = FileHandler(config.file)
        file_handler.setFormatter(ProcessorFormatter(processor=JSONRenderer()))
        logging.root.addHandler(file_handler)

    # 3. Pipeline 2: Human handler (if not --quiet or --json)
    if show_human:
        human_handler = HumanLogHandler(stream=sys.stderr)
        human_handler.setLevel(HUMAN)
        human_handler.addFilter(lambda r: r.levelno == HUMAN)
        logging.root.addHandler(human_handler)

    # 4. Pipeline 3: Technical console (if not --quiet or --json)
    if show_console:
        console_handler = StreamHandler(sys.stderr)
        console_handler.setLevel(_verbose_to_level(config.verbose))
        console_handler.addFilter(lambda r: r.levelno != HUMAN)  # exclude HUMAN
        console_handler.setFormatter(ProcessorFormatter(processor=ConsoleRenderer()))
        logging.root.addHandler(console_handler)

    # 5. structlog: ALWAYS wrap_for_formatter
    structlog.configure(
        processors=[..., wrap_for_formatter],
        logger_factory=LoggerFactory(),
    )
```

### Why always `wrap_for_formatter`

The final structlog processor is **always** `ProcessorFormatter.wrap_for_formatter`, regardless of whether `--log-file` is used or not. This ensures events flow as structured dicts through the stdlib handler system, which allows `HumanLogHandler` to extract the event dict from `record.msg`.

If `ConsoleRenderer` were used directly in the processor chain (as was done before v0.15.3), events would be rendered to plain text before reaching the handlers, and `HumanLogHandler` would not be able to extract the event names to format them.

---

## Verbose levels

| Verbose | Console level | What the user sees |
|---------|--------------|-------------------|
| 0 (default) | WARNING | Only HUMAN logs (agent steps) + errors |
| 1 (`-v`) | INFO | HUMAN + system operations |
| 2 (`-vv`) | DEBUG | HUMAN + all technical detail |
| 3+ (`-vvv`) | DEBUG | HUMAN + HTTP + payloads |

HUMAN logs are shown **always** (except with `--quiet` / `--json`), regardless of `-v`.

---

## Relationship with OpenTelemetry (v1.0.0)

Starting with v1.0.0, architect supports OpenTelemetry traces as a complement to structured logging. Traces and logs are **independent systems**:

| System | Purpose | Configuration |
|---------|-----------|---------------|
| **Logging (structlog)** | Agent events, debugging, human output | `logging:` in config + `-v` flags |
| **Telemetry (OpenTelemetry)** | Session/LLM/tool spans for observability | `telemetry:` in config |

Logs go to stderr (human/technical) and JSON file. Traces go to OTLP, console, or a separate JSON file. They do not mix.

See [`telemetry.md`](/architect-docs/en/docs/v1-0-0/telemetry) for OpenTelemetry configuration.

---

## Module files

| File | Contents |
|---------|-----------|
| `logging/levels.py` | Definition of `HUMAN = 25` |
| `logging/human.py` | `HumanFormatter`, `HumanLogHandler`, `HumanLog`, `_summarize_args` |
| `logging/setup.py` | `configure_logging()`, `configure_logging_basic()`, `get_logger()` |
| `telemetry/otel.py` | `ArchitectTracer`, `NoopTracer` (independent system) |
