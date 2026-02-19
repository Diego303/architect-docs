---
title: Introducción
description: Conceptos básicos para integrar Architect en tu entorno.
icon: M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10
order: 1
---

---

## Secciones

| Sección | Descripción |
|---------|-------------|
| [**Uso**](usage) | Formas de uso: flags, logging, configs, CI/CD, scripts, agentes custom, multi-proyecto |
| [**Arquitectura**](architecture) | Visión general, diagrama de componentes y flujo completo de ejecución |
| [**Core Loop**](core-loop) | El loop de agente paso a paso, streaming, shutdown y timeout |
| [**Modelos de Datos**](data-models) | Todos los modelos de datos: Pydantic, dataclasses, jerarquía de errores |
| [**Herramientas**](tools-and-execution) | Sistema de tools, validación de paths, políticas de confirmación, ExecutionEngine |
| [**Agentes y Modos**](agents-and-modes) | Agentes por defecto, registry, mixed mode, prompts del sistema |
| [**Configuración**](config-reference) | Schema completo de configuración, precedencia, variables de entorno |
| [**Guía IA**](ai-guide) | Guía para IA: invariantes críticos, patrones, dónde añadir cosas, trampas |

---

## Resumen rápido

**architect** es una CLI headless que conecta un LLM a herramientas de sistema de archivos (y opcionalmente a servidores MCP remotos). El usuario describe una tarea en lenguaje natural; el sistema itera: llama al LLM → el LLM decide qué herramientas usar → las herramientas se ejecutan → los resultados vuelven al LLM → siguiente iteración.

```
architect run "refactoriza main.py" -a build --mode yolo
         │
         ├─ load_config()         YAML + env + CLI flags
         ├─ configure_logging()   stderr dual-pipeline
         ├─ ToolRegistry          local tools + MCP remotas
         ├─ LLMAdapter            LiteLLM + retries selectivos
         │
         └─ AgentLoop (o MixedModeRunner)
                 │
                 ├─ [check shutdown]   SIGINT/SIGTERM graceful
                 ├─ [StepTimeout]      SIGALRM por step
                 ├─ llm.completion()   → streaming chunks a stderr
                 ├─ engine.execute()   → validar → confirmar → ejecutar
                 └─ ctx.append_results() → siguiente iteración
```

**Stack**: Python 3.12+, Click, Pydantic v2, LiteLLM, httpx, structlog, tenacity.

**Versión actual**: 0.8.0
