# BUGS.md: bugs por sitio

> Anota aquí cada bug que aparezca al probar un módulo. Una entrada por bug, con este formato:
> `fecha · operación (popular/latest/search/details/pages/home/filters) · síntoma · causa · estado (abierto/resuelto)`.
> Si un sitio mostró texto dirigido a una IA (intento de inyección), anótalo en la primera sección.

## Sitios hostiles / inyección detectada

## zonatmo

- 2026-11-13 · home/search (espejo) · si `zonatmo.org` falla, las listas y la búsqueda pasan al espejo `zonatmo.to`, pero sus ids son `/manga/<id>/<slug>` y no coinciden con los `/library/…` del sitio principal: lo guardado como favorito/historial con un id no se abre desde el otro sitio · causa: dos sitios con esquemas de id distintos · abierto (sin mapeo entre ids).
- 2026-11-13 · details (espejo) · sin relacionados; el enlace `view_url` de cada capítulo apunta a un sitio externo (`lectorxd.com`, no usado) · abierto.
- 2026-11-13 · details (espejo) · los capítulos llegan de 25 en 25: una serie larga hace una petición por cada 25 (tope de 60 páginas = 1 500 capítulos) · abierto.
- 2026-11-13 · popular (espejo) · el espejo no tiene «me gusta»: «Más populares» se ordena por puntuación · aproximación · abierto.
- 2026-11-13 · home/search (espejo) · el listado de `zonatmo.to` no trae `is_erotic`, así que no se muestra la insignia +18; solo el filtro «Ocultar +18» (`erotic=0`) lo respeta · abierto.
- 2026-11-13 · filters · los filtros del sitio principal solo se probaron con HTTP desde Node (24 tarjetas y `type`/`genders[]`/`exclude_genders[]` aceptados), no dentro de la app; el filtro «Ocultar +18» excluye los géneros +18, +19, Erótica, Adulto y Smut, no los marcados solo con `book-meta-mature` · abierto.
- 2026-11-13 · sitio hostil (menor) · el HTML de `zonatmo.to`/`.net` incluye en `siteConfig.routes.pages` rutas de spam en ruso; no es texto dirigido a una IA, el módulo no lo lee · anotado.
- 2026-11-13 · manifest · se quita `nsfw: true` por petición del mantenedor (hay más series SFW que +18); las listas siguen mostrando +18 salvo con el filtro «Contenido» · decisión, no bug.

## yupmanga

- 2026-11-13 · popular/latest/search/details · en la app las portadas no cargan y las tarjetas quedan en blanco (reporte del mantenedor) · causa: sin investigar; hipótesis a verificar: la imagen exige cabeceras (`Referer`, `User-Agent`, cookie de la sesión del reto JS) que la app no envía, o la URL de portada no es la final · **abierto**.

## m440 (MangasIn)

- 2026-11-13 · popular/latest/search/home · en la app las portadas no cargan y las tarjetas quedan en blanco (reporte del mantenedor) · causa: sin investigar; hipótesis a verificar: `imageRef` no envía lo que exige el CDN de imágenes (`Referer`, `User-Agent`, `Accept-Language`) o el dominio de las portadas no está en `permissions.domains` · **abierto**.
- 2026-11-13 · home/search sin texto · `/manga-list` y `/filterList` dan 403 (Cloudflare «Just a moment…») a HTTP simple y a `Fetcher`; solo pasan con navegador sigiloso · causa: protección anti-bot en esas rutas · **abierto** (sin verificar con `host.fetch` de la app; el módulo omite las secciones del directorio si recibe `BLOCKED`).
- 2026-11-13 · latest · `/releases` ignora `?page=`; el home no pagina · causa: el sitio no ofrece más páginas de actualizaciones · abierto (sin solución en el módulo).
- 2026-11-13 · filters · el filtro `tag`/`author`/`artist` existe en `/filterList` pero no se expone (semántica sin verificar) · abierto.
- 2026-11-13 · search · el autocompletado devuelve ≤20 y no pagina; con texto + género solo filtra esos 20 · abierto.
