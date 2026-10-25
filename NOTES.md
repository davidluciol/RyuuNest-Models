# NOTES.md: cuaderno de trabajo de los módulos

> Notas de estado, decisiones y pendientes del repo de módulos. Lo importante y lo que otro agente necesitaría para no repetir una discusión. La bitácora va de la más reciente arriba.

## Estado (2026-10-25)

- **El núcleo de la app está listo para descargar módulos de un repo externo.** Evidencia en el código de `packages/core` (repo principal):
  - `RepoRegistry.addRepo(url)`: descarga y valida el `index.json` por HTTPS (URL canónica HTTPS, RF-2) y guarda el índice.
  - `InstallFlow` (RF-4, AC-8): único punto de entrada para instalar; exige confirmación manual (`confirmed`) y **reforzada** para módulos `script`; rechaza re-instalar un módulo ya instalado.
  - `PackageInstaller.install()`: descarga el `.zip` por HTTPS (las rutas del índice se resuelven contra la URL del repo), verifica **SHA-256**, aplica los topes de tamaño (paquete ≤ 2 MB, descomprimido ≤ 5 MB, ≤ 50 archivos), protege contra zip-slip y valida el manifest y la existencia del archivo de entrada.
- **Primer módulo: `tmo`** (port de `logicTMO.py`); formato exacto de este repo (`manifest.json` + `module.js`). Pendiente de la ejecución real contra el sitio por parte del humano (P-76 del repo principal) y de empaquetar y añadir a `index.json`.
- **Pendiente del lado de la app (no de este repo):** el adaptador `Http` real de la plataforma (la app nativa aún no rellena `HttpResponse.url`, anotado en P-74) y las pantallas de Fuentes/confirmación que conecten `InstallFlow`.

## Bitácora

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
