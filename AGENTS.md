# AGENTS.md: reglas para quien trabaje en RyuuNest-Models

> Este documento es la guía **autocontenida** de este repositorio: no hace falta conocer el repo principal de RyuuNest ni leer nada más para aplicar las reglas de aquí. Todo lo que un colaborador o agente necesita está en este repo.
> Contexto mínimo: la app **RyuuNest** (lector de manga, manhua, manhwa y cómics, `github.com/davidluciol/RyuuNest`) consume este repo añadiéndolo como repositorio de módulos por URL HTTPS: descarga el `index.json` de la raíz y, con confirmación del usuario, los paquetes `.zip`.
> Documentos y comentarios en español; identificadores de código en inglés.

## 0. Estructura obligatoria de un módulo

Cada módulo de este repo resulta en exactamente esto:

```
<site>/
  manifest.json    ← el contrato
  module.js        ← archivo final de entrada
  bin/             ← (opcional) toda la lógica de apoyo
```

- **`<site>`**: carpeta con el **nombre del sitio**. Debe coincidir con el `id` del manifest, todo en minúsculas, sin espacios ni signos (solo `[a-z0-9-]`). Un módulo por carpeta: aquí no se agrupan varios sitios.
- **`manifest.json`**: **el contrato**. La app valida su esquema y sus permisos antes de instalar; un campo de más o de menos lo rechaza. Campos permitidos:

  | Campo | Sentido |
  |---|---|
  | `id` | Identificador estable del sitio (igual al nombre de la carpeta) |
  | `name` | Nombre visible |
  | `version` | Semver del módulo (p. ej. `1.0.0`) |
  | `apiVersion` | `1` (fijo; la app informa si un módulo ya no es compatible) |
  | `runtime` | `"declarative"` o `"script"` |
  | `kinds` | Tipos de obra: `manga`, `manhua`, `manhwa`, `comic` |
  | `lang` | Idioma del sitio (código ISO, p. ej. `es`) |
  | `nsfw` | Declaración honesta del contenido |
  | `baseUrl` | Dominio raíz del sitio (HTTPS obligatorio) |
  | `capabilities` | Operaciones que el módulo realmente implementa: `popular`, `latest`, `search`, `details`, `pages` |
  | `permissions.domains` | Dominios a los que puede llamar; la app hace cumplir esto en cada petición |
  | `entry` | `"module.js"` |

- **`module.js`**: el archivo final de entrada, y lo único que el manifest declara. Es un **módulo ES** que exporta `create(host)`:

  ```js
  export default function create(host) {
    return {
      popular: () => { /* … */ },
      latest: (page) => { /* … */ },
      search: (query, page) => { /* … */ },
      details: (seriesId) => { /* … */ },
      pages: (chapterId) => { /* … */ },
    };
  }
  ```

  La app entrega el objeto `host` con lo que el módulo tiene permiso de usar: `host.fetch(url, { headers })` para pedir páginas del sitio (el host aplica los dominios de `permissions`, un tiempo límite y una pausa entre peticiones) y `host.html(texto)` para obtener un documento de HTML navegable con selectores CSS. **No hay más red ni más APIs**: dentro del módulo no existe `fetch` global, ni `npm`, ni librerías, ni acceso a archivos.
- **`bin/`**: aquí no hay problema si hay más archivos. Ahí va **toda la lógica de apoyo**: cabeceras (`headers`), constantes de rutas y selectores, mapas de dominios, decodificaciones, normalización de texto… organizado por tema y con métodos **CLEAN**: funciones pequeñas de una sola responsabilidad, nombres claros, sin código repetido. «Menos es más»: si algo no hace falta, no entra. `manifest.json` y `module.js` nunca viven dentro de `bin/`.
- **Datos de prueba:** si el módulo trae fixtures (páginas HTML/JSON guardadas del sitio para lanzar las pruebas sin red), van en `bin/fixtures/`; nunca con obras reales: series inventadas y portadas sin texto.

## 1. Reglas de trabajo

