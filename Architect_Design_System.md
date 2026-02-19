# Sistema de Diseño: "Architect"

Guía de Estilos para Documentación Oficial

## 1. Concepto Core y Filosofía Visual

El diseño se aleja del tradicional "modo oscuro hacker" o del estilo corporativo de SaaS moderno. La estética se basa en el brutalismo editorial y la arquitectura analógica.

Simula estar leyendo un manual de obra impreso, bocetos sobre una mesa de dibujo y planos técnicos.

- **Sensaciones:** Precisión, solidez, trabajo manual, técnica, claridad absoluta.
- **Elementos clave:** Líneas marcadas, sombras sólidas (sin difuminado), texturas de cuadrícula, colores de tinta y ladrillo.

## 2. Paleta de Colores (Tokens)

La paleta se divide en colores de fondo (papel), tintas (texto y bordes) y acentos (materiales).

### 2.1 Fondos y Superficies (Papel)

- **Paper (Fondo principal):** `#FDFBF7`
  - **Uso:** Color de fondo del `<body>`. Simula un papel crema claro de alta calidad.
- **Surface (Tarjetas y contenedores):** `#FFFFFF`
  - **Uso:** Fondo de tarjetas, bloques de código, botones secundarios y cajetines de búsqueda. Crea contraste con el fondo crema.
- **Shape (Decoraciones de fondo):** `#F3EFE6`
  - **Uso:** Formas geométricas de fondo (como el arco superior) para dar profundidad sin usar sombras.

### 2.2 Tintas (Texto y Líneas)

- **Ink (Grafito oscuro):** `#292524` (Stone 800 en Tailwind)
  - **Uso:** Texto principal, títulos (h1, h2, h3), bordes gruesos de componentes (2px), iconos, y color base de las sombras sólidas.
- **Ink Light (Grafito medio):** `#57534E` (Stone 600)
  - **Uso:** Texto secundario, párrafos largos, placeholders de inputs, comentarios en bloques de código.
- **Line (Cuadrícula y bocetos):** `#E7E5DF`
  - **Uso:** La cuadrícula de fondo y bordes muy sutiles.

### 2.3 Acentos (Materiales)

- **Brick (Terracota / Ladrillo):** `#C85A32`
  - **Uso:** Color principal de acción. Botones primarios, iconos destacados, enlaces, subrayados tipo marcador, indicadores de progreso.
- **Brick Light:** `#E87D57`
  - **Uso:** Estados hover o fondos con opacidad reducida (ej: `rgba(200, 90, 50, 0.15)` para fondos de iconos o subrayados).

## 3. Tipografía

El sistema utiliza tres familias tipográficas de Google Fonts, cada una con un propósito estricto.

### 3.1 Headings (Títulos y Botones)

- **Familia:** Outfit, sans-serif
- **Pesos:** Medium (500), Bold (700), ExtraBold (800).
- **Estilo:** Generalmente en MAYÚSCULAS (uppercase) y con tracking ajustado (`tracking-tight` para títulos grandes, `tracking-widest` para botones y etiquetas).
- **Uso:** Exclusivo para H1, H2, H3, etiquetas de figuras y texto dentro de botones.

### 3.2 Body (Texto general)

- **Familia:** Inter, sans-serif
- **Pesos:** Light (300), Regular (400), Medium (500), SemiBold (600).
- **Uso:** Párrafos de la documentación, descripciones de tarjetas, navegación secundaria. Debe ser altamente legible.

### 3.3 Monospace (Código y Datos técnicos)

- **Familia:** Fira Code, monospace
- **Pesos:** Regular (400), Medium (500).
- **Uso:** Bloques de código, comandos de terminal, atajos de teclado (`<kbd>`), versiones (v1.2.0), nombres de archivos.

## 4. Lenguaje Visual y Efectos

### 4.1 Sombras Brutalistas (Sombra Editorial)

No se usan sombras difuminadas (blur). Se usan sombras sólidas y desplazadas para simular que los elementos físicos están apilados.

- **Sombra base (Shadow Draft):** `box-shadow: 6px 6px 0px 0px rgba(41, 37, 36, 1);`
- **Sombra presionada/Hover:** `box-shadow: 2px 2px 0px 0px rgba(41, 37, 36, 1);`

