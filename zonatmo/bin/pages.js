/** Lector: todas las páginas del capítulo llegan en una sola vista. */

import { BASE_URL, SELECTORS } from "./config.js";
import { fail } from "./utils/errors.js";
import { loadDocument } from "./utils/http.js";
import { textOf } from "./utils/text.js";
import { imageRef, requirePath } from "./utils/url.js";

function imagesOf(document, url) {
  const images = document.select(SELECTORS.pages.images).map((image) => {
    const source = String(image.attr("src") ?? "").trim();
    if (source === "") {
      throw fail("PARSE", "Una imagen del capítulo no trae `src`", {
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

export async function pages(host, _chapterId, releaseId) {
  const url = BASE_URL + requirePath(releaseId, "release");
  const { document } = await loadDocument(host, url, `${BASE_URL}/`);
  const title = textOf(document, SELECTORS.pages.chapter);
  return { ...(title === "" ? {} : { title }), images: imagesOf(document, url) };
}
