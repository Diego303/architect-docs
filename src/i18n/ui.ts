export type Lang = 'es' | 'en';

export const ui = {
    es: {
        // === Layout ===
        layout: {
            title: 'Architect | Documentación Oficial',
        },

        // === Navbar ===
        nav: {
            why: 'Por qué Architect',
            docs: 'Docs',
            useCases: 'Casos de Uso',
            roadmap: 'Roadmap',
            aria: 'Menú de navegación',
            whyHref: 'why-architect/',
            useCasesHref: 'casos-de-uso/',
        },

        // === Footer ===
        footer: {
            copyright: '© 2026 Architect Project.',
            tagline: 'Hecho con precisión.',
            createdWith: 'Creado con',
        },

        // === DocsSidebar ===
        sidebar: {
            backToDocs: 'Volver a Docs',
            index: 'Índice:',
        },

        // === UseCasesTOC ===
        toc: {
            onThisPage: 'En esta página',
            backToHome: 'Volver a Inicio',
        },

        // === VersionSelector ===
        version: {
            label: 'VERSION',
            latest: '(latest)',
        },

        // === ArchBanner ===
        archBanner: {
            label: 'Nuevo · Referencia',
            title: 'Arquitecturas de Referencia',
            desc: '10 arquitecturas reales donde architect encaja en sistemas de producción. Diagramas, configs YAML y código listo para CI/CD, Security, AIOps, MLOps y DevOps.',
            statArchitectures: 'arquitecturas',
            statDomains: 'dominios',
            statDiagrams: 'diagramas',
        },

        // === ArchitecturesPage ===
        archPage: {
            backToDocs: 'Volver a Docs',
            title: 'Arquitecturas de Referencia',
            intro: '10 arquitecturas reales donde architect encaja en sistemas de producción. Cada una incluye diagrama del flujo, configuración YAML, comandos de implementación, y las features de architect que se usan.',
        },

        // === Docs Hub ===
        docsHub: {
            title: 'Documentación',
            searchPlaceholder: 'Buscar en la documentación...',
            noResults: 'No se encontraron resultados.',
            defaultDesc: 'Documentación técnica detallada sobre este módulo del sistema Architect.',
        },

        // === Landing: Hero ===
        hero: {
            titleLine1: 'Planifica y ejecuta tareas con',
            titleHighlight: 'Precisión Agéntica',
            subtitle: 'La documentación oficial de <strong class="text-ink">Architect</strong>. Herramienta CLI open source que orquesta agentes de IA para escribir, revisar, y corregir código automáticamente. <strong class="text-ink">Headless-first</strong>: diseñada para CI/CD, pipelines, y automatización. Multi-modelo y con guardrails de seguridad integrados.',
            terminalHeader: 'TERMINAL — HUMAN LOG OUTPUT',
            terminalCmd: 'architect run "Refactoriza el módulo auth del proyecto"',
            terminalStep1: 'Paso 1 → Llamada al LLM (5 mensajes)',
            terminalStep1Detail: 'LLM respondió con 2 tool calls',
            terminalTool1: 'read_file → src/main.py',
            terminalTool2: 'edit_file → src/main.py (3→5 líneas)',
            terminalHook: 'Hook python-lint:',
            terminalStep2: 'Paso 2 → Llamada al LLM (9 mensajes)',
            terminalStep2Detail: 'LLM respondió con texto final',
            terminalDone: 'Agente completado (2 pasos)',
            terminalReason: 'Razón: LLM decidió que terminó',
            terminalCost: 'Coste:',
            btnDocs: 'VER DOCS',
            btnGithub: 'GITHUB',
        },

        // === ElevatorPitch ===
        elevator: {
            title: 'Qué es Architect',
            badges: [
                'Multi-modelo', 'Ralph Loop', 'Parallel runs', 'Guardrails',
                'Pipelines YAML', 'Hooks', 'CI/CD-first', 'Memoria auto',
                'OpenTelemetry', 'Reports', 'Dry run', 'Skills Vercel',
            ],
            lead: 'Una herramienta de línea de comandos que convierte cualquier LLM en un agente de código autónomo. Dale una tarea, y architect lee tu código, planifica los cambios, los implementa, ejecuta tests, y verifica el resultado — <strong>todo sin intervención humana.</strong>',
            body1: 'A diferencia de los asistentes de código que viven dentro de un IDE, architect está diseñada para ejecutarse donde el código realmente se construye: en terminales, scripts, Makefiles, y pipelines de CI/CD. Es la pieza que falta entre <em>"tengo una IA que genera código"</em> y <em>"tengo una IA que entrega código verificado"</em>.',
            body2: 'Funciona con cualquier LLM: OpenAI, Anthropic, Google, DeepSeek, Mistral, modelos locales con Ollama — más de 100 proveedores soportados. Tú eliges el modelo, architect hace el trabajo.',
            value1Title: 'Headless-first',
            value1Desc: 'No es un chat con superpoderes. Es una herramienta de automatización que habla con LLMs.',
            value2Title: 'Determinismo sobre probabilismo',
            value2Desc: 'Los hooks y guardrails son reglas, no sugerencias. El LLM decide qué hacer, los quality gates verifican que el resultado es correcto.',
            value3Title: 'Transparencia total',
            value3Desc: 'Cada acción del agente se registra con human logs legibles y JSON estructurado. Sin cajas negras.',
            value4Title: 'Open source, sin sorpresas',
            value4Desc: 'Sin suscripciones ni features bloqueadas. Pagas solo los costes de API del LLM que elijas.',
        },

        // === KillerFeatures ===
        features: {
            title: 'Características Principales',
            items: [
                { title: 'Multi-Modelo, Cero Lock-in', description: 'Usa cualquier LLM: OpenAI, Anthropic, Google, DeepSeek, Mistral, Ollama — o cualquier API compatible. Más de 100 proveedores vía LiteLLM. Cambia de modelo con un flag.' },
                { title: 'Ralph Loop — Iteración Autónoma', description: 'Ejecuta, verifica con tus tests, si fallan reintenta con contexto limpio. Itera hasta que tus checks pasen de verdad — no hasta que el LLM crea que ha terminado.' },
                { title: 'Parallel Runs con Worktrees', description: 'Múltiples agentes en paralelo, cada uno en su git worktree aislado. Misma tarea con N modelos para comparar, o tareas diferentes para multiplicar velocidad.' },
                { title: 'Guardrails & Quality Gates', description: 'Archivos protegidos, comandos bloqueados, límites de cambios, reglas de código. Quality gates obligatorios antes de completar. Declarativo en YAML, determinista.' },
                { title: 'Pipelines Declarativos', description: 'Workflows multi-paso en YAML. Plan, Build, Test, Review, Fix. Variables entre pasos, condiciones, checkpoints. Composable y reutilizable.' },
                { title: 'Extensible con Hooks', description: '10 eventos del lifecycle del agente. Formatea código automáticamente, bloquea comandos peligrosos, notifica a Slack cuando termina. Pre y post en cada acción.' },
                { title: 'Hecho para CI/CD', description: 'Exit codes semánticos, output JSON parseable, reports en Markdown para PR comments. Budget y timeout como hard limits. Sin confirmaciones, sin prompts interactivos.' },
                { title: 'Aprende Con El Uso', description: 'Memoria procedural auto-generada. Detecta correcciones y las persiste. Combinada con .architect.md y skills Vercel-compatible: tres capas de conocimiento acumulado.' },
            ],
            // Ralph Loop Spotlight
            ralphTitle: 'Ralph Loop — La Feature Estrella',
            ralphDesc1: 'El patrón más productivo en agentic coding, integrado como feature nativa. En vez de confiar en que la IA decida cuándo ha terminado, architect ejecuta tus tests y linters después de cada iteración. Si fallan, el agente vuelve a intentarlo con <strong>contexto limpio</strong>.',
            ralphDesc2: 'Cada iteración arranca fresca — sin acumular basura de intentos anteriores. Solo recibe: la spec original, el diff acumulado, y los errores de la última iteración. El resultado: <strong>código que compila, pasa tests, y está limpio.</strong>',
            ralphFigureTitle: 'Ralph Loop — Iteración 3/25',
            ralphLine1: 'Agente trabajando (contexto limpio + errores de iter. 2)...',
            ralphLine2: 'Agente completó',
            ralphVerification: 'Verificación externa:',
            ralphTestPass: '18/18 passed',
            ralphLintPass: 'sin errores',
            ralphDone: 'Loop completado en 3 iteraciones',
            // Guardrails Spotlight
            guardrailsTitle: 'Guardrails & Quality Gates',
            guardrailsDesc1: 'Los guardrails de architect no dependen del LLM. Son reglas deterministas que se evalúan antes y después de cada acción. El agente no puede saltárselas porque no las controla — <strong>están fuera de su contexto.</strong>',
            guardrailsDesc2: 'Si el agente intenta escribir en <code>.env</code> → bloqueado. Si el código contiene <code>eval()</code> → bloqueado. Si dice "he terminado" pero pytest falla → sigue trabajando. <strong>Los quality gates pasan o no pasan.</strong> Sin negociación.',
            // Parallel Spotlight
            parallelTitle: 'Parallel Runs con Git Worktrees',
            parallelDesc1: 'Lanza múltiples agentes en paralelo, cada uno en su propio git worktree aislado. Misma tarea con diferentes modelos para comparar resultados reales en tu codebase. O diferentes tareas en paralelo para multiplicar velocidad.',
            parallelDesc2: 'Worktrees nativos de git: sin copias, sin conflictos, sin Docker. Cada worker opera en un snapshot aislado del repo. Al final, <strong>datos objetivos — no opiniones.</strong>',
            parallelFigureTitle: 'Resultados — Competitive Eval',
            parallelSteps: 'pasos',
            ralphCmd: 'Implementa el módulo de pagos',
            parallelCmd: 'Refactoriza el módulo auth',
        },

        // === Comparison ===
        comparison: {
            title: 'Por qué Architect',
            intro: 'architect no compite con Claude Code ni con Cursor en su terreno. Compite donde ellos no llegan: <strong>ejecución sin supervisión, CI/CD, automatización, scripts.</strong>',
            rows: [
                { label: 'Modo principal', claude: 'Terminal interactiva', cursor: 'IDE (VS Code)', aider: 'Terminal interactiva', architect: 'Headless / CI' },
                { label: 'Multi-modelo', claude: 'Solo Claude', cursor: 'Multi (con config)', aider: 'Multi', architect: 'Multi (LiteLLM, 100+)' },
                { label: 'Sin supervisión', claude: 'Parcial', cursor: 'No', aider: 'Parcial', architect: 'Nativo' },
                { label: 'Parallel runs', claude: 'Manual (worktrees)', cursor: 'No', aider: 'No', architect: 'Nativo' },
                { label: 'Ralph Loop', claude: 'Plugin externo', cursor: 'No', aider: 'No', architect: 'Nativo' },
                { label: 'Pipelines YAML', claude: 'No', cursor: 'No', aider: 'No', architect: 'Sí' },
                { label: 'Guardrails', claude: 'Hooks (manual)', cursor: 'Limitado', aider: 'No', architect: 'Declarativo (YAML)' },
                { label: 'Quality Gates', claude: 'No', cursor: 'No', aider: 'No', architect: 'Sí' },
                { label: 'CI/CD-first', claude: 'Adaptable', cursor: 'No', aider: 'Parcial', architect: 'Diseñado para ello' },
                { label: 'Exit codes CI', claude: 'No', cursor: 'No', aider: 'No', architect: 'Semánticos' },
                { label: 'Reports', claude: 'No', cursor: 'No', aider: 'No', architect: 'JSON / MD / GitHub' },
                { label: 'MCP nativo', claude: 'Sí', cursor: 'No', aider: 'No', architect: 'Sí' },
                { label: 'Post-edit hooks', claude: 'Manuales', cursor: 'Parcial', aider: 'No', architect: 'Auto y configurables' },
                { label: 'Self-eval', claude: 'No', cursor: 'No', aider: 'No', architect: 'Basic + Full' },
                { label: 'Skills ecosystem', claude: 'Sí', cursor: 'Sí', aider: 'No', architect: 'Sí (Vercel-compatible)' },
                { label: 'Memoria procedural', claude: 'No', cursor: 'No', aider: 'No', architect: 'Auto-generada' },
                { label: 'Session resume', claude: 'Parcial', cursor: 'No', aider: 'No', architect: 'Completo' },
                { label: 'Checkpoints', claude: 'Interactivo', cursor: 'No', aider: 'Git auto-commits', architect: 'Programático' },
                { label: 'OpenTelemetry', claude: 'No', cursor: 'No', aider: 'No', architect: 'Nativo' },
                { label: 'Cost tracking', claude: 'Limitado', cursor: 'No', aider: 'Parcial', architect: 'Completo + budget' },
                { label: 'Custom agents', claude: 'No', cursor: 'No', aider: 'No', architect: 'Sí (YAML)' },
                { label: 'Open source', claude: 'No', cursor: 'No', aider: 'Sí', architect: 'Sí' },
                { label: 'Coste', claude: '$20/mes (Pro)', cursor: '$20/mes', aider: 'API costs', architect: 'API costs (gratis)' },
            ],
            quoteVsClaude: '<strong>vs Claude Code:</strong> Claude Code es el mejor agente interactivo en terminal. architect es el mejor agente para automatización. Claude Code es tu copiloto; architect es tu <em>equipo de CI y tu piloto automático</em>.',
            quoteVsCursor: '<strong>vs Cursor:</strong> Cursor vive dentro del IDE. architect vive donde el código se construye y se despliega: en <em>terminales, pipelines, en CI, en scripts y cron jobs</em>.',
            quoteVsAider: '<strong>vs Aider:</strong> Aider fue pionero en agentes CLI. architect lleva la idea más lejos: parallel runs, pipelines declarativos, guardrails, quality gates, self-evaluation, MCP, y una arquitectura pensada para ejecutarse <em>sin supervisión durante horas</em>.',
        },

        // === UseCases (landing section) ===
        useCases: {
            title: 'Casos de Uso',
            devTitle: 'Para Developers',
            devDesc: 'Configura un Ralph Loop con tu spec y tus tests. Cierra el portátil. A la mañana siguiente tienes un PR con código que compila y pasa todos los tests.',
            devCases: [
                { label: 'Coding overnight', cmd: 'architect loop --spec tasks/payment-module.md \\\n  --check "pytest tests/ -q" \\\n  --check "mypy src/" \\\n  --max-iterations 30' },
                { label: 'Competitive coding', cmd: 'architect parallel "Optimiza las queries SQL" \\\n  --models gpt-4.1,claude-sonnet-4,deepseek-chat' },
                { label: 'Refactoring seguro', cmd: 'architect run "Migra de SQLAlchemy sync a async" \\\n  --dry-run\n# Preview primero, ejecuta después con checkpoints:\narchitect run "Migra de SQLAlchemy sync a async" \\\n  --checkpoint-every 5' },
            ],
            teamTitle: 'Para Equipos',
            teamDesc: 'Review automático en cada PR, estándares compartidos codificados en YAML, y evaluación objetiva cuando cambiáis de modelo.',
            teamCases: [
                { label: 'Review automático en PRs', cmd: 'architect run "Revisa este PR" \\\n  --agent review \\\n  --context-git-diff origin/main \\\n  --report github > review.md' },
                { label: 'Estándares compartidos', cmd: '# .architect.md + guardrails + skills\n# Convenciones del equipo codificadas,\n# versionadas en git, verificadas en cada ejecución' },
                { label: 'Eval de modelos', cmd: 'architect eval \\\n  --models claude-sonnet-4,gpt-4.1 \\\n  --tasks eval/tasks.yaml' },
            ],
            teamFigureTitle: 'GitHub Actions — Review',
            teamGhActionCmd: 'Revisa los cambios de este PR',
            ciTitle: 'Para CI/CD & DevOps',
            ciDesc: 'Integra architect en tus pipelines. Fix automático de lint, generación de changelogs, documentación actualizada — todo headless, todo auditable.',
            ciCases: [
                { label: 'Fix automático de lint', cmd: 'architect loop "Corrige errores de lint" \\\n  --check "eslint src/ --max-warnings 0" \\\n  --max-iterations 5 --budget 0.50' },
                { label: 'Changelog automático', cmd: 'architect run "Genera changelog desde v1.2.0" \\\n  --report markdown > CHANGELOG.md' },
                { label: 'Docs automáticas', cmd: 'architect pipeline pipelines/update-docs.yaml' },
            ],
        },

        // === QuickStart ===
        quickstart: {
            title: 'Empieza en 30 Segundos',
            step1Title: 'Instalar',
            step1Note: 'Requiere Python 3.12+',
            step2Title: 'Configurar',
            step2Note: 'O --preset node-react, --preset ci, o manual con export OPENAI_API_KEY=sk-...',
            step3Title: 'Tu primera tarea',
            step3Cmd: 'Añade un endpoint GET /health que devuelva {status: ok}',
            figureTitle: 'Más ejemplos',
            comment1: '# Preview sin ejecutar (como terraform plan)',
            exCmd1: 'Refactoriza el módulo auth',
            comment2: '# Ralph Loop: itera hasta que los tests pasen',
            exCmd2: 'Corrige todos los errores de lint',
            comment3: '# Parallel: 3 modelos, misma tarea, compara',
            exCmd3: 'Optimiza las queries SQL',
            comment4: '# En CI/CD con budget y report',
            exCmd4: 'Revisa este PR',
            comment5: '# Exit codes semánticos',
            exitCodes: '# 0 = success, 1 = failed, 2 = partial',
            ctaText: 'Open source. Sin suscripciones. Pagas solo los costes de API del LLM que elijas.',
            ctaButton: 'Casos de Uso',
            ctaHref: 'casos-de-uso/',
        },

        // === CasosDeUsoPage ===
        casosDeUso: {
            title: 'Casos de Uso',
            subtitle: 'Guía práctica de integración de <code>architect</code> en flujos de trabajo reales: desarrollo diario, CI/CD, DevOps, QA, documentación y arquitecturas avanzadas.',
        },

        // === WhyArchitectPage ===
        whyArchitect: {
            title: 'Por qué Architect',
            subtitle1: '<code>architect</code> es la capa de automatización y control que falta entre los agentes de IA y tu pipeline de CI/CD. Claude Code es brillante implementando código. architect se asegura de que ese código pasa tests, cumple guardrails, y se entrega de forma verificable — sin supervisión humana, durante horas si hace falta.',
            subtitle2: 'Usa architect con Claude (vía Agent SDK), con GPT-4.1, con DeepSeek, o con tu modelo local. El cerebro cambia, las garantías no.',
        },

        // === RoadmapPage ===
        roadmap: {
            heroTitle: 'Planos de',
            heroHighlight: 'Expansión',
            heroSubtitle: 'Hoja de ruta técnica de <code>architect</code>. Fases de construcción, herramientas en desarrollo y el futuro de la orquestación agéntica.',
            badgeCompleted: 'COMPLETADA',
            badgePlanned: 'PLANOS APROBADOS',
            badgeFuture: 'ESTUDIO DE VIABILIDAD',
            badgeMonitoring: 'MONITORIZANDO',
            milestoneLabel: 'Hito Conseguido',
            milestoneTitle: 'Lanzamiento v1.0.0 Stable',
            milestoneBadge: 'Release Oficial',
            stabilizationLabel: 'Fase de Estabilización',
            stabilizationTitle: 'Pruebas Exhaustivas & Hardening',
            stabilizationDesc: 'Batería de pruebas de integración, stress tests y corrección de edge cases post-release. Estabilización del core antes de nuevas features.',
            gaugeLabel: 'Cobertura de Tests',
            // Phases
            phaseA: 'Fase A',
            phaseATitle: 'Fundamentos de Extensibilidad',
            phaseADesc: 'La infraestructura sobre la que todo lo demás se apoya. Hooks, guardrails, skills y memoria procedural forman la columna vertebral de extensibilidad del agente.',
            phaseAItems: [
                '<strong>Sistema de Hooks Completo</strong> — 10 eventos de lifecycle, bloqueo/modificación de acciones, ejecución async y timeouts.',
                '<strong>Guardrails de Primera Clase</strong> — Archivos protegidos, comandos bloqueados, límites de edición, code rules y quality gates obligatorios.',
                '<strong>.architect.md + Skills</strong> — Contexto de proyecto auto-inyectado y ecosistema de skills reutilizables activadas por glob.',
                '<strong>Memoria Procedural</strong> — Detección de correcciones del usuario, persistencia en disco e inyección automática en sesiones futuras.',
            ],
            phaseB: 'Fase B',
            phaseBTitle: 'Persistencia y Reporting',
            phaseBDesc: 'Features que hacen a architect viable para tareas largas y entornos CI/CD. Sesiones persistentes, reportes estructurados y flags nativos para pipelines.',
            phaseBItems: [
                '<strong>Session Resume</strong> — Persistencia del estado a disco. Si una sesión se interrumpe, se reanuda desde el último punto.',
                '<strong>Execution Report</strong> — Reportes en JSON, Markdown y GitHub PR comment con timeline, costes y quality gates.',
                '<strong>CI/CD Native Flags</strong> — <code>--json</code>, <code>--budget</code>, <code>--timeout</code>, <code>--context-git-diff</code>. Exit codes semánticos.',
                '<strong>Dry Run / Preview</strong> — El agente planifica sin ejecutar. Tools de lectura activas, escritura interceptada como plan.',
            ],
            phaseC: 'Fase C',
            phaseCTitle: 'Automatización Avanzada',
            phaseCDesc: 'Las features que convierten a architect en una herramienta de automatización seria. Loops autónomos, ejecución paralela y workflows multi-step.',
            phaseCItems: [
                '<strong>Ralph Loop Nativo</strong> — Loop de corrección automática: ejecutar, verificar checks externos, re-ejecutar con errores. Configurable con presupuesto y tiempo límite.',
                '<strong>Parallel Runs + Worktrees</strong> — Múltiples agentes en git worktrees aislados. Fan-out (misma tarea, varios modelos) o distribución de tareas.',
                '<strong>Pipeline Mode</strong> — Workflows YAML multi-step con variables, condiciones, checkpoints y resume desde cualquier paso.',
                '<strong>Checkpoints & Rollback</strong> — Puntos de restauración basados en git. Rollback a cualquier step anterior.',
                '<strong>Auto-Review</strong> — Patrón writer/reviewer: al completar, un reviewer analiza los cambios y genera correcciones automáticas.',
            ],
            phaseD: 'Fase D',
            phaseDTitle: 'Extras y Especialización',
            phaseDDesc: 'Features avanzadas que completan la plataforma: sub-agentes, métricas de salud, evaluación competitiva entre modelos y observabilidad.',
            phaseDItems: [
                '<strong>Sub-Agentes / Dispatch</strong> — Delegar sub-tareas a agentes con contexto independiente que retornan un resumen.',
                '<strong>Code Health Delta</strong> — Métricas de salud antes/después con radon, eslint. Diff de complejidad en el reporte.',
                '<strong>Competitive Eval</strong> — Misma tarea con diferentes modelos + reporte comparativo de calidad, coste y velocidad.',
                '<strong>OpenTelemetry Traces</strong> — Spans para sesiones, LLM calls, tools y hooks. Exporta a Jaeger, Grafana Tempo, etc.',
                '<strong>Preset Configs</strong> — Templates predefinidos: <code>python</code>, <code>node-react</code>, <code>ci</code>, <code>paranoid</code>.',
            ],
            phaseE: 'Fase E',
            phaseETitle: 'Backend Abstraction + Claude SDK',
            phaseEDesc: 'Capa de abstracción para proveedores LLM e integración nativa con Claude Agent SDK como motor de ejecución, manteniendo la capa de control de architect encima.',
            phaseEItems: [
                '<strong>Backend Abstraction Layer</strong> — Interfaz unificada para proveedores LLM con health checks, métricas por backend y switching transparente.',
                '<strong>Claude Agent SDK Backend</strong> — Backend de Claude Agent SDK para usar las tools nativas de Claude Code como motor, con la capa de control de architect encima.',
            ],
            phaseF: 'Fase F',
            phaseFTitle: 'Architect como MCP Server',
            phaseFDesc: 'Architect como servidor MCP nativo para integración bidireccional con Claude Code y otros agentes del ecosistema.',
            phaseFItems: [
                '<strong>Architect MCP Server</strong> — Servidor MCP nativo que expone las capacidades de architect (build, review, plan) como tools remotas para integración bidireccional con Claude Code y otros agentes.',
            ],
            phaseG: 'Fase G',
            phaseGTitle: 'Ralph v2 + Guardrails v2 + Reports v2',
            phaseGDesc: 'Profundización de los sistemas core: loops resumables, guardrails por agente con audit trail, pipelines paralelos y reportes en formatos estándar CI/CD.',
            phaseGItems: [
                '<strong>Ralph Loop v2</strong> — Resumable (si se interrumpe un loop largo, se retoma desde la última iteración). Estrategias de escalación: si lleva 5+ iteraciones fallando, cambia el approach automáticamente.',
                '<strong>Guardrails v2</strong> — Scoped por agente (el build puede tocar código, el deploy solo infra). Audit trail JSONL inmutable. <code>allowed_paths</code> como inverso de <code>protected_files</code>.',
                '<strong>Pipeline Engine v2</strong> — Steps paralelos, error handling declarativo (<code>on_failure: retry | skip | abort</code>), includes para reutilizar steps entre pipelines.',
                '<strong>Reports & Audit Engine</strong> — JUnit XML para dashboards CI/CD estándar, formato GitHub PR con secciones colapsables, desglose de coste por paso.',
            ],
            phaseH: 'Fase H',
            phaseHTitle: 'Output Modes + Fallback + Int. Tests',
            phaseHDesc: 'Resiliencia de producción: modos de salida configurables, fallback automático entre backends y suite de tests de integración end-to-end.',
            phaseHItems: [
                '<strong>CLI Output Modes</strong> — Modos de salida del CLI configurables y extensibles para distintos contextos de uso.',
                '<strong>Backend Health & Fallback</strong> — Health check y fallback automático entre backends. Si el proveedor principal cae, architect cambia al fallback sin intervención.',
                '<strong>Integration Test Suite</strong> — Suite de tests de integración end-to-end para validar flujos completos: build, review, loops, pipelines y parallel.',
            ],
            future: 'Horizonte',
            futureTitle: 'Futuro',
            futureDesc: 'Ideas en evaluación para después del lanzamiento de las fases principales. Sujetas a cambios según feedback de la comunidad.',
            futureItems: [
                '<strong>Sandbox Docker</strong> — Ejecutar el agente en un contenedor efímero para aislamiento total del sistema host.',
                '<strong>Watch Mode</strong> — Daemon que observa el workspace y reacciona automáticamente a triggers configurados.',
                '<strong>Streaming Interactivo</strong> — Inyección de instrucciones mid-task con Ctrl+M en modo interactivo.',
                '<strong>.architect.md Jerárquico</strong> — Skills por directorio que se fusionan según el contexto de archivos activos.',
            ],
            ctaTitle: '¿Falta algo en los planos?',
            ctaDesc: 'La arquitectura es un esfuerzo colaborativo. Propón nuevas herramientas o agentes en nuestro repositorio.',
            ctaButton: 'Abrir Issue en GitHub',
            // Sidebar TOC
            tocTitle: 'Fases',
            tocBack: 'Volver a Inicio',
            tocPhaseA: 'Fase A — Extensibilidad',
            tocPhaseB: 'Fase B — Persistencia',
            tocPhaseC: 'Fase C — Automatización',
            tocPhaseD: 'Fase D — Especialización',
            tocMilestone: 'Hito — v1.0.0',
            tocStabilization: 'Estabilización',
            tocPhaseE: 'Fase E — Backend + SDK',
            tocPhaseF: 'Fase F — MCP Server',
            tocPhaseG: 'Fase G — v2 Engines',
            tocPhaseH: 'Fase H — Output + Tests',
            tocFuture: 'Futuro',
        },
    },

    en: {
        // === Layout ===
        layout: {
            title: 'Architect | Official Documentation',
        },

        // === Navbar ===
        nav: {
            why: 'Why Architect',
            docs: 'Docs',
            useCases: 'Use Cases',
            roadmap: 'Roadmap',
            aria: 'Navigation menu',
            whyHref: 'why-architect/',
            useCasesHref: 'use-cases/',
        },

        // === Footer ===
        footer: {
            copyright: '© 2026 Architect Project.',
            tagline: 'Built with precision.',
            createdWith: 'Created with',
        },

        // === DocsSidebar ===
        sidebar: {
            backToDocs: 'Back to Docs',
            index: 'Index:',
        },

        // === UseCasesTOC ===
        toc: {
            onThisPage: 'On this page',
            backToHome: 'Back to Home',
        },

        // === VersionSelector ===
        version: {
            label: 'VERSION',
            latest: '(latest)',
        },

        // === ArchBanner ===
        archBanner: {
            label: 'New · Reference',
            title: 'Reference Architectures',
            desc: '10 real-world architectures where architect fits in production systems. Diagrams, YAML configs and code ready for CI/CD, Security, AIOps, MLOps and DevOps.',
            statArchitectures: 'architectures',
            statDomains: 'domains',
            statDiagrams: 'diagrams',
        },

        // === ArchitecturesPage ===
        archPage: {
            backToDocs: 'Back to Docs',
            title: 'Reference Architectures',
            intro: '10 real-world architectures where architect fits in production systems. Each one includes a flow diagram, YAML configuration, implementation commands, and the architect features used.',
        },

        // === Docs Hub ===
        docsHub: {
            title: 'Documentation',
            searchPlaceholder: 'Search documentation...',
            noResults: 'No results found.',
            defaultDesc: 'Detailed technical documentation about this module of the Architect system.',
        },

        // === Landing: Hero ===
        hero: {
            titleLine1: 'Plan and execute tasks with',
            titleHighlight: 'Agentic Precision',
            subtitle: 'The official documentation for <strong class="text-ink">Architect</strong>. An open source CLI tool that orchestrates AI agents to write, review, and fix code automatically. <strong class="text-ink">Headless-first</strong>: designed for CI/CD, pipelines, and automation. Multi-model with built-in security guardrails.',
            terminalHeader: 'TERMINAL — HUMAN LOG OUTPUT',
            terminalCmd: 'architect run "Refactor the project auth module"',
            terminalStep1: 'Step 1 → LLM call (5 messages)',
            terminalStep1Detail: 'LLM responded with 2 tool calls',
            terminalTool1: 'read_file → src/main.py',
            terminalTool2: 'edit_file → src/main.py (3→5 lines)',
            terminalHook: 'Hook python-lint:',
            terminalStep2: 'Step 2 → LLM call (9 messages)',
            terminalStep2Detail: 'LLM responded with final text',
            terminalDone: 'Agent completed (2 steps)',
            terminalReason: 'Reason: LLM decided it was done',
            terminalCost: 'Cost:',
            btnDocs: 'VIEW DOCS',
            btnGithub: 'GITHUB',
        },

        // === ElevatorPitch ===
        elevator: {
            title: 'What is Architect',
            badges: [
                'Multi-model', 'Ralph Loop', 'Parallel runs', 'Guardrails',
                'YAML Pipelines', 'Hooks', 'CI/CD-first', 'Auto memory',
                'OpenTelemetry', 'Reports', 'Dry run', 'Vercel Skills',
            ],
            lead: 'A command-line tool that turns any LLM into an autonomous code agent. Give it a task, and architect reads your code, plans changes, implements them, runs tests, and verifies the result — <strong>all without human intervention.</strong>',
            body1: 'Unlike code assistants that live inside an IDE, architect is designed to run where code is actually built: in terminals, scripts, Makefiles, and CI/CD pipelines. It\'s the missing piece between <em>"I have an AI that generates code"</em> and <em>"I have an AI that delivers verified code"</em>.',
            body2: 'Works with any LLM: OpenAI, Anthropic, Google, DeepSeek, Mistral, local models with Ollama — over 100 providers supported. You choose the model, architect does the work.',
            value1Title: 'Headless-first',
            value1Desc: 'Not a chat with superpowers. It\'s an automation tool that talks to LLMs.',
            value2Title: 'Determinism over probabilism',
            value2Desc: 'Hooks and guardrails are rules, not suggestions. The LLM decides what to do, quality gates verify the result is correct.',
            value3Title: 'Full transparency',
            value3Desc: 'Every agent action is logged with human-readable logs and structured JSON. No black boxes.',
            value4Title: 'Open source, no surprises',
            value4Desc: 'No subscriptions or locked features. You only pay the API costs of the LLM you choose.',
        },

        // === KillerFeatures ===
        features: {
            title: 'Key Features',
            items: [
                { title: 'Multi-Model, Zero Lock-in', description: 'Use any LLM: OpenAI, Anthropic, Google, DeepSeek, Mistral, Ollama — or any compatible API. Over 100 providers via LiteLLM. Switch models with a flag.' },
                { title: 'Ralph Loop — Autonomous Iteration', description: 'Run, verify with your tests, if they fail retry with clean context. Iterate until your checks actually pass — not until the LLM thinks it\'s done.' },
                { title: 'Parallel Runs with Worktrees', description: 'Multiple agents in parallel, each in its own isolated git worktree. Same task with N models to compare, or different tasks to multiply speed.' },
                { title: 'Guardrails & Quality Gates', description: 'Protected files, blocked commands, change limits, code rules. Mandatory quality gates before completion. Declarative in YAML, deterministic.' },
                { title: 'Declarative Pipelines', description: 'Multi-step YAML workflows. Plan, Build, Test, Review, Fix. Variables between steps, conditions, checkpoints. Composable and reusable.' },
                { title: 'Extensible with Hooks', description: '10 agent lifecycle events. Auto-format code, block dangerous commands, notify Slack when done. Pre and post on every action.' },
                { title: 'Built for CI/CD', description: 'Semantic exit codes, parseable JSON output, Markdown reports for PR comments. Budget and timeout as hard limits. No confirmations, no interactive prompts.' },
                { title: 'Learns With Use', description: 'Auto-generated procedural memory. Detects corrections and persists them. Combined with .architect.md and Vercel-compatible skills: three layers of accumulated knowledge.' },
            ],
            // Ralph Loop Spotlight
            ralphTitle: 'Ralph Loop — The Star Feature',
            ralphDesc1: 'The most productive pattern in agentic coding, built in as a native feature. Instead of trusting the AI to decide when it\'s done, architect runs your tests and linters after each iteration. If they fail, the agent retries with <strong>clean context</strong>.',
            ralphDesc2: 'Each iteration starts fresh — no accumulating garbage from previous attempts. It only receives: the original spec, the accumulated diff, and errors from the last iteration. The result: <strong>code that compiles, passes tests, and is clean.</strong>',
            ralphFigureTitle: 'Ralph Loop — Iteration 3/25',
            ralphLine1: 'Agent working (clean context + errors from iter. 2)...',
            ralphLine2: 'Agent completed',
            ralphVerification: 'External verification:',
            ralphTestPass: '18/18 passed',
            ralphLintPass: 'no errors',
            ralphDone: 'Loop completed in 3 iterations',
            // Guardrails Spotlight
            guardrailsTitle: 'Guardrails & Quality Gates',
            guardrailsDesc1: 'Architect\'s guardrails don\'t depend on the LLM. They are deterministic rules evaluated before and after every action. The agent can\'t skip them because it doesn\'t control them — <strong>they\'re outside its context.</strong>',
            guardrailsDesc2: 'If the agent tries to write to <code>.env</code> → blocked. If the code contains <code>eval()</code> → blocked. If it says "I\'m done" but pytest fails → keeps working. <strong>Quality gates pass or they don\'t.</strong> No negotiation.',
            // Parallel Spotlight
            parallelTitle: 'Parallel Runs with Git Worktrees',
            parallelDesc1: 'Launch multiple agents in parallel, each in its own isolated git worktree. Same task with different models to compare real results on your codebase. Or different tasks in parallel to multiply speed.',
            parallelDesc2: 'Native git worktrees: no copies, no conflicts, no Docker. Each worker operates on an isolated repo snapshot. In the end, <strong>objective data — not opinions.</strong>',
            parallelFigureTitle: 'Results — Competitive Eval',
            parallelSteps: 'steps',
            ralphCmd: 'Implement the payments module',
            parallelCmd: 'Refactor the auth module',
        },

        // === Comparison ===
        comparison: {
            title: 'Why Architect',
            intro: 'architect doesn\'t compete with Claude Code or Cursor on their turf. It competes where they don\'t reach: <strong>unsupervised execution, CI/CD, automation, scripts.</strong>',
            rows: [
                { label: 'Primary mode', claude: 'Interactive terminal', cursor: 'IDE (VS Code)', aider: 'Interactive terminal', architect: 'Headless / CI' },
                { label: 'Multi-model', claude: 'Claude only', cursor: 'Multi (with config)', aider: 'Multi', architect: 'Multi (LiteLLM, 100+)' },
                { label: 'Unsupervised', claude: 'Partial', cursor: 'No', aider: 'Partial', architect: 'Native' },
                { label: 'Parallel runs', claude: 'Manual (worktrees)', cursor: 'No', aider: 'No', architect: 'Native' },
                { label: 'Ralph Loop', claude: 'External plugin', cursor: 'No', aider: 'No', architect: 'Native' },
                { label: 'YAML Pipelines', claude: 'No', cursor: 'No', aider: 'No', architect: 'Yes' },
                { label: 'Guardrails', claude: 'Hooks (manual)', cursor: 'Limited', aider: 'No', architect: 'Declarative (YAML)' },
                { label: 'Quality Gates', claude: 'No', cursor: 'No', aider: 'No', architect: 'Yes' },
                { label: 'CI/CD-first', claude: 'Adaptable', cursor: 'No', aider: 'Partial', architect: 'Designed for it' },
                { label: 'CI exit codes', claude: 'No', cursor: 'No', aider: 'No', architect: 'Semantic' },
                { label: 'Reports', claude: 'No', cursor: 'No', aider: 'No', architect: 'JSON / MD / GitHub' },
                { label: 'Native MCP', claude: 'Yes', cursor: 'No', aider: 'No', architect: 'Yes' },
                { label: 'Post-edit hooks', claude: 'Manual', cursor: 'Partial', aider: 'No', architect: 'Auto & configurable' },
                { label: 'Self-eval', claude: 'No', cursor: 'No', aider: 'No', architect: 'Basic + Full' },
                { label: 'Skills ecosystem', claude: 'Yes', cursor: 'Yes', aider: 'No', architect: 'Yes (Vercel-compatible)' },
                { label: 'Procedural memory', claude: 'No', cursor: 'No', aider: 'No', architect: 'Auto-generated' },
                { label: 'Session resume', claude: 'Partial', cursor: 'No', aider: 'No', architect: 'Complete' },
                { label: 'Checkpoints', claude: 'Interactive', cursor: 'No', aider: 'Git auto-commits', architect: 'Programmatic' },
                { label: 'OpenTelemetry', claude: 'No', cursor: 'No', aider: 'No', architect: 'Native' },
                { label: 'Cost tracking', claude: 'Limited', cursor: 'No', aider: 'Partial', architect: 'Complete + budget' },
                { label: 'Custom agents', claude: 'No', cursor: 'No', aider: 'No', architect: 'Yes (YAML)' },
                { label: 'Open source', claude: 'No', cursor: 'No', aider: 'Yes', architect: 'Yes' },
                { label: 'Cost', claude: '$20/mo (Pro)', cursor: '$20/mo', aider: 'API costs', architect: 'API costs (free)' },
            ],
            quoteVsClaude: '<strong>vs Claude Code:</strong> Claude Code is the best interactive terminal agent. architect is the best agent for automation. Claude Code is your copilot; architect is your <em>CI team and autopilot</em>.',
            quoteVsCursor: '<strong>vs Cursor:</strong> Cursor lives inside the IDE. architect lives where code is built and deployed: in <em>terminals, pipelines, CI, scripts and cron jobs</em>.',
            quoteVsAider: '<strong>vs Aider:</strong> Aider pioneered CLI agents. architect takes the idea further: parallel runs, declarative pipelines, guardrails, quality gates, self-evaluation, MCP, and an architecture designed to run <em>unsupervised for hours</em>.',
        },

        // === UseCases (landing section) ===
        useCases: {
            title: 'Use Cases',
            devTitle: 'For Developers',
            devDesc: 'Set up a Ralph Loop with your spec and tests. Close the laptop. Next morning you have a PR with code that compiles and passes all tests.',
            devCases: [
                { label: 'Coding overnight', cmd: 'architect loop --spec tasks/payment-module.md \\\n  --check "pytest tests/ -q" \\\n  --check "mypy src/" \\\n  --max-iterations 30' },
                { label: 'Competitive coding', cmd: 'architect parallel "Optimize SQL queries" \\\n  --models gpt-4.1,claude-sonnet-4,deepseek-chat' },
                { label: 'Safe refactoring', cmd: 'architect run "Migrate from SQLAlchemy sync to async" \\\n  --dry-run\n# Preview first, then execute with checkpoints:\narchitect run "Migrate from SQLAlchemy sync to async" \\\n  --checkpoint-every 5' },
            ],
            teamTitle: 'For Teams',
            teamDesc: 'Automatic review on every PR, shared standards encoded in YAML, and objective evaluation when switching models.',
            teamCases: [
                { label: 'Automatic PR review', cmd: 'architect run "Review this PR" \\\n  --agent review \\\n  --context-git-diff origin/main \\\n  --report github > review.md' },
                { label: 'Shared standards', cmd: '# .architect.md + guardrails + skills\n# Team conventions encoded,\n# versioned in git, verified on every run' },
                { label: 'Model evaluation', cmd: 'architect eval \\\n  --models claude-sonnet-4,gpt-4.1 \\\n  --tasks eval/tasks.yaml' },
            ],
            teamFigureTitle: 'GitHub Actions — Review',
            teamGhActionCmd: 'Review the changes in this PR',
            ciTitle: 'For CI/CD & DevOps',
            ciDesc: 'Integrate architect in your pipelines. Automatic lint fix, changelog generation, updated docs — all headless, all auditable.',
            ciCases: [
                { label: 'Automatic lint fix', cmd: 'architect loop "Fix lint errors" \\\n  --check "eslint src/ --max-warnings 0" \\\n  --max-iterations 5 --budget 0.50' },
                { label: 'Automatic changelog', cmd: 'architect run "Generate changelog from v1.2.0" \\\n  --report markdown > CHANGELOG.md' },
                { label: 'Automatic docs', cmd: 'architect pipeline pipelines/update-docs.yaml' },
            ],
        },

        // === QuickStart ===
        quickstart: {
            title: 'Get Started in 30 Seconds',
            step1Title: 'Install',
            step1Note: 'Requires Python 3.12+',
            step2Title: 'Configure',
            step2Note: 'Or --preset node-react, --preset ci, or manual with export OPENAI_API_KEY=sk-...',
            step3Title: 'Your first task',
            step3Cmd: 'Add a GET /health endpoint that returns {status: ok}',
            figureTitle: 'More examples',
            comment1: '# Preview without executing (like terraform plan)',
            exCmd1: 'Refactor the auth module',
            comment2: '# Ralph Loop: iterate until tests pass',
            exCmd2: 'Fix all lint errors',
            comment3: '# Parallel: 3 models, same task, compare',
            exCmd3: 'Optimize the SQL queries',
            comment4: '# In CI/CD with budget and report',
            exCmd4: 'Review this PR',
            comment5: '# Semantic exit codes',
            exitCodes: '# 0 = success, 1 = failed, 2 = partial',
            ctaText: 'Open source. No subscriptions. You only pay the API costs of the LLM you choose.',
            ctaButton: 'Use Cases',
            ctaHref: 'use-cases/',
        },

        // === CasosDeUsoPage ===
        casosDeUso: {
            title: 'Use Cases',
            subtitle: 'Practical guide for integrating <code>architect</code> into real workflows: daily development, CI/CD, DevOps, QA, documentation and advanced architectures.',
        },

        // === WhyArchitectPage ===
        whyArchitect: {
            title: 'Why Architect',
            subtitle1: '<code>architect</code> is the automation and control layer missing between AI agents and your CI/CD pipeline. Claude Code is brilliant at implementing code. architect ensures that code passes tests, meets guardrails, and is delivered verifiably — without human supervision, for hours if needed.',
            subtitle2: 'Use architect with Claude (via Agent SDK), with GPT-4.1, with DeepSeek, or with your local model. The brain changes, the guarantees don\'t.',
        },

        // === RoadmapPage ===
        roadmap: {
            heroTitle: 'Blueprints for',
            heroHighlight: 'Expansion',
            heroSubtitle: 'Technical roadmap for <code>architect</code>. Construction phases, tools under development and the future of agentic orchestration.',
            badgeCompleted: 'COMPLETED',
            badgePlanned: 'BLUEPRINTS APPROVED',
            badgeFuture: 'FEASIBILITY STUDY',
            badgeMonitoring: 'MONITORING',
            milestoneLabel: 'Milestone Achieved',
            milestoneTitle: 'v1.0.0 Stable Release',
            milestoneBadge: 'Official Release',
            stabilizationLabel: 'Stabilization Phase',
            stabilizationTitle: 'Exhaustive Testing & Hardening',
            stabilizationDesc: 'Integration tests battery, stress tests and post-release edge case fixes. Core stabilization before new features.',
            gaugeLabel: 'Test Coverage',
            // Phases
            phaseA: 'Phase A',
            phaseATitle: 'Extensibility Foundations',
            phaseADesc: 'The infrastructure everything else builds on. Hooks, guardrails, skills and procedural memory form the backbone of agent extensibility.',
            phaseAItems: [
                '<strong>Complete Hook System</strong> — 10 lifecycle events, action blocking/modification, async execution and timeouts.',
                '<strong>First-Class Guardrails</strong> — Protected files, blocked commands, edit limits, code rules and mandatory quality gates.',
                '<strong>.architect.md + Skills</strong> — Auto-injected project context and reusable skills ecosystem activated by glob.',
                '<strong>Procedural Memory</strong> — User correction detection, disk persistence and automatic injection in future sessions.',
            ],
            phaseB: 'Phase B',
            phaseBTitle: 'Persistence and Reporting',
            phaseBDesc: 'Features that make architect viable for long tasks and CI/CD environments. Persistent sessions, structured reports and native flags for pipelines.',
            phaseBItems: [
                '<strong>Session Resume</strong> — State persistence to disk. If a session is interrupted, it resumes from the last point.',
                '<strong>Execution Report</strong> — Reports in JSON, Markdown and GitHub PR comment with timeline, costs and quality gates.',
                '<strong>CI/CD Native Flags</strong> — <code>--json</code>, <code>--budget</code>, <code>--timeout</code>, <code>--context-git-diff</code>. Semantic exit codes.',
                '<strong>Dry Run / Preview</strong> — The agent plans without executing. Read tools active, write intercepted as plan.',
            ],
            phaseC: 'Phase C',
            phaseCTitle: 'Advanced Automation',
            phaseCDesc: 'The features that turn architect into a serious automation tool. Autonomous loops, parallel execution and multi-step workflows.',
            phaseCItems: [
                '<strong>Native Ralph Loop</strong> — Automatic correction loop: run, verify external checks, re-run with errors. Configurable with budget and time limit.',
                '<strong>Parallel Runs + Worktrees</strong> — Multiple agents in isolated git worktrees. Fan-out (same task, several models) or task distribution.',
                '<strong>Pipeline Mode</strong> — Multi-step YAML workflows with variables, conditions, checkpoints and resume from any step.',
                '<strong>Checkpoints & Rollback</strong> — Git-based restore points. Rollback to any previous step.',
                '<strong>Auto-Review</strong> — Writer/reviewer pattern: on completion, a reviewer analyzes changes and generates automatic corrections.',
            ],
            phaseD: 'Phase D',
            phaseDTitle: 'Extras and Specialization',
            phaseDDesc: 'Advanced features that complete the platform: sub-agents, health metrics, competitive evaluation between models and observability.',
            phaseDItems: [
                '<strong>Sub-Agents / Dispatch</strong> — Delegate sub-tasks to agents with independent context that return a summary.',
                '<strong>Code Health Delta</strong> — Before/after health metrics with radon, eslint. Complexity diff in the report.',
                '<strong>Competitive Eval</strong> — Same task with different models + comparative report of quality, cost and speed.',
                '<strong>OpenTelemetry Traces</strong> — Spans for sessions, LLM calls, tools and hooks. Export to Jaeger, Grafana Tempo, etc.',
                '<strong>Preset Configs</strong> — Predefined templates: <code>python</code>, <code>node-react</code>, <code>ci</code>, <code>paranoid</code>.',
            ],
            phaseE: 'Phase E',
            phaseETitle: 'Backend Abstraction + Claude SDK',
            phaseEDesc: 'Abstraction layer for LLM providers and native integration with Claude Agent SDK as execution engine, keeping architect\'s control layer on top.',
            phaseEItems: [
                '<strong>Backend Abstraction Layer</strong> — Unified interface for LLM providers with health checks, per-backend metrics and transparent switching.',
                '<strong>Claude Agent SDK Backend</strong> — Claude Agent SDK backend to use Claude Code\'s native tools as engine, with architect\'s control layer on top.',
            ],
            phaseF: 'Phase F',
            phaseFTitle: 'Architect as MCP Server',
            phaseFDesc: 'Architect as a native MCP server for bidirectional integration with Claude Code and other ecosystem agents.',
            phaseFItems: [
                '<strong>Architect MCP Server</strong> — Native MCP server exposing architect capabilities (build, review, plan) as remote tools for bidirectional integration with Claude Code and other agents.',
            ],
            phaseG: 'Phase G',
            phaseGTitle: 'Ralph v2 + Guardrails v2 + Reports v2',
            phaseGDesc: 'Deepening of core systems: resumable loops, per-agent guardrails with audit trail, parallel pipelines and reports in standard CI/CD formats.',
            phaseGItems: [
                '<strong>Ralph Loop v2</strong> — Resumable (if a long loop is interrupted, it resumes from the last iteration). Escalation strategies: if it\'s been failing for 5+ iterations, automatically changes approach.',
                '<strong>Guardrails v2</strong> — Scoped per agent (build can touch code, deploy only infra). Immutable JSONL audit trail. <code>allowed_paths</code> as inverse of <code>protected_files</code>.',
                '<strong>Pipeline Engine v2</strong> — Parallel steps, declarative error handling (<code>on_failure: retry | skip | abort</code>), includes to reuse steps between pipelines.',
                '<strong>Reports & Audit Engine</strong> — JUnit XML for standard CI/CD dashboards, GitHub PR format with collapsible sections, cost breakdown per step.',
            ],
            phaseH: 'Phase H',
            phaseHTitle: 'Output Modes + Fallback + Int. Tests',
            phaseHDesc: 'Production resilience: configurable output modes, automatic fallback between backends and end-to-end integration test suite.',
            phaseHItems: [
                '<strong>CLI Output Modes</strong> — Configurable and extensible CLI output modes for different usage contexts.',
                '<strong>Backend Health & Fallback</strong> — Health check and automatic fallback between backends. If the primary provider goes down, architect switches to fallback without intervention.',
                '<strong>Integration Test Suite</strong> — End-to-end integration test suite to validate complete flows: build, review, loops, pipelines and parallel.',
            ],
            future: 'Horizon',
            futureTitle: 'Future',
            futureDesc: 'Ideas under evaluation for after the main phases launch. Subject to changes based on community feedback.',
            futureItems: [
                '<strong>Docker Sandbox</strong> — Run the agent in an ephemeral container for total host system isolation.',
                '<strong>Watch Mode</strong> — Daemon that observes the workspace and automatically reacts to configured triggers.',
                '<strong>Interactive Streaming</strong> — Mid-task instruction injection with Ctrl+M in interactive mode.',
                '<strong>Hierarchical .architect.md</strong> — Per-directory skills that merge based on the active file context.',
            ],
            ctaTitle: 'Missing something from the blueprints?',
            ctaDesc: 'Architecture is a collaborative effort. Propose new tools or agents in our repository.',
            ctaButton: 'Open Issue on GitHub',
            // Sidebar TOC
            tocTitle: 'Phases',
            tocBack: 'Back to Home',
            tocPhaseA: 'Phase A — Extensibility',
            tocPhaseB: 'Phase B — Persistence',
            tocPhaseC: 'Phase C — Automation',
            tocPhaseD: 'Phase D — Specialization',
            tocMilestone: 'Milestone — v1.0.0',
            tocStabilization: 'Stabilization',
            tocPhaseE: 'Phase E — Backend + SDK',
            tocPhaseF: 'Phase F — MCP Server',
            tocPhaseG: 'Phase G — v2 Engines',
            tocPhaseH: 'Phase H — Output + Tests',
            tocFuture: 'Future',
        },
    },
} as const;
