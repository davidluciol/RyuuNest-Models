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

- 2026-11-13 · pages · el capítulo fallaba con `UNSUPPORTED` («el reto del lector cambió de formato») · causa: el reto pasó a JS polimórfico que lee el DOM/CSS oculto de la ficha · **resuelto** en 0.1.1 (intérprete cerrado `miniJs.js`).
- 2026-11-13 · pages · con una respuesta errónea al reto el sitio da un token sin `chapter_id` y redirige al home · causa: validación del servidor engañosa · **resuelto** (el módulo da `BLOCKED` si falta `chapter_id`).
- 2026-11-20 · pages · en el S25 (Expo Go, 0.1.1) abrir un capítulo daba `UNSUPPORTED` por el acento grave (plantillas) · causa: el reto es ahora un ofuscador general de JS (plantillas, `const/let`, desestructuración, `for…of`, flechas, clases con `new`/`this`, `function*`/`yield`, `try/finally`, `do…while`, spread, `**`, parámetros por defecto, `Array.from(x, fn)`…) · **resuelto** en 0.2.0: `miniJs.js` ampliado (sigue sin `eval`) y 35 variantes reales resueltas sin error.
- 2026-11-20 · pages · la respuesta del reto se calculaba mal aunque el JS corriera: la ficha ahora trae un `<style>` con una cascada CSS completa (`:nth-child`, `:not`, `[class~=]`, `[id=]`, escapes hex, atajo `flex`, `var(--x)`, `!important`, `style` en línea) y comentarios `<!--</div>-->` dentro del nodo · causa: la simulación de estilos era un regex ingenuo · **resuelto** en 0.2.0 con `bin/utils/boxStyle.js` (cascada mínima). Verificado contra el servidor: 16/16 respuestas aceptadas (id real de capítulo) y la cadena hex es la misma (`130d15d7`) en todas las variantes.
- 2026-11-20 · pages · el POST de `open_chapter` sin cabecera `Origin` recibe un `chapter_id` señuelo y un token que el lector rechaza (302 al home) aunque la respuesta sea correcta · causa: anti-bot del sitio · **resuelto** en 0.2.0 (`Origin` en todos los POST).
- 2026-11-20 · popular/latest/home · en Aventuras, YupManga abría con «Ningún resultado» · causa: el módulo no declaraba `home/list/filters`, así que la app no tenía cómo listar por género · **resuelto** en 0.2.0: `home` (Más leídas, Últimas publicaciones), `list`, `filters` (género; 21 géneros de `/categorias`) y `search("", page, {genre})` sobre `/genero/<slug>?page=N`. `latest` ya pagina (`/?page=N`). `/top` no pagina.
- 2026-11-13 · popular/latest/search/details · portadas en blanco en la app (reporte del mantenedor) · causa: verificado en vivo que el módulo es correcto: `image-proxy-v2.php?…context=cover` responde 200 `image/webp` con las cabeceras que entrega el módulo (también sin cookie) · **abierto, del lado de la app**: el cargador de imágenes de RyuuNest debe enviar `headers` de `ImageRef` (Referer/User-Agent) y aceptar WebP; si Cloudflare rechaza la huella TLS del cliente de la app, hay que cargarlas con `host.fetch`.
- 2026-11-13 · pages · el interstitial de anuncio obliga a esperar ~9 s por capítulo y el sitio limita las lecturas por día (`quota_exceeded` → `RATE_LIMITED`) · abierto (decisión del sitio).
- 2026-11-13 · sitio frágil · el reto cambia de forma sin aviso (ya van tres formatos); si falla con `UNSUPPORTED: JS/CSS no soportado: …` hay que ampliar `miniJs.js`/`boxStyle.js` con una captura nueva (ver «Depurar el reto» en `tools/README.md`) · abierto (vigilar).
- 2026-11-20 · sitio · Cloudflare limita a ~35 peticiones seguidas a `get_challenge.php` (429 «Just a moment…») · anotado (no afecta a un uso normal).

## m440 (MangasIn)

- 2026-11-13 · popular/latest/search/home · en la app las portadas no cargan y las tarjetas quedan en blanco (reporte del mantenedor) · causa: investigado el 2026-11-20: las portadas (`/uploads/manga/<slug>/cover/cover_250x350.jpg`, WebP servido como `.jpg`) responden 200 con las cabeceras del módulo y el dominio está en `permissions.domains`, así que el módulo es correcto · **abierto, del lado de la app** (mismo diagnóstico que yupmanga: cabeceras de `ImageRef` y huella TLS del cliente de imágenes).
- 2026-11-13 · home/search sin texto · `/manga-list` y `/filterList` dan 403 (Cloudflare «Just a moment…») a HTTP simple y a `Fetcher`; solo pasan con navegador sigiloso · causa: Cloudflare con reto JS en esas rutas; el 2026-11-20 sigue dando 403 incluso con huella TLS de Chrome (curl_cffi), solo lo pasa un navegador real · **abierto, del sitio** (el módulo omite las secciones del directorio si recibe `BLOCKED`; popular/latest/search/details/pages no dependen de ellas).
- 2026-11-13 · latest · `/releases` ignora `?page=`; el home no pagina · causa: el sitio no ofrece más páginas de actualizaciones · abierto (sin solución en el módulo).
- 2026-11-13 · filters · el filtro `tag`/`author`/`artist` existe en `/filterList` pero no se expone (semántica sin verificar) · abierto.
- 2026-11-13 · search · el autocompletado devuelve ≤20 y no pagina; con texto + género solo filtra esos 20 · abierto.

## luscious

- 2026-11-22 · todas · `host.fetch` sin huella de navegador recibe 403 «Just a moment» de Cloudflare en la API (`www.luscious.net/graphql/nobatch/`) · causa: WAF por huella TLS · abierto (sin verificar en el teléfono; se tipa `BLOCKED`).
- 2026-11-22 · pages/portadas · parte de las imágenes son AVIF (`cdn3.luscious.net`) · causa: el sitio las sirve así · abierto (sin verificar que la app las decodifique).
