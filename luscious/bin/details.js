/** Ficha: un álbum es una sola entrega (un capítulo con una release). */

import { summaryOf, tagsOf } from "./catalog.js";
import { fail } from "./utils/errors.js";
import { graphql } from "./utils/http.js";

/** Los ids del sitio son numéricos; se validan antes de ir a la API. */
export function requireId(id) {
  const value = String(id ?? "").trim();
  if (!/^\d+$/u.test(value)) throw fail("NOT_FOUND", `Id de álbum no válido: ${value}`);
  return value;
}

export async function details(host, seriesId) {
  const id = requireId(seriesId);
  const album = (await graphql(host, "AlbumGet", { id })).album?.get;
  if (!album || album.errors?.length > 0 || album.id == null) {
    const message = album?.errors?.[0]?.message ?? "Álbum no encontrado";
    throw fail("NOT_FOUND", message, { url: `https://www.luscious.net/albums/_${id}/` });
  }
  const summary = summaryOf(album);
  const extra = {};
  const put = (label, values) => {
    if (values.length > 0) extra[label] = values.join(", ");
  };
  put("Idioma", [album.language?.title].filter(Boolean));
  put("Artistas", tagsOf(album, "Artist"));
  put("Series", tagsOf(album, "Parody"));
  put("Personajes", tagsOf(album, "Character"));
  put("Traductores", tagsOf(album, "Translator"));
  put("Tipo", [album.is_manga ? "Manga" : "Imágenes"]);
  if (album.number_of_pictures != null) extra["Páginas"] = String(album.number_of_pictures);
  const created = Number(album.created);
  const publishedAt = Number.isFinite(created) && created > 0 ? new Date(created * 1000).toISOString() : undefined;
  return {
    ...summary,
    ...(album.description ? { description: String(album.description).trim() } : {}),
    genres: [
      ...(album.genres ?? []).map((genre) => genre.title).filter(Boolean),
      ...tagsOf(album, null),
    ],
    status: "completed",
    extra,
    chapters: [
      {
        id: summary.id,
        title: summary.title,
        number: 1,
        releases: [{ id: summary.id, ...(publishedAt === undefined ? {} : { publishedAt }) }],
      },
    ],
  };
}
