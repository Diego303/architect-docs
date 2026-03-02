---
title: "Prompt Engineering"
description: "Writing effective prompts, .architect.md, skills, anti-patterns, recipes."
icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
order: 32
---

# Prompt Engineering for Architect CLI

> A comprehensive guide for writing effective prompts, `.architect.md` files, and skills that maximize
> result quality and minimize execution cost.

---

## 1. Why prompt quality matters

Architect CLI is a tool where your primary interface is **natural language**. The quality
of the prompt you write directly determines three variables:

| Variable | Vague prompt | Precise prompt |
|----------|-------------|----------------|
| **Agent steps** | 15-20 (searches, tries, backtracks) | 5-8 (goes direct) |
| **Token cost** | $0.30-0.80 | $0.05-0.15 |
| **Result quality** | Partial, requires iterations | Complete in one pass |

The relationship is direct: an ambiguous prompt forces the agent to spend steps exploring, reading
files it does not need, and making decisions you could have specified. A precise prompt
allows the agent to execute a linear plan without backtracking.

Cost multiplies quickly. Each step involves a call to the LLM with all accumulated context.
At step 1, the LLM processes ~3,000 context tokens. At step 15, it may be
processing ~40,000 tokens. The later steps are exponentially more expensive than the initial ones.

---

## 2. What the LLM sees — Context anatomy

Before writing a prompt, it is essential to understand **what information the LLM already has** when
it receives your task. The context is assembled in layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM MESSAGE                                                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Agent Prompt (BUILD_PROMPT / PLAN_PROMPT / ...)       │  │
│  │    - Agent workflow process                              │  │
│  │    - Editing tool hierarchy                              │  │
│  │    - Search tools                                        │  │
│  │    - Behavior rules                                      │  │
│  │    ~600-800 tokens                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 2. Repo Tree (injected by RepoIndexer)                   │  │
│  │    - Total files, lines, languages                       │  │
│  │    - Complete directory tree                              │  │
│  │    ~500-3,000 tokens (depending on repo size)            │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 3. Active skills (only those matching by glob)           │  │
│  │    - Content of relevant SKILL.md files                  │  │
│  │    ~0-1,000 tokens per skill                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 4. Procedural memory (.architect/memory.md)              │  │
│  │    - Corrections from previous sessions                  │  │
│  │    ~0-500 tokens                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 5. Project instructions (.architect.md)                  │  │
│  │    - Conventions, patterns, restrictions                 │  │
│  │    ~0-2,000 tokens                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  USER MESSAGE (your prompt)                                      │
│  ~50-500 tokens                                                 │
├─────────────────────────────────────────────────────────────────┤
│  CONVERSATION HISTORY (accumulates during execution)             │
│  - LLM tool calls                                                │
│  - Tool results (truncated to max_tool_result_tokens)            │
│  - Compressed after summarize_after_steps steps                  │
│  - Hard limit: max_context_tokens (default 80,000)               │
│  ~0-60,000 tokens                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Why this matters

The LLM already arrives with **1,500-7,000 tokens of base context** before reading your prompt. This
means that:

1. **You do not need to repeat** what the repo tree already says. The agent already knows which files
   exist, what languages they are in, and how many lines they have.

2. **You do not need to explain how to use the tools.** The BUILD_PROMPT already tells it to use
   `edit_file` before `write_file`, to read before editing, and to verify afterward.

3. **Every token of your prompt competes** for space with the conversation history. A prompt
   of 2,000 tokens leaves less room for complex steps than one of 200 tokens.

4. **The `.architect.md` is repeated in EVERY LLM call.** If it has 500 lines, that is
   ~2,000 tokens multiplied by each step. In a 10-step session: 20,000 tokens just
   for project instructions.

### Prompt language (v1.1.0)

The agent system prompts (`build`, `plan`, `resume`, `review`) adapt to the configured language (`language: en` or `language: es`). If you use Spanish, the agent receives instructions in Spanish and tends to respond in Spanish. If you use English (default), the agent responses will be in English. This is independent of YOUR prompt language -- you can write in Spanish even with `language: en`, and the agent will understand equally.

### The four agents and their prompts

Architect has four agents with different prompts. Knowing which one is used affects how to write
your task:

