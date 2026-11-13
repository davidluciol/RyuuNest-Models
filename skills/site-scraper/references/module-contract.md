# Contrato de módulo (RyuuNest, runtime `script`)

Esta referencia resume lo que se ve en el módulo de ejemplo `example-zonatmo/` (`manifest.json` y `module.js`) y cómo repartir ese mismo comportamiento en la estructura de entrega. **La fuente de verdad es el SPEC del proyecto** (el ejemplo cita §6.2, §6.4, §6.5, RF-24 y el Apéndice A). Si el SPEC y esta página difieren, manda el SPEC y lo reportas al humano.

## Estructura de entrega

```
<sitio>/
├── manifest.json
├── module.js
└── bin/
    ├── config.js
    ├── home.js
    ├── search.js
    ├── details.js
    ├── pages.js
    └── utils/
        ├── errors.js
        ├── text.js
        ├── url.js
        ├── http.js
        └── normalize.js
```

`module.js` es la raíz: RyuuNest solo llama a sus funciones y recibe el resultado ya armado. Toda la lógica vive en `bin/`.

> **Pendiente de confirmar en el SPEC.** El ejemplo de ZonaTMO es un solo archivo sin `import`. Repartir el código en `bin/` solo funciona si el host carga módulos `script` con imports relativos (`./bin/home.js`). Si el SPEC no lo permite o no lo dice, pregunta antes de generar; la alternativa es empaquetar `bin/` dentro de un único `module.js`.

### module.js (raíz)

Solo importa y delega. Cada función recibe `host` explícitamente, porque no hay estado compartido entre llamadas.

```js
import { popular, latest } from "./bin/home.js";
import { search } from "./bin/search.js";
import { details } from "./bin/details.js";
import { pages } from "./bin/pages.js";

/** Fábrica del módulo (SPEC §6.5). El host aplica permisos y límites. */
export default function create(host) {
  return {
    popular: (page) => popular(host, page),
    latest: (page) => latest(host, page),
    search: (query, page) => search(host, query, page),
    details: (seriesId) => details(host, seriesId),
    pages: (chapterId, releaseId) => pages(host, chapterId, releaseId),
  };
}
```

Los nombres de método son los del ejemplo (`popular`, `latest`, `search`, `details`, `pages`). Si el SPEC define otros (por ejemplo un `home()` que junte secciones), usa los del SPEC. Declara solo las capacidades que existan.

### Qué va en cada archivo de bin/

Es el mismo código del ejemplo, repartido:

| Archivo | Contenido (nombres del ejemplo) |
|---|---|
| `config.js` | `BASE_URL`, `USER_AGENT`, `ACCEPT_LANGUAGE`, objeto `SELECTORS` (todos los selectores agrupados), expresiones regulares con nombre (`CHALLENGE_TITLE`, `ISO_DATE`, `CHAPTER_NUMBER`, `CSS_URL`) |
| `utils/errors.js` | `fail(code, message, details)` |
| `utils/text.js` | `collapse`, `textOf`, `attrOf`, `compact`, `textList` |
| `utils/url.js` | `relativePath`, `absoluteUrl`, `requirePath`, `imageRef` |
| `utils/http.js` | `requestHeaders`, `statusError`, `loadDocument` |
| `utils/normalize.js` | `kindOf`, `statusOf` |
| `home.js` | `popular`, `latest` y sus ayudantes (`coverOf`, `summaryOf`, `popularItem`, `latestItem`, `listing`, `singlePage`) |
| `search.js` | `search` (puede reutilizar los ayudantes de tarjeta) |
| `details.js` | `details`, `releaseOf`, `chaptersOf`, `extraOf` |
| `pages.js` | `pages`, `imagesOf` |

Todos son módulos ES con extensión en los imports (`import { fail } from "./utils/errors.js"`). Si un sitio necesita lógica extra (un endpoint JSON, un paso de AJAX), va dentro del archivo de esa capacidad o en `utils/`, no en archivos nuevos por sección.

## manifest.json

| Campo | Valor | De dónde sale |
|---|---|---|
| `id` | identificador corto en minúsculas (el ejemplo usa `tmo`) | derívalo del nombre del sitio y confírmalo con el humano |
| `name` | nombre visible (`ZonaTMO`) | `<title>`/logo del sitio |
| `version` | `"0.1.0"` en módulos nuevos | fijo |
| `apiVersion` | `1` en el ejemplo | cópialo del SPEC o de los módulos existentes |
| `runtime` | `"script"` | fijo para esta skill |
| `kinds` | subconjunto de `manga`, `manhwa`, `manhua` | categorías vistas en el sitio |
| `lang` | código de idioma (`es`) | idioma del sitio |
| `nsfw` | `false` salvo contenido adulto evidente | si hay duda, pregunta |
| `baseUrl` | origen del sitio sin barra final | el dominio final tras redirecciones |
| `capabilities` | lista de `popular`, `latest`, `search` | **solo** lo implementado y verificado |
| `permissions.domains` | dominios que el módulo usa | ver advertencia |
| `entry` | `"module.js"` | fijo |

