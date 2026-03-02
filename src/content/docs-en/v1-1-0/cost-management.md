---
title: "Cost Management"
description: "CostTracker, per-model pricing, budgets, prompt caching, local cache, optimization."
icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
order: 34
---

# Cost Management in Architect CLI

## Introduction

Calls to language models (LLMs) have a direct cost measured in tokens consumed. In workflows where an autonomous agent executes dozens of steps, each with thousands of context tokens, spending can scale rapidly if it is not monitored and controlled.

Architect CLI includes a comprehensive cost management system that covers three needs:

1. **Tracking**: recording the exact cost of each LLM call, broken down by model, tokens, and source.
2. **Budget**: setting spending limits per execution with graceful shutdown when exceeded.
3. **Optimization**: reducing costs through prompt caching, model selection, and local development cache.

This document explains how each component works, how to configure it, and how to apply optimization strategies to keep costs under control.

---

## How cost tracking works

### CostTracker: per-step recording

The core of the system is `CostTracker` (in `src/architect/costs/tracker.py`). Every time the agent makes an LLM call, the tracker records a `StepCost` with the following information:

- **step**: agent step number
- **model**: model used (e.g., `gpt-4o`, `claude-sonnet-4-6`)
- **input_tokens**: input tokens (full prompt)
- **output_tokens**: output tokens (model response)
- **cached_tokens**: tokens served from the provider cache (reduced cost)
- **cost_usd**: calculated cost in dollars
- **source**: call origin: `"agent"` (main loop), `"eval"` (self-evaluation), or `"summary"` (context compression)

```python
# Internal example: how the agent records each call
cost_tracker.record(
    step=5,
    model="gpt-4o",
    usage={"prompt_tokens": 8500, "completion_tokens": 1200, "cache_read_input_tokens": 3000},
    source="agent",
)
```

### PriceLoader: price resolution

`PriceLoader` (in `src/architect/costs/prices.py`) resolves the price for each model following a priority order:

1. **Exact match**: the model name matches a key in the pricing table.
2. **Prefix match**: the model starts with a registered key (e.g., `gpt-4o-2024-08-06` matches `gpt-4o`).
3. **Base name match**: the base prefix is extracted and a match is searched.
4. **Generic fallback**: if no match is found, conservative prices of $3.00 / $15.00 per million tokens (input/output) are applied.

Prices are loaded from `src/architect/costs/default_prices.json` at startup. Optionally, they can be overridden with a custom file via configuration.

### Token counting: input, output, and cached

The cost of a call is calculated with this formula:

```
cost = (non_cached_tokens / 1M) * input_price
     + (cached_tokens / 1M)     * cached_input_price
     + (output_tokens / 1M)     * output_price
```

Where `non_cached_tokens = input_tokens - cached_tokens`.

If the model does not have a cached input price defined, cached tokens are charged at the normal input price.

### BudgetExceededError: graceful shutdown

When the accumulated cost exceeds the configured budget (`budget_usd`), the tracker raises `BudgetExceededError`. The agent loop catches this exception and performs a graceful shutdown:

- Agent execution is stopped.
- The partial result is returned with `status: "partial"`.
- The cost summary is included in the output.

Additionally, there is a warning threshold (`warn_at_usd`) that emits a log warning when reached, without stopping execution. This allows configuring alerts before the full budget is exhausted.

---

## Per-model pricing table

Prices updated as of February 2026. All values are in USD per million tokens.

