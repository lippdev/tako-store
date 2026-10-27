import test from "node:test";
import assert from "node:assert/strict";

import { applyFieldMap, collectFeed, validateFieldMap } from "../src/feed";
import { feedAddressesProblem, feedUrlProblem, setFeedHostResolver } from "../src/public-url";

const JSON_FEED = JSON.stringify({
  items: [
    { sku: "A1", nome: "As Crônicas de Vela", plataforma: "steam", preco_centavos: 7990, link: "https://loja.example/jogo/vela", loja: "pixel-store" },
    { sku: "A2", nome: "Sem preço", plataforma: "steam", link: "https://loja.example/jogo/x", loja: "pixel-store" },
  ],
});

const CSV_FEED = [
  "sku,nome,plataforma,preco_centavos,link,loja",
  "B1,Rota 9,steam,2990,https://loja.example/jogo/rota-9,pixel-store",
  "B2,Linha curta,steam",
].join("\n");

const MAP = { externalId: "sku", title: "nome", platform: "plataforma", priceCents: "preco_centavos", url: "link", storeSlug: "loja" };

function withFetch(body: string, init: { status?: number; contentType?: string; location?: string } = {}) {
  const original = globalThis.fetch;
  setFeedHostResolver(async () => ["203.0.113.10"]);
  globalThis.fetch = (async () =>
    new Response(body, {
      status: init.status ?? 200,
      headers: {
        "content-type": init.contentType ?? "application/json",
        ...(init.location === undefined ? {} : { location: init.location }),
      },
    })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
    setFeedHostResolver(null);
  };
}

test("de-para leva o campo da fonte ao nome canônico", () => {
  const mapped = applyFieldMap({ sku: "A1", preco_centavos: 7990 }, MAP);
  assert.equal(mapped["externalId"], "A1");
  assert.equal(mapped["priceCents"], 7990);
  assert.equal(mapped["sku"], "A1");
});

test("de-para com campo canônico desconhecido é recusado", () => {
  assert.deepEqual(validateFieldMap({ preco: "preco_centavos" }), ["campo canônico desconhecido: preco"]);
  assert.deepEqual(validateFieldMap({ priceCents: "  " }), ['campo "priceCents" sem nome na fonte']);
  assert.deepEqual(validateFieldMap(MAP), []);
});

test("feed JSON vira linha validada e erro por linha", async () => {
  const restore = withFetch(JSON_FEED);
  try {
    const result = await collectFeed({ url: "https://feed.example/ofertas.json", format: "auto", fieldMap: MAP });
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.externalId, "A1");
    assert.equal(result.rows[0]?.priceCents, 7990);
    assert.equal(result.rows[0]?.storeSlug, "pixel-store");
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.line, 2);
    assert.equal(result.errors[0]?.code, "preco");
  } finally {
    restore();
  }
});

test("feed CSV detecta formato e recusa linha com coluna faltando", async () => {
  const restore = withFetch(CSV_FEED, { contentType: "text/csv" });
  try {
    const result = await collectFeed({ url: "https://feed.example/ofertas.csv", format: "auto", fieldMap: MAP });
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.title, "Rota 9");
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.code, "colunas");
  } finally {
    restore();
  }
});

test("feed com status de erro vira exceção com a mensagem", async () => {
  const restore = withFetch("não autorizado", { status: 401 });
  try {
    await assert.rejects(() => collectFeed({ url: "https://feed.example/ofertas.json", format: "json", fieldMap: {} }), /401/);
  } finally {
    restore();
  }
});

test("feed recusa endereço que não é https", async () => {
  await assert.rejects(() => collectFeed({ url: "http://feed.example/ofertas.json", format: "json", fieldMap: {} }), /https/);
});

test("feed recusa rede interna antes de buscar", () => {
  assert.match(feedUrlProblem("https://127.0.0.1/feed") ?? "", /rede local/);
  assert.match(feedUrlProblem("https://169.254.169.254/latest") ?? "", /rede local/);
  assert.match(feedUrlProblem("https://2130706433/feed") ?? "", /rede local/);
  assert.match(feedUrlProblem("https://localhost/feed") ?? "", /rede local/);
  assert.match(feedUrlProblem("https://user:senha@feed.example/feed") ?? "", /usuário/);
  assert.equal(feedUrlProblem("https://feed.example/ofertas.json"), null);
  assert.match(feedAddressesProblem(["203.0.113.10", "10.0.0.8"]) ?? "", /rede local/);
  assert.equal(feedAddressesProblem(["203.0.113.10"]), null);
});

test("JSON sem lista de ofertas é recusado", async () => {
  const restore = withFetch(JSON.stringify({ mensagem: "nada aqui" }));
  try {
    const result = await collectFeed({ url: "https://feed.example/ofertas.json", format: "auto", fieldMap: {} });
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0]?.code, "formato");
  } finally {
    restore();
  }
});
