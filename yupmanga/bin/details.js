/** Ficha: datos visibles, capítulos por AJAX y series similares. */

import {
  CHAPTERS_COUNT,
  ROUTES,
  SELECTORS,
} from "./config.js";
import { fail } from "./utils/errors.js";
import { createSession, getJson, loadDocument } from "./utils/http.js";
import { kindOf, statusOf } from "./utils/normalize.js";
import { attrOf, collapse, compact, textList, textOf } from "./utils/text.js";
import { imageRef, queryOf, requirePath } from "./utils/url.js";

function seriesIdOf(path) {
  const seriesId = queryOf(requirePath(path, "serie")).id;
  if (!seriesId) {
    throw fail("NOT_FOUND", `La ficha no trae un id de serie: ${path}`);
  }
  return seriesId;
}

function infoOf(document) {
  const row = document.select(SELECTORS.details.info)[0];
  if (row === undefined) {
    return {};
  }
  const spans = row.select(SELECTORS.details.infoSpan);
  const nested = row.select(SELECTORS.details.infoNested);
  return {
    statusText: spans.length > 0 ? collapse(spans[0].text()) : "",
    author: nested.length > 0 ? collapse(nested[0].text()) : "",
    direction: nested.length > 2 ? collapse(nested[2].text()) : "",
  };
}

function chaptersCountOf(document) {
  for (const heading of document.select(SELECTORS.details.chaptersCount)) {
    const match = CHAPTERS_COUNT.exec(collapse(heading.text()));
    if (match !== null) {
      return match[1];
    }
  }
  return "";
}

function chapterOf(link, seriesId) {
  const title = textOf(link, SELECTORS.chapters.title);
  const key = attrOf(link, "", "data-chapter-key");
  if (title === "" || key === "") {
    return undefined;
  }
  const number = Number(key.replace(",", "."));
  return compact({
    id: title,
    title,
    number: Number.isFinite(number) ? number : undefined,
    releases: [
      {
        id: `/series.php?id=${encodeURIComponent(seriesId)}&chapter=${encodeURIComponent(key)}`,
      },
    ],
  });
}

async function chaptersOf(host, session, seriesId, pageUrl) {
  const chapters = [];
  let page = 1;
  let total = 1;
  do {
    const payload = await getJson(host, session, ROUTES.chapters(seriesId, page));
    const document = host.html(String(payload.html ?? ""));
    for (const link of document.select(SELECTORS.chapters.link)) {
      const chapter = chapterOf(link, seriesId);
      if (chapter !== undefined) {
        chapters.push(chapter);
      }
    }
    total = Number(payload.totalPages) || 1;
    page += 1;
  } while (page <= total && page <= 50);

  if (chapters.length === 0) {
    throw fail("PARSE", "La ficha no devolvió capítulos", {
      url: pageUrl,
      selector: SELECTORS.chapters.link,
    });
  }
  chapters.sort((left, right) => (right.number ?? -1) - (left.number ?? -1));
  return chapters;
}

function relatedOf(payload) {
  const list = Array.isArray(payload.series_data) ? payload.series_data : [];
  const related = [];
  for (const item of list) {
    const id = String(item?.id ?? "").trim();
    const title = String(item?.title ?? "").trim();
    if (id === "" || title === "") {
      continue;
    }
    const cover = String(item?.thumbnail_url ?? "").trim();
    const status = String(item?.status ?? "").trim();
    related.push(
      compact({
        id: `/series.php?id=${encodeURIComponent(id)}`,
        title,
        cover: cover === "" ? undefined : imageRef(cover),
        kind: kindOf(item?.serieType),
        badges: status === "" ? [] : [status],
      }),
    );
  }
  return related;
}

export async function details(host, seriesPath) {
  const seriesId = seriesIdOf(seriesPath);
  const session = createSession();
  const url = ROUTES.series(seriesId);
  const { document } = await loadDocument(host, session, url);

  const title = textOf(document, SELECTORS.details.title);
  const csrf = attrOf(document, SELECTORS.details.csrf, "value");
  if (title === "" || csrf === "") {
    throw fail("NOT_FOUND", "La página no es una ficha de serie", {
      url,
      selector: SELECTORS.details.title,
    });
  }

  const info = infoOf(document);
  const cover = attrOf(document, SELECTORS.details.cover, "content");
  const description =
    attrOf(document, SELECTORS.details.description, "content") ||
    attrOf(document, 'meta[name="description"]', "content");
  const tags = textList(document, SELECTORS.details.tags);
  const chaptersTotal = chaptersCountOf(document);

  const [chapters, similar] = await Promise.all([
    chaptersOf(host, session, seriesId, url),
    getJson(host, session, ROUTES.similar(seriesId)).catch(() => ({ series_data: [] })),
  ]);

  return {
    id: seriesPath,
    title,
    ...(cover === "" ? {} : { cover: imageRef(cover) }),
    ...(description === "" ? {} : { description }),
    genres: textList(document, SELECTORS.details.genres),
    status: statusOf(info.statusText),
    altTitles: [],
    extra: compact({
      Autor: info.author,
      Dirección: info.direction,
      Capítulos: chaptersTotal,
      Etiquetas: tags.join(", "),
    }),
    chapters,
    related: relatedOf(similar),
  };
}
