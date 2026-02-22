# Architect Docs

Web de documentacion tecnica de **Architect CLI**, construida con [Astro](https://astro.build).

Architect es una CLI headless que conecta un LLM a herramientas de sistema de archivos y servidores MCP. El usuario describe una tarea en lenguaje natural y el sistema itera autonomamente: LLM -> tools -> resultados -> siguiente iteracion.

**Live:** [https://Diego303.github.io/architect-docs/](https://Diego303.github.io/architect-docs/)

## Estructura del proyecto

```
src/
├── components/
│   ├── sections/              # Secciones de la landing page
│   │   ├── Comparison.astro
│   │   ├── ElevatorPitch.astro
│   │   ├── KillerFeatures.astro
│   │   ├── QuickStart.astro
│   │   └── UseCases.astro
│   ├── ui/                    # Componentes reutilizables
│   │   ├── Button.astro
│   │   ├── Card.astro
│   │   ├── CodeFigure.astro
│   │   └── FeatureCard.astro
│   ├── CasosDeUsoPage.astro   # Pagina de casos de uso
│   ├── DocsSidebar.astro      # Sidebar con indice de navegacion
│   ├── Footer.astro
│   ├── LandingPage.astro
│   ├── Navbar.astro
│   ├── Prose.astro            # Wrapper de estilos para contenido markdown
│   ├── RoadmapPage.astro      # Pagina de roadmap (timeline visual)
│   ├── UseCasesTOC.astro      # TOC lateral para casos de uso
│   └── VersionSelector.astro  # Desplegable de version en hub de docs
├── config/
│   └── versions.ts            # Configuracion centralizada de versiones
├── content/
│   ├── docs/                  # Documentacion versionada en markdown
│   │   ├── v0-15-3/           # Docs de Architect v0.15.3
│   │   └── v0-16-1/           # Docs de Architect v0.16.1
│   └── pages/                 # Paginas de contenido standalone
│       └── casos-de-uso.md
├── layouts/
│   └── Layout.astro
└── pages/
    ├── index.astro            # Landing page
    ├── casos-de-uso.astro     # Pagina de casos de uso
    ├── roadmap.astro          # Pagina de roadmap
    └── docs/
        ├── index.astro        # Hub de documentacion con selector de version
        └── [...slug].astro    # Paginas de documentacion dinamicas
```

## Paginas

| Pagina | Ruta | Descripcion |
|--------|------|-------------|
| Landing | `/` | Presentacion del proyecto, features y quick start |
| Docs Hub | `/docs/` | Hub con tarjetas de documentacion, buscador y selector de version |
| Docs | `/docs/v0-16-1/*` | Documentacion tecnica versionada (16 secciones por version) |
| Casos de Uso | `/casos-de-uso/` | Guia practica de integracion en flujos reales: CI/CD, DevOps, QA, MCP |
| Roadmap | `/roadmap/` | Timeline visual de fases de desarrollo: completadas, en curso y futuras |

## Documentacion incluida (por version)

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
| Security | Capas defensivas, path traversal, sandboxing |
| Containers | Docker, rootless, Kubernetes, CI runners |
| Testing | Mapa de tests, cobertura, fixtures |
| MCP Server | Architect como servidor MCP |
| Good Practices | Patrones recomendados y antipatrones |
| Fast Usage | Referencia rapida de comandos |

## Sistema de versiones

La documentacion soporta multiples versiones de Architect. Cada version vive en su propio subdirectorio (`src/content/docs/v0-16-1/`, `src/content/docs/v0-15-3/`). El hub de docs incluye un selector de version junto al buscador. La configuracion de versiones esta centralizada en `src/config/versions.ts`.

Para añadir una nueva version: crear la carpeta con los docs, añadir una entrada en `versions.ts` y marcarla como `isLatest: true`.

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
