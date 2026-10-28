// Integração: as regras do domínio aplicadas a um catálogo gravado no banco de desenvolvimento. O teste cria as
// próprias figuras (slugs `teste-`) pelas mesmas funções de repositório do seed, então não depende do conteúdo do
// catálogo — real ou de demonstração. Precisa do banco migrado (`npm run db:up && npm run db:migrate`); sem banco,
// os testes são pulados.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  closePool,
  getPool,
  listOffersForProducts,
  listProducts,
  listPublishedGames,
  listSources,
  listStores,
  upsertGame,
  upsertOffer,
  upsertProduct,
  upsertSource,
  upsertStore,
  type OfferInput,
} from "../src/index";
import type { Game, Offer, Source, Store } from "@tako/domain";
import { cheapestOffer, discountPercent, type EligibilityContext } from "@tako/domain";

let online = false;
let games: Game[] = [];
let products: Awaited<ReturnType<typeof listProducts>> = [];
let offers: Offer[] = [];
const stores = new Map<string, Store>();
const sources = new Map<string, Source>();

const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 3_600_000);

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

  // Figuras do teste. O upsert por slug torna o preparo idempotente: reexecutar atualiza as mesmas linhas, e a
  // observação de cada execução é mais recente que a anterior, então sempre substitui a gravada.
  const loja = await upsertStore({
    slug: "teste-loja-principal",
    name: "Loja do teste",
    allowedDomains: ["principal.teste.example"],
    linkKind: "direct",
  });
  const lojaFora = await upsertStore({
    slug: "teste-loja-fora",
    name: "Loja secundária do teste",
    allowedDomains: ["fora.teste.example"],
    linkKind: "direct",
  });
  const lojaDesativada = await upsertStore({
    slug: "teste-loja-desativada",
    name: "Loja desativada do teste",
    enabled: false,
    allowedDomains: ["desativada.teste.example"],
  });
  const fonte = await upsertSource({
    slug: "teste-fonte",
    name: "Fonte do teste",
    kind: "file",
    maxAgeHours: 24,
    notes: "Figuras do teste de integração do catálogo.",
    access: "api",
    format: "csv",
    coversBrl: true,
    cadenceHours: 24,
    status: "approved",
  });

  const criarJogo = (slug: string, title: string) =>
    upsertGame({ slug, title, published: true, platforms: ["steam"], operatingSystems: ["windows"] });
  const fenda = await criarJogo("teste-fenda", "Fenda de teste");
  const furia = await criarJogo("teste-furia", "Fúria de teste");
  const maquina = await criarJogo("teste-maquina", "Máquina de teste");
  const estacao = await criarJogo("teste-estacao", "Estação de teste");
  const jardim = await criarJogo("teste-jardim", "Jardim de teste");
  const antigo = await criarJogo("teste-antigo", "Jogo antigo de teste");

  const fendaBase = await upsertProduct({ gameId: fenda.id, kind: "base", platform: "steam" });
  const furiaBase = await upsertProduct({ gameId: furia.id, kind: "base", platform: "steam" });
  const maquinaBase = await upsertProduct({ gameId: maquina.id, kind: "base", platform: "steam" });
  const estacaoBase = await upsertProduct({ gameId: estacao.id, kind: "base", platform: "steam" });
  const estacaoCompleta = await upsertProduct({
    gameId: estacao.id,
    kind: "edition",
    editionName: "Órbita Completa (teste)",
    platform: "steam",
  });
  const estacaoDlc = await upsertProduct({ gameId: estacao.id, kind: "dlc", platform: "steam" });
  const jardimBase = await upsertProduct({ gameId: jardim.id, kind: "base", platform: "steam" });
  const antigoBase = await upsertProduct({ gameId: antigo.id, kind: "base", platform: "steam" });

  const urlDa = (store: { allowedDomains: string[] | null }, produto: string) =>
    `https://${store.allowedDomains?.[0] ?? "teste.example"}/item/${produto}`;
  const oferta = (
    productId: string,
    store: { id: string; allowedDomains: string[] | null },
    slug: string,
    priceCents: number,
    extra: Partial<OfferInput> = {},
  ) =>
    upsertOffer({
      productId,
      storeId: store.id,
      sourceId: fonte.id,
      priceCents,
      platform: "steam",
      url: urlDa(store, slug),
      observedAt: hoursAgo(1),
      ...extra,
    });

  // A oferta de R$ 19,90 foi observada há 40 h e a fonte vence em 24 h: não disputa.
  await oferta(fendaBase.id, lojaFora, "fenda", 1_990, { observedAt: hoursAgo(40) });
  await oferta(fendaBase.id, loja, "fenda", 2_490);
  // A oferta em USD (1.299) existe, mas não entra na comparação em BRL.
  await oferta(furiaBase.id, lojaFora, "furia", 1_299, { currency: "USD" });
  await oferta(furiaBase.id, loja, "furia", 6_990);
  // A oferta dos EUA não disputa no Brasil, nem na volta para os EUA.
  await oferta(maquinaBase.id, loja, "maquina", 2_990);
  await oferta(maquinaBase.id, loja, "maquina-us", 1_999, { region: "US", currency: "USD" });
  // Preço de edição é sempre maior que o do jogo base, e o da DLC, menor.
  await oferta(estacaoBase.id, loja, "estacao", 11_990);
  await oferta(estacaoCompleta.id, loja, "estacao-completa", 15_990);
  await oferta(estacaoDlc.id, loja, "estacao-dlc", 3_490);
  // Desconto calculado contra referência confiável, e cupom registrado como informação.
  await oferta(jardimBase.id, loja, "jardim", 2_990, { referencePriceCents: 5_980, coupon: "TAKOTESTE" });
  // A loja desativada não disputa, mesmo com o menor preço.
  await oferta(antigoBase.id, lojaDesativada, "antigo", 990);
  await oferta(antigoBase.id, loja, "antigo", 4_990);

  // Só depois de gravar as figuras, carrega o catálogo como a loja o vê.
  games = await listPublishedGames();
  products = await listProducts();
  offers = await listOffersForProducts(products.map((product) => product.id));
  for (const store of await listStores()) stores.set(store.id, store);
  for (const source of await listSources()) sources.set(source.id, source);
});