| Model | Input $/1M | Output $/1M | Cached Input $/1M |
|---|---:|---:|---:|
| **OpenAI** | | | |
| `gpt-4o` | 2.50 | 10.00 | 1.25 |
| `gpt-4o-mini` | 0.15 | 0.60 | 0.075 |
| `gpt-4.1` | 2.00 | 8.00 | 0.50 |
| `gpt-4.1-mini` | 0.40 | 1.60 | 0.10 |
| `gpt-4.1-nano` | 0.10 | 0.40 | 0.025 |
| `o1` | 15.00 | 60.00 | 7.50 |
| `o1-mini` | 1.10 | 4.40 | 0.55 |
| `o3-mini` | 1.10 | 4.40 | 0.55 |
| **Anthropic** | | | |
| `claude-opus-4-6` | 15.00 | 75.00 | 1.50 |
| `claude-sonnet-4-6` | 3.00 | 15.00 | 0.30 |
| `claude-haiku-4-5` | 0.80 | 4.00 | 0.08 |
| `claude-opus-4` | 15.00 | 75.00 | 1.50 |
| `claude-sonnet-4` | 3.00 | 15.00 | 0.30 |
| `claude-haiku-4` | 0.80 | 4.00 | 0.08 |
| `claude-3-5-sonnet` | 3.00 | 15.00 | 0.30 |
| `claude-3-5-haiku` | 0.80 | 4.00 | 0.08 |
| **Google** | | | |
| `gemini/gemini-2.0-flash` | 0.10 | 0.40 | 0.025 |
| `gemini/gemini-2.5-pro` | 1.25 | 10.00 | 0.315 |
| `gemini/gemini-1.5-pro` | 1.25 | 5.00 | 0.3125 |
| **DeepSeek** | | | |
| `deepseek/deepseek-chat` | 0.27 | 1.10 | 0.07 |
| `deepseek/deepseek-reasoner` | 0.55 | 2.19 | 0.14 |
| **Other** | | | |
| `ollama` (local) | 0.00 | 0.00 | 0.00 |
| `together_ai` | 0.90 | 0.90 | -- |
| *(generic fallback)* | 3.00 | 15.00 | -- |

### Model selection guide by task type

| Task | Recommended model | Reason |
|---|---|---|
| Code review, linting | `gpt-4o-mini`, `claude-haiku-4-5`, `gemini-2.0-flash` | Simple tasks that do not require deep reasoning |
| Planning, design | `gpt-4o`, `claude-sonnet-4-6`, `gemini-2.5-pro` | Good balance between quality and cost |
| Complex refactoring | `gpt-4.1`, `claude-sonnet-4-6` | High code quality at moderate cost |
| Critical architecture | `claude-opus-4-6`, `o1` | Maximum reasoning capability |
| Iterative development | `ollama` (local) | Zero cost, ideal for experimentation |
| Low-cost tasks | `gpt-4.1-nano`, `deepseek/deepseek-chat` | Ultra-low cost for simple tasks |

---

## Cost configuration

### YAML configuration

In the project's `architect.yaml` file:

```yaml
costs:
  enabled: true               # Enable/disable cost tracking (default: true)
  budget_usd: 1.00            # Spending limit in USD per execution (null = no limit)
  warn_at_usd: 0.75           # Warning threshold (log warning when reached)
  prices_file: ./my_prices.json  # JSON file with custom prices (optional)
```

**`costs.enabled`**: when `true` (default), the cost of each LLM call is recorded. If disabled, no costs are calculated and no budget is enforced.

**`costs.budget_usd`**: maximum spending limit in dollars per execution. If the accumulated cost exceeds it, the agent stops with `status: "partial"`. Setting it to `null` (default) disables the limit.

**`costs.warn_at_usd`**: warning threshold. When accumulated spending reaches this value, a log warning is emitted. It does not stop execution. Useful for anticipating that the budget is running out.

**`costs.prices_file`**: path to a JSON file with custom prices. It has the same format as `default_prices.json`. Custom prices override the defaults for the specified models.

### CLI flags

```bash
# Set budget from the command line
architect run "refactoriza el modulo auth" --budget 0.50

# Show cost summary at the end
architect run "genera tests" --show-costs

# Combine budget and cost display
architect run "refactoriza todo" --budget 0.50 --show-costs
```

| Flag | Description |
|---|---|
| `--budget FLOAT` | Spending limit in USD for this execution |
| `--show-costs` | Show cost summary at the end |

The `--budget` flag overrides the `costs.budget_usd` value from the YAML file for that execution.

### Environment variables

Architect supports the following environment variables relevant to costs:

| Variable | Effect |
|---|---|
| `ARCHITECT_MODEL` | Overrides the default model (`llm.model`) |
| `ARCHITECT_API_BASE` | Overrides the API base URL (`llm.api_base`) |

To use a local model via Ollama:

```bash
export ARCHITECT_MODEL=ollama/llama3
export ARCHITECT_API_BASE=http://localhost:11434
architect run "tu tarea" --show-costs
# Cost: $0.0000
```

---

## Prompt caching -- reduce costs by up to 90%

### How it works