| Agent | When used | Can modify files | Focus |
|-------|-----------|------------------|-------|
| `build` | `architect run` (default) | Yes | Analyze, plan, execute, verify |
| `plan` | `architect run -a plan` | No | Read-only and analysis |
| `resume` | `architect resume <id>` | No | Resume interrupted session |
| `review` | `architect run -a review` | No | Find bugs, security issues, improvements |

The **build** agent follows a specific flow: "read first, modify second, verify third".
Its editing hierarchy is:

1. `edit_file` (exact str_replace) -- preferred for small changes
2. `apply_patch` (unified diff) -- for changes across multiple sections
3. `write_file` -- only for new files or complete rewrites

Your prompt should align with this flow, not contradict it.

---

## 3. Effective prompt patterns

### Pattern 1: Specific task with explicit files

When you know exactly which file to modify, say so. The agent saves 2-3 search steps.

```
architect run "Refactoriza la funcion validate_email en src/utils/validators.py
para usar regex en vez de split. Mantiene los mismos casos de retorno (True/False)
y los mensajes de error actuales."
```

**Why it works:** The agent knows the file, the function, the change, and the constraints.
It goes direct: `read_file` -> `edit_file` -> verify.

### Pattern 2: Task with success criteria

When you do not want to list every change but do define what "done" means:

```
architect run "Aniade tests unitarios para src/auth/service.py que cubran:
- Login exitoso con credenciales validas
- Contrasenia incorrecta retorna 401
- Usuario no existe retorna 404
- Token expirado retorna 401
- Rate limiting despues de 5 intentos fallidos
Usa pytest y mocks para la base de datos."
```

**Why it works:** The success criteria are concrete and verifiable. The agent can
evaluate whether it is done or not. No ambiguity about scope.

### Pattern 3: Task with explicit constraints

When there are things the agent must NOT do, say them explicitly:

```
architect run "Migra las llamadas HTTP de requests a httpx en src/api/client.py.
Restricciones:
- NO cambies la API publica de la clase HttpClient (mismos metodos, mismos parametros)
- NO cambies los tests existentes (deben seguir pasando)
- Usa httpx sincrono, no async"
```

**Why it works:** The constraints prevent the agent from making design decisions
you do not want. Without them, it could change the public API "because it looks better with httpx async".

### Pattern 4: Task with output format

For generation tasks where the format matters:

```
architect run "Genera el archivo docs/API.md con documentacion de la API REST.
Estructura requerida:
## Autenticacion (explica Bearer token)
## Endpoints (tabla: metodo, path, descripcion, auth requerida)
## Errores (codigos HTTP y formato del body)
## Ejemplos (curl para cada endpoint)
Basa la informacion en los archivos de src/api/routes/"
```

**Why it works:** The format is defined. The agent does not have to decide how to organize
the document.

### Pattern 5: Incremental exploration task

When you do not know exactly what needs to change but know what to look for:

```
architect run "Lee todos los endpoints en src/api/routes/ y corrige los que no
validan el input del usuario. Cada endpoint debe:
1. Validar que los campos requeridos existen
2. Validar tipos (no aceptar string donde se espera int)
3. Retornar 422 con mensaje descriptivo si la validacion falla
Usa los validadores existentes de src/utils/validators.py si existen."
```

**Why it works:** The agent has a clear pattern of what to look for and how to fix it.
The reference to existing validators prevents reinventing the wheel.

---

## 4. Anti-patterns — What NOT to do

### Anti-pattern 1: Vague prompts

```
# BAD
architect run "mejora el codigo"

# BAD
architect run "hazlo mas limpio"

# BAD
architect run "refactoriza"
```

**Problem:** "Improve" has no definition. The agent will read random files, make
cosmetic changes, and consume 15+ steps without a clear objective. Result: scattered changes that
may break things, high cost, low quality.

**Solution:** Always specify WHAT to improve, WHERE, and HOW you will know it is improved.

### Anti-pattern 2: Multi-objective in a single prompt

```
# BAD
architect run "Refactoriza el modulo auth, aniade tests para todos los endpoints,
actualiza la documentacion del README, optimiza las queries de la base de datos
y configura CI/CD con GitHub Actions"
```

**Problem:** These are 5 independent tasks. The agent will try to do everything, run out of
context halfway through, and the result will be partial for each task. Worse: if it fails at task 3,
tasks 4 and 5 are not even attempted.