1. **Ante la duda, pregunta.** Y sobre todo si es un dato que no se puede ver desde aquí: si el manifest declara algo que no se comprobó contra el sitio, el PR y `NOTES.md` lo dicen con la marca **«sin verificar»**. No se inventa nada: ni selectores, ni rutas, ni permisos.
2. **Todo el scraping corre en el dispositivo del lector.** En este repo no hay servidores, cuentas, telemetría, servicios de terceros ni CDN. Un módulo es código que se descarga y corre en local.
3. **La red va solo por `host.fetch`.** Ningún uso de `fetch` global (el ejecutor no lo permite). Las imágenes de capítulos se piden con las cabeceras que el sitio exija (`Referer`, `User-Agent`, `Accept-Language`); si falta una cabecera que el sitio requiere, las imágenes no cargan y las pruebas la detectan. Los `permissions.domains` del manifest deben cubrir `baseUrl` y todo dominio que el código pida: una petición a un dominio fuera de la lista la rechaza el host.
4. **Errores declarados, no mudos.** El módulo no puede importar la clase de error de la app, así que lanza un `Error` con esta forma exacta; sin ella, la app lo reporta como `INTERNAL` y esconde la causa real:

   ```js
   function fail(code, message, details) {
     const error = new Error(message);
     error.name = "ModuleError";
     error.code = code;
     if (details !== undefined) error.details = details;
     return error;
   }
   ```

   `code` es uno de: `NETWORK`, `TIMEOUT`, `BLOCKED`, `RATE_LIMITED`, `NOT_FOUND`, `PARSE`, `UNSUPPORTED`, `INTERNAL`. El correcto depende de la causa: 404 → `NOT_FOUND`, 429 → `RATE_LIMITED`, 401/403 → `BLOCKED`, una página que no es ficha ni lector → `PARSE`. `details` admite `{ url, status, selector }` para el detalle expandible de la app. Los fallos de red y los tiempos límite ya los tipa el host: no hace falta que el módulo los relance.
5. **Sin estado entre peticiones.** El módulo es funciones, no un servicio con memoria: cada petición lleva sus cabeceras nuevas y no se guarda nada entre llamadas.
6. **Etiquetas honestas.** Si el sitio está tras protecciones anti-robot que un módulo de dispositivo no puede vencer, se dice: el método informa `BLOCKED` con detalle y no se promete que funcione. Un `capabilities` que promete más de lo que el módulo hace es una promesa rota: el usuario la ve en la app y la operación falla en pantalla.
7. **Prueba antes de publicar, por la vía que tengas disponible.**
   - **Con el repo principal clonado** (`github.com/davidluciol/RyuuNest`, público): tiene las automatizaciones completas — validación de manifest y arnés de contrato del módulo contra fixtures guardadas del sitio (el CLI `ryuunest-module` del §2.1 es parte de eso).
   - **Solo con este repo** (la vía común de un primer PR): guarda en `bin/fixtures/` una copia del HTML o JSON real de cada página que el módulo vaya a leer, verifica tus selectores contra esos archivos y añade en `bin/` una prueba mínima con Node (`node --test`) que no toque la red y pase por las 5 operaciones declaradas en `capabilities`. Lo «sin verificar» contra el sitio real queda dicho en el PR y en `NOTES.md`.
   - Un módulo que no se puede probar también es un defecto del módulo.
8. **Instalación solo por esta vía.** Sin rutas locales ni pasos que el usuario tenga que ejecutar. La app descarga solo así: `index.json` → pantalla de confirmación → `.zip` verificado.

## 2. Empaquetado y publicación

La app no lee las carpetas: lee el **`index.json`** de la raíz de este repo. Antes de nada, dos invariantes:

- Publicar módulo roto no es abrir un PR: es **distribuir rotura**. Se publica solo con el manifest validado y las pruebas en verde por la vía disponible (§1.7).
- El `.zip` no se regenera **sin actualizar su hash**: el `sha256` del `index.json` es lo que la app compara con los bytes que descarga. Si no coincide, el módulo no se instala.

### 2.1 Crear el `.zip`: dos vías, un mismo contrato

Ambas producen un paquete válido: la app verifica el `sha256` de `index.json` contra el `.zip` que esté publicado en este repo, sin importar qué herramienta lo comprimió. Elige una por módulo y sé consistente.

Lo que las dos exigen:

- El `.zip` contiene **el contenido de la carpeta** con `manifest.json` y `module.js` (y `bin/` si hay) **en la raíz del paquete**, no una carpeta intermedia.
- Sin archivos que empiecen por punto (`.`) ni `node_modules`.
- Topes que el instalador defiende: ≤ 2 MB comprimido, ≤ 5 MB descomprimido, ≤ 50 archivos.

**Vía manual (solo con este repo):**

```bash
# desde la carpeta del módulo
cd <site>
zip -r ../packages/<id>-<version>.zip . -x '.*' '.*/*' 'node_modules/*'
cd ..

sha256sum packages/<id>-<version>.zip   # → sha256 para index.json
wc -c < packages/<id>-<version>.zip     # → size en bytes
```

En Windows, `zip` y `sha256sum` no vienen de serie: cualquier equivalente vale (PowerShell `Compress-Archive` con exclusión de ocultos, `7z a` con `-xr!.git`, o `Get-FileHash -Algorithm SHA256` para el hash). Lo único innegociable es el contenido del paquete: manifest en la raíz, sin ocultos ni `node_modules`, y un hash calculado del `.zip` exacto que se sube.

