// Importação e reprocessamento (OFR-003, OFR-006): a linha recusada guarda o conteúdo, o reprocessamento tenta de
// novo e marca o que resolveu — sem duplicar oferta. Cada teste cria as próprias linhas e apaga no fim.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { RawOffer } from "@tako/connectors";
import { getSourceBySlug, getPool, query, queryOne } from "@tako/db";
import { importCollected, retryFailedRun } from "../src/index";

let online = false;
let gameId = "";
let productId = "";
let storeId = "";

before(async () => {
  try {
    await getPool().query("select 1");
    online = true;
  } catch {
    online = false;
    return;
  }
  const game = await queryOne<{ id: string }>(
    "insert into games (slug, title, published) values ('teste-ingestao', 'Teste de ingestão', true) returning id",
  );
  gameId = game?.id ?? "";
  const product = await queryOne<{ id: string }>(
    "insert into products (game_id, kind, platform) values ($1, 'base', 'steam') returning id",
    [gameId],
  );
  productId = product?.id ?? "";
  const store = await queryOne<{ id: string }>(
    "insert into stores (slug, name, allowed_domains) values ('teste-ingestao', 'Loja de ingestão', '{teste.example}') returning id",
  );
  storeId = store?.id ?? "";
});

after(async () => {
  if (!online) return;
  await query("delete from games where id = $1", [gameId]);
  await query("delete from stores where id = $1", [storeId]);
  await query("delete from sources where slug = 'teste-ingestao'");
  await getPool().end();
});

const rawOffer = (overrides: Partial<RawOffer> = {}): RawOffer => ({
  externalId: "SKU-1",
  title: "Jogo fora do catálogo",
  edition: null,
  platform: "steam",
  region: "BR",
  currency: "BRL",
  priceCents: 9_900,
  referencePriceCents: null,
  availability: "available",
  url: "https://loja.example/jogo",
  coupon: null,
  subscription: null,
  observedAt: "2026-10-27T10:00:00.000Z",
  storeSlug: "teste-ingestao",
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}): unknown => ({
  externalId: "SKU-1",
  title: "Teste de ingestão",
  platform: "steam",
  priceCents: 9_900,
  url: "https://loja.example/jogo",
  storeSlug: "teste-ingestao",
  ...overrides,
});

describe("importação", () => {
  it("grava a oferta válida e rejeita a inválida com o conteúdo guardado", async (t) => {
    if (!online) return t.skip("sem banco");
    const source = await queryOne<{ id: string }>(
      `insert into sources (slug, name, kind, access, format, covers_brl, status)
       values ('teste-ingestao', 'Fonte de ingestão', 'file', 'api', 'json', true, 'approved') returning id`,
    );
    const loaded = await getSourceBySlug("teste-ingestao");
    assert.ok(loaded !== null);

    const summary = await importCollected(
      loaded,
      {
        rows: [],
        errors: [
          { line: 1, code: "preco", message: "preço ausente", payload: row({ priceCents: null }) },
          { line: 2, code: "url", message: "link precisa ser https", payload: row({ url: "http://loja.example/jogo" }) },
        ],
      },
      "teste",
    );

    assert.equal(summary.accepted, 0);
    assert.equal(summary.rejected, 2);
    assert.equal(summary.status, "failed");

    const stored = await query<{ payload: unknown; resolved_at: string | null }>(
      "select payload, resolved_at from ingestion_errors where run_id = $1 order by line",
      [summary.runId],
    );
    assert.equal(stored.length, 2);
    assert.equal(stored[0]?.payload === null, false);
    assert.equal(stored[0]?.resolved_at, null);
    await query("delete from ingestion_runs where id = $1", [summary.runId]);
    await query("delete from sources where id = $1", [source?.id ?? ""]);
  });

  it("reprocessa o erro depois que o vínculo é aprovado", async (t) => {
    if (!online) return t.skip("sem banco");
    await query(
      `insert into sources (slug, name, kind, access, format, covers_brl, status)
       values ('teste-ingestao', 'Fonte de ingestão', 'file', 'api', 'json', true, 'approved')`,
    );
    const source = await getSourceBySlug("teste-ingestao");
    assert.ok(source !== null);

    // Primeira execução: o jogo não está no catálogo, então o vínculo fica pendente e a oferta não é gravada.
    const first = await importCollected(source, { rows: [rawOffer()], errors: [] }, "teste");
    assert.equal(first.rejected, 1);
    assert.equal(first.accepted, 0);
    assert.equal(first.errors[0]?.code, "vinculo-pendente");

    const external = await queryOne<{ id: string }>(
      "select id from external_products where source_id = $1 and external_id = 'SKU-1'",
      [source.id],
    );
    assert.ok(external !== null);

    // O operador aprova o vínculo no painel; o reprocessamento tenta de novo a mesma linha.
    const mapping = await queryOne<{ id: string }>(
      `update product_mappings set product_id = $2, status = 'approved', confidence = 1, reason = 'teste',
         decided_by = 'teste', decided_at = now()
       where external_product_id = $1 returning id`,
      [external.id, productId],
    );
    assert.ok(mapping !== null);

    const retry = await retryFailedRun(first.runId, "teste");
    assert.equal(retry.retried, 1);
    assert.equal(retry.resolved, 1);
    assert.equal(retry.accepted, 1);

    const offer = await queryOne<{ price_cents: string }>(
      "select price_cents from offers where product_id = $1 and store_id = $2",
      [productId, storeId],
    );
    assert.equal(Number(offer?.price_cents), 9_900);

    const resolved = await query<{ resolved_at: string | null }>(
      "select resolved_at from ingestion_errors where run_id = $1",
      [first.runId],
    );
    assert.notEqual(resolved[0]?.resolved_at, null);

    // Reprocessar de novo não duplica a oferta.
    const offers = await query<{ total: number }>("select count(*)::int as total from offers where product_id = $1", [productId]);
    assert.equal(offers[0]?.total, 1);

    await query("delete from product_mappings where id = $1", [mapping.id]);
    await query("delete from offers where product_id = $1", [productId]);
    await query("delete from ingestion_runs where source_id = $1", [source.id]);
    await query("delete from external_products where source_id = $1", [source.id]);
    await query("delete from sources where id = $1", [source.id]);
  });
});