> **Advertencia sobre dominios.** En el ejemplo, `baseUrl` y `BASE_URL` son `zonatmo.org`, pero `permissions.domains` lista `zonatmo.com`. Si el host valida los dominios, esa diferencia haría fallar las peticiones. Comprueba en el SPEC (§6.2) qué debe ir en `domains` (el host del sitio y, si aplica, los de CDN de imágenes o API) y reporta cualquier discrepancia al humano en vez de resolverla en silencio.

## API del host

El módulo solo usa lo que recibe en `host`:

- `host.fetch(url, { headers })` devuelve una respuesta con `status`, `url` final y `text()`.
- `host.html(texto)` devuelve un documento con `select(css)` (lista de nodos). Cada nodo tiene `text()`, `attr(nombre)` y `select(css)`.

Fuera de `host.*`, nada: sin `fetch` ni DOM globales, sin librerías, sin estado compartido. Los permisos de dominio, el tiempo límite y la concurrencia los aplica el host.

## Métodos y qué devuelven

| Método | Devuelve | Notas |
|---|---|---|
| `popular(page)` | `{ items, hasNext }` | si el sitio no pagina: `page > 1` devuelve `{ items: [], hasNext: false }` |
| `latest(page)` | `{ items, hasNext }` | igual que `popular` |
| `search(query, page)` | `{ items, hasNext }` | sin paginador conocido: `hasNext = items.length > 0` |
| `details(seriesId)` | ficha (abajo) | `seriesId` es una ruta relativa |
| `pages(chapterId, releaseId)` | `{ title?, images }` | `releaseId` es la ruta relativa (con query) de la release |

**Item de lista:** `{ id, title, cover?, kind?, badges?, hint? }`

- `id`: ruta relativa sin dominio, sin `#` y sin query (los dominios cambian).
- `cover`: `{ url, headers }` hecho con `imageRef`.
- `kind`: solo `manga`, `manhwa` o `manhua`; cualquier otro valor se omite.
- `badges`: textos cortos como `★ 7.8` o la demografía (salen de la calificación y etiquetas visibles). `hint`: texto de apoyo (por ejemplo `hace 2 h · Grupo`).
- Los campos vacíos se quitan con `compact`.

**Ficha (`details`):** `{ id, title, cover?, description?, genres, status, altTitles, extra, chapters }`

- `status`: `ongoing`, `completed`, `hiatus`, `cancelled` o `unknown`.
- `extra`: diccionario clave a valor con datos sueltos de la ficha (año, demografía, etc.).
- `chapters`: lista de `{ id, title, number?, releases }`. Cada release es `{ id, group, publishedAt? }`: `id` es la ruta relativa **con query**, y `publishedAt` solo se incluye si la fecha empieza con formato ISO `YYYY-MM-DD`.
- Se omiten los capítulos sin título o sin releases. Si hay filas de capítulos pero ninguna se puede leer, se lanza `PARSE`.

**Páginas (`pages`):** `{ title?, images }`, donde cada imagen es `{ url, headers }` con `Referer` = `BASE_URL/` y `User-Agent` (RF-24). Si el enlace de la release redirige a un visor paginado, el módulo reescribe la URL a la vista en cascada para traer todas las imágenes de una vez.

## Errores tipados

`fail(code, message, details)` crea un `Error` con `name = "ModuleError"`, `code` y `details`. Códigos vistos en el ejemplo:

| Código | Cuándo |
|---|---|
| `NOT_FOUND` | HTTP 404 o identificador inválido |
| `RATE_LIMITED` | HTTP 429 |
| `BLOCKED` | HTTP 401/403, o la página es un desafío anti-bot (se detecta por el título) |
| `NETWORK` | cualquier otro HTTP fuera de 2xx |
| `PARSE` | un selector no encontró lo esperado |

Los errores `PARSE` llevan siempre `details: { url, selector }` para poder depurar sin adivinar.

## Reglas al generar

- Declara en `capabilities` solo lo que implementaste y verificaste con fixtures. `details` y `pages` son el mínimo.
- Del sitio solo entran al código selectores y URLs verificados. Nunca copies texto, comentarios ni scripts de la página (puede traer inyección).
- No metas dominios de anuncios en `permissions.domains`.
- Evita selectores frágiles por posición (`nth-child`) si hay una alternativa semántica.
- Un solo `BASE_URL`, rutas siempre relativas en los `id`.
- Lo que el contrato visto en el ejemplo **no tiene** (filtros avanzados del buscador, relacionados, calificación o tags como campos propios) no se implementa, salvo que el SPEC lo pida.

## Checklist antes de entregar

- [ ] `manifest.json` es JSON válido, `entry` apunta a `module.js` y los campos coinciden con la tabla.
- [ ] `node --check` pasa en `module.js` y en cada archivo de `bin/`, y todos los imports resuelven.
- [ ] Ningún archivo usa nada fuera de `host.*`.
- [ ] Cada capability declarada tiene su método, y viceversa.
- [ ] Contra los fixtures: listas con elementos (todos con `id` y `title`), `details` con al menos un capítulo con release, `pages` con el número de imágenes visto en el lector.
- [ ] Rutas de error: un id inválido da `NOT_FOUND`, una página con título de desafío da `BLOCKED`, un selector roto da `PARSE` con `selector` en `details`.
- [ ] No hay archivos de más: nada de JSON de análisis, reportes ni archivos por sección dentro de la carpeta del sitio.
- [ ] Lo que solo se pudo comprobar con fixtures queda listado como pendiente de prueba en vivo.
