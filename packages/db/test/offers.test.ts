// Integridade da escrita de oferta (PRD §14 e §15): reimportar não duplica, e observação velha não substitui a
// nova. O teste cria as próprias linhas e apaga no fim; não depende do seed.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { closePool, getPool, query, queryOne, upsertOffer } from "../src/index";

let online = false;
let gameId = "";
let productId = "";
let storeId = "";
let sourceId = "";

before(async () => {
  try {
    await getPool().query("select 1");
    online = true;
  } catch {
    online = false;
    return;
  }
  const game = await queryOne<{ id: string }>(
    "insert into games (slug, title, published) values ('teste-oferta', 'Teste de oferta', true) returning id",
  );
  gameId = game?.id ?? "";
  const product = await queryOne<{ id: string }>(
    "insert into products (game_id, kind, platform) values ($1, 'base', 'steam') returning id",
    [gameId],
  );
  productId = product?.id ?? "";
  const store = await queryOne<{ id: string }>(
    "insert into stores (slug, name, allowed_domains) values ('teste-loja', 'Loja de teste', '{teste.example}') returning id",
  );
  storeId = store?.id ?? "";
  const source = await queryOne<{ id: string }>(
    "insert into sources (slug, name, kind) values ('teste-fonte', 'Fonte de teste', 'file') returning id",
  );
  sourceId = source?.id ?? "";
});

after(async () => {
  if (!online) return;
  await query("delete from games where id = $1", [gameId]);
  await query("delete from stores where id = $1", [storeId]);
  await query("delete from sources where id = $1", [sourceId]);
  await closePool();
});

const base = { priceCents: 5000, url: "https://teste.example/a", platform: "steam" as const };

describe("escrita de oferta", () => {
  it("grava a primeira observação", async (t) => {
    if (!online) return t.skip("sem banco");
    const result = await upsertOffer({
      ...base,
      productId,
      storeId,
      sourceId,
      observedAt: new Date("2026-10-27T10:00:00.000Z"),
    });
    assert.equal(result.applied, true);
  });

  it("não deixa observação mais velha sobrescrever o preço", async (t) => {
    if (!online) return t.skip("sem banco");
    const result = await upsertOffer({
      ...base,
      priceCents: 9000,
      productId,
      storeId,
      sourceId,
      observedAt: new Date("2026-10-26T10:00:00.000Z"),
    });
    assert.equal(result.applied, false);
    const row = await queryOne<{ price_cents: string }>("select price_cents from offers where product_id = $1", [productId]);
    assert.equal(Number(row?.price_cents), 5000);
  });

  it("deixa observação mais nova atualizar o preço", async (t) => {
    if (!online) return t.skip("sem banco");
    const result = await upsertOffer({
      ...base,
      priceCents: 4500,
      productId,
      storeId,
      sourceId,
      observedAt: new Date("2026-10-27T15:00:00.000Z"),
    });
    assert.equal(result.applied, true);
    const row = await queryOne<{ price_cents: string }>("select price_cents from offers where product_id = $1", [productId]);
    assert.equal(Number(row?.price_cents), 4500);
  });

  it("reimportar a mesma oferta não duplica a linha", async (t) => {
    if (!online) return t.skip("sem banco");
    await upsertOffer({
      ...base,
      productId,
      storeId,
      sourceId,
      observedAt: new Date("2026-10-27T16:00:00.000Z"),
    });
    const rows = await query<{ n: number }>("select count(*)::int as n from offers where product_id = $1", [productId]);
    assert.equal(rows[0]?.n, 1);
  });

  it("guarda cada observação aplicada no histórico", async (t) => {
    if (!online) return t.skip("sem banco");
    const rows = await query<{ n: number }>(
      "select count(*)::int as n from price_observations where source_id = $1",
      [sourceId],
    );
    // Três escritas aplicadas: a primeira, a de 15h e a de 16h. A de 26/10 foi ignorada.
    assert.equal(rows[0]?.n, 3);
  });
});
