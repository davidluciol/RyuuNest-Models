/**
 * ZonaTMO — módulo script de RyuuNest (SPEC §6.5). Port de `legacyModulos/logicTMO.py`
 * (SPEC Apéndice A).
 *
 * Solo usa `host.*`: los permisos de dominio, el tiempo límite y la concurrencia los
 * aplica el host. Los fallos se lanzan como errores tipados (`fail`) y no hay estado
 * compartido: cada llamada arma sus propias cabeceras.
 */
const BASE_URL = "https://zonatmo.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const ACCEPT_LANGUAGE = "en-US,en;q=0.9";

const SELECTORS = {
  card: {
    link: "a",
    style: "div.thumbnail style",
    title: "div.thumbnail h4.text-truncate",
    kind: "div.thumbnail span.book-type",
  },
  popular: { items: "div.element", score: "span.score", demography: "span.demography" },
  latest: { items: "div.upload-file-row", time: "span.number", groups: "span.groups" },
  details: {
    title: "h1.element-title",
    description: "p.element-description",
    cover: "div.element-image img.book-thumbnail",
    genres: "div.element-header-content-text h6",
    status: "div.element-header-content-text span.book-status",
    altTitles: "div.element-header-content-text span.text-truncate",
    extra: "div.unchecked",
    extraKey: "small.element-header-bar-element-title",
    extraValue: "span.element-header-bar-element-number",
    chapters: "li.upload-link",
    chapterTitle: "a.btn-collapse",
    releases: "li.list-group-item",
    releaseGroup: "a",
    releaseLink: "a.btn.btn-default.btn-sm",
    releaseDate: "div.text-center",
  },
  pages: {
    header: "section.bg-manga",
    images: "div.img-container img.viewer-img",
  },
};

const CHALLENGE_TITLE = /just a moment|attention required/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/u;
const CHAPTER_NUMBER = /^cap[ií]tulo\s+(\d+(?:[.,]\d+)?)/iu;
const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/u;

/** Error tipado del contrato (SPEC §6.4): el runtime lo reconoce por su forma. */
function fail(code, message, details) {
  const error = new Error(message);
  error.name = "ModuleError";
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function collapse(text) {
  return text.split(/\s+/u).filter(Boolean).join(" ");
}

function textOf(scope, selector) {
  const first = scope.select(selector)[0];
  return first === undefined ? "" : collapse(first.text());
}

function attrOf(scope, selector, name) {
  const first = scope.select(selector)[0];
  const value = first === undefined ? undefined : first.attr(name);
  return value === undefined ? "" : value.trim();
}

/** Quita lo que no aporta: `undefined`, `""` y listas vacías. */
function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) =>
        value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0),
    ),
  );
}

