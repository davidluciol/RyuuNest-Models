# NOTES.md: cuaderno de trabajo de los módulos

> Notas de estado, decisiones y pendientes del repo de módulos. Lo importante y lo que otro agente necesitaría para no repetir una discusión. La bitácora va de la más reciente arriba.

## Estado (2026-10-25)

- **El núcleo de la app está listo para descargar módulos de un repo externo.** Evidencia en el código de `packages/core` (repo principal):
  - `RepoRegistry.addRepo(url)`: descarga y valida el `index.json` por HTTPS (URL canónica HTTPS, RF-2) y guarda el índice.
  - `InstallFlow` (RF-4, AC-8): único punto de entrada para instalar; exige confirmación manual (`confirmed`) y **reforzada** para módulos `script`; rechaza re-instalar un módulo ya instalado.
  - `PackageInstaller.install()`: descarga el `.zip` por HTTPS (las rutas del índice se resuelven contra la URL del repo), verifica **SHA-256**, aplica los topes de tamaño (paquete ≤ 2 MB, descomprimido ≤ 5 MB, ≤ 50 archivos), protege contra zip-slip y valida el manifest y la existencia del archivo de entrada.
- **Primer módulo: `zonatmo`** (`script`) para `https://zonatmo.org`, con `manifest.json` + `module.js` + `bin/`. Pendiente solo la ejecución dentro de la app por parte del humano. El antiguo ejemplo `tmo` (`zonatmo.com`) quedó retirado: ese dominio ya no resuelve.
- **Segundo módulo: `yupmanga`** (`script`) para `https://www.yupmanga.com`, con las cinco operaciones. Ojo: el sitio bloquea clientes HTTP sin huella de navegador (Cloudflare WAF) y el lector exige resolver su reto JS y esperar el interstitial de anuncio; ver la bitácora. Pendiente la prueba real dentro de la app.
- **Tercer módulo: `m440`** (`script`) para `https://m440.in`, con las cinco operaciones: listas desde el home, búsqueda por el JSON de autocompletado, ficha con capítulos cifrados (AES) y lector en una sola vista. Publicado `0.1.0`; pendiente la prueba dentro de la app y ampliar `capabilities` en el SDK (hoy solo admite tres).
- **Pendiente del lado de la app (no de este repo):** el adaptador `Http` real de la plataforma (la app nativa aún no rellena `HttpResponse.url`, anotado en P-74) y las pantallas de Fuentes/confirmación que conecten `InstallFlow`.

## Bitácora

### 2026-10-26 · Módulo `m440` (listas en el home y capítulos cifrados)

- **Acceso:** `https://m440.in` responde por HTTP simple (200, HTML de Laravel). Cloudflare está delante como CDN, sin reto real; `/manga-list` sí devuelve 403 con «Just a moment…» y no se usa. El probe marca `risk: high` solo por una meta de verificación de la red publicitaria `juicyads`; no hay popups ni redirecciones, así que **no se abrió navegador** en ningún momento (solo Nivel 1).
- **Listas:** `popular` son las 39 tarjetas de «Actualizaciones populares Manga» (`ul.hot-thumbnails li.span3`); `latest` son las 235 filas de «Últimas actualizaciones Manga» (231 series únicas: se deduplican por ruta). El home ignora `?page=`, así que `page > 1` devuelve vacío.
- **Buscador:** `/search?q=…` devuelve un JSON de autocompletado con 20 resultados como máximo (título, slug, portada, estado y categorías). No pagina: `hasNext: false`.
- **Ficha:** los datos de la serie viajan en `const jsmangas = {…}` y **el listado de capítulos va cifrado** en `const UsaPoncho = "…"` con AES-256-CBC (CryptoJS, frase de paso fija, sal e IV aleatorios por página). Como el host no ofrece criptografía, se reimplementaron AES-256-CBC y MD5 (`EVP_BytesToKey`) en `bin/utils/crypto.js`, sin librerías externas ni ejecutar JS del sitio. Verificado descifrando 839 capítulos (One Piece), 180 (SPY X FAMILY) y 30 (Seihantai na Kimi to Boku); ~44 ms para el mayor en Node.
- **Lector:** todas las páginas del capítulo llegan en un solo HTML (`img[data-src]`); la primera se duplica en un `img.scan-page` con `src`, por eso solo se usa `data-src`. Las imágenes están en `s1.m440.in` y `s2.m440.in` y exigen `Referer` (200 con él, 403 sin él). `permissions.domains` incluye `m440.in`, `s1.m440.in` y `s2.m440.in`; `s3/s4` no existen.
- **Verificado:** arnés local con fixtures y los mismos `htmlparser2` + `css-select` del repo principal (popular, latest, búsqueda con y sin resultados, tres fichas —en emisión y finalizada—, lector de dos capítulos con 19 y 40 imágenes, y errores 404/BLOCKED). Además, prueba en vivo de las cinco operaciones y descarga de dos imágenes con las cabeceras del módulo.
- **Decisiones:** `nsfw: true` (el sitio tiene ecchi/mature evidente); `kinds: ["manga","manhwa"]` (verificados; no se declaran manhua/cómic). `capabilities` declara las cinco operaciones que el módulo implementa y verifica, como pide `AGENTS.md`. El validador del SDK en este clon todavía no las admite (`MODULE_CAPABILITIES` solo lista `popular`, `latest`, `search`), así que `ryuunest-module validate` falla; el arreglo va en el repo principal (ampliar `MODULE_CAPABILITIES`, el tipo `ModuleManifest` y el SPEC §6.1). El runtime ya exige `details` y `pages` siempre.
- **Publicado:** `packages/m440-0.1.0.zip` (SHA-256 `36bfb1aa6d242940e1f62bbd17f612e72f2c9e597cbf27e2816f6cab255c3e65`, 14 121 bytes) y su entrada entera en `index.json`. Pendiente: probar dentro de la app; si el sitio rota la frase de paso del listado, `details` dará `UNSUPPORTED` hasta actualizar `CHAPTER_KEY`. El `.zip` se generó con el mismo criterio del CLI (`fflate`, nivel 6, rutas con `/`), sin dotfiles ni `node_modules`.

