/** Ficha de serie: datos visibles y capítulos con sus releases. */

import {
  BASE_URL,
  CHAPTER_NUMBER,
  CSS_URL,
  SELECTORS,
  STAT_LABELS,
  VISITS_TITLE,
} from "./config.js";
import { fail } from "./utils/errors.js";
import { loadDocument } from "./utils/http.js";
import { isoDate, kindOf, statusOf } from "./utils/normalize.js";
import { attrOf, compact, textList, textOf } from "./utils/text.js";
import { imageRef, relativePath, requirePath } from "./utils/url.js";

function chapterNumber(raw, title) {
  const fromAttribute = String(raw ?? "").trim();
  const match = CHAPTER_NUMBER.exec(title);
  const value = fromAttribute !== "" ? fromAttribute : match === null ? "" : match[1];
  if (value === "") {
    return undefined;
  }
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
}

function releaseOf(block) {
  const id = relativePath(attrOf(block, SELECTORS.details.releaseLink, "href"), true);
  if (id === "") {
    return undefined;
  }
  return compact({
    id,
    group: textOf(block, SELECTORS.details.releaseGroup),
    publishedAt: isoDate(textOf(block, SELECTORS.details.releaseDate)),
  });
}

function chaptersOf(document, url) {
  const rows = document.select(SELECTORS.details.chapters);
  const chapters = [];
  for (const row of rows) {
    const title = textOf(row, SELECTORS.details.chapterTitle);
    const releases = row
      .select(SELECTORS.details.releases)
      .map(releaseOf)
      .filter((release) => release !== undefined);
    if (title === "" || releases.length === 0) {
      continue;
    }
    const number = chapterNumber(attrOf(row, SELECTORS.details.chapterTitle, "data-number"), title);
    chapters.push({
      id: title,
      title,
      ...(number === undefined ? {} : { number }),
      releases,
    });
  }
  if (rows.length > 0 && chapters.length === 0) {
    throw fail("PARSE", "La ficha trae capítulos pero ninguno se pudo leer", {
      url,
      selector: `${SELECTORS.details.chapters} ${SELECTORS.details.releases}`,
    });
  }
  return chapters;
}

function synonymsOf(document, title) {
  return textList(document, SELECTORS.details.synonyms).filter((alt) => alt !== title);
}

/** Datos sueltos de la cabecera: cifras (`ul.zt-hd__stats`), demografía y autores. */
function extraOf(document) {
  const extra = {};
  for (const item of document.select(SELECTORS.details.stats)) {
    const label = textOf(item, SELECTORS.details.statLabel);
    const key = STAT_LABELS.find(([pattern]) => pattern.test(label))?.[1];
    const value =
      VISITS_TITLE.exec(attrOf(item, SELECTORS.details.statValue, "title"))?.[1] ??
      textOf(item, SELECTORS.details.statValue);
    if (key !== undefined && value !== "") {
      extra[key] = value;
    }
  }
  const demography = textOf(document, SELECTORS.details.demography);
  if (demography !== "") {
    extra["Demografía"] = demography[0].toUpperCase() + demography.slice(1);
  }
  const authors = textList(document, SELECTORS.details.authors);
  if (authors.length > 0) {
    extra["Autor"] = authors.join(", ");
  }
  return extra;
}

/** Carrusel "Relacionados": mismas tarjetas que una lista, con la portada en un `<style>`. */
function relatedOf(document) {
  const seen = new Set();
  const related = [];
  for (const card of document.select(SELECTORS.details.related)) {
    const id = relativePath(attrOf(card, SELECTORS.details.relatedLink, "href"), false);
    const title =
      attrOf(card, SELECTORS.details.relatedTitle, "title") ||
      textOf(card, SELECTORS.details.relatedTitle);
    if (id === "" || title === "" || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const style = textOf(card, SELECTORS.details.relatedStyle);
    const image = CSS_URL.exec(style);
    const cover = image === null || image[2].trim() === "" ? "" : image[2].trim();
    const score = textOf(card, SELECTORS.details.relatedScore);
    const badges = [];
    if (score !== "" && Number(score) > 0) {
      badges.push(`★ ${score}`);
    }
    const demography = textOf(card, SELECTORS.details.relatedDemography);
    if (demography !== "") {
      badges.push(demography);
    }
    related.push(
      compact({
        id,
        title,
        cover: cover === "" ? undefined : imageRef(cover),
        kind: kindOf(textOf(card, SELECTORS.details.relatedKind)),
        badges,
      }),
    );
  }
  return related;
}

export async function details(host, seriesId) {
  const url = BASE_URL + requirePath(seriesId, "serie");
  const { document } = await loadDocument(host, url);
  const title = textOf(document, SELECTORS.details.title);
  if (title === "") {
    throw fail("PARSE", "La página no es una ficha de serie", {
      url,
      selector: SELECTORS.details.title,
    });
  }

  const cover = attrOf(document, SELECTORS.details.cover, "src");
  const description = textOf(document, SELECTORS.details.description);
  const status = `${attrOf(document, SELECTORS.details.status, "class")} ${textOf(
    document,
    SELECTORS.details.status,
  )}`;
  return {
    id: seriesId,
    title,
    ...(cover === "" ? {} : { cover: imageRef(cover) }),
    ...(description === "" ? {} : { description }),
    genres: textList(document, SELECTORS.details.genres),
    status: statusOf(status),
    altTitles: synonymsOf(document, title),
    extra: extraOf(document),
    chapters: chaptersOf(document, url),
    related: relatedOf(document),
  };
}
