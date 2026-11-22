// Prueba sin red. Necesita el parser del repo principal: RYUUNEST_REPO=<ruta al clon> node --test bin/m440.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
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
        : url.includes("/search?") ? fixture("search.json")
        : /\/manga\/[^/]+\/[^/]+$/u.test(url) ? fixture("chapter.html")
        : /\/manga\/[^/]+$/u.test(url) ? fixture("series.html") : fixture("home.html");
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

// Arnés del repo principal (`pnpm --filter @ryuunest/test-site build`): una release por capítulo.
test("m440: arnés de contrato con fixtures propias", { skip: !repo }, async () => {
  const { runContract } = await import(pathToFileURL(`${repo}/packages/test-site/dist/index.js`).href);
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const report = await runContract(create(makeHost([])), {
    capabilities: manifest.capabilities,
    seriesId: "/manga/serie-falsa-uno",
    chapterId: "/manga/serie-falsa-uno/2-fake2",
    releaseIds: ["/manga/serie-falsa-uno/2-fake2"],
    searchQuery: "serie",
    estimatedHasNext: true,
    singleReleasePerChapter: true,
    expectImageHeaders: { Referer: "https://m440.in/" },
  });
  assert.deepEqual(report.methods, ["popular", "latest", "search", "details", "pages"]);
  assert.deepEqual(report.imageCounts, [3]);
});

// T42: el host corta con TIMEOUT genérico; el módulo explica que el sitio es intermitente.
test("m440: un TIMEOUT del host se explica como sitio intermitente", { skip: !repo }, async () => {
  const host = makeHost([]);
  host.fetch = async (url) => {
    const error = new Error(`Tiempo límite agotado: ${url}`);
    error.name = "ModuleError";
    error.code = "TIMEOUT";
    throw error;
  };
  await assert.rejects(create(host).popular(), (error) => {
    assert.equal(error.code, "TIMEOUT");
    assert.match(error.message, /intermitente/u);
    return true;
  });
});

// G6: m440 responde 403 a peticiones separadas ~250 ms (POCO, 2026-11-21/22); pide 600 ms.
test("m440: el manifest declara una pausa de 600 ms que la app acepta", { skip: !repo }, async () => {
  const { validateManifest } = await import(pathToFileURL(`${repo}/packages/module-sdk/dist/index.js`).href);
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.network?.minDelayMs, 600);
  assert.deepEqual(validateManifest(manifest).ok, true);
});

test("m440: un 403 del sitio es BLOCKED", { skip: !repo }, async () => {
  const host = makeHost([]);
  host.fetch = async (url) => ({ status: 403, url, text: async () => "" });
  await assert.rejects(create(host).popular(), (error) => {
    assert.equal(error.code, "BLOCKED");
    return true;
  });
});
