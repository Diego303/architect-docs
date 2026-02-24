---
title: "Por qué Architect"
description: "Visión, diferenciadores y dirección futura de Architect CLI"
---

## El core: el mismo patrón que usan los mejores

Antes de hablar de qué hace diferente a architect, hay algo que merece la pena entender: por debajo, todas las herramientas de agentes de código serias de 2025-2026 funcionan igual.

Harrison Chase (fundador de LangChain) lo dejó claro en su publicación sobre Deep Agents: la arquitectura dominante que ha emergido es también la más simple — un LLM ejecutando en un loop, llamando tools. Claude Code, Deep Research, Manus, y las herramientas que funcionan de verdad en producción han convergido en la misma combinación: una herramienta de planificación, sub-agentes, acceso al sistema de archivos, y un prompt bien diseñado.

No hay magia secreta. No hay arquitectura revolucionaria que una herramienta tenga y las demás no. El agent loop de Claude Code (lo que Anthropic llama internamente "nO") es un `while` que continúa mientras haya tool calls. El de architect es exactamente lo mismo. El de Deep Agents sobre LangGraph, igual. El poder, como dice el propio análisis de la arquitectura de Claude Code, viene de la simplicidad radical: pensar, actuar, observar, repetir.

architect implementa este patrón de forma completa:

- **Agent loop** con watchdogs (budget, timeout, contexto) que piden al agente un cierre limpio en vez de cortar abruptamente.
- **Context management** con compresión automática cuando la ventana se llena, configurable en umbral y comportamiento.
- **Tools de filesystem** (read, write, edit, search, grep, run_command) que le dan al agente manos reales sobre tu código.
- **Sub-agentes** con contexto aislado para delegar subtareas sin contaminar la conversación principal.
- **Skills y `.architect.md`** que inyectan conocimiento del proyecto en cada sesión — convenciones, patrones preferidos, reglas del equipo.
- **MCP** para conectar con servicios externos.
- **Memoria procedural** que detecta correcciones automáticamente y las persiste para futuras sesiones.

Todo esto es paridad con el estado del arte. Es necesario, pero no es lo que diferencia a architect. Es el motor del coche — lo que importa es para qué está diseñado el coche.

---

## El nicho: donde los agentes interactivos no llegan

Claude Code es la mejor herramienta de coding interactivo que existe. No intentamos competir con eso. Cursor es brillante dentro de VS Code. Tampoco competimos ahí.

architect existe para un escenario diferente: **cuando necesitas que un agente de IA trabaje solo, sin supervisión, y que el resultado sea verificable.**

Son las 3 de la mañana, tu pipeline de CI/CD detecta que los tests fallan después de un merge. Es lunes a las 6am y quieres que las dependencias se actualicen antes de que llegue nadie a la oficina. Tienes una spec de 200 líneas y quieres que un agente la implemente, ejecute tests, corrija lo que falle, y te deje un reporte cuando termines de dormir.

En esos escenarios, Claude Code no te sirve — necesitas estar sentado delante. Cursor tampoco. Necesitas algo que esté diseñado desde el día uno para funcionar sin que nadie esté mirando.

Eso es architect: **headless-first, CI/CD-native, con capas de verificación determinista que el LLM no puede saltarse.**

Exit codes semánticos (0 éxito, 1 fallo, 2 parcial) para que tu pipeline reaccione. Output JSON parseable para integración automática. Flags nativos de CI/CD: `--budget` como hard limit, `--timeout`, `--context-git-diff`, `--report`. Todo pensado para que architect sea un step más en tu GitHub Actions, GitLab CI, o Jenkins — no una herramienta que necesita a alguien delante.

---

## Lo que hace diferente a architect

### Ralph Loop — iteración autónoma con verificación real

Esta es la feature estrella. Ninguna otra herramienta open source la tiene como feature nativa.

