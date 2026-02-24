# architect — Feature Overview & Website Content

> Documento de referencia para la web de documentación (Astro Starlight).
> Contiene: copy de landing, resumen de todas las features, y estructura sugerida de secciones.

---

## 1. Hero / Tagline

### Opciones de tagline

```
architect — El agente de código que trabaja mientras tú duermes.

architect — Tu agente de código headless. Automatiza, paraleliza, y escala.

architect — Agentes de IA para tus pipelines, no para tu IDE.
```

### Elevator pitch (hero subtitle)

> Herramienta CLI que orquesta agentes de IA para escribir, revisar, y corregir código automáticamente. Headless-first: diseñada para CI/CD, pipelines, y automatización. Multi-modelo, extensible con hooks, y con guardrails de seguridad integrados. Open source.

### Versión larga (para sección "Qué es architect")

> architect es una herramienta de línea de comandos que convierte cualquier LLM en un agente de código autónomo. Dale una tarea, y architect lee tu código, planifica los cambios, los implementa, ejecuta tests, y verifica el resultado — todo sin intervención humana.
>
> A diferencia de los asistentes de código que viven dentro de un IDE, architect está diseñada para ejecutarse donde el código realmente se construye: en terminales, scripts, Makefiles, y pipelines de CI/CD. Es la pieza que falta entre "tengo una IA que genera código" y "tengo una IA que entrega código verificado".

---

## 2. Killer Features (Landing — sección principal)

Estas son las 6-8 features que deberían ocupar la sección principal de la landing, cada una con icono, título, descripción corta, y un snippet de código.

---

### 🔀 Multi-Modelo, Cero Lock-in

Usa cualquier LLM: OpenAI, Anthropic, Google, DeepSeek, Mistral, Ollama, o cualquier proveedor compatible con OpenAI. Cambia de modelo con una línea de config. Sin dependencia de ningún vendor.

```bash
# OpenAI
architect run "Añade autenticación JWT" --model gpt-4.1

# Anthropic
architect run "Añade autenticación JWT" --model claude-sonnet-4

# Local con Ollama
architect run "Añade autenticación JWT" --model ollama/llama3
```

Funciona con LiteLLM bajo el capó: más de 100 proveedores soportados, incluyendo proxies corporativos y modelos self-hosted.

---

### 🔁 Ralph Loop — Iteración Autónoma

El patrón más productivo en agentic coding, integrado como feature nativa. En vez de confiar en que la IA decida cuándo ha terminado, architect ejecuta tus tests y linters después de cada iteración. Si fallan, el agente vuelve a intentarlo con contexto limpio. Si pasan, el loop termina.

```bash
architect loop "Implementa el módulo de pagos completo" \
  --check "pytest tests/ -q" \
  --check "ruff check src/" \
  --max-iterations 25
```

```
─── Ralph Loop · Iteración 3/25 ─────────────────

🔄 Agente trabajando (contexto limpio + errores de iter. 2)...
   🔧 edit_file → src/payments/stripe.py
   🔧 edit_file → tests/test_payments.py
   ✅ Agente completó

🧪 Verificación externa:
   ✓ pytest tests/ -q → 18/18 passed
   ✓ ruff check src/ → sin errores

✅ Loop completado en 3 iteraciones ($0.089)
```

Cada iteración arranca con un contexto fresco — sin acumular basura de intentos anteriores. Solo recibe: la spec original, el diff acumulado, y los errores de la última iteración. El resultado: código que compila, pasa tests, y está limpio.

---

### ⚡ Parallel Runs con Git Worktrees

Lanza múltiples agentes en paralelo, cada uno en su propio git worktree aislado. Misma tarea con diferentes modelos para comparar. O diferentes tareas en paralelo para multiplicar velocidad.

