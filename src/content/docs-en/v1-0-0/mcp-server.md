---
title: "Creating an MCP Server"
description: "MCP server that exposes architect as a remote tool (server.py + tools.py)."
icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
order: 14
---

# Creating an Architect MCP Server

Guide for building an MCP (Model Context Protocol) server that exposes `architect` as a remote tool. This allows other AI agents -- an IDE assistant, a Slack chatbot, or another architect -- to delegate code implementation to architect via JSON-RPC 2.0.

---

## Concept

Architect is installed as a Python package and invoked via CLI. An MCP server can wrap those invocations with `subprocess` and expose them as JSON-RPC 2.0 tools. This way, any MCP client (including another architect) can request:

- "Implement this feature in `/workspace`"
- "Review the code and give me a report"
- "Plan how to refactor this module"
- "Generate tests for this function"

Each request is internally translated to an `architect run "..." --mode yolo --json` and the result is returned as an MCP response.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  MCP Client (another agent, IDE, chatbot)               │
│  → tools/call: architect_implement_code                 │
└──────────────────────────┬──────────────────────────────┘
                           │ JSON-RPC 2.0 / HTTP
                           ▼
┌─────────────────────────────────────────────────────────┐
│  MCP Server (server.py)                                 │
│                                                         │
│  Registered tools:                                      │
│  ├── architect_implement_code   → build agent           │
│  ├── architect_review_code      → review agent          │
│  ├── architect_plan_task        → plan agent            │
│  ├── architect_generate_tests   → build agent (tests)   │
│  ├── architect_generate_docs    → build agent (docs)    │
│  └── architect_run_custom       → any prompt            │
│                                                         │
│  Each tool invokes:                                     │
│    subprocess.run(["architect", "run", ...])            │
└──────────────────────────┬──────────────────────────────┘
                           │ subprocess
                           ▼
┌─────────────────────────────────────────────────────────┐
│  architect CLI                                          │
│  --mode yolo --json --quiet --budget N                  │
│                                                         │
│  Reads/writes files in the workspace                    │
│  Runs tests/linters if --allow-commands                 │
│  Returns JSON to stdout                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Requirements

```bash
# From PyPI
pip install architect-ai-cli

# Or from GitHub
git clone -b main --single-branch https://github.com/Diego303/architect-cli.git
cd architect-cli && pip install -e .

# Install the official MCP SDK for Python
pip install mcp

# Verify
architect --version
python -c "import mcp; print('MCP SDK OK')"
```

The LLM API key must be available as an environment variable:

```bash
export LITELLM_API_KEY="sk-..."
```

---

## Project structure

```
architect-mcp-server/
├── server.py          # MCP server (entry point)
├── tools.py           # Functions that invoke architect via subprocess
├── config.yaml        # Architect configuration (optional)
├── requirements.txt   # Dependencies
└── Containerfile      # For container deployment
```

**requirements.txt:**

```
mcp>=1.0
```

---

## Implementation: tools.py

This module encapsulates all invocations to architect. Each function executes `architect run` as a subprocess, parses the JSON output, and returns a structured result.

