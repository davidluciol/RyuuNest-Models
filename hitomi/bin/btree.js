/**
 * Búsqueda por texto libre (título, varias palabras) en el índice B-tree del sitio
 * (`galleriesindex`), igual que `search.js` de hitomi.la: clave = 4 primeros bytes del SHA-256
 * de la palabra; nodos de 464 bytes leídos con `Range`; los datos son IDs de 4 bytes big-endian.
 */

import { CONTENT_URL } from "./config.js";
import { fail } from "./utils/errors.js";
import { request } from "./utils/http.js";
import { sha256 } from "./utils/sha256.js";

const MAX_NODE_SIZE = 464;
const SUBNODES = 17; // B + 1, con B = 16
const MAX_DEPTH = 32;

async function rangeBytes(host, url, start, end) {
  const response = await request(host, url, { Range: `bytes=${start}-${end}` });
  if (typeof response.bytes !== "function") {
    throw fail("UNSUPPORTED", "Esta versión de la app no expone host.bytes(), necesario para buscar en Hitomi", { url });
  }
  const bytes = await response.bytes();
  return response.status === 200 ? bytes.subarray(start, end + 1) : bytes; // el servidor ignoró Range
}

const uint64 = (view, pos) => view.getUint32(pos) * 2 ** 32 + view.getUint32(pos + 4);

export function decodeNode(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const keys = [];
  const keyCount = view.getInt32(pos);
  pos += 4;
  for (let i = 0; i < keyCount; i++) {
    const size = view.getInt32(pos);
    if (size <= 0 || size > 32) throw fail("PARSE", "Nodo del índice de Hitomi con clave inválida");
    keys.push(bytes.subarray(pos + 4, pos + 4 + size));
    pos += 4 + size;
  }
  const datas = [];
  const dataCount = view.getInt32(pos);
  pos += 4;
  for (let i = 0; i < dataCount; i++) {
    datas.push([uint64(view, pos), view.getInt32(pos + 8)]);
    pos += 12;
  }
  const subnodes = [];
  for (let i = 0; i < SUBNODES; i++) {
    subnodes.push(uint64(view, pos));
    pos += 8;
  }
  return { keys, datas, subnodes };
}

function compare(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export async function indexVersion(host) {
  const text = (await (await request(host, `${CONTENT_URL}/galleriesindex/version?_=${Date.now()}`)).text()).trim();
  if (!/^\d+$/u.test(text)) throw fail("PARSE", "Versión del índice de Hitomi inválida", { text });
  return text;
}

/** IDs de las galerías cuyo texto contiene `word` (en el orden del índice). */
export async function idsForWord(host, version, word) {
  const base = `${CONTENT_URL}/galleriesindex/galleries.${version}`;
  const key = sha256(word).subarray(0, 4);
  let address = 0;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const node = decodeNode(await rangeBytes(host, `${base}.index`, address, address + MAX_NODE_SIZE - 1));
    let i = 0;
    let cmp = -1;
    for (; i < node.keys.length; i++) {
      cmp = compare(key, node.keys[i]);
      if (cmp <= 0) break;
    }
    if (node.keys.length > 0 && cmp === 0) return readData(host, `${base}.data`, node.datas[i]);
    if (node.subnodes.every((sub) => sub === 0) || node.subnodes[i] === 0) return [];
    address = node.subnodes[i];
  }
  throw fail("PARSE", "El índice de Hitomi es más profundo de lo esperado");
}

async function readData(host, url, [offset, length]) {
  if (length <= 0 || length > 100_000_000) return [];
  const bytes = await rangeBytes(host, url, offset, offset + length - 1);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getInt32(0);
  if (count <= 0 || bytes.length !== count * 4 + 4) throw fail("PARSE", "Datos del índice de Hitomi incompletos");
  return Array.from({ length: count }, (_, i) => String(view.getInt32(4 + i * 4)));
}
