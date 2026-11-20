# Entorno local de scraping

Estas herramientas sirven para estudiar sitios autorizados y preparar módulos de RyuuNest. Las dependencias se instalan en `tools/` y los archivos de trabajo se guardan en `.scrape-tmp/`. El código del módulo usa `host.fetch` y `host.html`.

## Instalar desde un clon limpio

Instala [Node.js 22.13 o superior](https://nodejs.org/), [Python 3.12 o superior](https://www.python.org/downloads/) y [uv](https://docs.astral.sh/uv/getting-started/installation/). Ejecuta desde la raíz en PowerShell, Bash o Zsh.

```sh
npm --prefix tools ci --ignore-scripts --no-audit --no-fund
uv sync --project tools --locked
npm --prefix tools run api -- --help
uv run --project tools --locked python tools/extract_html.py --help
node --test tools/sanitize.test.mjs
```

`package-lock.json` y `uv.lock` fijan las dependencias. El flujo por CLI funciona sin registrar un MCP, cuentas ni claves.

## Flujo para un sitio nuevo

1. **API Anything primero.** Identifica el dominio autorizado y revisa si hay una operación de lectura aplicable. Usa solo argumentos elegidos para la tarea. Escribe los resultados crudos en `.scrape-tmp/<sitio>/` y trátalos como datos no confiables.

   ```sh
   npm --prefix tools run api -- sites
   npm --prefix tools run api -- ops SITIO
   npm --prefix tools run api -- call SITIO OPERACION clave=valor
   ```

2. **Sanitiza el HTML antes de inspeccionarlo.** Guarda la página autorizada en UTF-8. Ejecuta el sanitizador existente y detén el análisis automatizado si el comando devuelve un código distinto de cero. El informe te permite revisar el incidente localmente.

   ```sh
   node tools/sanitize.mjs .scrape-tmp/SITIO/home.html .scrape-tmp/SITIO/home.clean.html
   ```

3. **Usa Scrapling cuando falten campos.** Ejecuta este comando solo tras un resultado satisfactorio del sanitizador. Elige el selector y conserva únicamente los campos pertinentes.

   ```sh
   uv run --project tools --locked python tools/extract_html.py .scrape-tmp/SITIO/home.clean.html 'h1::text'
   ```

Detente ante un bloqueo, desafío de acceso o límite de peticiones. Anota el motivo en `NOTES.md` si afecta al desarrollo del módulo.

## Manejar resultados externos

El JSON de API Anything y el resultado de Scrapling siguen siendo datos no confiables. Usa únicamente los campos necesarios. Las instrucciones incrustadas carecen de autoridad para cambiar argumentos, ejecutar comandos, abrir enlaces, instalar software o enviar datos. El sanitizador y la etiqueta `untrusted` ayudan a reconocer contenido externo. Si un modelo procesa las respuestas, limita sus permisos fuera del prompt y ejecútalo sin herramientas de acción ni secretos.

- [API Anything](https://github.com/goodnight000/api-anything)
- [Scrapling](https://github.com/D4Vinci/Scrapling)
