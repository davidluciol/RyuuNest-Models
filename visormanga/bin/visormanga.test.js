// Prueba sin red (fixtures inventadas). Necesita el parser del repo principal:
// RYUUNEST_REPO=<ruta absoluta al clon> node --test visormanga/bin/visormanga.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import create from "../module.js";

const repo = process.env.RYUUNEST_REPO;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const reply = (status, text) => ({ status, headers: {}, text: async () => text });
const IMAGE_HEADERS = {
  Referer: "https://visormanga.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};
const cover = (url) => ({ url, headers: IMAGE_HEADERS });

/** `route(url)` devuelve la respuesta; cada petición queda en `requests`. */
function makeHost(route, requests = []) {
  const require = createRequire(`${repo}/packages/core/package.json`);
  const { parseDocument } = require("htmlparser2");
  const { selectAll } = require("css-select");
  const textOf = (n) => (n.type === "text" ? n.data : (n.children ?? []).map(textOf).join(""));
  const view = (node) => ({
    attr: (name) => node.attribs?.[name],
    text: () => textOf(node),
    select: (selector) => selectAll(selector, node).map(view),
  });
  return {
    html: (text) => view(parseDocument(text, { decodeEntities: true })),
    fetch: async (url, init = {}) => {
      requests.push({ url, headers: init.headers });
      return { url, ...(await route(url)) };
    },
  };
}

test("visormanga: popular lee la biblioteca sin la barra lateral ni enlaces ajenos", { skip: !repo }, async () => {
  const requests = [];
  const { items, hasNext } = await create(makeHost(() => reply(200, fixture("library.html")), requests)).popular(1);
  assert.equal(requests[0].url, "https://visormanga.com/biblioteca");
  assert.equal(requests[0].headers["Accept-Language"], "es-ES,es;q=0.9");
  assert.equal(hasNext, true);
  assert.deepEqual(items, [
    { id: "serie-inventada-uno", title: "Serie Inventada Uno & Cia", cover: cover("https://thumbs.visormanga.com/cover/serie-inventada-uno.jpg"), hint: "Manhwa" },
    { id: "serie-inventada-2", title: "Serie Inventada 2" },
  ]);
});

test("visormanga: hasNext solo si el paginador enlaza a la página siguiente", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("library.html")), requests));
  assert.equal((await mod.popular(2)).hasNext, false);
  assert.equal((await mod.list("library", "x")).hasNext, true);
  assert.deepEqual((await create(makeHost(() => reply(200, fixture("empty.html")))).popular(9999)), { items: [], hasNext: false });
  assert.deepEqual(requests.map((r) => r.url), ["https://visormanga.com/biblioteca?page=2", "https://visormanga.com/biblioteca"]);
});

test("visormanga: buscador por texto o, si hay género válido, por su ruta sin texto", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("library.html")), requests));
  await mod.search(" amor & odio ", 2);
  await mod.search("amor", 3, { genre: "boys-love" });
  await mod.search("amor", 1, { genre: "../admin" });
  assert.deepEqual(requests.map((r) => r.url), [
    "https://visormanga.com/biblioteca?search=amor+%26+odio&page=2",
    "https://visormanga.com/genero/boys-love?page=3",
    "https://visormanga.com/biblioteca?search=amor",
  ]);
});

test("visormanga: latest saca la serie del slug del capítulo y quita duplicados", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("home.html")), requests));
  assert.deepEqual(await mod.latest(1), {
    hasNext: false,
    items: [
      { id: "serie-inventada-uno", title: "Serie Inventada Uno", cover: cover("https://thumbs.visormanga.com/cover/bbb222.jpg"), hint: "Capítulo 12.50" },
      { id: "otra-2", title: "Otra 2" },
    ],
  });
  assert.deepEqual(await mod.latest(2), { items: [], hasNext: false });
  assert.deepEqual((await mod.list("new", 1)).items, [{ id: "nueva-inventada", title: "Nueva Inventada", hint: "Manga" }]);
  assert.equal(requests.length, 2);
});