```python
"""
Tools that invoke architect CLI via subprocess.

Each function runs architect with --mode yolo --json --quiet
and returns a dict with the parsed result. All functions
handle subprocess errors, timeouts, and invalid JSON.
"""

import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Default subprocess timeout (5 minutes)
DEFAULT_TIMEOUT = 300

# Default budget in USD per invocation
DEFAULT_BUDGET = 2.0


@dataclass(frozen=True)
class ArchitectResult:
    """Parsed result from an architect CLI invocation."""

    success: bool
    status: str
    output: str
    steps: int
    exit_code: int
    cost_usd: float | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "success": self.success,
            "status": self.status,
            "output": self.output,
            "steps": self.steps,
            "exit_code": self.exit_code,
        }
        if self.cost_usd is not None:
            d["cost_usd"] = self.cost_usd
        if self.error is not None:
            d["error"] = self.error
        return d


def _run_architect(
    prompt: str,
    workspace: str,
    agent: str = "build",
    model: str | None = None,
    budget: float = DEFAULT_BUDGET,
    timeout: int = DEFAULT_TIMEOUT,
    allow_commands: bool = False,
    self_eval: str = "off",
    config_path: str | None = None,
    extra_args: list[str] | None = None,
) -> ArchitectResult:
    """Run architect CLI as a subprocess and parse the result.

    Args:
        prompt: Task description.
        workspace: Absolute path to the working directory.
        agent: Agent to use (build, plan, review, resume).
        model: LLM model (None uses the default from config/env).
        budget: Spending limit in USD.
        timeout: Subprocess timeout in seconds.
        allow_commands: Enable run_command tool.
        self_eval: Self-evaluation mode (off, basic, full).
        config_path: Path to config.yaml file.
        extra_args: Additional CLI arguments.

    Returns:
        ArchitectResult with the parsed result.
    """
    # Validate workspace
    workspace_path = Path(workspace)
    if not workspace_path.is_dir():
        return ArchitectResult(
            success=False,
            status="failed",
            output="",
            steps=0,
            exit_code=-1,
            error=f"Workspace does not exist or is not a directory: {workspace}",
        )

    # Build command
    cmd = [
        "architect", "run", prompt,
        "--mode", "yolo",
        "--json",
        "--quiet",
        "-w", str(workspace_path.resolve()),
        "-a", agent,
        "--budget", str(budget),
        "--show-costs",
    ]

    if model:
        cmd.extend(["--model", model])

    if allow_commands:
        cmd.append("--allow-commands")

    if self_eval != "off":
        cmd.extend(["--self-eval", self_eval])

    if config_path:
        cmd.extend(["-c", config_path])

    if extra_args:
        cmd.extend(extra_args)

    logger.info(
        "Running architect: agent=%s workspace=%s budget=%.2f",
        agent, workspace, budget,
    )

    # Run subprocess
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(workspace_path),
        )
    except subprocess.TimeoutExpired:
        logger.error("Timeout running architect (%ds)", timeout)
        return ArchitectResult(
            success=False,
            status="failed",
            output="",
            steps=0,
            exit_code=-1,
            error=f"Timeout: architect did not finish in {timeout}s",
        )
    except FileNotFoundError:
        logger.error("architect CLI not found in PATH")
        return ArchitectResult(
            success=False,
            status="failed",
            output="",
            steps=0,
            exit_code=-1,
            error="architect CLI is not installed or not in PATH",
        )
    except OSError as e:
        logger.error("Error running architect: %s", e)
        return ArchitectResult(
            success=False,
            status="failed",
            output="",
            steps=0,
            exit_code=-1,
            error=f"System error: {e}",
        )

    # Parse JSON from stdout
    try:
        data = json.loads(result.stdout) if result.stdout.strip() else {}
    except json.JSONDecodeError:
        # If not valid JSON, capture stdout as plain text
        logger.warning("architect did not return valid JSON (exit code %d)", result.returncode)
        return ArchitectResult(
            success=result.returncode == 0,
            status="failed" if result.returncode != 0 else "success",
            output=result.stdout.strip() or result.stderr.strip(),
            steps=0,
            exit_code=result.returncode,
            error=result.stderr.strip() if result.returncode != 0 else None,
        )

    # Extract fields from JSON
    status = data.get("status", "failed")
    cost_usd = None
    costs = data.get("costs")
    if isinstance(costs, dict):
        cost_usd = costs.get("total_cost_usd")

    return ArchitectResult(
        success=status == "success",
        status=status,
        output=data.get("output") or "",
        steps=data.get("steps", 0),
        exit_code=result.returncode,
        cost_usd=cost_usd,
        error=data.get("stop_reason") if status != "success" else None,
    )


# --- Public tools -------------------------------------------------------


def implement_code(
    prompt: str,
    workspace: str,
    model: str | None = None,
    budget: float = DEFAULT_BUDGET,
    allow_commands: bool = True,
    self_eval: str = "basic",
    config_path: str | None = None,
) -> ArchitectResult:
    """Implement code based on a natural language description.

    Uses the build agent: reads the project, plans changes, edits files,
    and optionally runs tests to verify.

    Args:
        prompt: What to implement (e.g. "add email validation to user.py").
        workspace: Project directory.
        model: LLM model to use.
        budget: Spending limit in USD.
        allow_commands: Allow test/linter execution.
        self_eval: Self-evaluation (off, basic, full).
        config_path: Architect YAML config.

    Returns:
        ArchitectResult with the implementation result.
    """
    return _run_architect(
        prompt=prompt,
        workspace=workspace,
        agent="build",
        model=model,
        budget=budget,
        allow_commands=allow_commands,
        self_eval=self_eval,
        config_path=config_path,
    )


def review_code(
    prompt: str,
    workspace: str,
    model: str | None = None,
    budget: float = 0.50,
    config_path: str | None = None,
) -> ArchitectResult:
    """Review code and generate a quality report.

    Uses the review agent: read-only, looks for bugs, vulnerabilities,
    code smells, and improvement opportunities.

    Args:
        prompt: What to review (e.g. "review src/auth/ looking for vulnerabilities").
        workspace: Project directory.
        model: LLM model to use.
        budget: Spending limit in USD.
        config_path: Architect YAML config.

    Returns:
        ArchitectResult with the review report.
    """
    return _run_architect(
        prompt=prompt,
        workspace=workspace,
        agent="review",
        model=model,
        budget=budget,
        config_path=config_path,
    )


def plan_task(
    prompt: str,
    workspace: str,
    model: str | None = None,
    budget: float = 0.50,
    config_path: str | None = None,
) -> ArchitectResult:
    """Generate an implementation plan without modifying files.

    Uses the plan agent: reads the project and produces a detailed plan
    with files to create/modify, concrete changes, and execution order.

    Args:
        prompt: What to plan (e.g. "how to add JWT authentication?").
        workspace: Project directory.
        model: LLM model to use.
        budget: Spending limit in USD.
        config_path: Architect YAML config.

    Returns:
        ArchitectResult with the implementation plan.
    """
    return _run_architect(
        prompt=prompt,
        workspace=workspace,
        agent="plan",
        model=model,
        budget=budget,
        config_path=config_path,
    )


def generate_tests(
    prompt: str,
    workspace: str,
    model: str | None = None,
    budget: float = DEFAULT_BUDGET,
    config_path: str | None = None,
) -> ArchitectResult:
    """Generate unit tests for the specified code.

    Uses the build agent with a testing-oriented prompt.
    Allows command execution so the agent can run the tests
    it generates and verify they pass.

    Args:
        prompt: What to test (e.g. "generate tests for src/services/payment.py").
        workspace: Project directory.
        model: LLM model to use.
        budget: Spending limit in USD.
        config_path: Architect YAML config.

    Returns:
        ArchitectResult with the generation result.
    """
    full_prompt = (
        f"{prompt}\n\n"
        "Generate complete unit tests with pytest. "
        "Cover normal flows, errors, and edge cases. "
        "Run the tests at the end to verify they pass."
    )
    return _run_architect(
        prompt=full_prompt,
        workspace=workspace,
        agent="build",
        model=model,
        budget=budget,
        allow_commands=True,
        self_eval="basic",
        config_path=config_path,
    )


def generate_docs(
    prompt: str,
    workspace: str,
    model: str | None = None,
    budget: float = 1.0,
    config_path: str | None = None,
) -> ArchitectResult:
    """Generate or update project documentation.

    Uses the build agent with a documentation-oriented prompt.

    Args:
        prompt: What to document (e.g. "generate REST API docs in docs/api.md").
        workspace: Project directory.
        model: LLM model to use.
        budget: Spending limit in USD.
        config_path: Architect YAML config.

    Returns:
        ArchitectResult with the generation result.
    """
    full_prompt = (
        f"{prompt}\n\n"
        "Generate clear documentation in Markdown format. "
        "Read the source code to extract real information. "
        "Do not invent data that is not in the code."
    )
    return _run_architect(
        prompt=full_prompt,
        workspace=workspace,
        agent="build",
        model=model,
        budget=budget,
        allow_commands=False,
        config_path=config_path,
    )


def run_custom(
    prompt: str,
    workspace: str,
    agent: str = "build",
    model: str | None = None,
    budget: float = DEFAULT_BUDGET,
    allow_commands: bool = False,
    self_eval: str = "off",
    config_path: str | None = None,
) -> ArchitectResult:
    """Run architect with an arbitrary prompt and configuration.

    Generic tool for any task that does not fit the specific tools.
    Exposes all configuration parameters.

    Args:
        prompt: Task to perform.
        workspace: Project directory.
        agent: Agent to use (build, plan, review, resume).
        model: LLM model to use.
        budget: Spending limit in USD.
        allow_commands: Allow command execution.
        self_eval: Self-evaluation mode.
        config_path: Architect YAML config.

    Returns:
        ArchitectResult with the result.
    """
    return _run_architect(
        prompt=prompt,
        workspace=workspace,
        agent=agent,
        model=model,
        budget=budget,
        allow_commands=allow_commands,
        self_eval=self_eval,
        config_path=config_path,
    )
```

