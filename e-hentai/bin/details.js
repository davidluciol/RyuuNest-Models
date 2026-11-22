/** Ficha de una galería con la API JSON (`gdata`): metadatos y «capítulos» de 20 imágenes. */

import { THUMBS_PER_PAGE } from "./config.js";
import { fail } from "./utils/errors.js";
import { callApi, imageHeaders } from "./utils/http.js";

/** Espacios de nombres que van a `extra` en vez de a `genres`. */
const META = {
  language: "Idioma", artist: "Artista", group: "Grupo", parody: "Parodia",
  character: "Personajes", cosplayer: "Cosplayer", reclass: "Reclasificada",
};
const ENTITIES = { amp: "&", quot: '"', "#039": "'", "#39": "'", lt: "<", gt: ">" };

const decode = (text) => String(text ?? "").replace(/&(amp|quot|#0?39|lt|gt);/gu, (_, name) => ENTITIES[name]);

/** `g/{gid}/{token}` → `{ gid, token }` o `NOT_FOUND`. */
export function galleryOf(id) {
  const match = /^g\/(\d+)\/([0-9a-f]{10})(?:\/|$)/u.exec(String(id ?? ""));
  if (!match) throw fail("NOT_FOUND", `Identificador de galería no válido: ${id}`);
  return { gid: Number(match[1]), token: match[2] };
}

function tagsByNamespace(tags) {
  const groups = {};
  for (const tag of tags ?? []) {
    const [namespace, value] = tag.includes(":") ? tag.split(/:(.*)/su) : ["misc", tag];
    (groups[namespace] ??= []).push(value);
  }
  return groups;
}

/** Bloques de 20 imágenes, el más nuevo (último) primero como pide el contrato. */
function chaptersOf(gid, token, filecount, publishedAt) {
  const total = Math.ceil(filecount / THUMBS_PER_PAGE);
  return Array.from({ length: total }, (_, index) => {
    const block = total - 1 - index;
    const id = `g/${gid}/${token}/${block}`;
    const first = block * THUMBS_PER_PAGE + 1;
    const last = Math.min(filecount, first + THUMBS_PER_PAGE - 1);
    return { id, title: `Páginas ${first}–${last}`, number: block + 1, releases: [{ id, ...(publishedAt ? { publishedAt } : {}) }] };
  });
}

export async function details(host, seriesId) {
  const { gid, token } = galleryOf(seriesId);
  const body = await callApi(host, { method: "gdata", gidlist: [[gid, token]], namespace: 1 });
  const meta = body.gmetadata?.[0];
  if (!meta || meta.error || meta.expunged === true) {
    throw fail("NOT_FOUND", `La galería ${gid} no existe o fue retirada`, { url: `g/${gid}/${token}` });
  }
  const filecount = Number(meta.filecount) || 0;
  const tags = tagsByNamespace(meta.tags);
  const publishedAt = meta.posted ? new Date(Number(meta.posted) * 1000).toISOString() : undefined;
  const extra = { Categoría: meta.category, "Subido por": meta.uploader, Valoración: meta.rating, Páginas: String(filecount) };
  for (const [namespace, label] of Object.entries(META)) if (tags[namespace]) extra[label] = tags[namespace].join(", ");
  const altTitle = decode(meta.title_jpn);
  return {
    id: `g/${gid}/${token}`,
    title: decode(meta.title) || `#${gid}`,
    ...(meta.thumb ? { cover: { url: meta.thumb, headers: imageHeaders() } } : {}),
    kind: "manga",
    nsfw: true,
    badges: [meta.category].filter(Boolean),
    ...(meta.uploader ? { hint: meta.uploader } : {}),
    genres: Object.entries(tags)
      .filter(([namespace]) => !(namespace in META))
      .flatMap(([, values]) => values),
    status: "completed",
    altTitles: altTitle ? [altTitle] : [],
    extra: Object.fromEntries(Object.entries(extra).filter(([, value]) => value)),
    chapters: chaptersOf(gid, token, filecount, publishedAt),
  };
}