### 2026-10-26 · Módulo `yupmanga` (con reto de lector)

- **Acceso:** el home devuelve **403 «Attention Required!» de Cloudflare** a `fetch` de Node y a `curl` (huella TLS de cliente no-navegador). `robots.txt` sí responde y desautoriza `/ajax/`, `/reader2.php`, `/reader_v2.php` y las URLs con `?page=`. A petición del humano se usó **impersonación TLS (curl_cffi)** solo como herramienta local de análisis y prueba; el módulo **no** incluye ninguna librería ni técnica de evasión: usa únicamente `host.fetch`.
- **Módulo:** listas por `/top.php` («Más leídas», 24) y home («Últimas series», 36); búsqueda en `/search.php?q=…&page=N`; ficha con géneros, etiquetas, autor, dirección, estado y **series similares** (`/ajax/load_similar_series.php`); capítulos por `/ajax/load_chapters.php` (se ordenan de más nuevo a más viejo). `id` de serie y release conservan la query (`/series.php?id=…`) porque el id vive ahí.
- **Lector (excepción deliberada):** el capítulo se abre con un **reto JS por petición** (`get_anchor` + `get_challenge` + `open_chapter`) que se resuelve extrayendo sus constantes y reproduciendo la cuenta, sin `eval`; después el sitio exige el **interstitial de anuncio** (~8 s) antes de servir `reader_v2.php`. El módulo completa ese trámite con `setTimeout` (9 s) y lee `readerPageKeys`, que trae todas las imágenes del capítulo en un solo HTML. Depende de que `host.fetch` acepte POST, cabecera `Cookie` y exponga `set-cookie`; si no, el lector fallará aunque las listas funcionen.
- **Verificado:** 13/13 en vivo a través de un proxy local con huella de navegador (popular, latest, búsqueda con página 2, dos fichas —una finalizada y otra en emisión—, relacionados, capítulos y lector de dos series: 9 y 36 imágenes). **Sin verificar:** el comportamiento de `host.fetch` real de la app frente a Cloudflare.
- **Publicado:** `packages/yupmanga-0.1.0.zip` y entrada en `index.json`. Dominios: `www.yupmanga.com`.

### 2026-10-25 · `capabilities` completo y módulo 0.2.0

- **Revertido:** el manifest vuelve a declarar `details` y `pages` en `capabilities`, que es lo que el módulo implementa y extrae del sitio. En el repo de la app se amplió el contrato para admitirlas.
- **Versión 0.2.0** (minor por capacidades nuevas declaradas) y paquete republicado: nuevo SHA-256 y tamaño en `index.json`; el `.zip` de `0.1.0` queda retirado.

### 2026-10-25 · Módulo `zonatmo` y primera publicación del repo