**Nota de interacción:** Cuando un elemento hace hover o focus, debe trasladarse en X e Y y reducir la sombra para crear un efecto físico de ser "aplastado".

- **Clases Tailwind:** `hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-draft-hover`

### 4.2 Bordes

- Los bordes de los contenedores interactivos y bloques principales siempre son de 2px sólidos.
- **Clase Tailwind:** `border-2 border-arch-ink`
- Los bordes internos o separadores pueden ser de 1px o 2px dependiendo de la jerarquía.

### 4.3 Fondos y Texturas

- **Cuadrícula (Grid):** Se crea mediante un `linear-gradient` en CSS sobre el body. Tamaño de celda: 60px.
- **Subrayado Marcador:** Se utiliza un pseudo-elemento `::after` con opacidad del 15% del color Brick, rotado ligeramente (`transform: skewX(-15deg)`), posicionado detrás del texto clave.

### 4.4 Iconografía

- **Estilo:** Lineal (stroke), grosor de 2px o 2.5px.
- **Detalle técnico:** En los SVG, utilizar `stroke-linecap="square"` y `stroke-linejoin="miter"`. Esto hace que las esquinas de los iconos sean puntiagudas y cuadradas, reforzando el aspecto técnico/arquitectónico, evitando bordes redondeados infantiles.

## 5. Componentes Clave (Reglas de construcción)

### 5.1 Botones

- **Primario:** Fondo Brick, Texto Surface, borde Ink 2px, sombra Draft. Letra Outfit, Bold, Uppercase.
- **Secundario:** Fondo Surface, Texto Ink, borde Ink 2px, sombra Draft. Letra Outfit, Bold, Uppercase. Al hacer hover, el fondo cambia a Paper.

### 5.2 Tarjetas de Documentación (Cards)

- **Contenedor:** Fondo Surface, borde Ink 2px, sombra Draft. Comportamiento hover "aplastar".
- **Esquina decorativa:** Un triángulo o cuadrado en la esquina superior derecha, simulando cinta de carrocero o pliegues (Fondo Brick al 10%, con bordes inferior e izquierdo de 2px).
- **Cajetín de Icono:** Fondo Paper, borde Ink 2px, tamaño fijo (ej. 56x56px).

### 5.3 Bloques de Código ("Figura/Manual")

No parecen terminales Mac. Parecen diagramas de libros impresos.

- **Cabecera:** Fondo Paper, borde inferior Ink 2px. Texto en Fira Code, tamaño pequeño, indicando "FIGURA X: NOMBRE_ARCHIVO".
- **Cuerpo:** Fondo Surface. Indicadores de progreso (como el planner) usan pequeños cuadrados sólidos de color Brick o bordes izquierdos gruesos en lugar de ticks verdes (✔).

### 5.4 Buscador

- **Contenedor:** Padding generoso (e.g. `py-5`), borde 2px.
- **Interacción Focus:** El input no debe tener un anillo de color de sistema (`outline-none`). En su lugar, el borde cambia a Brick, y todo el cajetín hace el efecto físico de aplastarse (translación y reducción de sombra).

## 6. Recomendaciones para el desarrollo en Astro

- **Tailwind Config:** Copia exactamente la extensión de la configuración de Tailwind del HTML original (colores, fuentes y box-shadows) en tu archivo `tailwind.config.mjs` de Astro.
- **Layout Principal (Layout.astro):** Define el `<style is:global>` en tu layout base. Mete allí el `background-image` de la cuadrícula, y las importaciones de Google Fonts.
- **Sistema de Componentes:**
  - Crea un componente `<Card />` para no repetir la lógica del borde, la sombra y la esquina decorativa.
  - Crea un componente `<CodeBlock />` que reciba un prop `filename` para pintar automáticamente la cabecera tipo "FIGURA".
- **Diagramas en MDX/Markdown:** Si usas colecciones de contenido en Astro, te sugiero que los diagramas de arquitectura los hagas en formato ASCII art dentro de bloques de código o uses SVG exportados en monocromo, para mantener la vibra de "plano impreso". No utilices imágenes coloridas o fotos reales dentro de la documentación.