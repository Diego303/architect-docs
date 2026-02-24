# architect — Feature Overview & Website Content (Core)

> Documento de referencia para la web de documentación (Astro Starlight).
> Cubre exclusivamente las funcionalidades implementadas en el core (v1, v2, v3).

---

## 1. Hero / Tagline

### Opciones de tagline

```
architect — Tu agente de código headless. Automatiza, verifica, escala.

architect — El agente de código que trabaja sin supervisión.

architect — Agentes de IA para tu terminal, CI, y pipelines. No para tu IDE.
```

### Elevator pitch (hero subtitle)

> Herramienta CLI open source que convierte cualquier LLM en un agente de código autónomo. Headless-first: diseñada para funcionar sin supervisión en terminales, CI/CD, cron jobs, y scripts. Multi-modelo vía LiteLLM. Verificación automática post-edición. Logs legibles para humanos. Open source.

### Versión larga (para sección "Qué es architect")

> architect es una herramienta de línea de comandos que orquesta agentes de IA para leer, analizar, y modificar código automáticamente. Dale una tarea en lenguaje natural, y architect planifica los cambios, los implementa, ejecuta lint y tests para verificarlos, y te devuelve un resultado limpio — todo sin intervención humana.
>
> A diferencia de los asistentes que viven dentro de un editor, architect está diseñada para ejecutarse donde el código realmente se construye: en terminales, Makefiles, y pipelines de CI/CD. Es la pieza que falta entre "tengo una IA que sugiere código" y "tengo una IA que entrega código verificado".
>
> Funciona con cualquier LLM: OpenAI, Anthropic, Google, DeepSeek, Mistral, modelos locales con Ollama — más de 100 proveedores soportados. Tú eliges el modelo, architect hace el trabajo.

---

## 2. Killer Features (Landing — sección principal)

Estas son las features principales que deberían ocupar la sección destacada de la landing. Cada una con icono, título, descripción, y snippet de código.

---

### 🔀 Multi-Modelo, Cero Lock-in

Usa cualquier LLM sin atarte a un proveedor. OpenAI, Anthropic, Google, DeepSeek, Mistral, Ollama, vLLM — o cualquier API compatible con OpenAI. Cambia de modelo con un flag. Sin lock-in, sin sorpresas.

```bash
# OpenAI
architect run "Añade autenticación JWT" --model gpt-4.1

# Anthropic
architect run "Añade autenticación JWT" --model claude-sonnet-4

# Google
architect run "Añade autenticación JWT" --model gemini/gemini-2.5-pro

# Modelo local con Ollama
architect run "Añade autenticación JWT" --model ollama/llama3

# Cualquier proxy compatible OpenAI
architect run "Añade autenticación JWT" --model openai/my-custom-model \
  --api-base http://mi-proxy:8000
```

Bajo el capó, architect usa LiteLLM: una capa de abstracción que soporta más de 100 proveedores. Configurar un modelo es una línea en el YAML. Migrar de uno a otro es cambiar esa línea.

```yaml
# config.yaml
llm:
  model: claude-sonnet-4          # Cambia esto y listo
  api_key_env: ANTHROPIC_API_KEY  # Lee la key desde env var
  timeout: 60
  retries: 2
  stream: true
  prompt_caching: true            # Ahorra tokens en llamadas repetitivas
```

---

### 🧠 El Agente Decide Cuándo Terminar

El agent loop de architect no tiene un contador de pasos que corta abruptamente. El agente trabaja hasta que decide que terminó: cuando no pide más tools, es que ha completado su tarea. Los límites de seguridad (budget, timeout, contexto) son watchdogs: cuando saltan, no cortan — le piden al agente un cierre limpio con un resumen de qué hizo y qué queda pendiente.

```
─── architect · build · claude-sonnet-4 ─────────────────

📖 read_file → src/auth/provider.py (145 líneas)
📖 read_file → src/routes/login.py (89 líneas)
🔧 edit_file → src/auth/provider.py (+12 -3)
📝 write_file → src/auth/jwt_handler.py (67 líneas)
🔧 edit_file → src/routes/login.py (+8 -2)
📝 write_file → tests/test_jwt.py (54 líneas)
🖥️ run_command → pytest tests/test_jwt.py -q  ✓ 4/4 passed
🔍 lint → ruff check src/auth/jwt_handler.py  ✓ sin errores

─── Resultado ─────────────────────────────────────

✅ Completado (8 pasos, 14.2s, $0.032)
```

