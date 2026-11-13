# PLAN.md: plan temporal de la sesión (borrar al terminar)

Objetivo: escalera de herramientas de scraping, reglas anti-inyección y módulos con home/buscador dinámicos. Detalle y decisiones: ver plan aprobado; reglas en `AGENTS.md` §5–§7; herramientas en `tools/README.md`; bugs en `BUGS.md`.

## Fase A: base (hecha en esta sesión)
- [x] Rama `tooling-and-rules`.
- [x] `PLAN.md` y `BUGS.md`.
- [x] `AGENTS.md`: §5 scraping seguro, §6 escalera de herramientas, §7 contrato dinámico.
- [x] `tools/README.md`, `tools/sanitize.mjs` y su test.

## Fase B: contrato dinámico por sitio
- [x] m440 0.2.0 (zip hecho; `index.json` pendiente en PR aparte)
- [ ] zonatmo
- [ ] yupmanga

Por sitio, en este orden: m440 (MangasIn), zonatmo, yupmanga.
1. Investigar con la escalera (§6) las secciones del home y cómo funciona el buscador (filtros, etiquetas, orden).
2. Guardar fixtures **sanitizadas** en `bin/fixtures/` (series inventadas).
3. Implementar `home`, `list`, `filters` y `search(query, page, filters)` en `bin/`; cablear en `module.js`; ampliar `capabilities`.
4. Prueba `node --test` sin red; anotar bugs en `BUGS.md` y hallazgos en `NOTES.md`.
5. Subir `version` (minor), regenerar `.zip`, recalcular `sha256`/`size`. `index.json` va en **PR aparte**.

## Fuera de este repo
- Ampliar `MODULE_CAPABILITIES`, `ModuleManifest` y SPEC §6.1 con `home`, `list`, `filters`; la UI debe pintar por lo que devuelven.

## Cierre
- [ ] Lista de §4 de `AGENTS.md`.
- [ ] Borrar este archivo.