after(async () => {
  if (!online) return;
  // As figuras saem em cascata: ofertas e produtos pendem dos jogos, e o histórico e os cliques, das ofertas.
  await getPool().query("delete from games where slug like 'teste-%'");
  await getPool().query("delete from stores where slug like 'teste-%'");
  await getPool().query("delete from sources where slug like 'teste-%'");
  await closePool();
});

function gameId(slug: string): string {
  const game = games.find((candidate) => candidate.slug === slug);
  assert.ok(game, `figura do teste ${slug} não foi criada`);
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
  assert.ok(product, `produto ${slug}:${kind} não foi criado`);
  return product.id;
}

describe("catálogo de teste", () => {
  it("cria as próprias figuras sem depender do seed", (t) => {
    if (!online) return t.skip("sem banco");
    for (const slug of ["teste-fenda", "teste-furia", "teste-maquina", "teste-estacao", "teste-jardim", "teste-antigo"]) {
      assert.ok(games.some((game) => game.slug === slug), `faltou o jogo ${slug}`);
    }
    assert.ok(offers.length >= 11, "as ofertas das figuras estão carregadas");
  });
});

describe("menor preço elegível sobre o catálogo de teste", () => {
  it("escolhe a oferta válida mais barata do jogo base", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("teste-fenda", "base");
    const best = cheapestOffer(
      offers.filter((offer) => offer.productId === product),
      contextFor(),
    );
    assert.equal(best?.priceCents, 2_490);
    assert.equal(stores.get(best?.storeId ?? "")?.slug, "teste-loja-principal");
  });

  it("não compara oferta em outra moeda", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("teste-furia", "base");
    const best = cheapestOffer(
      offers.filter((offer) => offer.productId === product),
      contextFor(),
    );
    assert.equal(best?.currency, "BRL");
    assert.equal(best?.priceCents, 6_990);
  });

  it("não mostra oferta de outra região", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("teste-maquina", "base");
    const noBrazil = cheapestOffer(
      offers.filter((offer) => offer.productId === product),
      contextFor(),
    );
    assert.equal(noBrazil?.priceCents, 2_990);
    const usOnly = offers.find((offer) => offer.productId === product && offer.region === "US");
    assert.ok(usOnly, "a figura dos EUA precisa existir");
  });

  it("não mistura jogo base com edição, DLC ou pacote", (t) => {
    if (!online) return t.skip("sem banco");
    const base = productId("teste-estacao", "base");
    const deluxe = productId("teste-estacao", "edition", "Órbita Completa (teste)");
    const dlc = productId("teste-estacao", "dlc");
    const bestBase = cheapestOffer(offers.filter((offer) => offer.productId === base), contextFor());
    const bestDeluxe = cheapestOffer(offers.filter((offer) => offer.productId === deluxe), contextFor());
    const bestDlc = cheapestOffer(offers.filter((offer) => offer.productId === dlc), contextFor());
    assert.equal(bestBase?.priceCents, 11_990);
    assert.ok(bestDeluxe !== null && bestDeluxe.priceCents > 11_990, "edição tem preço próprio e maior");
    assert.equal(bestDlc?.priceCents, 3_490);
    assert.notEqual(bestDeluxe?.productId, bestBase?.productId);
  });

  it("calcula o desconto só com referência confiável", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("teste-jardim", "base");
    const best = cheapestOffer(offers.filter((offer) => offer.productId === product), contextFor());
    assert.equal(best?.priceCents, 2_990);
    assert.equal(discountPercent(best?.priceCents ?? 0, best?.referencePriceCents ?? null), 50);
  });

  it("informa ao menos uma oferta com cupom, como as figuras desenham", (t) => {
    if (!online) return t.skip("sem banco");
    assert.ok(offers.some((offer) => offer.conditions.coupon !== null));
  });

  it("exclui a loja desativada da comparação", (t) => {
    if (!online) return t.skip("sem banco");
    const product = productId("teste-antigo", "base");
    const doTeste = offers.filter((offer) => offer.productId === product);
    const desativada = doTeste.find(
      (offer) => stores.get(offer.storeId)?.slug === "teste-loja-desativada",
    );
    assert.ok(desativada, "a figura da loja desativada precisa existir");
    const best = cheapestOffer(doTeste, contextFor());
    assert.equal(best?.priceCents, 4_990);
    assert.equal(stores.get(best?.storeId ?? "")?.slug, "teste-loja-principal");
  });
});
