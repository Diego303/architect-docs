---
title: "Why Architect"
description: "Vision, differentiators, and future direction of Architect CLI"
---

## The core: the same pattern used by the best

Before talking about what makes architect different, there is something worth understanding: under the hood, every serious code agent tool from 2025-2026 works the same way.

Harrison Chase (founder of LangChain) made this clear in his publication on Deep Agents: the dominant architecture that has emerged is also the simplest -- an LLM running in a loop, calling tools. Claude Code, Deep Research, Manus, and the tools that actually work in production have all converged on the same combination: a planning tool, sub-agents, filesystem access, and a well-designed prompt.

There is no secret magic. There is no revolutionary architecture that one tool has and the others do not. The agent loop of Claude Code (what Anthropic internally calls "nO") is a `while` that continues as long as there are tool calls. The one in architect is exactly the same. Deep Agents on LangGraph, the same. The power, as the analysis of Claude Code's architecture itself states, comes from radical simplicity: think, act, observe, repeat.

architect implements this pattern completely:

- **Agent loop** with watchdogs (budget, timeout, context) that ask the agent for a clean shutdown instead of cutting abruptly.
- **Context management** with automatic compression when the window fills up, configurable in threshold and behavior.
- **Filesystem tools** (read, write, edit, search, grep, run_command) that give the agent real hands on your code.
- **Sub-agents** with isolated context to delegate subtasks without contaminating the main conversation.
- **Skills and `.architect.md`** that inject project knowledge into every session -- conventions, preferred patterns, team rules.
- **MCP** to connect with external services.
- **Procedural memory** that automatically detects corrections and persists them for future sessions.

All of this is parity with the state of the art. It is necessary, but it is not what differentiates architect. It is the engine of the car -- what matters is what the car is designed for.

---

## The niche: where interactive agents fall short

Claude Code is the best interactive coding tool that exists. We are not trying to compete with that. Cursor is brilliant inside VS Code. We are not competing there either.

architect exists for a different scenario: **when you need an AI agent to work on its own, unsupervised, and for the result to be verifiable.**

It is 3 AM, your CI/CD pipeline detects that tests are failing after a merge. It is Monday at 6 AM and you want dependencies updated before anyone arrives at the office. You have a 200-line spec and you want an agent to implement it, run tests, fix whatever fails, and leave you a report when you wake up.

In those scenarios, Claude Code does not help -- you need to be sitting in front of it. Cursor does not either. You need something designed from day one to work without anyone watching.

That is architect: **headless-first, CI/CD-native, with deterministic verification layers that the LLM cannot bypass.**

Semantic exit codes (0 success, 1 failure, 2 partial) so your pipeline can react. Parseable JSON output for automatic integration. Native CI/CD flags: `--budget` as a hard limit, `--timeout`, `--context-git-diff`, `--report`. Everything designed so that architect is just another step in your GitHub Actions, GitLab CI, or Jenkins -- not a tool that needs someone in front of it.

---

## What makes architect different

### Ralph Loop -- autonomous iteration with real verification

This is the flagship feature. No other open source tool has it as a native feature.

The Ralph Loop executes your task, runs the checks you define (pytest, ruff, tsc, whatever), and if they fail, launches a new iteration with **clean context**. The agent does not carry the history of its failed attempts -- it only receives the original spec, the accumulated diff, and the errors from the last iteration. It does not get contaminated. It does not get stuck repeating the same errors.

```bash
architect loop "Implement the payments module per the spec" \
  --spec tasks/payments.md \
  --check "pytest tests/ -q" \
  --check "ruff check src/" \
  --max-iterations 20 \
  --max-cost 3.00
```

The cycle is: execute, verify with real tests, if it fails retry with clean context, repeat until it passes. This turns an agent that "generates code" into an agent that "delivers code that works." The difference is enormous.

Claude Code can do something similar manually -- you launch it, it fails, you relaunch it. But it does not have a command that automates the complete cycle with external checks, clean context between iterations, and cumulative budget. Deep Agents does not either. The Ralph Loop can work for hours, alone, iterating until your tests actually pass -- not until the LLM thinks it is done.

### Deterministic guardrails and Quality Gates

This is probably the strongest differentiator for teams and enterprise.

architect's guardrails do not depend on the LLM. They are deterministic rules evaluated before and after each agent action. The agent cannot bypass them because it does not control them -- they are outside its context.

