---
description: "Analiza un sitio de manga/cómics y entrega su módulo de RyuuNest en una carpeta. Uso: /scrape-site <url> [destino=ruta]"
---

Analiza este sitio con la skill `site-scraper`: $ARGUMENTS

Primero carga la skill con la herramienta `skill` y sigue sus fases en orden, empezando por la comprobación de conexión al home. Lee también sus referencias cuando la skill lo indique.

Cómo interpretar los argumentos:

- El primer valor es la URL del home del sitio. Si no hay URL, pídela y no hagas nada más.
- Opcional: `destino=<ruta>`: carpeta donde se creará la del sitio. Sin ese argumento, se usa el directorio actual.
- Opcional: `hasta=<fase>` para detener el análisis al terminar esa fase y reportar en el chat. Fases: `conexion`, `home`, `tarjetas`, `buscador`, `detalle`, `lector`, `modulo`. Sin ese argumento, haz todas.

Resultado esperado: una sola carpeta `<destino>/<sitio>/` con `manifest.json`, `module.js` y `bin/` (toda la lógica). No generes JSON de análisis, reportes ni archivos por fase; el análisis se resume en el chat y los HTML de trabajo van solo en `.scrape-tmp/<sitio>/`.

Recuerda lo esencial:

- Nivel 1 (HTTP) antes que navegador. Si hay adware, popups o redirecciones a sitios externos, para, cierra todo y pasa el trabajo al humano como indica la skill.
- No inventes datos. Ante una duda real, pregunta.
- No toques el código de la app ni los módulos existentes, y nunca sobrescribas una carpeta que ya exista.
- si no puedes resolver la tarea, usa otro metodo usando librerias si es necesario

**ruta de la skill** `C:\Users\poti\.opencode-skill-libraries\_uncategorized\site-scraper`