**Solution:** Split into separate executions or use a YAML pipeline:

```bash
# Option A: Separate executions
architect run "Refactoriza el modulo auth separando validacion de sesion"
architect run "Aniade tests para los endpoints de src/api/routes/"
architect run "Actualiza README.md con la nueva estructura de auth"

# Option B: YAML pipeline (see section 7)
architect pipeline workflow.yaml
```

### Anti-pattern 3: Contradicting the agent

```
# BAD — fights against the BUILD_PROMPT editing hierarchy
architect run "Para todos los cambios usa write_file, nunca edit_file"

# BAD — disables the verification the agent needs
architect run "No ejecutes tests despues de los cambios"

# BAD — prevents the exploration it needs
architect run "No leas archivos, solo escribe los cambios directamente"
```

**Problem:** The BUILD_PROMPT already establishes that `edit_file` is preferred, that verification
should happen after each change, and that reading should happen before editing. Contradicting these rules confuses
the LLM, which receives opposing instructions in the same context.

**Solution:** Work WITH the agent, not against it. If you need write_file for a new file,
simply describe the task and the agent will choose the correct tool.

### Anti-pattern 4: Huge prompts with unnecessary context

```
# BAD — 500 lines of context the agent does not need
architect run "Aqui esta el historial completo del proyecto desde 2019,
las decisiones de arquitectura, las minutas de las reuniones, el roadmap
para 2027... [500 more lines] ...por cierto, cambia el color del boton
a azul en src/components/Button.tsx"
```

**Problem:** Every token in the prompt is processed in EVERY LLM call. 500 lines of
irrelevant context consume ~2,000 tokens per step. In 10 steps: 20,000 wasted tokens. Additionally,
the LLM may be distracted by the context and make unrequested changes.

**Solution:** Only include what the agent needs for this specific task:

```
architect run "Cambia el color del boton primario a azul (#0066CC) en
src/components/Button.tsx. Solo el variant='primary'."
```

### Anti-pattern 5: Not specifying files when you know them

```
# BAD — the agent will spend 3-4 steps searching
architect run "Corrige el bug de autenticacion"

# GOOD — goes direct
architect run "Corrige el bug en src/auth/middleware.py donde el token JWT
no se valida cuando viene en query params (solo valida el header Authorization)"
```

**Problem:** If you know the bug is in `middleware.py`, do not force the agent to find it.
Each search step (grep, search_code, read_file of irrelevant files) consumes tokens
and time.

---

## 5. Writing effective .architect.md files

The `.architect.md` file (also `AGENTS.md` or `CLAUDE.md`) is injected into the system prompt
of **every LLM call**, at every step, of every session. This makes it the most
powerful and most costly configuration mechanism.

### What to include

1. **Code conventions** that are not obvious from the code:

```markdown
## Conventions

- Imports sorted: stdlib, third-party, local (separated by blank line)
- Variable names in snake_case, classes in PascalCase
- Public functions always with docstring (Google format)
- Do not use `print()`, use `logger.info()` from structlog
```

2. **Preferred libraries** (when alternatives exist):

```markdown
## Dependencies

- HTTP client: httpx (not requests)
- Validation: pydantic v2 (not dataclasses for external inputs)
- Tests: pytest + pytest-mock (not unittest)
- Date format: always ISO 8601 with timezone
```

3. **Known anti-patterns for the project**:

```markdown
## Prohibited

- DO NOT use `import *`
- DO NOT use SQL queries without parameters (always prepared statements)
- DO NOT write secrets in code (use environment variables)
- DO NOT write functions longer than 50 lines
```

4. **Expected structure** (when not obvious):

```markdown
## Structure

- New endpoints go in src/api/routes/<resource>.py
- DB models go in src/models/<resource>.py
- Pydantic schemas go in src/schemas/<resource>.py
- Mirror tests: tests/test_<module>/test_<file>.py
```

### What NOT to include

- **What the code already says.** If you have a `pyproject.toml` with the Python version,
  do not repeat it in `.architect.md`. The agent can read it.
- **Generic documentation.** Do not copy the README into `.architect.md`.
- **One-time instructions.** "Migrate from Flask to FastAPI" does not go in `.architect.md`;
  it goes in the `architect run` prompt.
