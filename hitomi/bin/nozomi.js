/** Listas `.nozomi`: enteros de 4 bytes big-endian (IDs de galería), de más nuevo a más viejo. */

import { CONTENT_URL, PAGE_SIZE } from "./config.js";
import { fail } from "./utils/errors.js";
import { request } from "./utils/http.js";

function idsFrom(bytes) {
  const ids = [];
  for (let index = 0; index + 3 < bytes.length; index += 4) {
    ids.push(String(((bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3]) >>> 0));
  }
  return ids;
}

/** IDs de la página `page` de la lista `path` (p. ej. `index-spanish`). Lista inexistente = vacía. */
export async function readIds(host, path, page) {
  const url = `${CONTENT_URL}/${path}.nozomi`;
  const start = (page - 1) * PAGE_SIZE * 4;
  const end = start + PAGE_SIZE * 4 - 1;
  const response = await request(host, url, { Range: `bytes=${start}-${end}` }, [404, 416]);
  if (response.status === 404 || response.status === 416) {
    return { ids: [], hasNext: false };
  }
  if (typeof response.bytes !== "function") {
    throw fail("UNSUPPORTED", "Esta versión de la app no expone host.bytes(), necesario para leer las listas de Hitomi", { url });
  }
  let bytes = await response.bytes();
  if (response.status === 200) {
    bytes = bytes.subarray(start, end + 1); // el servidor ignoró Range y mandó la lista entera
  }
  return { ids: idsFrom(bytes), hasNext: bytes.length === PAGE_SIZE * 4 };
}
