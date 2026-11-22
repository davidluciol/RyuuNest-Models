/** Lector: imágenes del álbum por `AlbumListOwnPictures` (50 por página), en orden de posición. */

import { MAX_PICTURE_PAGES } from "./config.js";
import { requireId } from "./details.js";
import { fail } from "./utils/errors.js";
import { graphql, imageHeaders } from "./utils/http.js";

/** `url_to_original` llega `null` sin sesión; los nombres de tamaño varían (`xMax`, `thumb_1280`), así que manda `width`. */
function urlOf(picture) {
  const widest = [...(picture.thumbnails ?? [])].filter((t) => t.url).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return picture.url_to_original ?? widest?.url;
}

export async function pages(host, chapterId) {
  const id = requireId(chapterId);
  const pictures = [];
  for (let page = 1; page <= MAX_PICTURE_PAGES; page += 1) {
    const input = { filters: [{ name: "album_id", value: id }], display: "date_newest", page };
    const list = (await graphql(host, "AlbumListOwnPictures", { input })).picture?.list;
    pictures.push(...(list?.items ?? []));
    if (list?.info?.has_next_page !== true) break;
  }
  const images = pictures
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map(urlOf)
    .filter(Boolean)
    .map((url) => ({ url, headers: imageHeaders() }));
  if (images.length === 0) throw fail("NOT_FOUND", `El álbum ${id} no tiene imágenes visibles`);
  return { images };
}
