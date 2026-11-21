/** Lector: la lista de imágenes sale de `galleries/<id>.js` + `gg.js`. */

import { galleryInfo, imageUrl, loadGg } from "./gallery.js";
import { imageHeaders } from "./utils/http.js";

export async function pages(host, chapterId) {
  const [info, gg] = await Promise.all([galleryInfo(host, chapterId), loadGg(host)]);
  return {
    title: info.title ?? undefined,
    images: info.files.map((file) => ({ url: imageUrl(gg, file.hash), headers: imageHeaders() })),
  };
}