```bash
# Competitive execution: 3 modelos, misma tarea
architect parallel "Refactoriza el módulo auth" \
  --models gpt-4.1,claude-sonnet-4,deepseek-chat

# Fan-out: tareas diferentes en paralelo
architect parallel \
  --task "Añade tests para auth.py" \
  --task "Implementa endpoint /users" \
  --task "Actualiza la documentación del API"
```

```
─── Resultados ──────────────────────────────────

Worker 1 (gpt-4.1)         → architect/parallel-1  ✅  8 pasos  $0.034
Worker 2 (claude-sonnet-4)  → architect/parallel-2  ✅  5 pasos  $0.028
Worker 3 (deepseek-chat)    → architect/parallel-3  ⚡ 20 pasos  $0.006

architect diff parallel-1 parallel-2    # Comparar
architect merge parallel-2              # Mergear la ganadora
```

Worktrees nativos de git: sin copias, sin conflictos, sin Docker. Cada worker opera en un snapshot aislado del repo.

---

### 🛡️ Guardrails & Quality Gates

El agente no puede declarar "he terminado" hasta que tus checks pasen. Archivos protegidos que la IA no puede tocar. Comandos bloqueados. Límites de archivos y líneas. Reglas de código que se aplican en cada escritura. Todo declarativo en YAML, versionable, y determinista.

```yaml
# .architect/guardrails.yaml
guardrails:
  protected_files: [".env", "*.pem", "migrations/*"]
  blocked_commands: ['rm -rf /', 'git push --force']
  max_files_modified: 30

  quality_gates:
    - name: lint
      command: "ruff check src/"
      required: true
    - name: tests
      command: "pytest tests/ -q"
      required: true

  code_rules:
    - pattern: 'eval\('
      message: "Prohibido: usa alternativas seguras."
      severity: block
```

```
✅ Agente completó (12 pasos)

🛡️ Quality Gates:
   ✓ lint — sin errores
   ✓ tests — 24/24 passed
   ✗ security — 1 issue (hardcoded password)

⚠️ Gate 'security' falló → agente corrigiendo automáticamente...
```

Los guardrails son deterministas: siempre se ejecutan, el LLM no puede saltárselos. La diferencia entre "una IA que genera código" y "una IA en la que puedes confiar".

---

### 📋 Pipelines Declarativos

Define workflows multi-paso en YAML. Plan → Build → Test → Review → Fix → Document. Cada paso es un agente independiente con su propio contexto, modelo, y checks. Variables fluyen entre pasos. Checkpoints permiten reiniciar desde cualquier punto.

```yaml
# pipelines/feature.yaml
name: "nueva-feature"
steps:
  - name: plan
    agent: plan
    prompt: "Analiza y planifica: {{task}}"
    output_var: plan_result

  - name: implement
    agent: build
    prompt: "Implementa: {{plan_result}}"
    checkpoint: true

  - name: test
    agent: build
    prompt: "Escribe tests completos"
    checks: ["pytest tests/ -q"]

  - name: review
    agent: review
    prompt: "Revisa cambios, identifica bugs"
    output_var: review_result

  - name: fix
    agent: build
    condition: "{{review_result}}"
    prompt: "Corrige: {{review_result}}"
```

```bash
architect pipeline feature.yaml --var task="Búsqueda de usuarios"
architect pipeline feature.yaml --from-step test   # Reiniciar desde un paso
```

Composable: crea pipelines para features, bugfixes, refactors, migraciones, releases. Cada pipeline es un archivo YAML reutilizable.

---

### 🪝 Extensible con Hooks

Inyecta tu propia lógica en cada punto del lifecycle del agente. Antes y después de cada tool, de cada llamada al LLM, al iniciar sesión, al terminar. Los hooks son scripts shell: formatear código automáticamente después de cada edición, bloquear comandos peligrosos, inyectar contexto de git, notificar a Slack cuando termina.