Si algo sale mal o el agente se atasca, los watchdogs intervienen de forma limpia:

```
⚠️ Budget warning: $0.45 de $0.50 consumido
🔻 Pidiendo cierre limpio al agente...

✅ Cierre parcial (12 pasos, $0.47)
   Completado: endpoints /users y /orders
   Pendiente: tests de integración para /orders
```

Ctrl+C tampoco corta abruptamente — pide al agente que resuma dónde quedó antes de salir. Siempre sabes en qué punto está.

---

### 🛠️ Tools Potentes para el Agente

El agente no solo genera código: lee el codebase, busca patrones, ejecuta comandos, y verifica su propio trabajo. Cada tool está diseñada para dar al LLM el contexto justo que necesita sin desperdiciar tokens.

```
Tools de lectura:
  read_file          Lee archivos con números de línea y rangos parciales
  search_code        Búsqueda por regex con contexto alrededor de los resultados
  grep               Búsqueda rápida de texto literal en múltiples archivos
  find_files         Descubre archivos por nombre o patrón glob
  list_directory     Explora la estructura del proyecto

Tools de escritura:
  write_file         Crea archivos nuevos
  edit_file          Edición quirúrgica con búsqueda y reemplazo (str_replace)
  apply_patch        Aplica diffs unificados para cambios complejos

Tools de ejecución:
  run_command        Ejecuta comandos shell con timeout y captura de output

Tools de contexto:
  Repo indexer       Mapa del repositorio: archivos, funciones, clases, imports
                     Se inyecta automáticamente como contexto para el agente
```

El diff inteligente opera en tres niveles: `edit_file` para cambios puntuales (buscar y reemplazar una sección), `apply_patch` para diffs complejos (múltiples hunks), y `write_file` solo para archivos nuevos. El agente elige el nivel correcto según la tarea. Esto evita el problema clásico de agentes que reescriben archivos enteros y destruyen código existente.

```python
# edit_file: solo cambia lo que necesita
edit_file(
    path="src/auth/provider.py",
    old_str="def authenticate(self, token):\n    return self.verify(token)",
    new_str="def authenticate(self, token):\n    if not token:\n        raise AuthError('Token required')\n    return self.verify(token)",
)
# Solo esas líneas cambian. El resto del archivo se mantiene intacto.
```

---

### ✅ Verificación Automática Post-Edición

Cada vez que el agente edita un archivo, architect ejecuta automáticamente los verificadores que configures: linter, formatter, type checker, tests. Si algo falla, el resultado vuelve al agente como feedback para que lo corrija en el siguiente paso — sin intervención humana.

```yaml
# config.yaml
hooks:
  post_edit:
    - name: python-lint
      command: "ruff check $ARCHITECT_EDITED_FILE --no-fix"
      file_patterns: ["*.py"]
      timeout: 10

    - name: python-format
      command: "ruff format $ARCHITECT_EDITED_FILE --quiet"
      file_patterns: ["*.py"]
      timeout: 10

    - name: typecheck
      command: "mypy $ARCHITECT_EDITED_FILE --ignore-missing-imports"
      file_patterns: ["*.py"]
      timeout: 15
      enabled: false    # Desactivar si es muy lento
```

```
🔧 edit_file → src/services/payment.py (+15 -3)
  🔍 python-lint → ✓ sin errores
  🔍 python-format → ✓ formateado

🔧 edit_file → src/routes/payments.py (+8 -1)
  🔍 python-lint → ✗ F401: 'os' imported but unused
  → Feedback enviado al agente

📖 El agente lee el error y corrige automáticamente
🔧 edit_file → src/routes/payments.py (-1)  # Elimina import os
  🔍 python-lint → ✓ sin errores
```

El agente recibe los errores de lint como un tool result más. No se necesita un paso adicional ni configuración especial: la verificación es parte del flujo natural de edición.

---

### 🔌 Conecta con Cualquier Servicio vía MCP

architect se conecta a servidores MCP (Model Context Protocol) para que el agente pueda usar herramientas externas: bases de datos, APIs, servicios cloud, gestión de tickets. Las tools MCP se descubren automáticamente y aparecen al agente como si fueran nativas.

