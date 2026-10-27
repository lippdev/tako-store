import test from "node:test";
import assert from "node:assert/strict";

import { currentAsset, galleryAssets, parseMediaUrl, type MediaAsset } from "../src/media";

const asset = (overrides: Partial<MediaAsset> & Pick<MediaAsset, "id" | "kind" | "url">): MediaAsset => ({
  gameId: "jogo-1",
  origin: "Imprensa da distribuidora",
  attribution: null,
  position: 0,
  createdAt: "2026-10-01T12:00:00.000Z",
  ...overrides,
});

test("aceita endereço https", () => {
  assert.deepEqual(parseMediaUrl("https://cdn.exemplo.com/capa.png"), {
    ok: true,
    url: "https://cdn.exemplo.com/capa.png",
  });
});

test("aceita caminho interno do catálogo de demonstração", () => {
  assert.deepEqual(parseMediaUrl("/covers/fenda.svg"), { ok: true, url: "/covers/fenda.svg" });
});

test("recusa http, javascript e data", () => {
  assert.equal(parseMediaUrl("http://exemplo.com/capa.png").ok, false);
  assert.equal(parseMediaUrl("javascript:alert(1)").ok, false);
  assert.equal(parseMediaUrl("data:image/png;base64,AAA").ok, false);
  assert.equal(parseMediaUrl("//exemplo.com/capa.png").ok, false);
});

test("recusa endereço vazio ou inválido", () => {
  assert.equal(parseMediaUrl("   ").ok, false);
  assert.equal(parseMediaUrl("capa.png").ok, false);
});

test("galeria mostra só capturas, na ordem da biblioteca", () => {
  const assets = [
    asset({ id: "a", kind: "screenshot", url: "/1.svg", position: 2 }),
    asset({ id: "b", kind: "cover", url: "/c.svg" }),
    asset({ id: "c", kind: "screenshot", url: "/2.svg", position: 1 }),
  ];

  assert.deepEqual(
    galleryAssets(assets).map((item) => item.url),
    ["/2.svg", "/1.svg"],
  );
});

test("imagem vigente é a mais recente do tipo", () => {
  const assets = [
    asset({ id: "antiga", kind: "cover", url: "/velha.svg", createdAt: "2026-01-01T00:00:00.000Z" }),
    asset({ id: "nova", kind: "cover", url: "/nova.svg", createdAt: "2026-06-01T00:00:00.000Z" }),
  ];

  assert.equal(currentAsset(assets, "cover")?.id, "nova");
  assert.equal(currentAsset(assets, "hero"), null);
});