```yaml
hooks:
  pre_tool_use:
    - name: security-check
      matcher: "run_command"
      command: ".architect/hooks/block-dangerous.sh"

  post_tool_use:
    - name: auto-format
      matcher: "write_file|edit_file"
      file_patterns: ["*.py"]
      command: "ruff format $ARCHITECT_FILE_PATH --quiet"

  session_end:
    - name: notify
      command: ".architect/hooks/slack-notify.sh"
      async: true
```

10 eventos del lifecycle. Variables de entorno con contexto completo. Hooks async para notificaciones. Pre-hooks que pueden bloquear, permitir, o modificar la acción. El mismo patrón que Claude Code y Cursor — compatible con el ecosistema.

---

### 🏗️ Hecho para CI/CD

architect no es un chat que también funciona headless. Es headless-first: diseñada desde el principio para ejecutarse sin supervisión en GitHub Actions, GitLab CI, Jenkins, o cualquier pipeline.

```yaml
# .github/workflows/architect-review.yml
- name: AI Code Review
  run: |
    architect run "Revisa los cambios de este PR" \
      --agent review \
      --context-git-diff origin/main \
      --report markdown \
      --budget 0.10 \
      --timeout 300 \
      --json
```

Exit codes semánticos (0=success, 1=failed, 2=partial). Output JSON parseable. Reportes en Markdown para PR comments. Budget y timeout como hard limits. Sin confirmaciones, sin prompts interactivos. El agente trabaja, produce un resultado, y sale.

```bash
# Generar changelog desde la última tag
architect run "Genera changelog desde v1.2.0" --report markdown > CHANGELOG.md

# Fix automático de lint errors en CI
architect loop "Corrige todos los errores de lint" \
  --check "eslint src/ --max-warnings 0" \
  --max-iterations 10

# Review automático de cada PR
architect run "Revisa este diff" --context-git-diff origin/main --report github
```

---

### 🧠 Aprende Con El Uso

architect detecta automáticamente cuando le corriges y guarda la lección en `.architect/memory.md`. La próxima vez que trabaje en tu proyecto, ya sabe que usas pytest en vez de unittest, que los imports van desde `src.core`, y que el deploy es con Docker.

```markdown
<!-- .architect/memory.md (auto-generado, editable) -->
# Memoria del Proyecto

- [2026-02-15] Corrección: usar pytest, no unittest
- [2026-02-15] Corrección: importar desde src.core, no desde core
- [2026-02-18] Patrón: endpoints en src/routes/ con APIRouter
- [2026-02-18] Corrección: el deploy es con docker compose up --build
```

La memoria es un archivo markdown plano: versionable, editable, y transparente. Sin bases de datos vectoriales, sin magia oculta. Solo un archivo que crece con cada sesión y hace que el agente cometa menos errores con el tiempo.

Combinado con `.architect.md` (instrucciones del proyecto) y **skills** compatibles con el estándar Vercel, tienes tres capas de conocimiento: reglas permanentes, skills especializadas, y memoria acumulada.

---

## 3. Features Completas (Para sección "Features" de docs)

Inventario exhaustivo organizado por categoría. Cada feature con una línea de descripción.

### Core — El Motor

| Feature | Descripción |
|---------|-------------|
| **Agent Loop inteligente** | El agente trabaja hasta que decide que terminó. Sin límites artificiales de pasos. Los watchdogs (budget, timeout, context) piden un cierre limpio en vez de cortar abruptamente. |
| **Context Manager** | Gestión automática de la ventana de contexto. Comprime mensajes antiguos cuando se llena. Mantiene siempre los mensajes recientes y el system prompt intactos. |
| **Execution Engine** | Motor centralizado que valida, autoriza, y ejecuta cada acción del agente. Políticas de confirmación configurables: `yolo`, `confirm-sensitive`, `confirm-all`. |
| **Streaming** | Respuestas del LLM en streaming en tiempo real. Ve lo que el agente está pensando mientras trabaja. |
| **Graceful Shutdown** | Ctrl+C no corta: pide al agente que resuma qué hizo y qué queda pendiente. Siempre sabes en qué punto quedó. |
| **Cost Tracking** | Seguimiento de coste por paso, por sesión, y acumulado. Budget limits como hard stops. Warnings configurables. |
| **Prompt Caching** | Cache de prompts para reducir tokens y costes en llamadas repetitivas al mismo modelo. |
| **Structured Logging** | JSON estructurado con structlog. Nivel `human` para logs legibles con iconos. Niveles debug/info/warn/error para desarrollo. |

