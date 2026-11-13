// Prueba sin red. Necesita el parser del repo principal: RYUUNEST_REPO=<ruta al clon> node --test bin/m440.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import create from "../module.js";

const repo = process.env.RYUUNEST_REPO;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

function makeHost(requests) {
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
      const body = url.includes("/filterList") ? fixture("catalog.html")
        : url.includes("/search?") ? fixture("search.json") : fixture("home.html");
      return { status: 200, url, text: async () => body };
    },
  };
}

test("m440: home, list, filters y search con filtros", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(requests));

  const { sections } = await mod.home();
  assert.deepEqual(sections.map((s) => s.id), ["popular", "latest", "views", "az"]);
  assert.equal(sections[0].items[0].id, "/manga/serie-falsa-uno");
  assert.equal(sections[2].items.length, 2);
  assert.equal(sections[2].hasNext, true);
  assert.ok(requests.some((u) => u.includes("sortBy=views") && u.includes("asc=false")));

  const more = await mod.list("views", 2);
  assert.ok(requests.at(-1).includes("page=2"));
  assert.equal(more.items[1].title, "Serie Falsa Dos");

  const filters = await mod.filters();
  assert.deepEqual(filters.map((f) => f.id), ["cat", "alpha", "sort"]);

  await mod.search("", 1, { cat: "25", sort: "views" });
  assert.ok(requests.at(-1).includes("cat=25"));

  const byText = await mod.search("serie", 1, { cat: "25" }); // Shounen = 25
  assert.equal(byText.items.length, 1);
  assert.equal((await mod.search("serie", 1, { cat: "1" })).items.length, 0); // Action
});