/** Ruta relativa al sitio (los dominios cambian, SPEC §6.2); `""` si no hay ruta. */
function relativePath(href, keepQuery) {
  let path = href
    .trim()
    .replace(/^https?:\/\/[^/]+/iu, "")
    .replace(/#.*$/u, "");
  if (!keepQuery) {
    path = path.replace(/\?.*$/u, "");
  }
  if (path === "") {
    return "";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function absoluteUrl(url) {
  const value = url.trim();
  if (/^https?:\/\//iu.test(value)) {
    return value;
  }
  if (value.startsWith("//")) {
    return `https:${value}`;
  }
  return `${BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

function requirePath(id, what) {
  if (typeof id !== "string" || !id.startsWith("/")) {
    throw fail("NOT_FOUND", `Identificador de ${what} no válido: ${String(id)}`);
  }
  return id;
}

function requestHeaders(referer) {
  const headers = { "User-Agent": USER_AGENT, "Accept-Language": ACCEPT_LANGUAGE };
  if (referer !== undefined) {
    headers.Referer = referer;
  }
  return headers;
}

/** RF-24: el sitio exige `Referer` y `User-Agent` al pedir las imágenes. */
function imageRef(url) {
  return {
    url: absoluteUrl(url),
    headers: { Referer: `${BASE_URL}/`, "User-Agent": USER_AGENT },
  };
}

function statusError(url, status) {
  const code =
    status === 404
      ? "NOT_FOUND"
      : status === 429
        ? "RATE_LIMITED"
        : status === 401 || status === 403
          ? "BLOCKED"
          : "NETWORK";
  return fail(code, `El sitio respondió ${status} a ${url}`, { url, status });
}

async function loadDocument(host, url, referer) {
  const response = await host.fetch(url, { headers: requestHeaders(referer) });
  if (response.status < 200 || response.status > 299) {
    throw statusError(url, response.status);
  }
  const document = host.html(await response.text());
  if (CHALLENGE_TITLE.test(textOf(document, "title"))) {
    throw fail("BLOCKED", `El sitio pide superar una protección anti-bot en ${url}`, { url });
  }
  return { document, url: response.url };
}

function kindOf(text) {
  const kind = text.trim().toLowerCase();
  return kind === "manga" || kind === "manhwa" || kind === "manhua" ? kind : undefined;
}

function statusOf(text) {
  const value = text.toLowerCase();
  if (value.includes("public")) {
    return "ongoing";
  }
  if (value.includes("finaliz") || value.includes("complet")) {
    return "completed";
  }
  if (value.includes("paus") || value.includes("hiatus")) {
    return "hiatus";
  }
  if (value.includes("cancel")) {
    return "cancelled";
  }
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Listas                                                              */
/* ------------------------------------------------------------------ */

function coverOf(row) {
  const style = row.select(SELECTORS.card.style)[0];
  const match = style === undefined ? null : CSS_URL.exec(style.text());
  return match === null || match[2].trim() === "" ? undefined : imageRef(match[2]);
}

function summaryOf(row, url) {
  const id = relativePath(attrOf(row, SELECTORS.card.link, "href"), false);
  const title = textOf(row, SELECTORS.card.title);
  if (id === "" || title === "") {
    throw fail("PARSE", "Tarjeta de serie sin enlace o sin título", {
      url,
      selector: `${SELECTORS.card.link} / ${SELECTORS.card.title}`,
    });
  }
  return { id, title, cover: coverOf(row), kind: kindOf(textOf(row, SELECTORS.card.kind)) };
}

function popularItem(card, url) {
  const score = textOf(card, SELECTORS.popular.score);
  const badges = [];
  if (score !== "") {
    badges.push(`★ ${score}`);
  }
  badges.push(textOf(card, SELECTORS.popular.demography));
  return compact({ ...summaryOf(card, url), badges: badges.filter(Boolean) });
}

function latestItem(row, url) {
  const hint = [textOf(row, SELECTORS.latest.time), textOf(row, SELECTORS.latest.groups)]
    .filter(Boolean)
    .join(" · ");
  return compact({ ...summaryOf(row, url), hint });
}

async function listing(host, url, selector, toItem) {
  const { document } = await loadDocument(host, url);
  return document.select(selector).map((row) => toItem(row, url));
}

/** `populars` y `latest_uploads` no se paginan (como en el código original). */
async function singlePage(host, page, url, selector, toItem) {
  if (page > 1) {
    return { items: [], hasNext: false };
  }
  return { items: await listing(host, url, selector, toItem), hasNext: false };
}

/** El sitio no expone paginador conocido: hay más páginas mientras la actual traiga series. */
async function searchPage(host, query, page) {
  const url = `${BASE_URL}/library?title=${encodeURIComponent(query)}&pg=${page}`;
  const items = await listing(host, url, SELECTORS.popular.items, popularItem);
  return { items, hasNext: items.length > 0 };
}

/* ------------------------------------------------------------------ */
/* Ficha                                                               */
/* ------------------------------------------------------------------ */

function releaseOf(item) {
  const id = relativePath(attrOf(item, SELECTORS.details.releaseLink, "href"), true);
  if (id === "") {
    return undefined;
  }
  const date = textOf(item, SELECTORS.details.releaseDate);
  return compact({
    id,
    group: textOf(item, SELECTORS.details.releaseGroup),
    publishedAt: ISO_DATE.test(date) ? date : undefined,
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
    const match = CHAPTER_NUMBER.exec(title);
    chapters.push({
      id: title,
      title,
      ...(match === null ? {} : { number: Number(match[1].replace(",", ".")) }),
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

function extraOf(document) {
  const extra = {};
  for (const data of document.select(SELECTORS.details.extra)) {
    const key = textOf(data, SELECTORS.details.extraKey);
    const value = textOf(data, SELECTORS.details.extraValue);
    if (key !== "" && value !== "") {
      extra[key] = value;
    }
  }
  return extra;
}

function textList(document, selector) {
  return document
    .select(selector)
    .map((element) => collapse(element.text()))
    .filter(Boolean);
}

async function detailsOf(host, seriesId) {
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
  return {
    id: seriesId,
    title,
    ...(cover === "" ? {} : { cover: imageRef(cover) }),
    ...(description === "" ? {} : { description }),
    genres: textList(document, SELECTORS.details.genres),
    status: statusOf(textOf(document, SELECTORS.details.status)),
    altTitles: textList(document, SELECTORS.details.altTitles),
    extra: extraOf(document),
    chapters: chaptersOf(document, url),
  };
}

/* ------------------------------------------------------------------ */
/* Capítulo                                                            */
/* ------------------------------------------------------------------ */

function imagesOf(document, url) {
  const images = document.select(SELECTORS.pages.images).map((image) => {
    const source = (image.attr("data-src") || "").trim();
    if (source === "") {
      throw fail("PARSE", "Una imagen del capítulo no trae `data-src`", {
        url,
        selector: SELECTORS.pages.images,
      });
    }
    return imageRef(source);
  });
  if (images.length === 0) {
    throw fail("PARSE", "El capítulo no trae ninguna imagen", {
      url,
      selector: SELECTORS.pages.images,
    });
  }
  return images;
}

/**
 * El enlace de la release redirige al visor paginado; la versión `cascade` trae todas las
 * imágenes en una sola página (SPEC Apéndice A.3).
 */
async function pagesOf(host, releaseId) {
  const referer = `${BASE_URL}/`;
  const first = await loadDocument(host, BASE_URL + requirePath(releaseId, "release"), referer);
  const viewer = first.url.includes("paginated")
    ? await loadDocument(host, first.url.replace("paginated", "cascade"), referer)
    : first;

  const header = viewer.document.select(SELECTORS.pages.header)[0];
  const title =
    header === undefined ? "" : collapse(`${textOf(header, "h1")} ${textOf(header, "h2")}`);
  return { ...(title === "" ? {} : { title }), images: imagesOf(viewer.document, viewer.url) };
}

/** Fábrica del módulo (SPEC §6.5). El host aplica permisos y límites. */
export default function create(host) {
  return {
    popular: (page) =>
      singlePage(host, page, `${BASE_URL}/populars`, SELECTORS.popular.items, popularItem),
    latest: (page) =>
      singlePage(
        host,
        page,
        `${BASE_URL}/latest_uploads?uploads_mode=thumbnail`,
        SELECTORS.latest.items,
        latestItem,
      ),
    search: (query, page) => searchPage(host, query, page),
    details: (seriesId) => detailsOf(host, seriesId),
    pages: (_chapterId, releaseId) => pagesOf(host, releaseId),
  };
}