### Tools — Lo Que El Agente Puede Hacer

| Feature | Descripción |
|---------|-------------|
| **read_file** | Lee archivos con números de línea. Soporta rangos parciales para archivos grandes. |
| **write_file** | Crea archivos nuevos con contenido completo. |
| **edit_file** | Edita archivos existentes con búsqueda y reemplazo preciso. Sin reescribir el archivo entero. |
| **search_code** | Búsqueda semántica en el codebase con contexto alrededor de los resultados. |
| **grep** | Búsqueda por regex rápida en múltiples archivos. |
| **list_directory** | Exploración de la estructura del proyecto. |
| **run_command** | Ejecuta comandos shell con timeout, captura de output, y feedback al agente. |
| **Diff inteligente** | Genera diffs legibles que el agente puede interpretar. Detecta cambios semánticos vs. cosméticos. |
| **Repo map** | Indexa la estructura del proyecto para dar al agente una visión general: archivos, funciones, clases, imports. |
| **MCP Client** | Conecta con servidores MCP remotos para tools externos: bases de datos, APIs, servicios cloud. Descubrimiento automático de tools. |
| **dispatch_subagent** | El agente puede delegar sub-tareas a agentes especializados con su propio contexto. Investiga sin contaminar el contexto principal. |

### Agentes — Roles Especializados

| Feature | Descripción |
|---------|-------------|
| **build** | Agente principal. Planifica y ejecuta cambios de código. Acceso completo a todas las tools. |
| **plan** | Solo lectura. Analiza el codebase y produce un plan de acción sin tocar nada. |
| **review** | Solo lectura. Revisa cambios buscando bugs, problemas de seguridad, y violaciones de convenciones. |
| **Agentes custom** | Define agentes propios en YAML con prompt, tools permitidas, y configuración específica. |
| **Auto-Review** | Patrón Writer/Reviewer automático: el agente `build` termina, y un agente `review` revisa sus cambios en contexto limpio. Si encuentra problemas, el builder los corrige. |

### Automatización — Lo Que Hace Especial a architect

| Feature | Descripción |
|---------|-------------|
| **Ralph Loop** | Iteración autónoma hasta que los tests pasen. Cada iteración con contexto limpio. Progress tracking. Verificación externa objetiva. |
| **Parallel Runs** | Múltiples agentes en paralelo con git worktrees. Competitive execution (misma tarea, N modelos). Fan-out (tareas diferentes). |
| **Pipeline Mode** | Workflows YAML multi-paso con variables, condiciones, y checkpoints. Composable y reutilizable. |
| **Checkpoints & Rollback** | Snapshots automáticos ligados a git commits. Rollback a cualquier punto. Resume desde el último checkpoint. |
| **Session Resume** | Serialización completa del estado. Si el agente se interrumpe (crash, timeout, Ctrl+C), reanuda exactamente donde quedó. |
| **Competitive Eval** | Ejecuta la misma tarea con N modelos diferentes y compara resultados objetivamente: pasos, coste, tests pasados, calidad. |
| **Dry Run** | Previsualiza lo que el agente haría sin ejecutar nada. Como `terraform plan` pero para código. |

### Seguridad & Calidad