```yaml
guardrails:
  protected_files: [".env", "*.pem", "migrations/*"]
  blocked_commands: ['rm -rf /', 'git push --force']
  max_files_modified: 20
  code_rules:
    - pattern: 'eval\('
      message: "eval() prohibited in this project"
      severity: block
  quality_gates:
    - name: lint
      command: "ruff check src/"
      required: true
    - name: tests
      command: "pytest tests/ -q"
      required: true
```

If the agent tries to write to `.env`, it is blocked. If the generated code contains `eval()`, it is blocked. If the agent says "I am done" but pytest fails, it is not done -- it keeps working. There is no negotiation. There is no "well, the LLM decided it was fine." The quality gates pass or they do not.

Claude Code has per-tool permissions (allow/deny/ask), but it does not have declarative protected_files, blocked_commands with regex, max_files_modified, or code_rules that scan content. It does not have quality gates that prevent the agent from finishing until checks pass. Deep Agents has none of this.

This is exactly what a team needs to trust an autonomous agent running in their pipeline at 3 AM: the guarantee that there are limits the LLM cannot cross, by design.

### Declarative YAML Pipelines

Agent workflows defined as code, version-controlled in git, reusable across projects.

```yaml
name: complete-feature
steps:
  - name: plan
    agent: plan
    prompt: "Analyze the spec and produce an implementation plan"

  - name: implement
    agent: build
    prompt: "Implement according to the previous plan"
    checks: ["pytest tests/ -q", "ruff check src/"]

  - name: review
    agent: review
    prompt: "Review the changes looking for bugs and security issues"

  - name: fix
    agent: build
    prompt: "Fix the issues found in the review"
    condition: "review.issues_found > 0"

  - name: document
    agent: docs
    prompt: "Update the documentation with the changes made"
```

This is not a bash script chaining calls to `claude -p`. It is a declarative workflow with conditions, variables, checkpoints, and error handling. Version-controlled, reproducible, and auditable. The intelligent alternative to the fragile scripts people currently use to orchestrate headless agents.

Claude Code has Agent Teams but they are more ad-hoc. Deep Agents has LangGraph for workflows but it requires writing Python code -- it is not a declarative YAML that anyone can read and modify.

### Reports and auditing for CI/CD

Every architect execution produces a complete report: what it did, which files it touched, how much each step cost, which quality gates passed or failed, a complete timeline of actions, and the full diff. In JSON for your pipeline to parse, in Markdown for PR comments, in JUnit XML for CI/CD dashboards.

```bash
architect run "Fix the lint errors" \
  --report json --report-file report.json \
  --report github > pr-comment.md
```

In CI/CD, the report is the deliverable. If you cannot audit what the agent did, you cannot trust it. Claude Code simply does not generate this type of reports. architect does it by default.

### Parallel Runs and Competitive Eval

Launch the same task in parallel with different models or configurations. Compare results with real data.

```bash
architect parallel "Refactor the authentication module" \
  --workers 3 \
  --models claude-sonnet-4,gpt-4.1,deepseek-chat \
  --checks "pytest tests/ -q"
```

Each worker runs in an isolated git worktree. No conflicts, no interference. At the end, a comparison table: which model passed the most tests, which was fastest, which cost the least. Objective data, not opinions. This is unique as a native feature -- neither Claude Code nor Deep Agents has it.

### Multi-model without lock-in

architect works with any LLM that LiteLLM supports: OpenAI, Anthropic, Google, DeepSeek, Mistral, Ollama, or any compatible API. Over 100 providers. Changing models means changing a single line in the YAML.

```yaml
llm:
  model: claude-sonnet-4          # Change this and you're done
  api_key_env: ANTHROPIC_API_KEY
```

Your workflow does not change, your guardrails do not change, your pipelines do not change. Only the brain. For companies that cannot or do not want to depend on a single provider, this is a reality that matters. Claude Code only works with Claude. Deep Agents is optimized for the LangChain ecosystem. architect is agnostic by design.

---

## Collaboration with Claude Code, not competition

We are not selling "a better agent" -- that battle is won by Anthropic and OpenAI with models that improve every month. We are selling **control and verification over any agent**. It is the difference between a pilot (Claude Code) and an air traffic control system (architect). Both are necessary, neither replaces the other.

The collaboration works in both directions.

### architect uses Claude Code as an engine

When you configure the Claude Agent SDK backend, architect uses Claude Code's native tools (Read, Write, Edit, Bash -- which are the most polished on the market) as its execution engine. But on top of that, architect applies its own layers: hooks, guardrails, quality gates, Ralph Loop, pipelines, reports. Everything that Claude Code does not have.