```yaml
# config.yaml
mcp:
  servers:
    - name: github
      url: http://localhost:3001
      token_env: GITHUB_MCP_TOKEN

    - name: database
      url: http://localhost:3002
      token_env: DB_MCP_TOKEN

    - name: jira
      url: http://localhost:3003
      token_env: JIRA_MCP_TOKEN
```

```bash
architect run "Lee el ticket PROJ-1234 de Jira, implementa lo que pide,
y crea un PR en GitHub con los cambios"
```

Para el agente, `mcp_jira_get_ticket` es una tool más — igual que `read_file` o `run_command`. Las mismas políticas de confirmación, el mismo logging, el mismo formato de resultado. Sin código de integración, sin SDKs extra: configuras la URL del servidor MCP y architect hace el resto.

---

### 🏗️ Hecho para Headless

architect no es un chat al que le añadieron un modo headless. Es headless-first. Cada decisión de diseño está pensada para que funcione sin supervisión: en CI/CD, en cron jobs, en scripts, dentro de un Makefile.

```bash
# En un script de bash
architect run "Añade endpoint GET /health" \
  --model gpt-4.1 \
  --agent build \
  --confirm-mode yolo \        # Sin confirmaciones
  --timeout 300 \              # Máximo 5 minutos
  --budget 0.50                # Máximo $0.50

echo "Exit code: $?"
# 0 = success, 1 = failed, 2 = partial
```

Exit codes semánticos que tu script puede interpretar. Output en streaming para ver qué hace el agente en tiempo real, o silenciable para cron. Logs JSON estructurados para parsear con `jq`. Configuración por archivo YAML, por variables de entorno, o por flags de CLI — lo que tu pipeline necesite.

```bash
# En GitHub Actions
- run: |
    architect run "Revisa los cambios de este PR" \
      --agent review \
      --confirm-mode yolo \
      --budget 0.15 \
      --timeout 300

# En un Makefile
ai-fix:
    architect run "Corrige los errores de lint" --confirm-mode yolo

# En cron
0 6 * * 1 cd /app && architect run "Actualiza dependencias" --timeout 600
```

---

### 👁️ Logs Que Puedes Leer

architect tiene un nivel de log `human` diseñado específicamente para seguir lo que hace el agente en tiempo real. Iconos claros, información útil, sin ruido. A diferencia de los logs debug que nadie lee, los human logs están pensados para que abras la terminal y entiendas qué está pasando de un vistazo.

```
─── architect · build · gpt-4.1 ─────────────────────────

📖 read_file → src/routes/users.py (89 líneas)
📖 read_file → src/models/user.py (45 líneas)
🔎 search_code → "class UserService" → 1 resultado
📖 read_file → src/services/user_service.py (120 líneas)
📝 write_file → src/routes/orders.py (56 líneas)
🔧 edit_file → src/routes/__init__.py (+2)
📝 write_file → tests/test_orders.py (78 líneas)
🖥️ run_command → pytest tests/test_orders.py -q
   ✓ 6/6 passed (1.2s)

─── Resultado ─────────────────────────────────────

✅ Completado en 9 pasos (18.3s, $0.028)
   Archivos creados: 2   Archivos modificados: 1
```

Tres niveles de detalle con un flag:

```bash
architect run "..." -v        # Human logs + info
architect run "..." -vv       # + debug (token counts, context usage)
architect run "..." -vvv      # + raw LLM requests/responses
```

Para CI y automatización, los mismos eventos se emiten como JSON estructurado:

```json
{"event": "tool_used", "tool": "edit_file", "file": "src/auth.py",
 "lines_added": 12, "lines_removed": 3, "step": 4, "cost_usd": 0.003}
```

---

### 💰 Control de Costes Integrado

Cada llamada al LLM se rastrea: tokens de entrada, tokens de salida, coste calculado según el modelo. Sabes exactamente cuánto cuesta cada tarea, cada paso, cada sesión. Puedes poner límites duros de presupuesto y el agente se detendrá limpiamente cuando los alcance.

```yaml
# config.yaml
costs:
  enabled: true
  budget_usd: 1.00      # Hard limit: parar al llegar a $1
  warn_at_usd: 0.75     # Warning al 75%
```