El Ralph Loop ejecuta tu tarea, corre los checks que tú definas (pytest, ruff, tsc, lo que sea), y si fallan, lanza una nueva iteración con **contexto limpio**. El agente no arrastra el historial de sus intentos fallidos — solo recibe la spec original, el diff acumulado, y los errores de la última iteración. No se contamina. No se atasca repitiendo los mismos errores.

```bash
architect loop "Implementa el módulo de pagos según la spec" \
  --spec tasks/payments.md \
  --check "pytest tests/ -q" \
  --check "ruff check src/" \
  --max-iterations 20 \
  --max-cost 3.00
```

El ciclo es: ejecuta → verifica con tests reales → si falla, reintenta con contexto limpio → repite hasta que pase. Esto convierte a un agente que "genera código" en un agente que "entrega código que funciona". La diferencia es enorme.

Claude Code puede hacer algo parecido manualmente — lo lanzas, falla, lo relanzas. Pero no tiene un comando que automatice el ciclo completo con checks externos, contexto limpio entre iteraciones, y budget acumulativo. Deep Agents tampoco. El Ralph Loop puede trabajar durante horas, solo, iterando hasta que tus tests pasen de verdad — no hasta que el LLM crea que ha terminado.

### Guardrails deterministas y Quality Gates

Este es probablemente el diferenciador más fuerte para equipos y enterprise.

Los guardrails de architect no dependen del LLM. Son reglas deterministas que se evalúan antes y después de cada acción del agente. El agente no puede saltárselas porque no las controla — están fuera de su contexto.

```yaml
guardrails:
  protected_files: [".env", "*.pem", "migrations/*"]
  blocked_commands: ['rm -rf /', 'git push --force']
  max_files_modified: 20
  code_rules:
    - pattern: 'eval\('
      message: "eval() prohibido en este proyecto"
      severity: block
  quality_gates:
    - name: lint
      command: "ruff check src/"
      required: true
    - name: tests
      command: "pytest tests/ -q"
      required: true
```

Si el agente intenta escribir en `.env` → bloqueado. Si el código generado contiene `eval()` → bloqueado. Si el agente dice "he terminado" pero pytest falla → no ha terminado, sigue trabajando. No hay negociación. No hay "bueno, el LLM decidió que estaba bien". Los quality gates pasan o no pasan.

Claude Code tiene permisos per-tool (allow/deny/ask), pero no tiene protected_files declarativos, blocked_commands con regex, max_files_modified, ni code_rules que escaneen contenido. No tiene quality gates que impidan al agente terminar hasta que los checks pasen. Deep Agents no tiene nada de esto.

Esto es exactamente lo que un equipo necesita para confiar en un agente autónomo corriendo en su pipeline a las 3am: la garantía de que hay límites que el LLM no puede cruzar, por diseño.

### Pipelines YAML declarativos

Workflows de agentes definidos como código, versionables en git, reutilizables entre proyectos.

```yaml
name: feature-completa
steps:
  - name: plan
    agent: plan
    prompt: "Analiza la spec y produce un plan de implementación"

  - name: implement
    agent: build
    prompt: "Implementa según el plan anterior"
    checks: ["pytest tests/ -q", "ruff check src/"]

  - name: review
    agent: review
    prompt: "Revisa los cambios buscando bugs y problemas de seguridad"

  - name: fix
    agent: build
    prompt: "Corrige los issues encontrados en el review"
    condition: "review.issues_found > 0"

  - name: document
    agent: docs
    prompt: "Actualiza la documentación con los cambios realizados"
```

Esto no es un script de bash encadenando llamadas a `claude -p`. Es un workflow declarativo con condiciones, variables, checkpoints, y error handling. Versionable, reproducible, y auditable. La alternativa inteligente a los scripts frágiles que la gente usa ahora para orquestar agentes headless.

Claude Code tiene Agent Teams pero son más ad-hoc. Deep Agents tiene LangGraph para workflows pero requiere escribir código Python — no es un YAML declarativo que cualquiera pueda leer y modificar.

