---
title: "OpenTelemetry Traces"
description: "Session, LLM, and tool spans: OTLP, console, JSON file exporters."
icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
order: 28
---

# OpenTelemetry Traces

Optional tracing with OpenTelemetry to monitor sessions, LLM calls, and tool execution.

Implemented in `src/architect/telemetry/otel.py`. Available since v1.0.0 (Base plan v4 Phase D — D4).

> **Requirement**: This module requires the `telemetry` extra. Install with:
> ```bash
> pip install architect-ai-cli[telemetry]
> ```
> Without this extra, a transparent `NoopTracer` is used with no performance impact.

---

## Concept

The `ArchitectTracer` emits OpenTelemetry spans at three levels:

1. **Session span**: encompasses the entire execution (`architect run "..."`)
2. **LLM call spans**: each model call (tokens, cost, model)
3. **Tool spans**: each tool execution (name, success, duration)

If OpenTelemetry is not installed, a transparent `NoopTracer` is used with no performance impact.

---

## Configuration

### YAML Config

```yaml
telemetry:
  enabled: true
  exporter: otlp                        # otlp | console | json-file
  endpoint: http://localhost:4317       # for otlp (gRPC)
  trace_file: .architect/traces.json    # for json-file
```

### Optional dependencies

```bash
# Install the telemetry extra
pip install architect-ai-cli[telemetry]

# Or install manually
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp
```

---

## Exporters

### OTLP (OpenTelemetry Protocol)

Sends spans via gRPC to the configured endpoint. Compatible with:
- **Jaeger** (tracing backend)
- **Grafana Tempo** (observability)
- **Datadog**, **Honeycomb**, **Lightstep**, etc.
- Any OpenTelemetry collector

```yaml
telemetry:
  enabled: true
  exporter: otlp
  endpoint: http://localhost:4317   # collector or Jaeger
```

### Console

Prints formatted spans to stderr. Ideal for debugging.

```yaml
telemetry:
  enabled: true
  exporter: console
```

### JSON File

Writes spans as JSON to a file. Useful for offline analysis.

```yaml
telemetry:
  enabled: true
  exporter: json-file
  trace_file: .architect/traces.json
```

---

## Semantic attributes

The [GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) from OpenTelemetry are used:

### Session span

| Attribute | Description |
|-----------|-------------|
| `architect.task` | User task (first 200 chars) |
| `architect.agent` | Agent name |
| `gen_ai.request.model` | LLM model |
| `architect.session_id` | Session ID |

### LLM call span

| Attribute | Description |
|-----------|-------------|
| `gen_ai.request.model` | Model used |
| `gen_ai.usage.input_tokens` | Input tokens |
| `gen_ai.usage.output_tokens` | Output tokens |
| `gen_ai.usage.cost` | Cost in USD |
| `architect.step` | Step number |

### Tool span

| Attribute | Description |
|-----------|-------------|
| `architect.tool_name` | Tool name |
| `architect.tool_success` | Whether it executed successfully |
| `architect.tool_duration_ms` | Duration in milliseconds |

---

## API

### `create_tracer()`

Factory that returns `ArchitectTracer` or `NoopTracer` based on configuration and OpenTelemetry availability.

```python
def create_tracer(
    enabled: bool = False,
    exporter: str = "console",
    endpoint: str = "http://localhost:4317",
    trace_file: str | None = None,
) -> ArchitectTracer | NoopTracer:
```

### `ArchitectTracer`

```python
class ArchitectTracer:
    def start_session(self, task: str, agent: str, model: str, session_id: str = "") -> ContextManager:
        """Session-level span."""

    def trace_llm_call(self, model: str, tokens_in: int, tokens_out: int, cost: float, step: int) -> ContextManager:
        """Span per LLM call."""

    def trace_tool(self, tool_name: str, success: bool, duration_ms: float, **attrs) -> ContextManager:
        """Span per tool execution."""

    def shutdown(self) -> None:
        """Flush and close the tracer provider."""
```

### `NoopTracer` / `NoopSpan`

No-op implementation for when OpenTelemetry is not available:

```python
class NoopSpan:
    def set_attribute(self, key, value): pass
    def __enter__(self): return self
    def __exit__(self, *args): pass

class NoopTracer:
    def start_session(self, **kwargs): return NoopSpan()
    def trace_llm_call(self, **kwargs): return NoopSpan()
    def trace_tool(self, **kwargs): return NoopSpan()
    def shutdown(self): pass
```

### Constants

```python
SERVICE_NAME = "architect"
SERVICE_VERSION = "1.0.0"
```

---

## Wiring in CLI

```python
# In cli.py (run command)
tracer = create_tracer(
    enabled=config.telemetry.enabled,
    exporter=config.telemetry.exporter,
    endpoint=config.telemetry.endpoint,
    trace_file=config.telemetry.trace_file,
)

with tracer.start_session(task=prompt, agent=agent_name, model=model, session_id=session_id):
    state = loop.run(prompt, stream=use_stream)

tracer.shutdown()
```

---

## Example with Jaeger

```bash
# Start Jaeger
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest

# Configure architect
cat > config.yaml << 'EOF'
telemetry:
  enabled: true
  exporter: otlp
  endpoint: http://localhost:4317
EOF

# Run with telemetry
architect run "refactor utils.py" -c config.yaml --mode yolo

# View traces in Jaeger UI
open http://localhost:16686
# → Service "architect" → search for recent traces
```

---

## Files

| File | Contents |
|------|----------|
| `src/architect/telemetry/__init__.py` | Module exports |
| `src/architect/telemetry/otel.py` | `ArchitectTracer`, `NoopTracer`, `NoopSpan`, `create_tracer()` |
| `src/architect/config/schema.py` | `TelemetryConfig` (Pydantic model) |
| `src/architect/cli.py` | Wiring: `create_tracer()` + `start_session()` + `shutdown()` |
| `tests/test_telemetry/test_telemetry.py` | 20 tests (9 skipped without OpenTelemetry) |
| `tests/test_bugfixes/test_bugfixes.py` | BUG-5 tests (wiring) |