```bash
# O por ejecución
architect run "Refactoriza el módulo auth" --budget 0.50
```

```
📊 Paso 5: $0.012 (in: 2.4k tokens, out: 890 tokens)
📊 Acumulado: $0.078 / $0.50

...

⚠️ Budget warning: $0.38 de $0.50 consumido
🔧 edit_file → tests/test_auth.py (+24)
📊 Paso 12: $0.045 — Acumulado: $0.42

✅ Completado (12 pasos, $0.42)
```

Con prompt caching habilitado, las llamadas repetitivas al mismo modelo reutilizan el prefijo del prompt en caché, reduciendo tokens y coste significativamente en tareas largas.

---

### 🤖 Agentes Especializados

architect viene con agentes predefinidos para diferentes tipos de tareas, y puedes definir los tuyos.

**build** — El agente principal. Planifica internamente y ejecuta cambios de código. Acceso completo a todas las tools. Primero lee y analiza, luego actúa.

**plan** — Solo lectura. Analiza el codebase y produce un plan de acción o documentación sin tocar ningún archivo. Perfecto para entender código o planificar antes de ejecutar.

```bash
# build: implementa cambios
architect run "Añade rate limiting con Redis" --agent build

# plan: solo analiza
architect run "Analiza cómo funciona el sistema de auth actual
y describe cómo añadirías OAuth2" --agent plan
```

Define agentes custom en YAML para roles específicos de tu proyecto:

```yaml
# config.yaml
agents:
  build:
    confirm_mode: confirm-sensitive
    max_steps: 50

  plan:
    confirm_mode: yolo
    max_steps: 20

  # Agente custom para deploy
  deploy:
    system_prompt: |
      Eres un agente de deployment. Solo puedes modificar archivos
      en k8s/, terraform/, y docker/. NUNCA toques código de aplicación.
    allowed_tools: [read_file, search_code, run_command, write_file, edit_file]
    confirm_mode: confirm-all
    max_steps: 15

  # Agente custom de documentación
  docs:
    system_prompt: |
      Eres un agente de documentación técnica. Lees código y produces
      documentación clara en Markdown. Solo modificas archivos en docs/.
    allowed_tools: [read_file, search_code, find_files, write_file, grep]
    confirm_mode: yolo
    max_steps: 30
```

```bash
architect run "Actualiza los manifests de K8s para el nuevo servicio" --agent deploy
architect run "Documenta el módulo src/services/" --agent docs
```

Cada agente tiene su propio system prompt, tools permitidas, política de confirmación, y límite de pasos. El mismo motor, roles diferentes.

---

### 🔍 Contexto Inteligente del Repositorio

Antes de que el agente empiece a trabajar, architect indexa tu repositorio y construye un mapa: qué archivos existen, qué funciones y clases definen, qué importan. Este mapa se inyecta automáticamente en el contexto del agente para que sepa dónde buscar sin tener que explorar a ciegas.

```
Repo map (auto-generado, inyectado en el prompt):

src/
├── routes/
│   ├── users.py        → [GET /users, POST /users, GET /users/{id}]
│   ├── orders.py       → [GET /orders, POST /orders]
│   └── payments.py     → [POST /payments/create, POST /payments/webhook]
├── services/
│   ├── user_service.py → class UserService [create, get_by_id, update]
│   └── payment_service.py → class PaymentService [create_intent, confirm]
├── models/
│   ├── user.py         → class User(Base), class UserRole(Enum)
│   └── payment.py      → class Payment(Base), class PaymentStatus(Enum)
└── config/
    └── settings.py     → class Settings(BaseModel)
```

El agente sabe que `UserService` está en `src/services/user_service.py` sin necesidad de hacer grep ni list_directory primero. Cuando el contexto crece demasiado (conversaciones largas), el `ContextManager` comprime automáticamente los mensajes antiguos para hacer espacio, manteniendo siempre los recientes y el system prompt intactos.

```yaml
# config.yaml
context:
  max_tool_result_tokens: 2000   # Truncar outputs largos de tools
  compress_threshold: 0.75       # Comprimir cuando se usa el 75% del contexto
  keep_recent_steps: 4           # Siempre mantener los últimos 4 pasos
  max_context_tokens: 100000     # Tope del context window

indexer:
  enabled: true
  max_file_size: 1000000         # No indexar archivos >1MB
```

