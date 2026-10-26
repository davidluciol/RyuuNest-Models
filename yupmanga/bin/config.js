/** Constantes del sitio: dominio, rutas, selectores y expresiones regulares. */

export const BASE_URL = "https://www.yupmanga.com";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

export const ROUTES = {
  popular: () => `${BASE_URL}/top.php`,
  latest: () => `${BASE_URL}/`,
  search: (query, page) =>
    `${BASE_URL}/search.php?q=${encodeURIComponent(query)}&page=${page}`,  series: (seriesId) => `${BASE_URL}/series.php?id=${encodeURIComponent(seriesId)}`,
  chapters: (seriesId, page) =>
    `${BASE_URL}/ajax/load_chapters.php?series_id=${encodeURIComponent(seriesId)}&page=${page}&order=asc`,
  similar: (seriesId) =>
    `${BASE_URL}/ajax/load_similar_series.php?series_id=${encodeURIComponent(seriesId)}`,
  reader: (chapterId, token, page) =>
    `${BASE_URL}/reader_v2.php?chapter=${encodeURIComponent(chapterId)}&token=${encodeURIComponent(
      token,
    )}&page=${page}`,
};

export const SELECTORS = {
  grid: "div.grid",
  card: {
    root: "div.comic-card",
    link: "a",
    title: "h3",
    image: "img",
    badge: "span",
  },
  pagination: "a.ym-pag",
  details: {
    title: "h1",
    cover: 'meta[property="og:image"]',
    description: 'meta[property="og:description"]',
    genres: "a.genre-tag",
    tags: "a.tag-item",
    info: "div.flex.flex-wrap.gap-4",
    infoSpan: "span",
    infoNested: "span span",
    chaptersCount: "h2",
    csrf: "#csrf_token",
  },
  chapters: {
    link: "a.chapter-link",
    title: "h3",
  },
  reader: {
    chapterTitle: ".chapter-title",
    seriesTitle: ".series-title",
  },
};

export const CHALLENGE_TITLE = /just a moment|attention required|checking your browser|you have been blocked/iu;
export const CHAPTERS_COUNT = /^([\d.,]+)\s+cap[ií]tulos?$/iu;
export const CHALLENGE_PARTS = /\[([0-9,]+)\];var [\w$]+=String\.fromCharCode\(([0-9,]+)\);/u;
export const AD_TICKET = /const adTicket\s*=\s*(\{[\s\S]*?\});/u;
export const READER_URL = /data-reader-url="([^"]+)"/u;
export const PAGE_KEYS = /readerPageKeys\s*=\s*(\{[\s\S]*?\});/u;

/** Segundos que exige el sitio antes de dar por visto el interstitial. */
export const AD_WAIT_MS = 9000;
