import test from "node:test";
import assert from "node:assert/strict";

import {
  capaDeBiblioteca,
  pecaDaBiblioteca,
  pecaDeArteMelhor,
  steamConnector,
  steamAppDetails,
  steamFeaturedItems,
  steamRefresh,
  steamRow,
} from "../src/steam";

const APPDETALHES = {
  "42420": {
    success: true,
    data: {
      type: "game",
      name: "Celebration of Life",
      price_overview: { currency: "BRL", initial: 1999, final: 999 },
      header_image: "https://shared.akamai.steamstatic.com/header.jpg",
      short_description: "<p>Uma jornada breve sobre memória.</p>",
      genres: [{ description: "Puzzle" }],
      platforms: { windows: true, mac: false, linux: false },
    },
  },
  "620": {
    success: true,
    data: {
      type: "game",
      name: "Portal 2",
      price_overview: { currency: "BRL", initial: 2999, final: 499 },
      header_image: "https://shared.akamai.steamstatic.com/portal.jpg",
      short_description: "Física de portais.",
      genres: [],
      platforms: { windows: true, mac: true, linux: true },
    },
  },
};

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
  assert.ok(items.every((item) => item.final_price !== null));
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

test("capa do cartão vem da biblioteca (2:3) quando a peça existe", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url, init) =>
    init?.method === "HEAD"
      ? new Response(null, { status: 200 })
      : new Response(JSON.stringify(FEATURED), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const result = await steamConnector.collect({ now: new Date("2026-10-28T12:00:00.000Z") });
    assert.equal(
      result.rows.find((row) => row.externalId === "4115450")?.coverUrl,
      capaDeBiblioteca(4115450),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("sem arte de biblioteca, a capa é a da vitrine", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url, init) =>
    init?.method === "HEAD"
      ? new Response(null, { status: 404 })
      : new Response(JSON.stringify(FEATURED), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const result = await steamConnector.collect({ now: new Date("2026-10-28T12:00:00.000Z") });
    assert.equal(
      result.rows.find((row) => row.externalId === "4115450")?.coverUrl,
      "https://shared.akamai.steamstatic.com/header.jpg",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("atualização reconsulta os apps dados e recusa o sem preço sem parar", async () => {
  const original = globalThis.fetch;
  const pedidos: string[] = [];
  globalThis.fetch = (async (url, init) => {
    const endereco = String(url);
    if (init?.method !== "HEAD") pedidos.push(endereco);
    const appid = endereco.match(/appids=(\d+)/)?.[1] ?? "";
    if (init?.method === "HEAD") return new Response(null, { status: 200 });
    if (appid === "42420") return new Response(JSON.stringify({ "42420": APPDETALHES["42420"] }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ "620": { success: true, data: { type: "game", name: "Sem preço", price_overview: { currency: "BRL", initial: 0, final: 0 } } } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await steamRefresh([42420, 620], 1);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.externalId, "42420");
    // o sem preço é recusa silenciosa (gratuito é esperado), e a passada não para por isso
    assert.deepEqual(result.errors, []);
    assert.equal(pedidos.length, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("herói do banner usa a faixa de herói da biblioteca, não a peça retrata de grade", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    const endereco = String(url);
    if (init?.method === "HEAD") return new Response(null, { status: 200 });
    const appid = endereco.match(/appids=(\d+)/)?.[1] ?? "";
    return new Response(JSON.stringify({ [appid]: (APPDETALHES as Record<string, unknown>)[appid] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const resultado = await steamAppDetails(42420);
    assert.ok(resultado.ok);
    // 1920×620 da biblioteca entra sem recorte na faixa do banner; a cabeça pequena da vitrine não
    assert.equal(resultado.row["heroUrl"], pecaDaBiblioteca(42420, "library_hero"));
  } finally {
    globalThis.fetch = original;
  }
});

test("sem a faixa de herói, a cabeça da biblioteca cobre; sem nenhuma, a da vitrine fica de reserva", async () => {
  const original = globalThis.fetch;
  let temCabeca = true;
  globalThis.fetch = (async (url, init) => {
    const endereco = String(url);
    if (init?.method === "HEAD") {
      if (endereco.includes("library_hero")) return new Response(null, { status: 404 });
      return new Response(null, { status: temCabeca ? 200 : 404 });
    }
    const appid = endereco.match(/appids=(\d+)/)?.[1] ?? "";
    return new Response(JSON.stringify({ [appid]: (APPDETALHES as Record<string, unknown>)[appid] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const comCabeca = await steamAppDetails(42420);
    assert.ok(comCabeca.ok);
    assert.equal(comCabeca.row["heroUrl"], pecaDaBiblioteca(42420, "library_header"));
    temCabeca = false;
    const semNada = await steamAppDetails(42420);
    assert.ok(semNada.ok);
    assert.equal(semNada.row["heroUrl"], "https://shared.akamai.steamstatic.com/header.jpg");
  } finally {
    globalThis.fetch = original;
  }
});

test("limite da vitrine para a passada de atualização", async () => {
  const original = globalThis.fetch;
  const pedidos: string[] = [];
  globalThis.fetch = (async (url, init) => {
    const endereco = String(url);
    if (init?.method !== "HEAD") pedidos.push(endereco);
    if (init?.method === "HEAD") return new Response(null, { status: 200 });
    if (pedidos.length === 1) return new Response("lento", { status: 429 });
    return new Response(JSON.stringify(APPDETALHES["620"]), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await steamRefresh([620, 42420], 1);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.errors.map((error) => error.code), ["limite"]);
    // parou no primeiro: o segundo app não foi consultado
    assert.equal(pedidos.filter((pedido) => pedido.includes("appdetails")).length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("a arte do catálogo só melhora: nunca rebaixa e não toca em arte manual", () => {
  const capa = capaDeBiblioteca(42420);
  const faixa = pecaDaBiblioteca(42420, "library_hero");
  const cabeca = pecaDaBiblioteca(42420, "library_header");
  const vitrine = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42420/hash/header.jpg";
  // preenche o que falta
  assert.equal(pecaDeArteMelhor(null, faixa), true);
  // promove a reserva para a peça própria
  assert.equal(pecaDeArteMelhor(vitrine, faixa), true);
  assert.equal(pecaDeArteMelhor(vitrine, cabeca), true);
  // nunca rebaixa — falha passageira de rede não piora o que já está gravado
  assert.equal(pecaDeArteMelhor(faixa, vitrine), false);
  assert.equal(pecaDeArteMelhor(cabeca, vitrine), false);
  assert.equal(pecaDeArteMelhor(faixa, cabeca), false);
  // arte que não é da Steam (escolha manual no painel) fica intocada
  assert.equal(pecaDeArteMelhor("https://meu-cdn.exemplo/capa.jpg", faixa), false);
  // sem peça nova, nada muda
  assert.equal(pecaDeArteMelhor(null, null), false);
  assert.equal(pecaDeArteMelhor(capa, ""), false);
});