---

### 🖥️ Ejecución de Comandos Segura

El agente puede ejecutar comandos shell para compilar, testear, instalar dependencias, o cualquier otra operación. Pero con seguridad por capas: timeout por comando, captura de output truncada, y políticas de confirmación configurables.

```yaml
# config.yaml
commands:
  enabled: true
  default_timeout: 30            # Segundos por comando
  max_output_lines: 200          # No inundar el contexto con output largo
```

```
🖥️ run_command → pip install stripe
   ✓ Successfully installed stripe-8.4.0 (3.2s)

🖥️ run_command → pytest tests/test_payments.py -q
   ✗ FAILED tests/test_payments.py::test_webhook - AssertionError
   2/3 passed, 1 failed (1.8s)
   → Feedback enviado al agente

🔧 edit_file → tests/test_payments.py (+3 -1)
🖥️ run_command → pytest tests/test_payments.py -q
   ✓ 3/3 passed (1.6s)
```

Cuando un comando falla, el output del error se devuelve al agente como feedback. El agente lee el error, entiende qué pasó, y corrige. Es el ciclo de desarrollo natural — read, write, run, fix — pero automatizado.

Con la política de confirmación `confirm-sensitive`, el agente puede leer archivos y buscar código sin pedir permiso, pero cada comando shell requiere confirmación. En modo `yolo` (headless/CI), todo se ejecuta sin confirmar.

---

### 🔄 Self-Evaluation

architect puede evaluar automáticamente el resultado de su propio trabajo antes de declarar completado. En modo `basic`, verifica que la tarea se ejecutó sin errores. En modo `full`, lanza un segundo pase de evaluación que actúa como critic: revisa el resultado y si no es satisfactorio, el agente lo intenta de nuevo.

```yaml
# config.yaml
evaluation:
  mode: "basic"     # "off" | "basic" | "full"
  max_retries: 2    # Solo en modo full: reintentos máximos
```

```
✅ Agente completó (8 pasos)

🔍 Self-eval (basic):
   ✓ Sin errores durante la ejecución
   ✓ Todas las ediciones aplicadas correctamente
   ✓ Último comando exitoso

✅ Validado
```

En modo `full`:

```
✅ Agente completó (8 pasos)

🔍 Self-eval (full — critic pass):
   "El endpoint /orders no maneja el caso de usuario no existente.
    Falta un test para el error 404."

🔄 Retry 1/2 con feedback del critic...
   🔧 edit_file → src/routes/orders.py (+5)
   📝 write_file → tests/test_orders_errors.py
   🖥️ run_command → pytest tests/ -q  ✓ 8/8 passed

🔍 Self-eval (full — critic pass):
   "Todo correcto. Edge cases cubiertos."

✅ Validado (1 retry)
```

---

## 3. Features Completas (Para sección "Features" de docs)

Inventario exhaustivo organizado por categoría.

### Core — El Motor

| Feature | Descripción |
|---------|-------------|
| **Agent Loop inteligente** | `while True` — el LLM trabaja hasta que decide que terminó. Sin límites artificiales de pasos. Los watchdogs (budget, timeout, context) inyectan un cierre limpio en vez de cortar abruptamente. |
| **Context Manager** | Gestión automática de la ventana de contexto. Comprime mensajes antiguos cuando se llena (threshold configurable). Mantiene siempre los mensajes recientes y el system prompt intactos. Trunca resultados de tools para no desperdiciar tokens. |
| **Execution Engine** | Motor centralizado que valida, autoriza, y ejecuta cada acción del agente. Separa la decisión del LLM de la ejecución real. |
| **Políticas de confirmación** | Tres modos: `yolo` (todo automático), `confirm-sensitive` (confirmar escrituras y comandos), `confirm-all` (confirmar todo). Configurable por agente. |
| **Estado inmutable** | Cada paso produce un nuevo `AgentState` en vez de mutar uno existente. Facilita debugging, logging, y rastreo de qué hizo el agente en cada momento. |
| **Graceful Shutdown** | Ctrl+C no corta: inyecta una instrucción al LLM para que resuma qué hizo y qué queda pendiente antes de salir. Siempre sabes en qué punto quedó. |
| **Retries automáticos** | Reintentos configurables para errores transitorios del LLM (rate limits, timeouts de red). Backoff exponencial. |
| **Timeout por step** | Límite de tiempo configurable por paso individual. Si un tool o una llamada al LLM tarda demasiado, se corta sin bloquear el resto. |