### Reports y auditoría para CI/CD

Cada ejecución de architect produce un reporte completo: qué hizo, qué archivos tocó, cuánto costó cada paso, qué quality gates pasaron o fallaron, timeline completa de acciones, y diff completo. En JSON para que tu pipeline lo parsee, en Markdown para PR comments, en JUnit XML para dashboards de CI/CD.

```bash
architect run "Corrige los errores de lint" \
  --report json --report-file report.json \
  --report github > pr-comment.md
```

En CI/CD, el reporte es el entregable. Si no puedes auditar qué hizo el agente, no puedes confiar en él. Claude Code simplemente no genera este tipo de reports. architect lo hace por defecto.

### Parallel Runs y Competitive Eval

Lanza la misma tarea en paralelo con diferentes modelos o configuraciones. Compara resultados con datos reales.

```bash
architect parallel "Refactoriza el módulo de autenticación" \
  --workers 3 \
  --models claude-sonnet-4,gpt-4.1,deepseek-chat \
  --checks "pytest tests/ -q"
```

Cada worker se ejecuta en un git worktree aislado. Sin conflictos, sin interferencia. Al final, una tabla comparativa: qué modelo pasó más tests, cuál fue más rápido, cuál costó menos. Datos objetivos, no opiniones. Esto es único como feature nativa — ni Claude Code ni Deep Agents lo tienen.

### Multi-modelo sin lock-in

architect funciona con cualquier LLM que LiteLLM soporte: OpenAI, Anthropic, Google, DeepSeek, Mistral, Ollama, o cualquier API compatible. Más de 100 proveedores. Cambiar de modelo es cambiar una línea en el YAML.

```yaml
llm:
  model: claude-sonnet-4          # Cambia esto y listo
  api_key_env: ANTHROPIC_API_KEY
```

Tu workflow no cambia, tus guardrails no cambian, tus pipelines no cambian. Solo el cerebro. Para empresas que no pueden o no quieren depender de un solo proveedor, esto es una realidad que importa. Claude Code solo funciona con Claude. Deep Agents está optimizado para el ecosistema LangChain. architect es agnóstico por diseño.

---

## Colaboración con Claude Code, no competencia

No vendemos "un agente mejor" — esa batalla la ganan Anthropic y OpenAI con modelos que mejoran cada mes. Vendemos **control y verificación sobre cualquier agente**. Es la diferencia entre un piloto (Claude Code) y un sistema de control de tráfico aéreo (architect). Ambos son necesarios, ninguno reemplaza al otro.

La colaboración funciona en las dos direcciones.

### architect usa Claude Code como motor

Cuando configuras el backend de Claude Agent SDK, architect usa las herramientas nativas de Claude Code (Read, Write, Edit, Bash — que son las más pulidas del mercado) como motor de ejecución. Pero encima, architect aplica sus propias capas: hooks, guardrails, quality gates, Ralph Loop, pipelines, reports. Todo lo que Claude Code no tiene.

```yaml
# config.yaml — Claude Agent SDK como backend
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

Las tools más pulidas del mercado + las garantías de verificación de architect. Lo mejor de los dos mundos.

```bash
# Ralph Loop usando Claude como cerebro, architect como controlador
architect loop "Implementa autenticación JWT" \
  --backend claude-agent-sdk \
  --check "pytest tests/ -q" \
  --check "ruff check src/" \
  --max-iterations 15
