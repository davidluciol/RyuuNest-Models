# RyuuNest-Models

Repositorio público de **módulos de sitios concretos** para [RyuuNest](https://github.com/davidluciol/RyuuNest), el lector de código abierto de manga, manhua, manhwa y cómics.

La app se distribuye **sin módulos** (SPEC §15): los módulos del autor viven aquí, en un repo aparte y **no afiliado**. Cada persona añade en la app los repos que quiera y es responsable de respetar los derechos de autor y los términos de cada sitio.

> **Aviso:** RyuuNest-Models no está afiliado a ningún sitio de lectura, no aloja ni distribuye contenido protegido y no guarda datos de nadie. Este repo solo contiene código de extracción (scraping) y sus metadatos.

## Cómo se usa en la app

En **Ajustes → Añadir repositorio**, añade la URL HTTPS del `index.json` de este repo:

```
https://raw.githubusercontent.com/davidluciol/RyuuNest-Models/<rama>/index.json
```

La app descarga y valida el índice (formato `ryuunest-repo` v1), muestra los módulos disponibles y, **con tu confirmación**, descarga el paquete `.zip`, verifica su **SHA-256** contra el índice y valida su `manifest.json` antes de instalar nada. Los módulos `script` piden una confirmación reforzada (mantener pulsado) porque ejecutan código.

## Estructura

```
<site>/
  manifest.json   ← el contrato (lo valida la app)
  module.js       ← archivo final de entrada
  bin/            ← lógica de apoyo organizada (headers, utils, constantes…)
packages/…       ← los .zip publicados, referenciados desde index.json
index.json       ← el índice que lee la app (ryuunest-repo v1)
```

Las reglas para contribuir y para agentes están en [`AGENTS.md`](AGENTS.md); el cuaderno de trabajo, en [`NOTES.md`](NOTES.md).

## Cómo publicar un módulo

1. Crea la carpeta `<site>/` con `manifest.json`, `module.js` y tu lógica de apoyo en `bin/` (contrato y campos en [`AGENTS.md`](AGENTS.md) §0).
2. Comprueba el módulo contra páginas guardadas en `bin/fixtures/` con una prueba de Node sin red; si tienes clonado el repo principal de RyuuNest (público), puedes usar su arnés de contrato y su CLI.
3. Genera el `.zip`, calcula su **SHA-256** y su tamaño, y actualiza la entrada en `index.json` (vía manual o con el CLI; detalle en AGENTS.md §2).
4. Abre un PR: carpeta + `.zip` + entrada del `index.json`. Un mantenedor revisa permisos, topes y manifest antes de fusionar.

## Licencia

El código de este repo es **GPL-3.0** (los derivados también abiertos). Los módulos son obras independientes de cada autor, que decide su licencia. Esto no es asesoría legal.