### Tools — Lo Que El Agente Puede Hacer

| Feature | Descripción |
|---------|-------------|
| **read_file** | Lee archivos con números de línea. Soporta rangos parciales para archivos grandes (lee solo las líneas que necesita). |
| **write_file** | Crea archivos nuevos con contenido completo. Solo para archivos nuevos — para editar se usan las tools de edición. |
| **edit_file** | Edición quirúrgica con búsqueda y reemplazo (str_replace). Encuentra un bloque exacto de código y lo reemplaza. No reescribe el archivo entero. |
| **apply_patch** | Aplica diffs en formato unificado para cambios complejos con múltiples hunks. Para cuando edit_file no es suficiente. |
| **search_code** | Búsqueda por regex en el codebase con contexto alrededor de cada resultado (líneas antes y después). |
| **grep** | Búsqueda rápida de texto literal en múltiples archivos. Más rápido que search_code para búsquedas simples. |
| **find_files** | Descubre archivos por nombre o patrón glob. Útil para encontrar tests, configs, o archivos específicos. |
| **list_directory** | Exploración de la estructura del proyecto con profundidad configurable. |
| **run_command** | Ejecuta comandos shell con timeout, captura de output (truncada), y feedback de errores al agente. Seguridad por capas. |
| **Repo indexer** | Mapa automático del repositorio: archivos, funciones, clases, imports. Se inyecta en el contexto para que el agente sepa dónde buscar. |

### Agentes

| Feature | Descripción |
|---------|-------------|
| **build** | Agente principal. Planifica internamente y ejecuta cambios de código. Acceso a todas las tools. |
| **plan** | Solo lectura. Analiza el codebase y produce un plan o documentación sin tocar archivos. |
| **Agentes custom** | Define agentes propios en YAML con system prompt, tools permitidas, política de confirmación, y límite de pasos. |
| **Plan integrado en build** | El agente build planifica como parte de su flujo natural. No necesita un paso previo separado — lee, entiende, planifica, y ejecuta. |

### Verificación y Calidad

| Feature | Descripción |
|---------|-------------|
| **Post-edit hooks** | Lint, format, y type check automáticos después de cada edición. Los errores vuelven al agente como feedback. Configurable por extensión de archivo. |
| **Self-evaluation** | Validación automática del resultado. Modo basic (verificar que no hubo errores) o modo full (critic que revisa y manda a corregir). |
| **Errores como feedback** | Cuando un tool o comando falla, el error se devuelve al agente como información para que corrija. No se descarta — se aprovecha. |

### Conectividad

| Feature | Descripción |
|---------|-------------|
| **MCP Client** | Conecta con servidores MCP remotos. Descubrimiento automático de tools. Las tools MCP se usan exactamente igual que las locales. |
| **Multi-servidor** | Configura múltiples servidores MCP simultáneamente. El agente elige cuál usar según la tarea. |
| **Autenticación** | Token por servidor MCP, leído desde variable de entorno o config directa. |

### Observabilidad

| Feature | Descripción |
|---------|-------------|
| **Human logs** | Nivel de log `human` con iconos y formato legible. Diseñado para seguir al agente en tiempo real en la terminal. |
| **JSON logs** | Logs estructurados JSON con structlog. Cada evento con timestamp, herramienta, archivo, coste. Parseables con `jq`. |
| **Verbose levels** | Sin flag: solo human. `-v`: + info. `-vv`: + debug. `-vvv`: + raw LLM. |
| **Args summarizer** | Cada tool produce un resumen legible de lo que hizo (ej: `edit_file → src/auth.py +12 -3`). Usado en human logs. |
| **Cost tracking** | Coste por paso, por sesión, acumulado. Budget limits y warnings. Desglose de tokens in/out. |
| **Prompt caching** | Cache de prefijos de prompt para reducir tokens en llamadas repetitivas. Ahorro significativo en tareas largas. |

### Output y Configuración