| Feature | Descripción |
|---------|-------------|
| **Guardrails** | Archivos protegidos, comandos bloqueados, límites de cambios, reglas de código. Declarativo en YAML. Determinista: el LLM no puede saltárselos. |
| **Quality Gates** | Checks obligatorios antes de que el agente pueda declarar "completado". Si fallan, el agente sigue trabajando hasta que pasen. |
| **Hooks System** | 10 eventos del lifecycle con handlers personalizables. Pre/post tool, pre/post LLM, session start/end, agent complete, budget warning. |
| **Code Health Delta** | Mide métricas de salud del código antes y después: complejidad, duplicación, coverage. Verifica que el agente mejoró el código, no lo empeoró. |

### Conocimiento & Contexto

| Feature | Descripción |
|---------|-------------|
| **.architect.md** | Instrucciones del proyecto siempre presentes en el prompt. Convenciones, stack, reglas. Como CLAUDE.md o AGENTS.md. |
| **Skills (Vercel-compatible)** | Skills especializadas con formato SKILL.md estándar. Se activan automáticamente por glob de archivos. Instalables desde GitHub o URLs. |
| **Memoria Procedural** | Detección automática de correcciones del usuario. Persistencia entre sesiones en `.architect/memory.md`. El agente mejora con el uso. |
| **Presets** | Configuraciones predefinidas para empezar rápido: `architect init --preset python`, `--preset node-react`, `--preset ci`. |

### Observabilidad

| Feature | Descripción |
|---------|-------------|
| **Human Logs** | Logs legibles con iconos para seguir al agente en tiempo real. Qué archivo lee, qué edita, qué comando ejecuta, cuánto cuesta. |
| **Execution Reports** | Reportes post-ejecución en JSON, Markdown, o formato GitHub PR comment. Perfecto para CI/CD y auditoría. |
| **OpenTelemetry** | Emisión nativa de traces OTel para cada sesión, paso, llamada al LLM, y tool execution. Compatible con Grafana, Datadog, Jaeger. |
| **Cost Reports** | Desglose de costes por paso, por modelo, y por sesión. Budget warnings y hard limits. |

---

## 4. Comparativa — Por Qué architect

### Posicionamiento

```
                     Interactivo ←──────────────────→ Automatizado
                          │                                │
              Claude Code │                                │ architect
                 Cursor   │                                │
                          │                                │
                     IDE  ←──────────────────→ Terminal / CI
```

| | Claude Code | Cursor | Aider | architect |
|---|---|---|---|---|
| **Modo principal** | Terminal interactiva | IDE (VS Code) | Terminal interactiva | Headless / CI |
| **Multi-modelo** | Solo Claude | Multi (con config) | Multi | Multi (LiteLLM) |
| **Parallel runs** | Manual (worktrees) | No | No | Nativo |
| **Ralph Loop** | Plugin externo | No | No | Nativo |
| **Pipelines YAML** | No | No | No | Sí |
| **Guardrails** | Hooks (manual) | Limitado | No | Declarativo (YAML) |
| **Quality Gates** | No | No | No | Sí |
| **CI/CD-first** | Adaptable | No | Parcial | Diseñado para ello |
| **Reports** | No | No | No | JSON / MD / GitHub |
| **Skills ecosystem** | Sí | Sí | No | Sí (Vercel-compatible) |
| **Memoria procedural** | No (solo CLAUDE.md manual) | No | No | Auto-generada |
| **Session resume** | Parcial | No | No | Completo |
| **Checkpoints** | Interactivo (/revert) | No | Git auto-commits | Programático |
| **OpenTelemetry** | No | No | No | Nativo |
| **Coste** | $20/mes (Pro) | $20/mes | API costs | API costs (open source) |

### Frases para la comparativa

> **vs Claude Code**: Claude Code es el mejor agente interactivo en terminal. architect es el mejor agente para automatización. Claude Code es tu copiloto; architect es tu equipo de CI.

> **vs Cursor**: Cursor vive dentro del IDE. architect vive donde el código se despliega: en pipelines, scripts, y cron jobs.