---

## Implementation: server.py

The server uses the official MCP SDK for Python. It registers each tool with its JSON schema and handles JSON-RPC 2.0 requests automatically.

```python
"""
MCP Server that exposes architect CLI as remote tools.

Run:
    python server.py                     # Stdio mode (for local clients)
    python server.py --transport http    # HTTP mode (for remote clients)
    python server.py --port 8080         # HTTP on custom port

Each tool invokes architect via subprocess with --mode yolo --json.
"""

import argparse
import logging
import sys

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

import tools

# -- Logging ---------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("architect-mcp")

# -- MCP Server ------------------------------------------------------------

server = Server("architect-mcp")


# -- Tool registration -----------------------------------------------------

@server.list_tools()
async def list_tools() -> list[Tool]:
    """Return the list of available tools with their schemas."""
    return [
        Tool(
            name="architect_implement_code",
            description=(
                "Implements code in a project based on a natural language "
                "description. Reads the project, plans changes, "
                "edits files, and optionally runs tests to verify."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Description of what to implement",
                    },
                    "workspace": {
                        "type": "string",
                        "description": "Absolute path to the project directory",
                    },
                    "model": {
                        "type": "string",
                        "description": "LLM model (e.g. gpt-4o, claude-sonnet-4-6). Optional.",
                    },
                    "budget": {
                        "type": "number",
                        "description": "Spending limit in USD (default: 2.0)",
                        "default": 2.0,
                    },
                    "allow_commands": {
                        "type": "boolean",
                        "description": "Allow test/linter execution (default: true)",
                        "default": True,
                    },
                    "self_eval": {
                        "type": "string",
                        "description": "Self-evaluation: off, basic, full (default: basic)",
                        "enum": ["off", "basic", "full"],
                        "default": "basic",
                    },
                },
                "required": ["prompt", "workspace"],
            },
        ),
        Tool(
            name="architect_review_code",
            description=(
                "Reviews code and generates a quality report: "
                "bugs, vulnerabilities, code smells, and improvement opportunities. "
                "Read-only, does not modify files."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "What to review (e.g. 'review src/auth/ looking for vulnerabilities')",
                    },
                    "workspace": {
                        "type": "string",
                        "description": "Absolute path to the project directory",
                    },
                    "model": {
                        "type": "string",
                        "description": "LLM model. Optional.",
                    },
                    "budget": {
                        "type": "number",
                        "description": "Spending limit in USD (default: 0.50)",
                        "default": 0.50,
                    },
                },
                "required": ["prompt", "workspace"],
            },
        ),
        Tool(
            name="architect_plan_task",
            description=(
                "Analyzes a project and generates a detailed implementation "
                "plan without modifying files. Includes affected files, "
                "concrete changes, and execution order."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "What to plan (e.g. 'how to add JWT authentication?')",
                    },
                    "workspace": {
                        "type": "string",
                        "description": "Absolute path to the project directory",
                    },
                    "model": {
                        "type": "string",
                        "description": "LLM model. Optional.",
                    },
                    "budget": {
                        "type": "number",
                        "description": "Spending limit in USD (default: 0.50)",
                        "default": 0.50,
                    },
                },
                "required": ["prompt", "workspace"],
            },
        ),
        Tool(
            name="architect_generate_tests",
            description=(
                "Generates unit tests for existing code. "
                "Reads the source code, generates tests with pytest, "
                "and runs the tests to verify they pass."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "What to test (e.g. 'generate tests for src/services/payment.py')",
                    },
                    "workspace": {
                        "type": "string",
                        "description": "Absolute path to the project directory",
                    },
                    "model": {
                        "type": "string",
                        "description": "LLM model. Optional.",
                    },
                    "budget": {
                        "type": "number",
                        "description": "Spending limit in USD (default: 2.0)",
                        "default": 2.0,
                    },
                },
                "required": ["prompt", "workspace"],
            },
        ),
        Tool(
            name="architect_generate_docs",
            description=(
                "Generates or updates technical project documentation "
                "in Markdown format. Reads the source code to extract "
                "real information."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "What to document (e.g. 'generate REST API docs')",
                    },
                    "workspace": {
                        "type": "string",
                        "description": "Absolute path to the project directory",
                    },
                    "model": {
                        "type": "string",
                        "description": "LLM model. Optional.",
                    },
                    "budget": {
                        "type": "number",
                        "description": "Spending limit in USD (default: 1.0)",
                        "default": 1.0,
                    },
                },
                "required": ["prompt", "workspace"],
            },
        ),
        Tool(
            name="architect_run_custom",
            description=(
                "Runs architect with an arbitrary prompt and configuration. "
                "Generic tool for tasks that do not fit the specific tools."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Task to perform",
                    },
                    "workspace": {
                        "type": "string",
                        "description": "Absolute path to the project directory",
                    },
                    "agent": {
                        "type": "string",
                        "description": "Agent: build, plan, review, resume (default: build)",
                        "enum": ["build", "plan", "review", "resume"],
                        "default": "build",
                    },
                    "model": {
                        "type": "string",
                        "description": "LLM model. Optional.",
                    },
                    "budget": {
                        "type": "number",
                        "description": "Spending limit in USD (default: 2.0)",
                        "default": 2.0,
                    },
                    "allow_commands": {
                        "type": "boolean",
                        "description": "Allow command execution (default: false)",
                        "default": False,
                    },
                    "self_eval": {
                        "type": "string",
                        "description": "Self-evaluation: off, basic, full (default: off)",
                        "enum": ["off", "basic", "full"],
                        "default": "off",
                    },
                },
                "required": ["prompt", "workspace"],
            },
        ),
    ]


# -- Tool handlers ---------------------------------------------------------

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Dispatch a tool invocation to the corresponding handler."""
    logger.info("Tool invoked: %s", name)

    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return [TextContent(
            type="text",
            text=f"Unknown tool: {name}",
        )]

    try:
        result = handler(arguments)
    except Exception as e:
        logger.exception("Error executing tool %s", name)
        return [TextContent(
            type="text",
            text=f"Internal error executing {name}: {e}",
        )]

    # Format response
    if result.success:
        text = result.output
        if result.cost_usd is not None:
            text += f"\n\n[Cost: ${result.cost_usd:.4f} | Steps: {result.steps}]"
    else:
        text = f"Error ({result.status}): {result.error or 'unknown'}"
        if result.output:
            text += f"\n\nPartial output:\n{result.output}"

    return [TextContent(type="text", text=text)]


# -- Tool-to-handler mapping -----------------------------------------------

def _handle_implement(args: dict) -> tools.ArchitectResult:
    return tools.implement_code(
        prompt=args["prompt"],
        workspace=args["workspace"],
        model=args.get("model"),
        budget=args.get("budget", 2.0),
        allow_commands=args.get("allow_commands", True),
        self_eval=args.get("self_eval", "basic"),
    )


def _handle_review(args: dict) -> tools.ArchitectResult:
    return tools.review_code(
        prompt=args["prompt"],
        workspace=args["workspace"],
        model=args.get("model"),
        budget=args.get("budget", 0.50),
    )


def _handle_plan(args: dict) -> tools.ArchitectResult:
    return tools.plan_task(
        prompt=args["prompt"],
        workspace=args["workspace"],
        model=args.get("model"),
        budget=args.get("budget", 0.50),
    )


def _handle_generate_tests(args: dict) -> tools.ArchitectResult:
    return tools.generate_tests(
        prompt=args["prompt"],
        workspace=args["workspace"],
        model=args.get("model"),
        budget=args.get("budget", 2.0),
    )


def _handle_generate_docs(args: dict) -> tools.ArchitectResult:
    return tools.generate_docs(
        prompt=args["prompt"],
        workspace=args["workspace"],
        model=args.get("model"),
        budget=args.get("budget", 1.0),
    )


def _handle_run_custom(args: dict) -> tools.ArchitectResult:
    return tools.run_custom(
        prompt=args["prompt"],
        workspace=args["workspace"],
        agent=args.get("agent", "build"),
        model=args.get("model"),
        budget=args.get("budget", 2.0),
        allow_commands=args.get("allow_commands", False),
        self_eval=args.get("self_eval", "off"),
    )


TOOL_HANDLERS = {
    "architect_implement_code": _handle_implement,
    "architect_review_code": _handle_review,
    "architect_plan_task": _handle_plan,
    "architect_generate_tests": _handle_generate_tests,
    "architect_generate_docs": _handle_generate_docs,
    "architect_run_custom": _handle_run_custom,
}


# -- Entry point -----------------------------------------------------------

async def main_stdio():
    """Run the MCP server in stdio mode."""
    logger.info("Starting architect MCP server (stdio)")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main():
    parser = argparse.ArgumentParser(description="Architect MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport: stdio (default) or http",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port for HTTP transport (default: 8080)",
    )
    args = parser.parse_args()

    if args.transport == "stdio":
        import asyncio
        asyncio.run(main_stdio())

    elif args.transport == "http":
        from mcp.server.sse import SseServerTransport
        from starlette.applications import Starlette
        from starlette.routing import Route
        import uvicorn

        sse = SseServerTransport("/messages")

        async def handle_sse(request):
            async with sse.connect_sse(
                request.scope, request.receive, request._send
            ) as streams:
                await server.run(
                    streams[0], streams[1],
                    server.create_initialization_options(),
                )

        app = Starlette(routes=[
            Route("/sse", endpoint=handle_sse),
            Route("/messages", endpoint=sse.handle_post_message, methods=["POST"]),
        ])

        logger.info("Starting architect MCP server HTTP on port %d", args.port)
        uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
```