```

### Claude Code usa architect como servicio

Al revés: architect se expone como MCP Server, y Claude Code puede lanzar tareas de architect sin salir de su sesión interactiva.

```bash
# Añadir architect como MCP server en Claude Code
claude mcp add architect -- architect serve --transport stdio
```

Un developer trabajando con Claude Code puede decir: "Lanza un Ralph Loop para corregir los tests que fallan en el módulo de pagos." Claude Code delega a architect. architect ejecuta su loop con checks externos, guardrails, y quality gates. Cuando termina, devuelve el reporte a Claude Code.

El developer trabaja interactivamente durante el día con Claude Code. Por la noche, architect toma el relevo para tareas largas y autónomas. Ambas herramientas hablándose por MCP, cada una haciendo lo que mejor sabe hacer.

### Pipelines que mezclan backends

Un pipeline puede usar diferentes modelos en cada paso:

```yaml
steps:
  - name: implement
    backend: claude-agent-sdk      # Claude para implementar
  - name: review
    backend: litellm
    model: gpt-4.1                 # GPT para review (perspectiva diferente)
  - name: fix
    backend: claude-agent-sdk      # Claude para corregir
```

El que implementa no es el que revisa. Evitas el confirmation bias de que el mismo modelo evalúe su propio trabajo.

---

## El camino que viene

### Ahora

El core completo de la herramienta: hooks en 10 eventos del lifecycle, guardrails declarativos con quality gates, skills y `.architect.md`, memoria procedural, session resume, reports, flags CI/CD nativos, dry run, Ralph Loop, parallel runs con worktrees, pipelines YAML, checkpoints y rollback, auto-review writer/reviewer, sub-agentes, code health delta, presets de configuración.

### Próximo

La evolución hacia plataforma de orquestación:

- **Backend de Claude Agent SDK** para usar las tools nativas de Claude Code como motor, con la capa de control de architect encima.
- **architect como MCP Server** para integración bidireccional con Claude Code y otros agentes.
- **Ralph Loop v2**: resumable (si se interrumpe un loop largo, se retoma desde la última iteración), estrategias de escalación (si lleva 5+ iteraciones fallando, cambia el approach automáticamente).
- **Guardrails v2**: scoped por agente (el build puede tocar código, el deploy solo infra), audit trail JSONL inmutable, allowed_paths como inverso de protected_files.
- **Pipeline Engine v2**: steps paralelos, error handling declarativo (`on_failure: retry | skip | abort`), includes para reutilizar steps entre pipelines.
- **Reports v2**: JUnit XML para dashboards CI/CD estándar, formato GitHub PR con secciones colapsables, desglose de coste por paso.
- **Health check y fallback** automático entre backends — si el proveedor principal cae, architect cambia al fallback sin intervención.

### Futuro

- API REST para desplegar architect como servicio.
- Dashboard web para gestionar tareas, ver costes, y consultar reports.
- Sandboxing robusto para ejecución aislada en contenedores.

---

## Para quién es architect

**DevOps e ingenieros de plataforma** que quieren agentes de IA en sus pipelines de CI/CD con garantías reales. Exit codes semánticos, reports parseables, budget limits, quality gates obligatorios.

**Equipos que trabajan con múltiples proveedores de LLM** y no quieren atarse a uno solo. Hoy usan Claude, mañana prueban GPT-4.1, la semana que viene un modelo local con Ollama. El workflow no cambia.

**Desarrolladores que quieren automatización nocturna.** Dejar un Ralph Loop trabajando en una feature mientras duermen, con la garantía de que si los tests no pasan, el agente sigue intentando — y si algo sale mal, hay un reporte completo esperando por la mañana.

**Cualquiera que necesite auditoría de lo que hace un agente de IA.** Qué archivos tocó, qué comandos ejecutó, cuánto costó, qué guardrails se activaron, qué quality gates pasaron. Todo registrado, todo trazable.

## Para quién NO es architect

Si quieres un copiloto interactivo en tu editor, usa Claude Code o Cursor. Son mejores en eso y siempre lo serán. architect no es una experiencia interactiva — es una herramienta de automatización. La interfaz es un comando, no una conversación. El output es código verificado y un reporte, no texto en pantalla.

---

## En resumen

El agente genera el código. architect se asegura de que funciona.

Open source. Sin suscripciones. Pagas solo la API del LLM que elijas.
