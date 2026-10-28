import test from "node:test";
import assert from "node:assert/strict";

import { steamConnector, steamFeaturedItems, steamRow } from "../src/steam";

const FEATURED = {
  top_sellers: {
    id: "top_sellers",
    items: [
      {
        id: 4115450,
        type: 0,
        name: "Phantom Blade Zero",
        discounted: false,
        discount_percent: 0,
        original_price: 22990,
        final_price: 22990,
        currency: "BRL",
        header_image: "https://shared.akamai.steamstatic.com/header.jpg",
      },
      { id: 599999, name: "Sem preço", discounted: false, final_price: 0, currency: "BRL" },
      { id: 599998, name: "Em dólar", discounted: false, final_price: 1999, currency: "USD" },
    ],
  },
  specials: {
    id: "specials",
    items: [
      {
        id: 3240220,
        name: "Grand Theft Auto V Enhanced",
        discounted: true,
        discount_percent: 50,
        original_price: 14990,
        final_price: 7495,
        currency: "BRL",
        header_image: "https://shared.akamai.steamstatic.com/gta.jpg",
      },
      // repetido do top_sellers: entra uma vez só
      { id: 4115450, name: "Phantom Blade Zero", discounted: false, original_price: 22990, final_price: 22990, currency: "BRL" },
    ],
  },
  new_releases: { id: "new_releases", items: [] },
  coming_soon: { id: "coming_soon", items: [{ id: 4971900, name: "Em breve", final_price: 0, currency: "BRL" }] },
};

test("lista plana das categorias que vendem, sem spotlights nem em breve", () => {
  const items = steamFeaturedItems(FEATURED);
  assert.equal(items.length, 5);
  assert.ok(items.every((item) => !["coming_soon"].includes("")));
});

test("linha da vitrine vira oferta validada com desconto e capa", () => {
  const rows = steamFeaturedItems(FEATURED);
  const oferta = steamRow(rows[0]!, "2026-10-28T12:00:00.000Z");
  assert.equal(oferta["externalId"], "4115450");
  assert.equal(oferta["priceCents"], 22990);
  assert.equal(oferta["referencePriceCents"], null);
  assert.equal(oferta["storeSlug"], "steam");
  const gta = rows.find((item) => item.name === "Grand Theft Auto V Enhanced");
  const desconto = steamRow(gta!, "2026-10-28T12:00:00.000Z");
  assert.equal(desconto["priceCents"], 7495);
  assert.equal(desconto["referencePriceCents"], 14990);
  assert.equal(desconto["coverUrl"], "https://shared.akamai.steamstatic.com/gta.jpg");
});

test("coleta deduplica e recusa o que não é oferta com o motivo", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(FEATURED), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const result = await steamConnector.collect({ now: new Date("2026-10-28T12:00:00.000Z") });
    // 5 itens da lista; o em dólar e o sem preço são recusados; o repetido não entra duas vezes
    assert.equal(result.rows.length, 2);
    assert.deepEqual(
      result.errors.map((error) => error.code).sort(),
      ["moeda", "sem-preco"].sort(),
    );
    assert.equal(result.rows[0]?.observedAt, "2026-10-28T12:00:00.000Z");
  } finally {
    globalThis.fetch = original;
  }
});

test("falha da Steam vira erro com mensagem, não exceção crua", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response("fora do ar", { status: 503 })) as typeof fetch;
  try {
    await assert.rejects(() => steamConnector.collect({}), /503/);
  } finally {
    globalThis.fetch = original;
  }
});