---

## Running and testing

### Stdio mode (local development)

```bash
# The server reads/writes JSON-RPC via stdin/stdout
python server.py
```

To test manually, send JSON-RPC via stdin:

```bash
# List tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python server.py

# Invoke a tool
echo '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "architect_review_code",
    "arguments": {
      "prompt": "review the code looking for bugs",
      "workspace": "/home/user/my-project"
    }
  }
}' | python server.py
```

### HTTP mode (for remote clients)

```bash
# Install HTTP dependencies
pip install uvicorn starlette

# Start
python server.py --transport http --port 8080
```

Test with curl:

```bash
# List tools
curl -X POST http://localhost:8080/messages \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### Unit test for the tools module

```python
# test_tools.py
"""Tests for tools.py -- validate architect invocation via subprocess."""

import json
from unittest.mock import patch, MagicMock

import tools


def _mock_subprocess_success():
    """Simulate a successful architect execution."""
    mock = MagicMock()
    mock.returncode = 0
    mock.stdout = json.dumps({
        "status": "success",
        "stop_reason": "llm_done",
        "output": "Implementation completed. Edited user.py.",
        "steps": 3,
        "tools_used": [
            {"name": "read_file", "success": True, "path": "user.py"},
            {"name": "edit_file", "success": True, "path": "user.py"},
        ],
        "duration_seconds": 8.5,
        "costs": {"total_cost_usd": 0.0042},
    })
    mock.stderr = ""
    return mock


