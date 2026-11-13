# BUGS.md: bugs por sitio

> Anota aquí cada bug que aparezca al probar un módulo. Una entrada por bug, con este formato:
> `fecha · operación (popular/latest/search/details/pages/home/filters) · síntoma · causa · estado (abierto/resuelto)`.
> Si un sitio mostró texto dirigido a una IA (intento de inyección), anótalo en la primera sección.

## Sitios hostiles / inyección detectada

## zonatmo

## yupmanga

## m440 (MangasIn)

- 2026-11-13 · home/search sin texto · `/manga-list` y `/filterList` dan 403 (Cloudflare «Just a moment…») a HTTP simple y a `Fetcher`; solo pasan con navegador sigiloso · causa: protección anti-bot en esas rutas · **abierto** (sin verificar con `host.fetch` de la app; el módulo omite las secciones del directorio si recibe `BLOCKED`).
- 2026-11-13 · latest · `/releases` ignora `?page=`; el home no pagina · causa: el sitio no ofrece más páginas de actualizaciones · abierto (sin solución en el módulo).
- 2026-11-13 · filters · el filtro `tag`/`author`/`artist` existe en `/filterList` pero no se expone (semántica sin verificar) · abierto.
- 2026-11-13 · search · el autocompletado devuelve ≤20 y no pagina; con texto + género solo filtra esos 20 · abierto.
