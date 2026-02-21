# Architect Docs

Web de documentacion tecnica de **Architect CLI**, construida con [Astro](https://astro.build).

Architect es una CLI headless que conecta un LLM a herramientas de sistema de archivos y servidores MCP. El usuario describe una tarea en lenguaje natural y el sistema itera autonomamente: LLM -> tools -> resultados -> siguiente iteracion.

**Live:** [https://Diego303.github.io/architect-docs/](https://Diego303.github.io/architect-docs/)

## Estructura del proyecto

```
src/
├── components/
│   ├── sections/          # Secciones de la landing page
│   │   ├── Comparison.astro
│   │   ├── ElevatorPitch.astro
│   │   ├── KillerFeatures.astro
│   │   ├── QuickStart.astro
│   │   └── UseCases.astro
│   ├── ui/                # Componentes reutilizables
│   │   ├── Button.astro
│   │   ├── Card.astro
│   │   ├── CodeFigure.astro
│   │   └── FeatureCard.astro
│   ├── DocsSidebar.astro  # Sidebar con indice de navegacion
│   ├── Footer.astro
│   ├── LandingPage.astro
│   ├── Navbar.astro
│   └── Prose.astro        # Wrapper de estilos para contenido markdown
├── content/
│   └── docs/              # Documentacion en markdown
│       ├── introduccion.md
│       ├── usage.md
│       ├── architecture.md
│       ├── core-loop.md
│       ├── data-models.md
│       ├── tools-and-execution.md
│       ├── agents-and-modes.md
│       ├── config-reference.md
│       ├── logging.md
│       ├── ai-guide.md
│       └── testing.md
├── layouts/
│   └── Layout.astro
└── pages/
    ├── index.astro        # Landing page
    └── docs/
        ├── index.astro    # Hub de documentacion
        └── [...slug].astro # Paginas de documentacion dinamicas
```

## Documentacion incluida

| Seccion | Descripcion |
|---------|-------------|
| Introduccion | Vision general del proyecto y navegacion a las demas secciones |
| Usage | Flags, logging, configs, CI/CD, scripts, agentes custom |
| Architecture | Diagrama de componentes y flujo de ejecucion |
| Core Loop | Bucle principal del agente, safety nets, StopReason |
| Data Models | Modelos Pydantic, dataclasses, jerarquia de errores |
| Tools & Execution | Sistema de tools, filesystem, MCP, ExecutionEngine |
| Agents & Modes | Agentes por defecto, registry, prompts del sistema |
| Config Reference | Schema de configuracion, precedencia, variables de entorno |
| Logging | 3 pipelines, nivel HUMAN, HumanFormatter, structlog |
| AI Guide | Guia para IA: invariantes, patrones, trampas |
| Testing | Mapa de tests (~597 tests en 25 archivos) |

## Requisitos

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

## Comandos

| Comando | Accion |
|---------|--------|
| `pnpm install` | Instalar dependencias |
| `pnpm dev` | Servidor de desarrollo en `localhost:4321` |
| `pnpm build` | Build de produccion en `./dist/` |
| `pnpm preview` | Preview del build local |

## Despliegue

El sitio se despliega automaticamente en **GitHub Pages** mediante GitHub Actions al hacer push a la rama `main`. El workflow usa la accion oficial de Astro (`withastro/action@v2`).

## Stack

- **Framework:** Astro 5
- **Contenido:** Markdown via Content Collections
- **Despliegue:** GitHub Pages
- **CI/CD:** GitHub Actions