**Vía con el CLI `ryuunest-module`** (requiere tener clonado el repo principal, que es público: `pnpm install` + `pnpm --filter @ryuunest/module-sdk build` dejan el CLI listo):

```bash
ryuunest-module validate <site>                              # valida el manifest antes de seguir
ryuunest-module test <site>                                 # arnés contra el sitio falso de la plantilla (solo sirve si el módulo apunta a esa arquitectura)
ryuunest-module pack <site> --out packages/<id>-<version>.zip
```

El `pack` revalida el manifest, comprime toda la carpeta (excluye dotfiles y `node_modules`), calcula el SHA-256 hexadecimal y el tamaño, e imprime un JSON `{ "file", "sha256", "size", "files" }` con los datos exactos de la entrada del índice.

### 2.2 Comprobaciones antes de publicar

- **Manifest:** JSON válido; `apiVersion: 1`; `id` igual al nombre de la carpeta; `entry = "module.js"`; `permissions.domains` cubre `baseUrl` y todo dominio pedido en el código; `capabilities` es lo que el módulo realmente implementa.
- **`module.js`:** carga como módulo ES, exporta `create(host)` y las operaciones de `capabilities` existen y devuelven promesas.
- **El `.zip`** tiene `manifest.json` en su raíz y cabe en los topes.
- **`index.json`:** los `sha256` y `size` escritos corresponden al `.zip` exacto que queda publicado tras el push final (recalcular y comparar al terminar).

### 2.3 Actualizar el `index.json` y publicar

1. Busca la entrada del módulo (`id`) y **sustitúyela entera** con los valores del manifest vigente y los tres del paquete (`package`, `sha256`, `size`).
2. `version` sube por **semver**: parche para arreglos, minor para capacidades nuevas, mayor si cambia algo documentado como incompatible.
3. El PR lleva **los tres juntos**: la carpeta `<site>/` (o sus cambios), el `.zip` y la entrada del `index.json`. Un índice que referencie un paquete o un hash que no están en el repo es una instalación rota para quien lo intente.
4. Sin entrada en `index.json` con `package` + `sha256` + `size`, el módulo no existe para la app. El usuario decide instalarlo en la pantalla de confirmación (los módulos `script` piden confirmación reforzada porque ejecutan código): este repo es la fuente de verdad, no el instalador.

## 3. Paquetes y dependencias

- Un módulo es **autocontenido**: en el dispositivo no hay `npm`, no se instalan librerías al instalar el módulo, y el instalador rechaza paquetes con más de 50 archivos. Todo lo que el módulo necesita vive en su carpeta y su sitio de apoyo es `bin/`: cabeceras, rutas, selectores, decodificaciones y normalización de texto.
- Si al portar un sitio parece necesaria una **librería externa** (un parser para un formato que el host no entiende, decodificación de contenedores, una compresión particular del sitio…), la regla es **no añadir nada sin antes preguntar al mantenedor**, con la justificación exacta de **por qué se requiere para el web-scraping de ese sitio**:
  - qué dato concreto hay que extraer y en qué formato (raro) lo entrega el sitio, mejor con una muestra real;
  - por qué no lo cubre lo que ya da el contrato (`host.fetch`, `host.html()` con selectores CSS, o el propio `module.js` escrito a mano).
- El motivo válido es siempre del **scraping**: formato de respuesta del sitio, URLs de imagen cifradas u ofuscadas, paginaciones raras… No valen conveniencia, estilo, ni nada de UI, de HTTP propio, de telemetría o de propósito general.
- Si se acepta, la librería no entra en el `.zip` del módulo: entra en el lado del **host/contrato** de la app (repo principal, con pruebas y documentación) y el módulo solo la usa desde el host. La decisión y el motivo se anotan en `NOTES.md`.

## 4. Lista de cierre de sesión

- [ ] Estructura del §0 respetada: `<site>/`, `manifest.json`, `module.js`, apoyo solo en `bin/` (fixtures en `bin/fixtures/`).
- [ ] Manifest válido (§2.2) y `module.js` carga como módulo ES con `create(host)`.
- [ ] Pruebas en verde por la vía disponible (§1.7); lo «sin verificar» contra el sitio real queda dicho en el PR y en `NOTES.md`.
- [ ] `.zip` con `manifest.json` en la raíz, dentro de los topes, y generado por **una sola vía** (manual o CLI).
- [ ] `index.json` actualizado: entrada entera y `package`/`sha256`/`size` del `.zip` exacto que se sube, con semver coherente.
- [ ] Ninguna librería añadida sin preguntar; si se propuso una, decisión y motivo de scraping anotados en `NOTES.md`.
- [ ] Entrada nueva en la bitácora de `NOTES.md`.
- [ ] Preguntas sin resolver dichas al mantenedor.