```yaml
# config.yaml — Claude Agent SDK as backend
engine:
  backend: claude-agent-sdk
  claude_sdk:
    model: claude-sonnet-4
    permission_mode: acceptEdits
    allowed_tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]

guardrails:
  quality_gates:
    - name: tests
      command: "pytest tests/ -q"
      required: true
```

The most polished tools on the market + architect's verification guarantees. The best of both worlds.

```bash
# Ralph Loop using Claude as the brain, architect as the controller
architect loop "Implement JWT authentication" \
  --backend claude-agent-sdk \
  --check "pytest tests/ -q" \
  --check "ruff check src/" \
  --max-iterations 15
```

### Claude Code uses architect as a service

The other way around: architect exposes itself as an MCP Server, and Claude Code can launch architect tasks without leaving its interactive session.

```bash
# Add architect as an MCP server in Claude Code
claude mcp add architect -- architect serve --transport stdio
```

A developer working with Claude Code can say: "Launch a Ralph Loop to fix the failing tests in the payments module." Claude Code delegates to architect. architect runs its loop with external checks, guardrails, and quality gates. When it finishes, it returns the report to Claude Code.

The developer works interactively during the day with Claude Code. At night, architect takes over for long, autonomous tasks. Both tools talking to each other via MCP, each doing what it does best.

### Pipelines that mix backends

A pipeline can use different models at each step:

```yaml
steps:
  - name: implement
    backend: claude-agent-sdk      # Claude for implementation
  - name: review
    backend: litellm
    model: gpt-4.1                 # GPT for review (different perspective)
  - name: fix
    backend: claude-agent-sdk      # Claude for fixes
```

The one that implements is not the one that reviews. You avoid the confirmation bias of the same model evaluating its own work.

---

## The road ahead

### Now

The complete core of the tool: hooks on 10 lifecycle events, declarative guardrails with quality gates, skills and `.architect.md`, procedural memory, session resume, reports, native CI/CD flags, dry run, Ralph Loop, parallel runs with worktrees, YAML pipelines, checkpoints and rollback, auto-review writer/reviewer, sub-agents, code health delta, configuration presets.

### Next

The evolution toward an orchestration platform:

- **Claude Agent SDK backend** to use Claude Code's native tools as the engine, with architect's control layer on top.
- **architect as MCP Server** for bidirectional integration with Claude Code and other agents.
- **Ralph Loop v2**: resumable (if a long loop is interrupted, it picks up from the last iteration), escalation strategies (if it has been failing for 5+ iterations, it automatically changes the approach).
- **Guardrails v2**: scoped per agent (build can touch code, deploy only infra), immutable JSONL audit trail, allowed_paths as the inverse of protected_files.
- **Pipeline Engine v2**: parallel steps, declarative error handling (`on_failure: retry | skip | abort`), includes to reuse steps across pipelines.
- **Reports v2**: JUnit XML for standard CI/CD dashboards, GitHub PR format with collapsible sections, cost breakdown per step.
- **Health check and automatic fallback** between backends -- if the primary provider goes down, architect switches to the fallback without intervention.

### Future

- REST API to deploy architect as a service.
- Web dashboard to manage tasks, view costs, and browse reports.
- Robust sandboxing for isolated execution in containers.

---

## Who architect is for

**DevOps and platform engineers** who want AI agents in their CI/CD pipelines with real guarantees. Semantic exit codes, parseable reports, budget limits, mandatory quality gates.

**Teams working with multiple LLM providers** who do not want to be locked in to a single one. Today they use Claude, tomorrow they try GPT-4.1, next week a local model with Ollama. The workflow does not change.

**Developers who want overnight automation.** Leave a Ralph Loop working on a feature while you sleep, with the guarantee that if the tests do not pass, the agent keeps trying -- and if something goes wrong, there is a complete report waiting in the morning.

**Anyone who needs auditing of what an AI agent does.** Which files it touched, which commands it ran, how much it cost, which guardrails were triggered, which quality gates passed. Everything recorded, everything traceable.

## Who architect is NOT for

If you want an interactive copilot in your editor, use Claude Code or Cursor. They are better at that and always will be. architect is not an interactive experience -- it is an automation tool. The interface is a command, not a conversation. The output is verified code and a report, not text on a screen.

---

## In summary

The agent generates the code. architect makes sure it works.

Open source. No subscriptions. You only pay for the API of the LLM you choose.
