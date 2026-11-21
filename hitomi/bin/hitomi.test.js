// Prueba sin red (fixtures inventadas): node --test hitomi/bin/hitomi.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import create from "../module.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
// 0x00B0E100 tiene bytes ≥ 0x80: `text()` los destrozaría, `bytes()` no.
const IDS = [9000001, 0x00b0e100];

function nozomi(ids) {
  const bytes = new Uint8Array(ids.length * 4);
  ids.forEach((id, i) => new DataView(bytes.buffer).setUint32(i * 4, id));
  return bytes;
}

function makeHost(requests, { honorRange = true } = {}) {
  return {
    fetch: async (url, init = {}) => {
      requests.push({ url, headers: init.headers });
      if (url.endsWith(".nozomi")) {
        if (url.includes("/tag/nada-")) return { status: 404, text: async () => "", bytes: async () => new Uint8Array() };
        const body = nozomi(IDS);
        const range = /bytes=(\d+)-(\d+)/u.exec(init.headers?.Range ?? "");
        if (range === null || Number(range[1]) >= body.length) return { status: 416, text: async () => "", bytes: async () => new Uint8Array() };
        return honorRange
          ? { status: 206, text: async () => "", bytes: async () => body.subarray(Number(range[1]), Number(range[2]) + 1) }
          : { status: 200, text: async () => "", bytes: async () => body };
      }
      const text = url.endsWith("gg.js") ? fixture("gg.js") : fixture("gallery.js");
      return { status: 200, text: async () => text };
    },
  };
}

test("hitomi: latest lee IDs binarios y arma tarjetas", async () => {
  const requests = [];
  const { items, hasNext } = await create(makeHost(requests)).latest(1);
  assert.equal(requests[0].url, "https://ltn.gold-usergeneratedcontent.net/index-spanish.nozomi");
  assert.equal(requests[0].headers.Range, "bytes=0-95");
  assert.equal(requests[0].headers.Referer, "https://hitomi.la/");
  assert.ok(requests.some((r) => r.url.endsWith("/galleries/11591936.js")), "ID con bytes altos intacto");
  assert.equal(items.length, 2);
  assert.equal(hasNext, false);
  assert.equal(items[0].title, "Libro Falso");
  assert.equal(items[0].hint, "autor falso");
  assert.equal(
    items[0].cover.url,
    "https://btn.gold-usergeneratedcontent.net/webpbigtn/c/bd/1111111111111111111111111111111111111111111111111111111111111bdc.webp",
  );
  assert.equal(items[0].cover.headers.Referer, "https://hitomi.la/");
});

test("hitomi: si el servidor ignora Range se recorta la lista entera", async () => {
  const { items } = await create(makeHost([], { honorRange: false })).popular(1);
  assert.equal(items.length, 2);
  assert.equal((await create(makeHost([], { honorRange: false })).popular(2)).items.length, 0);
});

test("hitomi: search por namespace, tipo, filtros y lista inexistente", async () => {
  const requests = [];
  const mod = create(makeHost(requests));
  await mod.search("female:yuri", 1, { language: "all" });
  assert.ok(requests[0].url.endsWith("/tag/female%3Ayuri-all.nozomi"));
  await mod.search("artist:autor_falso", 1, {});
  assert.ok(requests.some((r) => r.url.endsWith("/artist/autor%20falso-spanish.nozomi")));
  await mod.search("", 1, { type: "doujinshi", language: "english" });
  assert.ok(requests.some((r) => r.url.endsWith("/type/doujinshi-english.nozomi")));
  assert.deepEqual(await mod.search("nada", 1, {}), { items: [], hasNext: false });
  assert.equal((await mod.search("", 2, {})).items.length, 0); // 416
});

test("hitomi: home, list y filters", async () => {
  const mod = create(makeHost([]));
  const { sections } = await mod.home();
  assert.deepEqual(sections.map((s) => s.id), ["new", "week"]);
  assert.equal((await mod.list("month", 1)).items.length, 2);
  assert.deepEqual((await mod.filters()).map((f) => f.id), ["language", "order", "type"]);
});

test("hitomi: details y pages", async () => {
  const mod = create(makeHost([]));
  const series = await mod.details("9000001");
  assert.deepEqual(series.genres, ["female:yuri", "full color"]);
  assert.equal(series.extra["Páginas"], "2");
  assert.equal(series.altTitles[0], "架空の本");
  assert.equal(series.chapters[0].releases[0].publishedAt, "2026-11-20T21:24:00-06:00");
  const { images } = await mod.pages("9000001");
  assert.deepEqual(images.map((i) => i.url), [
    "https://w2.gold-usergeneratedcontent.net/1700000000/3261/1111111111111111111111111111111111111111111111111111111111111bdc.webp",
    "https://w1.gold-usergeneratedcontent.net/1700000000/416/2222222222222222222222222222222222222222222222222222222222222a01.webp",
  ]);
  assert.equal(images[0].headers.Referer, "https://hitomi.la/");
});

test("hitomi: errores tipados", async () => {
  const mod = create({ fetch: async () => ({ status: 404, text: async () => "" }) });
  await assert.rejects(() => mod.details("9000001"), { name: "ModuleError", code: "NOT_FOUND" });
  await assert.rejects(() => mod.details("abc"), { code: "NOT_FOUND" });
  const old = create({ fetch: async () => ({ status: 206, text: async () => "" }) });
  await assert.rejects(() => old.latest(1), { code: "UNSUPPORTED" });
});