- **Change history.** It is not a CHANGELOG.

### Recommended size

Each line is repeated at every step. The math:

| Lines in .architect.md | Tokens/step | 10-step session | 20-step session |
|------------------------|-------------|-----------------|-----------------|
| 50 lines (~200 tokens) | 200 | 2,000 tokens | 4,000 tokens |
| 200 lines (~800 tokens) | 800 | 8,000 tokens | 16,000 tokens |
| 500 lines (~2,000 tokens) | 2,000 | 20,000 tokens | 40,000 tokens |

**Recommendation:** Keep it under 500 lines. Ideally between 50-150 lines.
If you need more, move specific instructions to **skills** (they are only activated when
files match).

### Complete example: Django project

```markdown
# Project Instructions — My Django App

## Stack
- Django 5.0, Python 3.12, PostgreSQL 16
- DRF for REST API, Celery for async tasks
- pytest-django for tests

## Code conventions
- Models: verbose_name in Spanish, Meta.ordering always defined
- Views: use class-based views (DRF APIView), not function-based
- Serializers: validation in validate_<field>(), never in the view
- URLs: kebab-case (api/my-resources/), not snake_case
- Permissions: always define permission_classes, never leave AllowAny in production

## New file structure
- apps/<name>/models.py — DB models
- apps/<name>/serializers.py — DRF serializers
- apps/<name>/views.py — Views/ViewSets
- apps/<name>/urls.py — URL patterns
- apps/<name>/tests/ — Tests (one file per module)
- apps/<name>/admin.py — Admin configuration

## Security rules
- NEVER hardcode secrets, use django.conf.settings
- All endpoints authenticated by default (IsAuthenticated)
- Queryset filters: always filter by authenticated user
- Do not use .raw() or direct SQL queries

## Tests
- Each view must have tests for: 200 OK, 401 no auth, 403 forbidden, 404 not found
- Use factory_boy for fixtures, not json fixtures
- Names: test_<action>_<condition>_<expected_result>
```

This example has ~40 lines, ~160 tokens. It is concise, actionable, and covers what the
code does not say by itself.

---

## 6. Writing effective skills

Skills are contextual instructions that are activated **only when the agent works with
files matching their globs**. Unlike `.architect.md` (which is always injected),
skills are selective.

### When to use skills vs .architect.md

| Criterion | .architect.md | Skill |
|-----------|---------------|-------|
| Applies to the entire project | Yes | No |
| Activated only for certain files | No | Yes |
| Repeated at every step | Always | Only if there are matching files |
| Token cost | Constant | Variable |

**Use `.architect.md`** for global conventions (import format, prohibitions, stack).
**Use skills** for instructions specific to a file type (how to write models,
how to write tests, how to write endpoints).

### Skill structure

Skills are stored in `.architect/skills/<name>/SKILL.md` with YAML frontmatter:

```
.architect/
  skills/
    django-models/
      SKILL.md
    api-endpoints/
      SKILL.md
```

### Example: Django models skill

`.architect/skills/django-models/SKILL.md`:

```markdown
---
name: django-models
description: Convenciones para modelos Django del proyecto
globs:
  - "*/models.py"
  - "*/models/*.py"
---

## Modelos Django — Convenciones

### Estructura de cada modelo
1. Campos del modelo (ordenados: PK, FKs, campos de datos, timestamps)
2. Meta class (ordering, verbose_name, verbose_name_plural, constraints)
3. __str__
4. clean() si hay validacion custom
5. Metodos de negocio
6. Managers customizados al final del archivo

### Campos obligatorios
- Todos los modelos deben tener `created_at` y `updated_at` (auto_now_add, auto_now)
- Usar `models.UUIDField` como PK en vez de AutoField
- ForeignKey siempre con `on_delete` explicito y `related_name`

### Migraciones
- Despues de modificar un modelo, ejecutar `python manage.py makemigrations`
- Verificar que la migracion generada es correcta
```

This skill is only injected when the agent works with `models.py` files. If the task
is editing an HTML template, this skill does not consume tokens.

### Example: API endpoints skill

`.architect/skills/api-endpoints/SKILL.md`:

```markdown
---
name: api-endpoints
description: Convenciones para endpoints de API REST
globs:
  - "*/views.py"
  - "*/viewsets.py"
  - "*/routes.py"
  - "*/routes/*.py"
---

## Endpoints API — Convenciones

### Estructura de un ViewSet
1. queryset y serializer_class
2. permission_classes
3. filterset_fields / search_fields
4. Acciones CRUD (list, create, retrieve, update, destroy)
5. Acciones custom con @action decorator

### Respuestas
- 200: operacion exitosa con datos
- 201: recurso creado (incluir Location header)
- 204: eliminacion exitosa (sin body)
- 400: error de validacion (body con campo: [errores])
- 401: no autenticado
- 403: sin permisos
- 404: recurso no existe

### Paginacion
- Siempre usar LimitOffsetPagination
- Default: limit=20, max_limit=100
```

---

## 7. Prompts for advanced features

The advanced features of Architect (Ralph Loop, Pipelines, Parallel, Review) have
specific characteristics that affect how to write prompts for them.

### Ralph Loop (`architect loop`)

The Ralph Loop runs agent iterations until all checks pass. **Each iteration
has a CLEAN context**: the agent does not receive the conversation history from previous iterations.
It only receives:

- The original task/spec
- The accumulated diff from previous iterations
- Errors from the last iteration
- An auto-generated progress.md

**Implications for the prompt:**

```bash
# GOOD — self-contained task, clear checks
architect loop \
  "Implementa la funcion parse_csv en src/parser.py que lea un CSV,
   valide que las columnas 'name' y 'email' existen, y retorne una
   lista de diccionarios. Si falta una columna, lanza ValueError
   con mensaje descriptivo." \
  --check "python -m pytest tests/test_parser.py -v" \
  --max-iterations 10

# BAD — depends on context the agent does not have between iterations
architect loop \
  "Sigue con lo que estabas haciendo antes" \
  --check "pytest"
```

Write the task as if it were the **first time** the agent sees it, because in each
iteration, it is. The checks must be commands that return exit code 0 when the task
is complete.

### Pipelines (`architect pipeline`)

Pipelines execute sequential steps. Each step has its own agent with clean context.
Steps communicate through `{{variables}}`.

```yaml
name: feature-completa
variables:
  modulo: auth
  tabla: users

steps:
  - name: crear-modelo
    prompt: |
      Crea el modelo {{tabla}} en apps/{{modulo}}/models.py con campos:
      username (CharField, unique), email (EmailField, unique),
      is_active (BooleanField, default True), created_at, updated_at.
    checkpoint: true

  - name: crear-serializer
    prompt: |
      Crea el serializer para el modelo {{tabla}} en
      apps/{{modulo}}/serializers.py. Incluye validacion de email
      unico en validate_email(). Campos: username, email, is_active.

  - name: crear-tests
    prompt: |
      Crea tests para el modelo {{tabla}} y su serializer en
      apps/{{modulo}}/tests/test_{{tabla}}.py. Cubre:
      - Creacion exitosa
      - Email duplicado
      - Username duplicado
      - Serializer validation
    checks:
      - "python -m pytest apps/{{modulo}}/tests/ -v"
```

**Rules for pipeline prompts:**

1. Each prompt must be **independent** — do not assume the agent remembers the previous step
2. Use `{{variables}}` for data shared between steps
3. Use `checkpoint: true` before destructive steps (to enable rollback)
4. Use `checks` to verify the step completed correctly

### Parallel (`architect parallel`)

Parallel executions launch multiple agents in separate git worktrees.
**Each worker is completely isolated**: it does not know what the other workers are doing.

```bash
# GOOD — independent tasks that don't conflict
architect parallel \
  "Aniade validacion de input a src/api/routes/users.py" \
  "Aniade validacion de input a src/api/routes/products.py" \
  "Aniade validacion de input a src/api/routes/orders.py"

# BAD — tasks that modify the same files
architect parallel \
  "Refactoriza src/utils.py para usar httpx" \
  "Aniade logging a todas las funciones de src/utils.py"
```

**Rules for parallel tasks:**

1. Tasks must modify **different files**
2. Each task must be self-contained (does not depend on the result of another)
3. Results are reviewed manually before merging (each worker creates its own branch)

### Review (`architect run` with auto-review)

The reviewer receives only the diff and the original task. To get a useful review, be
specific about what you want it to look for:

```yaml
# In .architect.yaml
auto_review:
  enabled: true
  max_fix_passes: 1
```

The reviewer looks by default for: bugs, security issues, conventions, simplification, and missing
tests. If you want to focus it, adjust the original task to include the security
or performance context that matters.

---

## 8. Before/after examples

### Example 1: Bug fix task

**Original prompt (bad):**
```
architect run "Arregla el bug de login"
```

**Problems:**
- Does not say which bug, in which file, or how it manifests
- The agent will spend 5-8 steps just searching for the problem
- If there are multiple login bugs, it does not know which to prioritize

**Improved prompt:**
```
architect run "En src/auth/login.py, la funcion authenticate() no maneja
el caso donde el usuario existe pero esta desactivado (is_active=False).
Actualmente retorna None (como si no existiera). Debe retornar un error
especifico: raise AccountDisabledError('Cuenta desactivada'). El error
ya esta definido en src/auth/exceptions.py."
```

**Estimated difference:**
- Before: ~12 steps, ~$0.35, uncertain result
- After: ~4 steps, ~$0.08, precise result

---

### Example 2: Adding tests task

**Original prompt (bad):**
```
architect run "Aniade tests"
```

**Problems:**
- Tests for what? The entire project? One file?
- What type of tests? Unit, integration, e2e?
- Which cases to cover?

**Improved prompt:**
```
architect run "Aniade tests unitarios para src/payments/processor.py.
Casos a cubrir:
1. process_payment() con tarjeta valida retorna PaymentResult(success=True)
2. process_payment() con tarjeta expirada lanza CardExpiredError
3. process_payment() con fondos insuficientes lanza InsufficientFundsError
4. refund() con payment_id valido retorna RefundResult(success=True)
5. refund() con payment_id inexistente lanza PaymentNotFoundError
Usa pytest con mocks para el gateway externo (src/payments/gateway.py)."
```

**Estimated difference:**
- Before: ~15 steps, ~$0.50, vague and incomplete tests
- After: ~6 steps, ~$0.12, 5 specific and useful tests

---

### Example 3: Refactoring task

**Original prompt (bad):**
```
architect run "Refactoriza el codigo para que sea mejor"
```

**Problems:**
- "Better" has no definition
- The agent could rename variables, reorganize imports, or rewrite entire functions
  unnecessarily
- High risk of breaking functionality

**Improved prompt:**
```
architect run "Refactoriza src/data/repository.py: extrae las funciones
de consulta SQL (get_users, get_orders, get_products) a una clase
BaseRepository con un metodo generico query(table, filters). Las tres
funciones actuales deben usar BaseRepository internamente. Los tests
existentes en tests/test_repository.py deben seguir pasando sin cambios."
```

**Estimated difference:**
- Before: ~18 steps, ~$0.60, unpredictable changes
- After: ~7 steps, ~$0.15, bounded and safe refactoring

---

### Example 4: Documentation task

**Original prompt (bad):**
```
architect run "Documenta el proyecto"
```

**Problems:**
- Does not define what to document or in what format
- The agent could generate a generic README, docstrings, or a wiki
- Without a defined structure, the result will be disorganized

**Improved prompt:**
```
architect run "Genera docs/deployment.md con guia de despliegue. Secciones:
## Requisitos (Python 3.12, PostgreSQL 16, Redis)
## Variables de entorno (lee .env.example y documenta cada variable)
## Base de datos (migraciones con django manage.py migrate)
## Despliegue local (docker-compose up)
## Despliegue en produccion (gunicorn + nginx, basado en Dockerfile)
Lee los archivos docker-compose.yml, Dockerfile y .env.example como fuente."
```

**Estimated difference:**
- Before: ~10 steps, ~$0.30, vague document without structure
- After: ~5 steps, ~$0.10, structured document based on real files

---

## Golden rules summary

1. **Be specific:** file + function + change + constraints
2. **Define "done":** verifiable success criteria
3. **One task per execution:** split complex tasks into steps
4. **Do not repeat what the agent already knows:** the repo tree, the tools, the flow
5. **Keep `.architect.md` concise:** <500 lines, only non-obvious conventions
6. **Use skills for selective context:** globs for activation by file type
7. **Specify files when you know them:** saves search steps
8. **Align with the agent:** do not contradict the BUILD_PROMPT