> **vs Aider**: Aider fue pionero en agentes CLI. architect lleva la idea más lejos: parallel runs, pipelines declarativos, guardrails, quality gates, y una arquitectura pensada para ejecutarse sin supervisión durante horas.

---

## 5. Casos de Uso — Sección "Use Cases"

### Para Developers Individuales

**Coding overnight**: Configura un Ralph Loop con tu spec y tus tests. Cierra el portátil. A la mañana siguiente tienes un PR con código que compila y pasa todos los tests.

```bash
architect loop --spec tasks/payment-module.md \
  --check "pytest tests/ -q" \
  --check "mypy src/" \
  --max-iterations 30
```

**Competitive coding**: ¿No sabes qué modelo es mejor para tu tarea? Lanza 3 en paralelo y compara resultados reales en tu codebase, no en benchmarks genéricos.

```bash
architect parallel "Optimiza las queries SQL del módulo de reportes" \
  --models gpt-4.1,claude-sonnet-4,deepseek-chat
```

**Refactoring asistido**: Preview qué haría el agente antes de ejecutar. Luego ejecuta con checkpoints para poder volver atrás en cualquier momento.

```bash
architect run "Migra de SQLAlchemy sync a async" --dry-run
architect run "Migra de SQLAlchemy sync a async" --checkpoint-every 5
```

### Para Equipos

**Review automático en cada PR**: Integra architect en tu pipeline de CI. El agente revisa cada PR buscando bugs, security issues, y violaciones de convenciones.

```yaml
# .github/workflows/review.yml
- run: |
    architect run "Revisa este PR" \
      --agent review \
      --context-git-diff origin/main \
      --report github > review.md
```

**Estándares compartidos**: `.architect.md` + guardrails + skills = convenciones del equipo codificadas y verificadas automáticamente. Versionados en git, aplicados en cada ejecución.

**Onboarding de modelos**: Cuando cambias de modelo (o sale uno nuevo), `architect eval` te dice objetivamente cómo se comporta en tu codebase real.

### Para CI/CD & DevOps

**Fix automático de pipelines rotos**: Cuando el lint falla en CI, architect puede corregirlo automáticamente.

```yaml
- run: |
    architect loop "Corrige todos los errores de lint" \
      --check "eslint src/ --max-warnings 0" \
      --max-iterations 5 \
      --budget 0.50
```

**Generación de changelogs**: Lee los commits desde la última release y genera un changelog formateado.

```bash
architect run "Genera changelog desde $(git describe --tags --abbrev=0)" \
  --report markdown > CHANGELOG.md
```

**Documentación automática**: Después de cada merge a main, actualiza la documentación.

```bash
architect pipeline pipelines/update-docs.yaml
```

---

## 6. Quick Start — Sección "Getting Started"

```bash
# Instalar
pip install architect

# Configurar (interactivo)
architect init --preset python

# O configurar manualmente
export OPENAI_API_KEY=sk-...
echo 'llm:\n  model: gpt-4.1' > config.yaml

# Tu primer agente
architect run "Añade un endpoint GET /health que devuelva {status: ok}"

# Ver lo que haría sin ejecutar
architect run "Refactoriza el módulo auth" --dry-run

# Tu primer Ralph Loop
architect loop "Corrige todos los errores de lint" \
  --check "ruff check src/" \
  --max-iterations 10
```

---

## 7. Estructura Sugerida de Docs (Sidebar)