def _mock_subprocess_failure():
    """Simulate a failed architect execution."""
    mock = MagicMock()
    mock.returncode = 4
    mock.stdout = json.dumps({
        "status": "failed",
        "stop_reason": None,
        "output": None,
        "steps": 0,
    })
    mock.stderr = "Authentication error: invalid API key"
    return mock


@patch("subprocess.run")
def test_implement_code_success(mock_run):
    mock_run.return_value = _mock_subprocess_success()

    result = tools.implement_code(
        prompt="add validation",
        workspace="/tmp/test-workspace",
    )

    assert result.success is True
    assert result.status == "success"
    assert "user.py" in result.output
    assert result.cost_usd == 0.0042
    assert result.exit_code == 0


@patch("subprocess.run")
def test_implement_code_auth_error(mock_run):
    mock_run.return_value = _mock_subprocess_failure()

    result = tools.implement_code(
        prompt="add validation",
        workspace="/tmp/test-workspace",
    )

    assert result.success is False
    assert result.exit_code == 4


@patch("subprocess.run", side_effect=FileNotFoundError)
def test_implement_code_not_installed(mock_run):
    result = tools.implement_code(
        prompt="test",
        workspace="/tmp/test-workspace",
    )

    assert result.success is False
    assert "not installed" in result.error


