// Fonte canônica cria o jogo na importação (OFR-008): Steam é o registro oficial dos jogos dela.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { importCollected } from "@tako/ingest";
import type { Source } from "@tako/domain";
import { closePool, findGameBySlug, getPool, listProducts, query, upsertSource } from "../src/index";

let online = false;
let source: Source;
let semCriacao: Source;

before(async () => {
  try {
    await getPool().query("select 1");
    online = true;
  } catch {
    online = false;
    return;
  }
  await query(
    `insert into stores (slug, name, allowed_domains) values ('loja-canonica-teste', 'Loja canônica', '{loja.example}')
     on conflict (slug) do update set allowed_domains = '{loja.example}'`,
  );
  source = await upsertSource({
    slug: "fonte-canonica-teste",
    name: "Fonte canônica de teste",
    kind: "api",
    access: "api",
    format: "json",
    coversBrl: true,
    cadenceHours: 6,
    status: "approved",
    autoCreate: true,
  });
});

after(async () => {
  if (!online) return;
  await query("delete from sources where slug = 'fonte-canonica-teste'");
  await query("delete from games where slug like 'jogo-canonicoteste%' or slug like 'outro-jogo-sem-cadastro%'");
  await query("delete from stores where slug = 'loja-canonica-teste'");
  await closePool();
});

describe("fonte canônica", () => {
  it("cria o jogo oculto, o produto e a oferta aprovada", async (t) => {
    if (!online) return t.skip("sem banco");
    const row = {
      externalId: "canonico-1",
      title: "Jogo CanônicoTeste",
      edition: null,
      platform: "steam" as const,
      region: "BR",
      currency: "BRL",
      priceCents: 9900,
      referencePriceCents: null,
      availability: "available" as const,
      url: "https://loja.example/app/1",
      coupon: null,
      subscription: null,
      observedAt: new Date().toISOString(),
      storeSlug: "loja-canonica-teste",
      coverUrl: "https://loja.example/capa.jpg",
    };
    const summary = await importCollected(source, { rows: [row], errors: [] }, "teste");
    assert.equal(summary.accepted, 1);
    const game = await findGameBySlug("jogo-canonicoteste");
    assert.ok(game);
    assert.equal(game?.published, false);
    assert.equal(game?.media.cover, "https://loja.example/capa.jpg");
    const products = await listProducts();
    const product = products.find((candidate) => candidate.gameId === game?.id);
    assert.ok(product);
    const mapping = await query<{ status: string; confidence: string }>(
      "select status, confidence::text from product_mappings where product_id = $1",
      [product?.id],
    );
    assert.equal(mapping[0]?.status, "approved");
    assert.equal(mapping[0]?.confidence, "1.000");
  });

  it("não cria jogo quando a fonte não é canônica; o vínculo fica na fila", async (t) => {
    if (!online) return t.skip("sem banco");
    const row = {
      externalId: "nao-canonico-2",
      title: "Outro Jogo Sem Cadastro",
      edition: null,
      platform: "steam" as const,
      region: "BR",
      currency: "BRL",
      priceCents: 5000,
      referencePriceCents: null,
      availability: "available" as const,
      url: "https://loja.example/app/2",
      coupon: null,
      subscription: null,
      observedAt: new Date().toISOString(),
      storeSlug: "loja-canonica-teste",
    };
    semCriacao = { ...source, autoCreate: false };
    const summary2 = await importCollected(semCriacao, { rows: [row], errors: [] }, "teste");
    assert.equal(summary2.accepted, 0);
    assert.equal(summary2.errors[0]?.code, "vinculo-pendente");
  });
});