| Feature | Descripción |
|---------|-------------|
| **Streaming** | Respuestas del LLM en streaming en tiempo real. Ve lo que el agente piensa mientras trabaja. |
| **Salida estructurada** | JSON final con status, pasos, archivos modificados, coste. Parseable en scripts y CI. |
| **Exit codes** | Semánticos: 0=success, 1=failed, 2=partial, 3=config error, 4=budget exceeded. |
| **Config merge** | YAML + env vars + CLI flags. Deep merge con prioridad: CLI > env > YAML. |
| **Pydantic schemas** | Toda la configuración validada con Pydantic v2. Errores claros si algo está mal configurado. |

---

## 4. Comparativa — Por Qué architect

### Posicionamiento

```
                     Interactivo ←──────────────────→ Automatizado
                          │                                │
              Claude Code │                                │ architect
                 Cursor   │                                │
                   Aider  │                                │
                          │                                │
                     IDE  ←──────────────────→ Terminal / CI
```

architect no compite con Claude Code ni con Cursor en su terreno. Compite donde ellos no llegan: ejecución sin supervisión, CI/CD, automatización, scripts.

| | Claude Code | Cursor | Aider | **architect** |
|---|---|---|---|---|
| **Modo principal** | Terminal interactiva | IDE (VS Code) | Terminal interactiva | **Headless / CI** |
| **Multi-modelo** | Solo Claude | Multi (con config) | Multi | **Multi (LiteLLM, 100+)** |
| **Sin supervisión** | Parcial | No | Parcial | **Nativo** |
| **Exit codes CI** | No | No | No | **Sí (semánticos)** |
| **MCP nativo** | Sí | No | No | **Sí** |
| **Post-edit hooks** | Hooks manuales | Parcial | No | **Automáticos y configurables** |
| **Self-eval** | No | No | No | **Basic + Full** |
| **Cost tracking** | Limitado | No | Parcial | **Completo con budget limits** |
| **Config YAML** | JSON limitado | Settings UI | CLI flags | **YAML completo con Pydantic** |
| **Prompt caching** | Sí | Interno | Repo map | **Sí (configurable)** |
| **Custom agents** | No | No | No | **Sí (YAML)** |
| **Streaming** | Sí | Sí | Sí | **Sí** |
| **Open source** | No | No | Sí | **Sí** |
| **Coste** | $20/mes | $20/mes | API costs | **API costs (gratis)** |

### Frases para la comparativa

> **vs Claude Code**: Claude Code es el mejor agente interactivo en terminal. architect es para cuando quieres que el agente trabaje solo. Claude Code es tu copiloto; architect es tu piloto automático.

> **vs Cursor**: Cursor vive dentro de VS Code. architect vive donde el código se construye y se despliega: en terminales, en CI, en scripts.

> **vs Aider**: Aider fue pionero en agentes CLI. architect lleva la idea más lejos con verificación automática, contexto gestionado, self-evaluation, MCP, y una arquitectura pensada para ejecutarse sin supervisión.

---

## 5. Casos de Uso

### Para Developers

**Implementar features rápido**: Un comando, una tarea, código verificado.

```bash
architect run "Añade un endpoint GET /v1/users/{id}/orders
con paginación y filtro por status"
```

**Fix de bugs con contexto**: Describe el bug, el agente lo encuentra y lo corrige.

```bash
architect run "El endpoint /payments/webhook lanza 500 cuando
Stripe envía un evento charge.refunded. El campo amount_refunded
es integer en centavos pero lo parseamos como float."
```

**Generar tests**: Apunta a un archivo y el agente escribe los tests.

```bash
architect run "Escribe tests completos para src/services/payment_service.py"
```

**Refactoring**: Cambios estructurales con verificación automática.

```bash
architect run "Extrae la lógica de validación de webhooks de
src/routes/payments.py a src/services/webhook_validator.py"
```

**Analizar código**: Usa el agente plan para entender sin tocar.

```bash
architect run "Explica cómo fluye un request desde que llega
al endpoint /orders hasta que se devuelve la respuesta" --agent plan
```

### Para CI/CD

**Review automático en PRs**: El agente revisa cada PR y comenta.

```bash
architect run "Revisa estos cambios buscando bugs y security issues" \
  --agent review --context-git-diff origin/main --budget 0.15
```

**Fix automático cuando CI falla**: Si lint o tests fallan, el agente corrige.

