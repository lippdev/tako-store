// Integração: a fila de atualização da Steam — apps com a observação mais antiga primeiro. Cria as próprias
// figuras (slugs `teste-`); precisa do banco migrado; sem banco, os testes são pulados.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  closePool,
  getPool,
  listSourceAppIdsOldestFirst,
  upsertGame,
  upsertOffer,
  upsertProduct,
  upsertSource,
  upsertStore,
} from "../src/index";

let online = false;

const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 3_600_000);

before(async () => {
  try {
    await getPool().query("select 1 from games limit 1");
    online = true;
  } catch {
    online = false;
  }
  if (!online) return;

  const loja = await upsertStore({
    slug: "teste-sync-loja",
    name: "Loja do teste de sincronização",
    allowedDomains: ["sync.teste.example"],
    linkKind: "direct",
  });
  const fonte = await upsertSource({
    slug: "teste-sync-fonte",
    name: "Fonte do teste de sincronização",
    kind: "api",
    maxAgeHours: 24,
    notes: "Figuras do teste da fila de atualização.",
    access: "api",
    format: "json",
    coversBrl: true,
    cadenceHours: 6,
    status: "approved",
  });

  const criarOferta = async (appid: string, idadeHoras: number) => {
    const jogo = await upsertGame({
      slug: `teste-sync-${appid}`,
      title: `Jogo de teste ${appid}`,
      published: true,
      platforms: ["steam"],
      operatingSystems: ["windows"],
    });
    const produto = await upsertProduct({ gameId: jogo.id, kind: "base", platform: "steam" });
    await upsertOffer({
      productId: produto.id,
      storeId: loja.id,
      sourceId: fonte.id,
      priceCents: 9_990,
      platform: "steam",
      url: `https://store.steampowered.com/app/${appid}/`,
      observedAt: hoursAgo(idadeHoras),
    });
  };
  await criarOferta("1110", 5);
  await criarOferta("2220", 40);
  await criarOferta("3330", 1);
});

after(async () => {
  if (!online) return;
  await getPool().query("delete from games where slug like 'teste-sync-%'");
  await getPool().query("delete from stores where slug like 'teste-sync-%'");
  await getPool().query("delete from sources where slug like 'teste-sync-%'");
  await closePool();
});

describe("fila de atualização da fonte", () => {
  it("ordena pela observação mais antiga e limita o lote", async (t) => {
    if (!online) return t.skip("sem banco");
    const fila = await listSourceAppIdsOldestFirst("teste-sync-fonte", 2);
    assert.deepEqual(fila, ["2220", "1110"]);
  });

  it("fonte sem ofertas devolve fila vazia", async (t) => {
    if (!online) return t.skip("sem banco");
    assert.deepEqual(await listSourceAppIdsOldestFirst("fonte-que-nao-existe", 10), []);
  });
});
