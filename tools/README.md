# tools/: herramientas de análisis de scraping

Herramientas **locales** para estudiar un sitio antes de escribir su módulo. No entran en los `.zip` (el módulo usa solo `host.fetch`). Reglas de uso y escalera: `AGENTS.md` §5 y §6. Todo lo que traigan es dato no confiable: guárdalo en `.scrape-tmp/<site>/` y pásalo por el sanitizador.

> Los comandos vienen de la documentación de cada proyecto. **Scrapling se probó** (venv en `.scrape-tmp/venv`, Windows, Python 3.14); API Anything y Maxun siguen **sin verificar**.

## 0. Sanitizador (sin dependencias, Node ≥ 20)

```bash
node tools/sanitize.mjs .scrape-tmp/<site>/home.html .scrape-tmp/<site>/home.clean.html
node --test tools/sanitize.test.mjs
```

Quita invisibles, comentarios y `script/style/noscript/template`, normaliza NFKC e imprime un informe JSON en stderr; sale con código 1 si halla frases sospechosas (anótalo en `BUGS.md`).

## 1. API Anything: primer intento

Descubre/reutiliza las APIs internas del sitio. Requiere Node ≥ 22.13. Repo: <https://github.com/goodnight000/api-anything> (MIT).

```bash
npx -y api-anything setup --local-only     # conecta el agente (MCP/skill) sin catálogo público
npx -y api-anything learn 'https://SITIO/buscar?q={q}' --args q=uno --args2 q=dos --args3 q=tres --local-only
npx -y api-anything call SITIO search q=uno
```

- **Siempre `--local-only`**: sin él se envían dominios/URLs al catálogo público.
- No vence CAPTCHAs ni URLs firmadas; esos casos pasan al nivel 2.

## 2. Scrapling: segundo intento

HTTP, adaptativo y navegador. Python ≥ 3.10. Docs: <https://scrapling.readthedocs.io/en/latest/> (BSD-3).

```bash
pip install "scrapling[fetchers]"   # añade "[ai]" para el servidor MCP
scrapling install                    # descarga los navegadores (en Windows no bajó el Chromium: usa `python -m patchright install chromium`)
scrapling extract get "https://SITIO/" .scrape-tmp/SITIO/home.md --css-selector ".lista"
scrapling extract fetch "https://SITIO/" .scrape-tmp/SITIO/home.md --solve-cloudflare   # navegador
```

- Orden: `Fetcher` → `StealthyFetcher` (`solve_cloudflare=True`) → `DynamicFetcher`. Probado con m440: `Fetcher` recibe 403 de Cloudflare; `StealthyFetcher(solve_cloudflare=True)` devuelve 200.
- MCP: `scrapling-mcp` por **stdio**. No exponerlo por HTTP sin token; riesgo SSRF. Mantén `main_content_only` activo.
- Navegador en Docker (`docker run -i --rm pyd4vinci/scrapling mcp`), nunca con tu perfil.

## 3. Maxun: último recurso

Plataforma autohospedada de robots sobre navegador real. Docs: <https://docs.maxun.dev/>. **AGPL-3.0**: no se incluye en paquetes.

```bash
git clone https://github.com/getmaxun/maxun && cd maxun
cp .env.example .env     # define JWT_SECRET, SESSION_SECRET (openssl rand -base64 48), ENCRYPTION_KEY (openssl rand -hex 32), PUBLIC_URL, BACKEND_URL
docker-compose up -d     # frontend 5173, backend 8080, postgres 5432, minio 9000/9001, navegador 3001/3002
```

- Liga puertos a `127.0.0.1` o filtra con firewall; no expongas el 8080 sin autenticación.
- Su servidor MCP y su API REST están **sin verificar**: confirma en la documentación antes de depender de ellos.