- **Dominio nuevo:** `zonatmo.com` ya no resuelve; el sitio vive en `https://zonatmo.org`. El ejemplo `ExampleModule` (id `tmo`) se retira porque sus rutas (`/populars`, `/latest_uploads`, `/library?title=`) dan 404 en el dominio vigente.
- **Módulo `zonatmo/`:** listas y búsqueda por `/biblioteca` (`order_item`, `filter_by=title`, paginación con `page` y `a[rel=next]`); ficha con capítulos y releases (varias versiones por capítulo); lector en una sola vista (`img.reader-image`, con `Referer` y `User-Agent`). `capabilities` declara las cinco operaciones que el módulo implementa (`popular`, `latest`, `search`, `details`, `pages`); el contrato de la app se amplió para admitir `details` y `pages`.
- **Relacionados:** la ficha incluye `related` (carrusel «Relacionados», 9 tarjetas) como campo adicional, a petición del humano. El contrato de la app aún no define ese campo; el runtime no valida la forma de la respuesta, así que no rompe nada.
- **Verificado:** 23/23 comprobaciones contra fixtures y en vivo (listas, paginación, búsqueda con y sin resultados, dos fichas —finalizada y en emisión—, capítulo con dos versiones, lector de dos series y errores tipados).
- **Publicado:** `packages/zonatmo-0.1.0.zip` y la primera `index.json` (`ryuunest-repo` v1). `.scrape-tmp/` entra en `.gitignore` (fixtures temporales de análisis, no se publican).
- **Decisiones:** `latest` usa `order_item=creation&order_dir=desc` («Últimos añadidos»), porque el sitio no ofrece orden por «actualizado». En «Relacionados» se omite el badge de puntuación cuando es `0.00` (sin votos).

### 2026-10-25 · Creación del repo de módulos e instrucciones

- **Hecho:** definido el centro de módulos: **`https://github.com/davidluciol/RyuuNest-Models.git`** (decisión **P-78** registrada en `MEMORY.md` del repo principal; procede el SPEC §15). Escritos `AGENTS.md` (contrato de contribución) y este cuaderno, en la carpeta `modules/` del repo principal a la espera de moverse a este repo.
- **Estructura decidida por el humano:** cada módulo resulta en una carpeta con el nombre del sitio, `manifest.json` (el contrato) y `module.js` como archivo final. Toda la lógica de apoyo (headers, utils, etc.) va en `bin/`, organizada y con métodos CLEAN («menos es más»).
- **Completado a petición del humano (misma sesión):** el `AGENTS.md` ahora documenta el **proceso completo de empaquetado** con el CLI `ryuunest-module` (verificado contra su código en `packages/module-sdk/src/cli.ts`): `validate` → arnés de contrato (CLI `test` para la plantilla, fixtures propias para un sitio real, como `tmoHarness.ts`) → `pack` — que comprime toda la carpeta (excluye dotfiles y `node_modules`), calcula SHA-256 y tamaño, e imprime `{ file, sha256, size, files }` — → entrada entera sustituida en `index.json` con semver. Además, nueva regla de **paquetes y dependencias**: un módulo es autocontenido (en el dispositivo no hay `npm`); si hace falta una librería externa, preguntar al humano y justificar por qué se requiere para el web-scraping del sitio concreto; si se acepta, entra por el lado del host/contrato del repo principal, nunca dentro del `.zip`.
- **Verificado:** núcleo apto para descarga externa (ver Estado arriba). No hizo falta ninguna tarea nueva del núcleo para este flujo.
- **Retrabado a petición del humano (misma sesión):** `AGENTS.md` y `README.md` reescritos para ser **autocontenidos**: se consumen desde `RyuuNest-Models` sin conocer el repo principal. La vía de publicación ahora admite el **paso manual** (zip + `sha256sum` + tamaño) sin necesidad de clonar nada, con el CLI como vía cómoda opcional; las reglas del host (`host.fetch`, `host.html`), la forma completa del error tipado con la lista de códigos y la estructura `create(host)` están descritas dentro del propio documento.
- **Siguiente paso:** crear el repo `RyuuNest-Models` en GitHub si no existe, mover estos documentos a su raíz, empaquetar `tmo` con el CLI `pack` del SDK (o la vía manual del AGENTS.md) y publicar la primera `index.json` con su entrada.

## Preguntas abiertas

1. **Existencia del repo:** ¿está ya creado `davidluciol/RyuuNest-Models` en GitHub, o se creará al subir estos documentos? (de esto depende la URL que se anuncie en la app).
2. **Rama por defecto** del repo de módulos (`main`): confirmar al crearlo, porque la URL del `index.json` que se añade en la app la incluye.