Prompt caching is a feature provided by LLM providers (primarily Anthropic) that allows caching the system prompt between consecutive calls. In a typical agent flow, the system prompt is identical across all steps; only the history messages change.

When prompt caching is active, Architect adds `cache_control` to the system message. The provider caches that content and serves it from cache in subsequent calls at a significantly reduced price.

**Typical savings**: Anthropic models charge cached input at 10% of the normal price. This means a 5,000-token system prompt reused 20 times costs ~90% less than without caching.

### Supported providers

| Provider | Support | Savings ratio |
|---|---|---|
| Anthropic (Claude) | Full | ~90% on cached tokens |
| OpenAI (GPT-4o) | Full | ~50% on cached tokens |
| Google (Gemini) | Full | ~75% on cached tokens |
| DeepSeek | Full | ~74% on cached tokens |
| Ollama (local) | N/A | Cost is always $0 |

### Configuration

```yaml
llm:
  model: claude-sonnet-4-6
  prompt_caching: true   # Enable prompt caching (default: false)
```

### When to use it

- **Recommended**: projects where Architect is executed repeatedly with the same system prompt (iterative development, CI/CD).
- **Especially useful**: with Anthropic models where savings reach ~90%.
- **Impact**: greatest in long executions (many steps) where the system prompt is repeated in each call.
- **No effect**: with local models (Ollama) where cost is already $0.

**Savings example**: with `claude-sonnet-4-6` and a 4,000-token system prompt in a 15-step execution:

- Without caching: 15 * 4,000 = 60,000 tokens at $3.00/M = $0.18
- With caching: 4,000 at $3.00/M + 14 * 4,000 at $0.30/M = $0.012 + $0.0168 = $0.029
- **Savings: ~84%** on system prompt cost

---

## Local LLM response cache

### What it is

`LocalLLMCache` (in `src/architect/llm/cache.py`) is a deterministic on-disk cache that stores complete LLM responses. When the messages and tools of a call are identical to a previous call, the cached response is returned without making any API call.

**Important**: this cache is exclusively for development. It should not be used in production because cached responses do not reflect changes in the project context.

### How it works

1. A SHA-256 key is generated from the canonical JSON of `(messages, tools)`.
2. A `{hash}.json` file is looked up in the cache directory.
3. If it exists and has not expired (TTL), the stored response is returned.
4. If it does not exist or has expired, the LLM call is made and the response is saved.

Cache failures are silent: they never break the agent flow.

### YAML configuration

```yaml
llm_cache:
  enabled: false              # Enable local cache (default: false)
  dir: ~/.architect/cache     # Storage directory
  ttl_hours: 24               # Validity hours for each entry (1-8760)
```

### CLI flags

```bash
# Enable local cache for this execution
architect run "genera tests" --cache

# Disable cache even if enabled in YAML
architect run "genera tests" --no-cache

# Clear all cache before executing
architect run "genera tests" --cache-clear
```

| Flag | Description |
|---|---|
| `--cache` | Enable local LLM cache for this execution |
| `--no-cache` | Disable local cache even if enabled in config |
| `--cache-clear` | Delete all cache entries before executing |

### When to use it

- **Iterative development**: when testing the same prompt repeatedly and wanting to avoid paying for each test.
- **Debugging**: to reproduce exact agent behaviors.
- **Not in production**: cached responses do not account for changes in project files.
- **Not with dynamic prompts**: if the prompt changes on every execution, the cache will have a very low hit rate.

---

## Cost estimates by task type

Estimates assume the use of `gpt-4o` as the main model. Actual costs vary depending on project complexity, file sizes, and prompt quality.

| Task type | Typical steps | Estimated cost | Recommended model | Suggested budget |
|---|:---:|---:|---|---:|
| Simple code review | 3-5 | $0.01 - $0.05 | `gpt-4o-mini` | $0.10 |
| Planning | 3-5 | $0.03 - $0.10 | `gpt-4o` | $0.20 |
| Small code change | 5-10 | $0.05 - $0.20 | `gpt-4o` | $0.50 |
| Test generation | 8-15 | $0.10 - $0.40 | `gpt-4o` | $0.75 |
| Documentation | 5-10 | $0.05 - $0.15 | `gpt-4o-mini` | $0.30 |
| Complex refactoring | 15-30 | $0.20 - $1.00 | `claude-sonnet-4-6` | $2.00 |
| Large new feature | 20-40 | $0.50 - $2.00 | `gpt-4.1` | $3.00 |