```
📖 Documentación
├── Getting Started
│   ├── Instalación
│   ├── Configuración
│   ├── Tu primera tarea
│   └── Presets
│
├── Conceptos
│   ├── Cómo funciona architect
│   ├── Agentes (build, plan, review, custom)
│   ├── Tools disponibles
│   ├── Context Management
│   └── Cost tracking
│
├── Guías
│   ├── Configurar .architect.md
│   ├── Escribir guardrails
│   ├── Crear hooks personalizados
│   ├── Instalar y crear skills
│   ├── Configurar pipelines YAML
│   ├── Usar el Ralph Loop
│   ├── Parallel runs y worktrees
│   ├── Session resume y checkpoints
│   ├── Integrar con CI/CD (GitHub Actions, GitLab CI)
│   ├── Memoria procedural
│   └── OpenTelemetry y observabilidad
│
├── Referencia
│   ├── config.yaml (esquema completo)
│   ├── CLI (todos los comandos y flags)
│   ├── Hooks (eventos, variables, output)
│   ├── Guardrails (opciones)
│   ├── Pipeline YAML (formato)
│   ├── Exit codes
│   └── Variables de entorno
│
├── Recetas
│   ├── AI review en cada PR
│   ├── Fix automático de lint en CI
│   ├── Changelog automático
│   ├── Competitive eval de modelos
│   ├── Refactoring seguro con checkpoints
│   ├── Coding overnight con Ralph Loop
│   └── Multi-repo con .architect.md jerárquico
│
└── Más
    ├── Comparativa con otras herramientas
    ├── FAQ
    ├── Roadmap
    └── Contribuir
```

---

## 8. Valores / Principios — Para sección "Philosophy" o "About"

### Headless-first

architect no es un chat con superpoderes. Es una herramienta de automatización que habla con LLMs. La interfaz principal es un comando, no una conversación. El output principal es código verificado, no texto.

### Determinismo sobre probabilismo

Las instrucciones en un prompt son sugerencias. Los hooks y guardrails son reglas. architect combina ambos: el LLM decide *qué* hacer, pero los guardrails aseguran que no rompa nada. Quality gates verifican que el resultado es correcto antes de declarar victoria.

### Transparencia total

Cada acción del agente se registra: qué archivo leyó, qué editó, qué comando ejecutó, cuánto costó. Human logs para humanos, JSON para máquinas, OpenTelemetry para dashboards. Sin cajas negras.

### Multi-modelo por diseño

No dependas de un solo proveedor. Usa el modelo barato para tareas simples y el caro para las difíciles. Compara modelos en tu codebase real. Cambia de proveedor sin reescribir nada.

### Mejora con el uso

La memoria procedural, las skills, y `.architect.md` hacen que architect sea más útil cuanto más la usas. Cada corrección que le haces se guarda. Cada convención de tu proyecto se aprende. El agente de la semana 10 comete menos errores que el de la semana 1.

### Open source, sin surprises

Sin suscripciones, sin tiers, sin features bloqueadas. Pagas solo los costes de API del LLM que elijas. El código es tuyo. Tus datos se quedan en tu máquina.

---

## 9. Números para Social Proof (cuando estén disponibles)

Placeholders para métricas reales que se podrán añadir:

- "X modelos soportados vía LiteLLM" → **100+**
- "Eventos del lifecycle con hooks" → **10**
- "Formatos de report" → **JSON, Markdown, GitHub PR**
- "Proveedores de LLM compatibles" → **OpenAI, Anthropic, Google, Mistral, Cohere, DeepSeek, Ollama, vLLM, y 100+ más**
- Compatible con el estándar de skills de **Vercel, Claude Code, Codex CLI, y 20+ herramientas**

---

## 10. Feature Badges / Chips (para la hero o header)

```
🔀 Multi-modelo   🔁 Ralph Loop   ⚡ Parallel runs   🛡️ Guardrails
📋 Pipelines YAML   🪝 Hooks   🏗️ CI/CD-first   🧠 Memoria auto
📡 OpenTelemetry   📊 Reports   🔍 Dry run   🧰 Skills Vercel
```

---

## 11. CTA (Call to Action)

```
Empieza en 2 minutos:
  pip install architect && architect init --preset python

GitHub → github.com/tu-user/architect
Docs → docs.architect.dev
```
