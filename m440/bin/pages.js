/** Lector: todas las páginas del capítulo llegan en una sola vista (`data-src`). */

import { BASE_URL, SELECTORS } from "./config.js";
import { fail } from "./utils/errors.js";
import { loadDocument } from "./utils/http.js";
import { textOf } from "./utils/text.js";
import { imageRef, requirePath } from "./utils/url.js";

export async function pages(host, _chapterId, releaseId) {
  const url = BASE_URL + requirePath(releaseId, "release");
  const { document } = await loadDocument(host, url, `${BASE_URL}/`);
  const title = textOf(document, SELECTORS.pages.title);
  const images = [];
  for (const image of document.select(SELECTORS.pages.images)) {
    const source = String(image.attr("data-src") || "").trim();
    if (source !== "") {
      images.push(imageRef(source));
    }
  }
  if (images.length === 0) {
    throw fail("PARSE", "El capítulo no trae ninguna imagen", {
      url,
      selector: SELECTORS.pages.images,
    });
  }
  return { ...(title === "" ? {} : { title }), images };
}