```bash
architect run "Corrige todos los errores de lint" \
  --confirm-mode yolo --budget 0.30
```

**Generación de changelogs**: Lee commits y produce un changelog.

```bash
architect run "Genera changelog desde v1.2.0" --agent plan
```

### Para DevOps

**Generar IaC**: Terraform, Kubernetes, Docker.

```bash
architect run "Crea los manifests de K8s para el servicio de notificaciones:
Deployment, Service, HPA, ConfigMap" --agent deploy
```

**Documentación**: Genera o actualiza docs basándose en el código.

```bash
architect run "Documenta el módulo src/services/ completo" --agent docs
```

---

## 6. Quick Start

```bash
# Instalar
pip install architect

# Configurar
export OPENAI_API_KEY=sk-...    # O ANTHROPIC_API_KEY, etc.

# Tu primera tarea
architect run "Añade un endpoint GET /health que devuelva {status: ok}"

# Con un modelo específico
architect run "Corrige los errores de lint" --model claude-sonnet-4

# Solo planificar, sin tocar código
architect run "Analiza cómo refactorizar el módulo auth" --agent plan

# En modo headless para CI
architect run "Añade tests para auth.py" --confirm-mode yolo --budget 0.30
```

---

## 7. Estructura Sugerida de Docs (Sidebar Starlight)

```
📖 Documentación
├── Getting Started
│   ├── Instalación
│   ├── Configuración
│   └── Tu primera tarea
│
├── Conceptos
│   ├── Cómo funciona architect
│   ├── El Agent Loop
│   ├── Tools disponibles
│   ├── Agentes (build, plan, custom)
│   ├── Políticas de confirmación
│   ├── Context Management
│   └── MCP (Model Context Protocol)
│
├── Guías
│   ├── Configurar post-edit hooks
│   ├── Definir agentes custom
│   ├── Conectar servidores MCP
│   ├── Usar self-evaluation
│   ├── Controlar costes
│   ├── Integrar con GitHub Actions
│   ├── Integrar con GitLab CI
│   └── Usar en scripts y Makefiles
│
├── Referencia
│   ├── config.yaml (esquema completo)
│   ├── CLI (todos los comandos y flags)
│   ├── Tools (descripción y parámetros)
│   ├── Agentes predefinidos
│   ├── Exit codes
│   └── Variables de entorno
│
└── Más
    ├── Comparativa con otras herramientas
    ├── FAQ
    ├── Roadmap
    └── Contribuir
```

---

## 8. Valores / Principios

### Headless-first

architect no es un chat con superpoderes. Es una herramienta de automatización que habla con LLMs. La interfaz principal es un comando, no una conversación. El output principal es código verificado, no texto.

### El agente que se verifica a sí mismo

Post-edit hooks, self-evaluation, errores como feedback. Tres capas que aseguran que el agente no solo genera código, sino que entrega código que funciona. El ciclo read→write→run→fix es el mismo que seguiría un developer — pero automático.

### Transparencia total

Cada acción del agente se registra con human logs legibles y JSON estructurado. Qué archivo leyó, qué editó, qué comando ejecutó, cuánto costó, cuántos tokens usó. Sin cajas negras.

### Multi-modelo por diseño

No dependas de un solo proveedor. Configura el modelo que quieras. Si mañana sale uno mejor o más barato, cambiarlo es una línea en el YAML. Tu workflow no cambia.

### Open source, sin sorpresas

Sin suscripciones, sin tiers, sin features bloqueadas. Pagas solo los costes de API del LLM que elijas. El código es tuyo. Tus datos se quedan en tu máquina.

---

## 9. Feature Badges (para hero o header)

```
🔀 Multi-modelo   🧠 Loop inteligente   ✅ Verificación auto
🔌 MCP nativo     🏗️ Headless-first     👁️ Human logs
💰 Cost tracking  🤖 Agentes custom     🔍 Self-eval
🖥️ run_command    📊 JSON structured    🔄 Prompt caching
```

---

## 10. CTA (Call to Action)

```
Empieza en 30 segundos:

  pip install architect
  export OPENAI_API_KEY=sk-...
  architect run "Añade un endpoint GET /health"

GitHub → github.com/tu-user/architect
Docs → docs.architect.dev
```
