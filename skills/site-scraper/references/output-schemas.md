# Formas de los JSON de salida

Todo se guarda en `scraping-work/<slug>/`. Reglas comunes:

- Lo que no sea visible en el sitio va en `null` (o `[]` para listas), nunca inventado.
- Los links son siempre absolutos.
- Cada archivo lleva `accessLevel` (`http`, `browser` o `human-fixture`) y `checkedAt` (fecha ISO).
- Los selectores se guardan junto al dato para que el paso siguiente (crear el módulo) no tenga que redescubrirlos.

```
scraping-work/<slug>/
├── site-report.json    Fase 1 y 2: acceso, protecciones, riesgo, secciones del home
├── home.json           Fase 3
├── search.json         Fase 4
├── detail.json         Fase 5
├── reader.json         Fase 6
├── notes.md            decisiones y problemas, una entrada por fase
├── HANDOFF.md          solo si hubo parada
├── fixtures/           HTML de ejemplo (home.html, detail-1.html, reader-1.html...)
└── module/             Fase 7: manifest.json y module.js (ver module-contract.md)
```

## Card (tarjeta de serie)

```json
{
  "title": "Nombre de la serie",
  "cover": "https://sitio.com/covers/abc.jpg",
  "url": "https://sitio.com/manga/abc",
  "tags": ["Acción", "Fantasía"],
  "rating": 4.6,
  "ratingScale": 5,
  "category": "manhwa"
}
```

`tags`, `rating`, `ratingScale` y `category` van en `null` si el sitio no los muestra en la tarjeta. `category` usa: `manga`, `manhua`, `manhwa`, `comic` u otro valor tal cual lo escribe el sitio.

## site-report.json

```json
{
  "site": "sitio.com",
  "baseUrl": "https://sitio.com",
  "checkedAt": "2026-10-24T18:00:00Z",
  "accessLevel": "http",
  "status": "ok",
  "probe": { "access": "ok", "risk": "low", "cloudflarePresent": true, "cloudflareChallenge": false },
  "safety": { "adNetworks": [], "popupCalls": 0, "injectionSignals": [] },
  "homeSections": [
    { "id": "latest", "label": "Últimos capítulos", "selector": ".latest-list .item", "itemCount": 24, "paginated": false }
  ]
}
```

`status` toma uno de: `ok`, `blocked-antibot`, `stopped-risk` (se activó una regla de parada), `partial` (faltan fases).

## home.json

```json
{
  "accessLevel": "http",
  "checkedAt": "2026-10-24T18:05:00Z",
  "sections": [
    {
      "id": "latest",
      "label": "Últimos capítulos",
      "selector": ".latest-list .item",
      "items": [ { "...": "Card" } ]
    }
  ],
  "coverage": { "title": 1.0, "cover": 1.0, "url": 1.0, "tags": 0.0, "rating": 0.4, "category": 0.0 }
}
```

`coverage` es el porcentaje (0 a 1) de tarjetas con cada campo presente.

## search.json

```json
{
  "accessLevel": "http",
  "request": {
    "method": "GET",
    "urlTemplate": "https://sitio.com/search?q={query}&page={page}",
    "params": { "query": "q", "page": "page", "sort": "orderby" },
    "returns": "html"
  },
  "pagination": { "type": "page-number", "startsAt": 1, "pageSize": 20 },
  "filters": [
    { "id": "genre", "param": "genres[]", "multiple": true, "values": [ { "label": "Acción", "value": "action" } ] },
    { "id": "status", "param": "status", "multiple": false, "values": [ { "label": "En emisión", "value": "ongoing" } ] }
  ],
  "samples": {
    "withResults": { "query": "solo", "count": 12, "items": [ { "...": "Card" } ] },
    "noResults": { "query": "zzzzqqq", "count": 0, "emptyMarker": ".no-results" }
  }
}
```

`returns` es `html` o `json`. Si es `json`, añade `responseShape` con las rutas de los campos.

## detail.json

```json
{
  "accessLevel": "http",
  "title": "Nombre de la serie",
  "altTitles": ["元の名前", "Other title"],
  "description": "Sinopsis completa",
  "cover": "https://sitio.com/covers/abc.jpg",
  "genres": ["Acción", "Drama"],
  "status": "ongoing",
  "statusRaw": "En emisión",
  "type": "manhwa",
  "chapters": {
    "total": 120,
    "order": "desc",
    "structure": "flat-list | expandable-releases | paginated | ajax",
    "loadedVia": "initial-html | ajax",
    "selector": "li.upload-link",
    "titleSelector": "a.btn-collapse",
    "releaseSelector": "li.list-group-item",
    "items": [
      {
        "number": "120",
        "title": "Capítulo 120",
        "releases": [
          { "group": "Servidor 1", "url": "https://sitio.com/view/abc/120", "date": "2026-10-20", "dateRaw": "2026-10-20 18:30" }
        ]
      }
    ]
  },
  "related": [ { "...": "Card", "type": "manga" } ],
  "selectors": { "title": "h1.entry-title", "description": ".summary p", "status": ".status" }
}
```

- `status` se normaliza a: `ongoing`, `completed`, `hiatus`, `cancelled` o `unknown`. El texto original del sitio va en `statusRaw`.
- Cada capítulo lleva sus `releases`: los servidores o grupos clicables que llevan al lector. Si el sitio no ofrece varios, una sola release con `"group": null`.
- `date` va en formato ISO `YYYY-MM-DD` (o `null` si no se puede); el texto original del sitio va en `dateRaw`.
- `number` es texto porque hay capítulos como "12.5" o "Extra".

## reader.json

```json
{
  "accessLevel": "browser",
  "releaseUrl": "https://sitio.com/view/abc/120",
  "finalUrl": "https://sitio.com/viewer/abc/120/paginated",
  "server": "Servidor 1",
  "mode": "paged",
  "cascade": {
    "available": true,
    "how": "reemplazar «paginated» por «cascade» en la URL",
    "urlRewrite": { "from": "paginated", "to": "cascade" },
    "selector": null
  },
  "imageSelector": "div.img-container img.viewer-img",
  "lazyLoad": { "present": true, "attribute": "data-src", "scrollStep": 3, "roundsUntilStable": 2 },
  "images": [ { "index": 1, "url": "https://cdn.sitio.com/abc/120/001.jpg" } ],
  "imageCount": 22,
  "imageHeaders": { "referer": "https://sitio.com/", "cookiesRequired": false },
  "verified": "live"
}
```

- `releaseUrl` es el enlace que sale de la lista de capítulos; `finalUrl` es donde termina tras las redirecciones (por ejemplo, el visor paginado). `urlRewrite` es `null` si no hace falta reescribir nada para ver la cascada.
- `mode` es `cascade` o `paged` (el modo que traía el sitio por defecto).
- `verified` es `live` (probado en el sitio) o `fixture-only` (solo desde HTML guardado).
- Guarda como máximo las URLs de un capítulo de muestra; no descargues las imágenes.
