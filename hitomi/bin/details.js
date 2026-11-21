/** Ficha: una galería es una sola entrega (un capítulo con una release). */

import { galleryInfo, loadGg } from "./gallery.js";
import { names, summaryOf } from "./catalog.js";

function genreOf(tag) {
  const prefix = tag.female ? "female:" : tag.male ? "male:" : "";
  return `${prefix}${tag.tag}`;
}

/** `2026-11-20 21:24:00-06` → ISO 8601. */
function isoDate(text) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})([+-]\d{2})$/u.exec(String(text ?? ""));
  return match === null ? undefined : `${match[1]}T${match[2]}${match[3]}:00`;
}

export async function details(host, seriesId) {
  const [info, gg] = await Promise.all([galleryInfo(host, seriesId), loadGg(host)]);
  const summary = summaryOf(info, gg);
  const extra = {};
  const put = (label, values) => {
    if (values.length > 0) extra[label] = values.join(", ");
  };
  put("Tipo", [info.type].filter(Boolean));
  put("Idioma", [info.language_localname ?? info.language].filter(Boolean));
  put("Artistas", names(info.artists, "artist"));
  put("Grupos", names(info.groups, "group"));
  put("Series", names(info.parodys, "parody"));
  put("Personajes", names(info.characters, "character"));
  extra["Páginas"] = String(info.files.length);
  const publishedAt = isoDate(info.date);
  return {
    ...summary,
    genres: (info.tags ?? []).map(genreOf),
    status: "completed",
    altTitles: info.japanese_title ? [info.japanese_title] : [],
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