def test_implement_code_invalid_workspace():
    result = tools.implement_code(
        prompt="test",
        workspace="/path/that/does/not/exist",
    )

    assert result.success is False
    assert "does not exist" in result.error


@patch("subprocess.run", side_effect=tools.subprocess.TimeoutExpired(cmd="architect", timeout=300))
def test_implement_code_timeout(mock_run):
    result = tools.implement_code(
        prompt="test",
        workspace="/tmp/test-workspace",
    )

    assert result.success is False
    assert "Timeout" in result.error
```

---

## Connecting from architect as a client

An architect can use this MCP server as a remote tool. This way an orchestrator agent delegates implementation to another architect.

```yaml
# config-orchestrator.yaml
llm:
  model: claude-sonnet-4-6

mcp:
  servers:
    - name: architect
      url: http://localhost:8080
      # token_env: ARCHITECT_MCP_TOKEN  # If you add authentication
```

```bash
# The orchestrator agent can request:
architect run \
  "Read ticket PROJ-42 and use architect_implement_code \
   to implement what it asks in /workspace/myapp" \
  -c config-orchestrator.yaml \
  --mode yolo
```

Internally, architect discovers the MCP server tools at startup and registers them with the `mcp_architect_` prefix:

- `mcp_architect_architect_implement_code`
- `mcp_architect_architect_review_code`
- `mcp_architect_architect_plan_task`
- etc.

The LLM sees them as normal tools and can invoke them when it deems appropriate.

---

## Container deployment

```dockerfile
# Containerfile.mcp-server
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# From PyPI
RUN pip install architect-ai-cli

