// Prueba sin red. Necesita el parser del repo principal: RYUUNEST_REPO=<ruta al clon> node --test bin/zonatmo.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import create from "../module.js";

const repo = process.env.RYUUNEST_REPO;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

function makeHost(requests, { orgDown = false } = {}) {
  const require = createRequire(`${repo}/packages/core/package.json`);
  const { parseDocument } = require("htmlparser2");
  const { selectAll } = require("css-select");
  return {
    html: (text) => {
      const root = parseDocument(text);
      const textOf = (n) => (n.type === "text" ? n.data : (n.children ?? []).map(textOf).join(""));
      const view = (node) => ({
        attr: (name) => node.attribs?.[name],
        text: () => textOf(node),
        select: (selector) => selectAll(selector, node).map(view),
      });
      return view(root);
    },
    fetch: async (url) => {
      requests.push(url);
      if (url.startsWith("https://zonatmo.org") && orgDown) return { status: 403, url, text: async () => "" };
      const body = url.includes("/wp-api/api/listing") ? fixture("mirror-listing.json")
        : url.includes("/seventi-manga/v1/manga/") ? fixture("mirror-manga.json")
        : url.includes("/chapters?") ? fixture("mirror-chapters.json")
        : url.includes("/single/manga/serie-espejo-uno/") ? fixture("mirror-chapter.json")
        : url.includes("/single/manga/") ? fixture("mirror-single.json")
        : fixture("library.html");
      return { status: 200, url, text: async () => body };
    },
  };
}

test("zonatmo: home, list, filters y search con filtros (sitio principal)", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(requests));

  const { sections } = await mod.home();
  assert.deepEqual(sections.map((s) => s.id), ["popular", "latest", "top"]);
  assert.equal(sections[0].items[0].id, "/library/manhwa/9001/serie-falsa-uno");
  assert.equal(sections[0].hasNext, true);
  assert.ok(requests[1].includes("order_item=creation"));

  await mod.list("top", 2);
  assert.ok(requests.at(-1).includes("order_item=score") && requests.at(-1).includes("page=2"));

  assert.deepEqual((await mod.filters()).map((f) => f.id), ["sort", "type", "demography", "status", "genre", "content"]);

  await mod.search("", 1, { type: "manhwa", genre: "3", content: "sfw", status: "nope" });
  const url = decodeURIComponent(requests.at(-1));
  assert.ok(url.includes("type=manhwa") && url.includes("genders[]=3") && url.includes("exclude_genders[]=27"));
  assert.ok(!url.includes("status=") && !url.includes("title="));

  assert.deepEqual(await mod.search("", 1, {}), { items: [], hasNext: false });
  await mod.search("falsa", 1);
  assert.ok(requests.at(-1).includes("title=falsa"));
});

test("zonatmo: si el sitio principal falla, responde el espejo", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(requests, { orgDown: true }));

  const result = await mod.search("espejo", 1, { type: "manhwa", genre: "4", content: "sfw" });
  assert.equal(result.items[0].id, "/manga/9101/serie-espejo-uno");
  assert.equal(result.items[0].kind, "manhwa");
  assert.equal(result.items[1].badges.includes("+18"), true);
  assert.equal(result.hasNext, true);
  const url = requests.at(-1);
  assert.ok(url.startsWith("https://zonatmo.to/wp-api/api/listing/manga?"));
  assert.ok(url.includes("type=87") && url.includes("genres=15") && url.includes("erotic=0") && url.includes("search=espejo"));

  const info = await mod.details("/manga/9101/serie-espejo-uno");
  assert.equal(info.cover.url, "https://zonatmo.to/wp-content/uploads/2026/01/serie-espejo-uno.webp");
  assert.equal(info.status, "completed");
  assert.deepEqual(info.genres, ["Comedia", "Drama"]);
  assert.equal(info.chapters.length, 2);
  assert.equal(info.chapters[0].releases.length, 2);
  assert.equal(info.chapters[0].releases[0].id, "/manga/9101/serie-espejo-uno/serie-espejo-uno-capitulo-2b");

  const { images } = await mod.pages("x", "/manga/9101/serie-espejo-uno/serie-espejo-uno-capitulo-2");
  assert.deepEqual(images.map((i) => i.url), [
    "https://cdn.zonatmo.to/manga/llaveManga_x_1/llaveCapitulo_x_2/page_0001.webp",
    "https://cdn.zonatmo.to/manga/llaveManga_x_1/llaveCapitulo_x_2/page_0002.webp",
  ]);
  await assert.rejects(mod.pages("x", "/manga/9101/../x"), { code: "NOT_FOUND" });
});

test("zonatmo: un 404 del sitio principal no salta al espejo", { skip: !repo }, async () => {
  const requests = [];
  const host = makeHost(requests);
  const real = host.fetch;
  host.fetch = async (url) => (url.includes("/biblioteca") ? { status: 404, url, text: async () => "" } : real(url));
  await assert.rejects(create(host).popular(1), { code: "NOT_FOUND" });
  assert.equal(requests.length, 0);
});
