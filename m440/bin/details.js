/** Ficha de serie: datos visibles, capítulos (cifrados en el HTML) y sus releases. */

import {
  BASE_URL,
  CHAPTER_KEY,
  CHAPTER_PAYLOAD,
  DEMOGRAPHIC_ROW,
  MANGA_PAYLOAD,
  SELECTORS,
} from "./config.js";
import { decryptChapterPayload } from "./utils/crypto.js";
import { fail } from "./utils/errors.js";
import { loadDocument } from "./utils/http.js";
import { attrOf, collapse, compact, splitList, stripTags, textOf } from "./utils/text.js";
import { imageRef, relativePath, requirePath } from "./utils/url.js";

/** Extrae el objeto JSON que empieza en `start` contando llaves fuera de cadenas. */
function jsonObjectAt(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

function mangaData(text, url) {
  const marker = text.indexOf(MANGA_PAYLOAD);
  if (marker < 0) {
    throw fail("PARSE", "La ficha no trae los datos de la serie", {
      url,
      selector: MANGA_PAYLOAD,
    });
  }
  const start = text.indexOf("{", marker + MANGA_PAYLOAD.length);
  const raw = start < 0 ? "" : jsonObjectAt(text, start);
  if (raw === "") {
    throw fail("PARSE", "Los datos de la serie están incompletos", {
      url,
      selector: MANGA_PAYLOAD,
    });
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw fail("PARSE", "Los datos de la serie no son JSON válido", {
      url,
      selector: MANGA_PAYLOAD,
    });
  }
  if (data === null || typeof data !== "object") {
    throw fail("PARSE", "Los datos de la serie tienen una forma inesperada", {
      url,
      selector: MANGA_PAYLOAD,
    });
  }
  return data;
}

function isoDate(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/u.exec(String(value ?? "").trim());
  return match === null ? undefined : match[1];
}

function statusOf(data) {
  const id = String(data.status_id ?? "").trim();
  const label = String(data.status?.label ?? "").trim();
  if (id === "1" || /ongoing|en curso|public/iu.test(label)) return "ongoing";
  if (id === "2" || /complet|finaliz|ended/iu.test(label)) return "completed";
  if (/hiatus|pausa/iu.test(label)) return "hiatus";
  if (/cancel/iu.test(label)) return "cancelled";
  return "unknown";
}

/** El listado de capítulos llega cifrado con AES-256-CBC (ver `utils/crypto.js`). */
function chaptersOf(text, mangaSlug, url) {
  const marker = text.indexOf(CHAPTER_PAYLOAD);
  if (marker < 0) {
    throw fail("PARSE", "La ficha no trae el listado de capítulos", {
      url,
      selector: CHAPTER_PAYLOAD,
    });
  }
  const start = marker + CHAPTER_PAYLOAD.length;
  const end = text.indexOf('";', start);
  if (end < 0) {
    throw fail("PARSE", "El listado de capítulos está incompleto", {
      url,
      selector: CHAPTER_PAYLOAD,
    });
  }

  let rawPayload;
  try {
    rawPayload = JSON.parse(`"${text.slice(start, end)}"`);
  } catch {
    throw fail("PARSE", "El listado de capítulos no se pudo leer", {
      url,
      selector: CHAPTER_PAYLOAD,
    });
  }

  let plain;
  try {
    plain = decryptChapterPayload(CHAPTER_KEY, rawPayload);
  } catch {
    throw fail("UNSUPPORTED", "El cifrado del listado de capítulos cambió de formato", {
      url,
      selector: CHAPTER_PAYLOAD,
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(plain);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
  } catch {
    throw fail("PARSE", "El listado de capítulos descifrado no es JSON válido", {
      url,
      selector: CHAPTER_PAYLOAD,
    });
  }
  if (!Array.isArray(parsed)) {
    throw fail("PARSE", "El listado de capítulos descifrado no es una lista", {
      url,
      selector: CHAPTER_PAYLOAD,
    });
  }

  const chapters = [];
  for (const chapter of parsed) {
    if (chapter === null || typeof chapter !== "object") continue;
    const title = collapse(chapter.name);
    const slug = String(chapter.slug ?? "").trim();
    if (title === "" || slug === "") continue;
    const numberText = String(chapter.number ?? "").trim();
    const number = numberText === "" ? Number.NaN : Number(numberText.replace(",", "."));
    const id = `/manga/${mangaSlug}/${slug}`;
    chapters.push({
      id,
      title,
      ...(Number.isFinite(number) ? { number } : {}),
      releases: [
        compact({
          id,
          group: collapse(chapter.user?.username),
          publishedAt: isoDate(chapter.created_at),
        }),
      ],
    });
  }
  if (parsed.length > 0 && chapters.length === 0) {
    throw fail("PARSE", "La ficha trae capítulos pero ninguno se pudo leer", {
      url,
      selector: CHAPTER_PAYLOAD,
    });
  }
  return chapters;
}

function summaryOf(document, manga) {
  const visible = textOf(document, SELECTORS.details.summary).replace(/^Sinopsis\s*/iu, "");
  return visible !== "" ? visible : stripTags(manga.summary);
}

function demographicOf(text) {
  const match = DEMOGRAPHIC_ROW.exec(text);
  return match === null ? "" : stripTags(match[1]);
}

function ratingOf(document) {
  const score = attrOf(document, SELECTORS.details.rating, "data-score");
  return score === "" || Number(score) <= 0 ? undefined : score;
}

function coverOf(document) {
  const source =
    attrOf(document, SELECTORS.details.cover, "src") ||
    attrOf(document, 'meta[itemprop="image"]', "content");
  return source === "" ? undefined : imageRef(source);
}

function genresOf(manga, demographic) {
  const seen = new Set();
  const genres = [];
  for (const category of manga.categories ?? []) {
    const name = collapse(category?.name);
    if (name !== "" && name !== demographic && !seen.has(name)) {
      seen.add(name);
      genres.push(name);
    }
  }
  return genres;
}

export async function details(host, seriesId) {
  const path = requirePath(relativePath(seriesId, false), "serie");
  const { document, text, url } = await loadDocument(host, `${BASE_URL}${path}`);
  const manga = mangaData(text, url);
  const title = collapse(manga.name);
  if (title === "") {
    throw fail("PARSE", "La ficha no trae el título de la serie", {
      url,
      selector: MANGA_PAYLOAD,
    });
  }
  const slug = collapse(manga.slug);
  if (slug === "") {
    throw fail("PARSE", "La ficha no trae el identificador de la serie", {
      url,
      selector: MANGA_PAYLOAD,
    });
  }
  const extra = compact({
    Tipo: collapse(manga.type?.label),
    Publicación: collapse(manga.releaseDate),
    Autor: collapse(manga.author),
    Artista: collapse(manga.artist),
    Demografía: demographicOf(text),
    Puntuación: ratingOf(document),
  });
  const cover = coverOf(document);
  const description = summaryOf(document, manga);
  return {
    id: path,
    title,
    ...(cover === undefined ? {} : { cover }),
    ...(description === "" ? {} : { description }),
    genres: genresOf(manga, extra["Demografía"] ?? ""),
    status: statusOf(manga),
    altTitles: splitList(manga.otherNames),
    extra,
    chapters: chaptersOf(text, slug, url),
  };
}
