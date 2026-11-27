/** Lector: imágenes del álbum por `AlbumListOwnPictures` (50 por página), en orden de posición. */

import { PICTURE_LIST_CAP, PICTURE_PAGES_PER_ORDER } from "./config.js";
import { requireId } from "./details.js";
import { fail } from "./utils/errors.js";
import { graphql, imageHeaders } from "./utils/http.js";

/** `url_to_original` llega `null` sin sesión; los nombres de tamaño varían (`xMax`, `thumb_1280`), así que manda `width`. */
function urlOf(picture) {
  const widest = [...(picture.thumbnails ?? [])].filter((t) => t.url).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return picture.url_to_original ?? widest?.url;
}

/** Añade a `seen` (por id) las imágenes en orden `display`; con `untilOverlap` para al toparse con una ya vista. */
async function collect(host, id, display, seen, untilOverlap) {
  for (let page = 1; page <= PICTURE_PAGES_PER_ORDER; page += 1) {
    const input = { filters: [{ name: "album_id", value: id }], display, page };
    const list = (await graphql(host, "AlbumListOwnPictures", { input })).picture?.list;
    let overlap = false;
    for (const picture of list?.items ?? []) {
      if (seen.has(picture.id)) overlap = true;
      else seen.set(picture.id, picture);
    }
    if ((untilOverlap && overlap) || list?.info?.has_next_page !== true) return;
  }
}

export async function pages(host, chapterId) {
  const id = requireId(chapterId);
  const seen = new Map();
  await collect(host, id, "date_newest", seen, false);
  // El API anónimo corta cada orden en 1000 imágenes: el resto (hasta 2000) sale del orden contrario.
  if (seen.size >= PICTURE_LIST_CAP) await collect(host, id, "date_oldest", seen, true);
  const images = [...seen.values()]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map(urlOf)
    .filter(Boolean)
    .map((url) => ({ url, headers: imageHeaders() }));
  if (images.length === 0) throw fail("NOT_FOUND", `El álbum ${id} no tiene imágenes visibles`);
  return { images };
}
