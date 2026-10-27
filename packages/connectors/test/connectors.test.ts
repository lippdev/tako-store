import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  demoFileConnector,
  importStructured,
  parseCsv,
  suggestProduct,
  validateOfferRow,
} from "../src/index";

const valid = {
  externalId: "x-1",
  title: "Fenda",
  platform: "steam",
  priceCents: 2490,
  url: "https://loja.example/fenda",
  storeSlug: "pixel-store",
};

describe("validação da linha da fonte", () => {
  it("aceita a linha completa e assume BR/BRL", () => {
    const result = validateOfferRow(valid, 1);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.row.region, "BR");
      assert.equal(result.row.currency, "BRL");
      assert.equal(result.row.availability, "available");
    }
  });

  it("recusa sem identificador, sem título, sem loja", () => {
    assert.deepEqual(validateOfferRow({ ...valid, externalId: "" }, 1).ok, false);
    assert.deepEqual(validateOfferRow({ ...valid, title: "" }, 1).ok, false);
    assert.deepEqual(validateOfferRow({ ...valid, storeSlug: "" }, 1).ok, false);
  });

  it("recusa preço não inteiro, zero ou ausente", () => {
    for (const priceCents of [0, -10, 12.5, "12,50", null]) {
      const result = validateOfferRow({ ...valid, priceCents }, 1);
      assert.equal(result.ok, false, `deveria recusar ${String(priceCents)}`);
    }
  });

  it("recusa link que não é https", () => {
    assert.equal(validateOfferRow({ ...valid, url: "http://loja.example/x" }, 1).ok, false);
    assert.equal(validateOfferRow({ ...valid, url: "" }, 1).ok, false);
  });

  it("recusa plataforma e disponibilidade desconhecidas", () => {
    assert.equal(validateOfferRow({ ...valid, platform: "ubisoft" }, 1).ok, false);
    assert.equal(validateOfferRow({ ...valid, availability: "talvez" }, 1).ok, false);
  });
});

describe("CSV", () => {
  it("lê aspas, vírgula dentro do campo e aspas escapadas", () => {
    const { header, rows } = parseCsv('id,title,priceCents\n1,"Fenda, deluxe",2490\n2,"Diz ""oi""",100');
    assert.deepEqual(header, ["id", "title", "priceCents"]);
    assert.deepEqual(rows[0], ["1", "Fenda, deluxe", "2490"]);
    assert.deepEqual(rows[1], ["2", 'Diz "oi"', "100"]);
  });

  it("relata a linha com número errado de colunas", () => {
    const result = importStructured(
      "externalId,title,platform,priceCents,url,storeSlug\nx-1,Fenda,steam,2490,https://a.example/x,pixel-store\nx-2,Quebrada,steam",
    );
    assert.equal(result.format, "csv");
    assert.equal(result.rows.length, 1);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.line, 3);
    assert.equal(result.errors[0]?.code, "colunas");
  });
});

describe("importação estruturada", () => {
  it("separa o que entra do que é erro, com linha", () => {
    const result = importStructured(
      JSON.stringify([
        {
          externalId: "a",
          title: "Fenda",
          platform: "steam",
          priceCents: 2490,
          url: "https://x.example/a",
          storeSlug: "pixel-store",
        },
        { externalId: "b", title: "Sem preço", platform: "steam", url: "https://x.example/b", storeSlug: "pixel-store" },
      ]),
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.line, 2);
  });

  it("entende arquivo de um objeto só", () => {
    const result = importStructured(JSON.stringify(valid));
    assert.equal(result.rows.length, 1);
  });

  it("devolve erro de JSON inválido sem explodir", () => {
    const result = importStructured("{isso não é json");
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0]?.code, "json");
  });
});

describe("conector de demonstração", () => {
  it("lê o arquivo de exemplo e separa a linha inválida", async () => {
    const result = await demoFileConnector.collect({});
    // Sete linhas no arquivo: uma com preço zero é recusada, as outras seis entram.
    assert.equal(result.rows.length, 6);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors.some((error) => error.code === "preco"));
  });

  it("dá a toda linha uma data de observação", async () => {
    const now = new Date("2026-10-27T12:00:00.000Z");
    const result = await demoFileConnector.collect({ now });
    assert.ok(result.rows.every((row) => row.observedAt === now.toISOString()));
  });
});

describe("sugestão de vínculo", () => {
  const games = [{ id: "g1", title: "Estação Órbita", originalTitle: null, alternativeTitles: [] }];
  const products = [
    { id: "p-base", gameId: "g1", kind: "base" as const, editionName: null, platform: "steam" },
    { id: "p-deluxe", gameId: "g1", kind: "edition" as const, editionName: "Órbita Completa", platform: "steam" },
    { id: "p-xbox", gameId: "g1", kind: "base" as const, editionName: null, platform: "xbox" },
  ];

  it("reconhece o jogo base com confiança máxima", () => {
    const suggestion = suggestProduct({ title: "Estação Órbita", edition: null, platform: "steam" }, games, products);
    assert.equal(suggestion.productId, "p-base");
    assert.equal(suggestion.confidence, 1);
  });

  it("reconhece a edição exata", () => {
    const suggestion = suggestProduct(
      { title: "Estação Órbita", edition: "Órbita Completa", platform: "steam" },
      games,
      products,
    );
    assert.equal(suggestion.productId, "p-deluxe");
    assert.equal(suggestion.confidence, 0.95);
  });

  it("não confirma edição desconhecida", () => {
    const suggestion = suggestProduct(
      { title: "Estação Órbita", edition: "Colecionador", platform: "steam" },
      games,
      products,
    );
    assert.ok(suggestion.confidence !== null && suggestion.confidence < 0.9);
  });

  it("rebaixa quando a plataforma não confere", () => {
    const suggestion = suggestProduct({ title: "Estação Órbita", edition: null, platform: "gog" }, games, products);
    assert.ok(suggestion.confidence !== null && suggestion.confidence < 0.5);
    assert.match(suggestion.reason, /plataforma|gog|steam/);
  });

  it("não sugere nada para título desconhecido", () => {
    const suggestion = suggestProduct({ title: "Outro Jogo", edition: null, platform: "steam" }, games, products);
    assert.equal(suggestion.productId, null);
    assert.equal(suggestion.confidence, null);
  });

  it("ignora acento e caixa no título", () => {
    const suggestion = suggestProduct({ title: "estacao orbita", edition: null, platform: "steam" }, games, products);
    assert.equal(suggestion.productId, "p-base");
  });
});