test("visormanga: home arma 4 secciones con dos peticiones", { skip: !repo }, async () => {
  const requests = [];
  const route = (url) => reply(200, fixture(url === "https://visormanga.com/" ? "home.html" : "library.html"));
  const { sections } = await create(makeHost(route, requests)).home();
  assert.deepEqual(requests.map((r) => r.url).sort(), ["https://visormanga.com/", "https://visormanga.com/biblioteca"]);
  assert.deepEqual(sections.map((s) => [s.id, s.kind, s.items.length, s.hasNext]), [
    ["chapters", "list", 2, false],
    ["new", "list", 1, false],
    ["popular", "list", 1, false],
    ["library", "list", 2, true],
  ]);
  assert.deepEqual(sections[2].items[0], { id: "popular-inventada", title: "Popular Inventada", cover: cover("https://thumbs.visormanga.com/cover/aaa111.jpg") });
});

test("visormanga: details quita el año del título y lo pone en la descripción", { skip: !repo }, async () => {
  const requests = [];
  const series = await create(makeHost(() => reply(200, fixture("details.html")), requests)).details("serie-inventada-uno");
  assert.equal(requests[0].url, "https://visormanga.com/manga/serie-inventada-uno");
  assert.deepEqual(series, {
    id: "serie-inventada-uno",
    title: "Serie Inventada Uno",
    cover: cover("https://thumbs.visormanga.com/cover/serie-inventada-uno.jpg"),
    nsfw: true,
    hint: "Manhwa",
    description: "Año: 2031\n\nUna historia inventada para pruebas.",
    genres: ["Acción", "Drama"],
    status: "unknown",
    altTitles: [],
    extra: { Tipo: "Manhwa" },
    chapters: [
      { id: "serie-inventada-uno-12.50", title: "Capítulo 12.50", number: 12.5, releases: [{ id: "serie-inventada-uno-12.50" }] },
      { id: "serie-inventada-uno-1.00", title: "Capítulo 1.00", number: 1, releases: [{ id: "serie-inventada-uno-1.00" }] },
    ],
  });
  const plain = await create(makeHost(() => reply(200, fixture("details-no-year.html")))).details("serie-sin-ano");
  assert.equal(plain.title, "Serie Sin Año");
  assert.equal(plain.description, undefined);
  assert.deepEqual(plain.chapters, []);
});

test("visormanga: errores tipados de details", { skip: !repo }, async () => {
  const requests = [];
  const notFound = create(makeHost(() => reply(404, "<html></html>"), requests));
  await assert.rejects(notFound.details("no-existe"), { code: "NOT_FOUND" });
  await assert.rejects(notFound.details("../x"), { code: "NOT_FOUND" });
  assert.equal(requests.length, 1);
  await assert.rejects(create(makeHost(() => reply(200, fixture("empty.html")))).details("algo"), { code: "PARSE" });
  await assert.rejects(create(makeHost(() => reply(429, ""))).details("algo"), { code: "RATE_LIMITED" });
  await assert.rejects(create(makeHost(() => reply(403, ""))).popular(1), { code: "BLOCKED" });
});

test("visormanga: pages lee data-src y descarta el GIF de carga y hosts ajenos", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("reader.html")), requests));
  assert.deepEqual(await mod.pages("serie-inventada-uno-12.50"), {
    images: [
      { url: "https://v2.imgvtmo.com/tmpimg/inv12-01.jpg", headers: IMAGE_HEADERS },
      { url: "https://v2.imgvtmo.com/tmpimg/inv12-02.jpg", headers: IMAGE_HEADERS },
    ],
  });
  assert.equal(requests[0].url, "https://visormanga.com/leer/serie-inventada-uno-12.50");
  await assert.rejects(mod.pages("sin-numero"), { code: "NOT_FOUND" });
  await assert.rejects(create(makeHost(() => reply(200, fixture("empty.html")))).pages("serie-1.00"), { code: "PARSE" });
  await assert.rejects(create(makeHost(() => reply(404, ""))).pages("serie-1.00"), { code: "NOT_FOUND" });
});

test("visormanga: lector sin imágenes da NOT_FOUND con mensaje claro, sin más peticiones", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("reader-empty.html")), requests));
  await assert.rejects(mod.pages("serie-inventada-cero-3.00"), { code: "NOT_FOUND", message: "El sitio no tiene imágenes para este capítulo" });
  assert.equal(requests.length, 1);
});

test("visormanga: filters expone el select de géneros", async () => {
  const [genre] = await create({}).filters();
  assert.equal(genre.id, "genre");
  assert.equal(genre.type, "select");
  assert.equal(genre.options.length, 48);
  assert.deepEqual(genre.options[0], { value: "accion", label: "Acción" });
});
