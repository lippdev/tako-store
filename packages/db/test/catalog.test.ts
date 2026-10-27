// Integração: as regras do domínio aplicadas ao catálogo de demonstração. Precisa do banco migrado e semeado
// (`npm run db:up && npm run db:migrate && npm run db:seed`); sem banco, os testes são pulados.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  listOffersForProducts,
  listProducts,
  listPublishedGames,
  listSources,
  listStores,
  closePool,
  getPool,
} from "../src/index";
import type { Game, Offer, Source, Store } from "@tako/domain";
import { cheapestOffer, discountPercent, type EligibilityContext } from "@tako/domain";

let online = false;
let games: Game[] = [];
let products: Awaited<ReturnType<typeof listProducts>> = [];
let offers: Offer[] = [];
const stores = new Map<string, Store>();
const sources = new Map<string, Source>();

function contextFor(region = "BR", currency = "BRL"): EligibilityContext {
  return { region, currency, now: new Date(), stores, sources };
}

before(async () => {
  try {
    await getPool().query("select 1 from games limit 1");
    online = true;
  } catch {
    online = false;
    return;
  }
  games = await listPublishedGames();
  products = await listProducts();
  offers = await listOffersForProducts(products.map((product) => product.id));
  for (const store of await listStores()) stores.set(store.id, store);
  for (const source of await listSources()) sources.set(source.id, source);
});

after(async () => {
  if (online) await closePool();
});

function gameId(slug: string): string {
  const game = games.find((candidate) => candidate.slug === slug);
  assert.ok(game, `jogo ${slug} não está no seed`);
  return game.id;
}

function productId(slug: string, kind: string, edition?: string): string {
  const game = gameId(slug);
  const product = products.find(
    (candidate) =>
      candidate.gameId === game &&
      candidate.kind === kind &&
      (edition === undefined || candidate.editionName === edition),
  );
  assert.ok(product, `produto ${slug}:${kind} não está no seed`);
  return product.id;
}

describe("catálogo de demonstração", () => {
  it("tem jogos, produtos e ofertas", (t) => {
    if (!online) return t.skip("sem banco");
    assert.ok(games.length >= 12);
    assert.ok(products.length >= 17);
    assert.ok(offers.length >= 30);
  });
});

describe("menor preço elegível sobre os dados reais do banco", () => {
  it("escolhe a oferta válida mais barata do jogo base", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("fenda", "base");
    const best = cheapestOffer(
      offers.filter((offer) => offer.productId === product),
      contextFor(),
    );
    // A oferta de R$ 19,90 do Bazar foi observada há 40 h e a fonte vence em 24 h: não disputa.
    assert.equal(best?.priceCents, 2_490);
    assert.equal(stores.get(best?.storeId ?? "")?.slug, "pixel-store");
  });

  it("não compara oferta em outra moeda", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("furia-de-aco", "base");
    const best = cheapestOffer(
      offers.filter((offer) => offer.productId === product),
      contextFor(),
    );
    // A oferta em USD (1.299) existe, mas não entra na comparação em BRL.
    assert.equal(best?.currency, "BRL");
    assert.equal(best?.priceCents, 6_990);
  });

  it("não mostra oferta de outra região", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("maquina-de-chuva", "base");
    const noBrazil = cheapestOffer(
      offers.filter((offer) => offer.productId === product),
      contextFor(),
    );
    assert.equal(noBrazil?.priceCents, 2_990);
    const usOnly = offers.find((offer) => offer.productId === product && offer.region === "US");
    assert.ok(usOnly, "o seed precisa manter a oferta dos EUA");
  });

  it("não mistura jogo base com edição, DLC ou pacote", (t) => {
    if (!online) return t.skip("sem banco");
    const base = productId("estacao-orbita", "base");
    const deluxe = productId("estacao-orbita", "edition", "Órbita Completa");
    const dlc = productId("estacao-orbita", "dlc");
    const bestBase = cheapestOffer(offers.filter((offer) => offer.productId === base), contextFor());
    const bestDeluxe = cheapestOffer(offers.filter((offer) => offer.productId === deluxe), contextFor());
    const bestDlc = cheapestOffer(offers.filter((offer) => offer.productId === dlc), contextFor());
    // Preço de edição é sempre maior que o do jogo base, e o da DLC, menor — e nenhum dos três se mistura.
    assert.equal(bestBase?.priceCents, 11_990);
    assert.ok(bestDeluxe !== null && bestDeluxe.priceCents > 11_990, "edição tem preço próprio e maior");
    assert.equal(bestDlc?.priceCents, 3_490);
    assert.notEqual(bestDeluxe?.productId, bestBase?.productId);
  });

  it("calcula o desconto só com referência confiável", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("jardim-de-vidro", "base");
    const best = cheapestOffer(offers.filter((offer) => offer.productId === product), contextFor());
    assert.equal(best?.priceCents, 2_990);
    assert.equal(discountPercent(best?.priceCents ?? 0, best?.referencePriceCents ?? null), 50);
  });

  it("informa ao menos uma oferta com cupom, como o seed desenha", (t) => {
    if (!online) return t.skip("sem banco");
    assert.ok(offers.some((offer) => offer.conditions.coupon !== null));
  });

  it("exclui a loja desativada", (t) => {
    if (!online) return t.skip("sem banco");
    const disabled = [...stores.values()].filter((store) => !store.enabled);
    assert.equal(disabled.length, 1);
    assert.equal(disabled[0]?.slug, "loja-antiga");
  });
});