# Or from GitHub
RUN git clone -b main --single-branch \
      https://github.com/Diego303/architect-cli.git /opt/architect-cli && \
    cd /opt/architect-cli && pip install --no-cache-dir -e .

# Install MCP server dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Install HTTP dependencies (for SSE transport)
RUN pip install --no-cache-dir uvicorn starlette

# Copy server code
COPY server.py tools.py /app/

WORKDIR /app

ENV ARCHITECT_WORKSPACE=/workspace
ENV HOME=/tmp

EXPOSE 8080

ENTRYPOINT ["python", "server.py"]
CMD ["--transport", "http", "--port", "8080"]
```

```bash
# Build
docker build -t architect-mcp-server -f Containerfile.mcp-server .

# Run
docker run -d \
  -p 8080:8080 \
  -e LITELLM_API_KEY="${LITELLM_API_KEY}" \
  -v /path/to/projects:/workspace \
  architect-mcp-server
```

---

## Best practices

### Security

- **Do not expose the server to the internet without authentication.** The server executes arbitrary code via architect. Add an authentication middleware (Bearer token, mTLS) if you expose it outside localhost.
- **Always use `--budget`.** Without a budget, a malicious request can consume tokens indefinitely.
- **Validate the workspace.** The `tools.py` module validates that the workspace exists before invoking architect. Consider adding a whitelist of allowed workspaces.
- **Do not pass `--api-key` via arguments.** Use environment variables (`LITELLM_API_KEY`). Process arguments are visible in `ps aux`.

### Robustness

- **Subprocess timeout.** All invocations have a timeout (default 300s). Without a timeout, a stuck architect blocks the server indefinitely.
- **Exhaustive error handling.** `_run_architect()` captures: `TimeoutExpired`, `FileNotFoundError`, `OSError`, and `JSONDecodeError`. It never propagates exceptions to the MCP client.
- **Always structured result.** `ArchitectResult` guarantees there is always `success`, `status`, and `exit_code`, even on system errors.
- **Logging to stderr.** The server logs all invocations and errors. Logs do not mix with JSON-RPC communication.

### Performance

- **One subprocess per request.** Each tool call launches an independent architect process. For high concurrency, consider a worker pool or an async server with `asyncio.create_subprocess_exec`.
- **Prompt caching.** If the server receives repeated requests on the same project, enable `prompt_caching: true` in the architect config to reduce costs and latency.
- **Lightweight models for reviews.** Use `gpt-4o-mini` for `review_code` and `plan_task` (read-only, do not need advanced editing capability). Reserve `gpt-4o` or `claude-sonnet-4-6` for `implement_code`.

### Extensibility

- **Adding new tools** means adding a function in `tools.py`, registering the `Tool` in `list_tools()`, and creating a handler in `TOOL_HANDLERS`. The pattern is always the same.
- **Custom YAML config.** Each tool can receive `config_path` to use a different architect configuration. Useful for separating review configs (cheap model) vs implementation (powerful model).
- **Custom agents.** You can define custom agents in the architect YAML config (documenter, tester, security) and expose them as MCP tools with `run_custom(agent="documenter")`.