**Note**: these costs are for a single agent execution. Advanced features (Ralph Loop, Parallel, etc.) multiply these values as described in the following section.

---

## Cost multipliers in advanced features

Advanced Architect features execute multiple LLM calls internally. It is crucial to account for these multipliers when setting budgets.

### Ralph Loop (iterations)

Each Ralph Loop iteration executes a complete agent from scratch (clean context). The cost is multiplied by the number of iterations.

```
ralph_cost = base_cost * N_iterations
```

Example: a task with a base cost of $0.30 and `--max-iterations 5` can cost up to $1.50.

```bash
architect loop "implementa feature X" --check "pytest" --max-iterations 5 --budget 2.00
```

### Parallel (workers)

Each worker in parallel execution is a complete `architect run` subprocess in an isolated git worktree. The cost is multiplied by the number of workers.

```
parallel_cost = base_cost * N_workers
```

Example: 3 workers with a base cost of $0.20 each = $0.60 total.

```bash
architect parallel --budget-per-worker 0.50
```

### Auto-review

Automatic review adds at least one extra LLM call to analyze the generated diff. If issues are detected and a fix pass is triggered, an additional agent execution is added.

```
review_cost = base_cost + review_call_cost + (fix_pass_cost if issues found)
```

Estimate: +10-30% over the base cost.

### Self-evaluation

Agent self-evaluation adds extra calls depending on the mode:

- **basic**: +1 LLM call at the end of execution.
- **full**: +1 call per retry (up to `max_retries` retries).

```
eval_cost_basic = base_cost + 1_eval_call
eval_cost_full  = base_cost + N_retries * 1_eval_call
```

### Context compression

When the agent context grows too large, automatic compression is triggered to summarize the history. This requires an extra LLM call.

```
compression_cost = base_cost + N_compressions * 1_summary_call
```

### General estimation formula

To estimate the total cost of a complex execution:

```
total_cost = (base_cost + eval_calls + compression_calls + review_calls) * loop_factor * parallel_factor

Where:
  base_cost         = steps * average_tokens * price_per_token
  eval_calls        = 0 (no eval), 1 (basic), or N (full with retries)
  compression_calls = number of times compression is triggered
  review_calls      = 0 (no review), 1-2 (with review)
  loop_factor       = 1 (no Ralph), or N (Ralph iterations)
  parallel_factor   = 1 (no parallel), or N (number of workers)
```

**Complete example**: complex refactoring (~$0.40 base) with basic self-eval (+$0.05), auto-review (+$0.08), in a Ralph Loop of 3 iterations:

```
($0.40 + $0.05 + $0.08) * 3 = $1.59
Recommended budget: $2.00
```

---

## Optimization strategies

### 1. Select the right model for each task

Not all tasks require the most powerful model. Using `gpt-4o-mini` or `claude-haiku-4-5` for review and documentation tasks can reduce costs by 90% compared to `gpt-4o`.

```yaml
# architect.yaml — economical model as default
llm:
  model: gpt-4o-mini

# Override for tasks that require more capability
# architect run "refactoring complejo" --model gpt-4o
```

### 2. Budget as a safety net

Always set a budget. Not as a spending target, but as protection against runaway executions:

```yaml
costs:
  budget_usd: 2.00      # Absolute maximum
  warn_at_usd: 1.50     # Warning at 75%
```

In CI/CD it is especially important to avoid unexpected costs:

```bash
architect run "$TASK" --budget 1.00 --confirm-mode yolo
```

### 3. Improve prompt quality

A clear and specific prompt reduces the number of steps the agent needs. Fewer steps = fewer LLM calls = lower cost.

Comparison:
- Vague prompt: "fix the bugs" -- 15-20 steps, $0.40
- Precise prompt: "fix the null check in `auth.py:42` that causes a crash when `user.email` is None" -- 3-5 steps, $0.08

### 4. Context management

Configure context compression to prevent prompts from growing indefinitely:

```yaml
agent:
  max_steps: 25
  context:
    summarize_after_steps: 15    # Compress context after N steps
    max_tool_result_tokens: 4000 # Limit tool results
```

Fewer context tokens = lower cost per step.

### 5. Local models for development

For rapid iteration during development, using Ollama with a local model completely eliminates API cost:

```bash
export ARCHITECT_MODEL=ollama/llama3
export ARCHITECT_API_BASE=http://localhost:11434
architect run "experimenta con esta logica" --show-costs
```

### 6. Prompt caching for team deployments

In environments where multiple developers or CI pipelines run Architect with the same system prompt, enabling prompt caching significantly reduces aggregate cost:

```yaml
llm:
  model: claude-sonnet-4-6
  prompt_caching: true
```

---

## Monitoring for teams

### --show-costs output

When using `--show-costs`, Architect displays a summary at the end:

```
Costs: $0.0342 (8,450 in / 2,100 out / 3,200 cached)
```

This compact format shows: total cost, input tokens, output tokens, and cached tokens (if any).

### JSON output

When using `--json`, the output includes a detailed cost block:

```json
{
  "status": "completed",
  "result": "...",
  "costs": {
    "total_input_tokens": 45200,
    "total_output_tokens": 12800,
    "total_cached_tokens": 18000,
    "total_tokens": 58000,
    "total_cost_usd": 0.042,
    "by_source": {
      "agent": 0.038,
      "eval": 0.004
    }
  }
}
```

### Reports with costs

Reports generated with `--report` include cost information:

```bash
# JSON report with costs included
architect run "tarea" --report json --report-file report.json --show-costs

# Markdown report for documentation
architect run "tarea" --report markdown --report-file report.md
```

### Cost aggregation in CI

To aggregate costs across multiple executions in CI/CD, you can parse the JSON output:

```bash
# In a CI pipeline
architect run "$TASK" --json --budget 1.00 > result.json

# Extract cost
jq '.costs.total_cost_usd' result.json
```

To maintain a historical record, you can send it to a metrics system or simply accumulate in a file:

```bash
COST=$(architect run "$TASK" --json | jq '.costs.total_cost_usd')
echo "$(date -Iseconds) $TASK $COST" >> costs.log
```

### Budget alerts with hooks

Architect supports `budget_warning` hooks that execute when accumulated spending reaches the warning threshold:

```yaml
costs:
  budget_usd: 2.00
  warn_at_usd: 1.50

hooks:
  budget_warning:
    - run: "echo 'ALERT: budget at 75%' | slack-notify"
    - run: "curl -X POST https://monitoring.example.com/alert -d 'budget_warning'"
```

This allows integrating cost alerts with team notification systems (Slack, PagerDuty, custom webhooks, etc.).

---

## Local models -- zero cost

### Ollama configuration

[Ollama](https://ollama.ai) allows running language models locally without any API cost. Architect supports it natively through LiteLLM.

**Ollama installation**:

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3
ollama pull codellama
```

**Architect configuration**:

```yaml
llm:
  model: ollama/llama3
  api_base: http://localhost:11434
  timeout: 120   # Local models can be slower
```

Or via environment variables:

```bash
export ARCHITECT_MODEL=ollama/llama3
export ARCHITECT_API_BASE=http://localhost:11434
architect run "tu tarea"
```

### Registered prices

All models matching the `ollama` prefix have a $0.00 price in the pricing table:

```json
{
  "ollama": {
    "input_per_million": 0.0,
    "output_per_million": 0.0,
    "cached_input_per_million": 0.0
  }
}
```

### Limitations

| Aspect | Cloud models | Local models (Ollama) |
|---|---|---|
| Cost | Variable based on usage | Always $0 |
| Quality | High (GPT-4o, Claude) | Variable, generally lower |
| Speed | Fast (GPU servers) | Depends on local hardware |
| Maximum context | 128K-200K tokens | Typically 4K-32K |
| Tool calling | Full | Limited support in some models |
| Availability | Requires internet | Works offline |

### Usage recommendations

- **Development and experimentation**: ideal for iterating on prompts and flows at no cost.
- **Simple tasks**: variable renaming, formatting, boilerplate generation.
- **Not recommended for**: complex refactoring, architecture analysis, or any task where output quality is critical.
- **Optimal combination**: use Ollama during local development and a cloud model in CI/CD with a budget.

```bash
# Local development — $0 cost
ARCHITECT_MODEL=ollama/llama3 ARCHITECT_API_BASE=http://localhost:11434 architect run "prototipa esto"

# CI/CD — cloud model with budget
architect run "implementa feature" --budget 1.00 --show-costs
```
