#!/usr/bin/env node
// Backfill das capas no formato do cartão (2:3 retrato) para o catálogo já importado da Steam. O conector novo
// grava a capa retrata da biblioteca nos jogos novos; este script atualiza os que chegaram antes da correção,
// cuja capa é a paisagem da vitrine (header 460×215) — o cartão recorta 70% da largura e corta o título.
//
// O appid sai da própria URL guardada (/steam/apps/<id>/header.jpg). A capa da biblioteca é conferida com um
// HEAD no CDN: sem a peça (~5% dos apps, os mais antigos), a capa fica como está e o motivo fica no relatório.
//
// Uso: node scripts/backfill-covers-steam.mjs   (DATABASE_URL sobrepõe o padrão do pool)

import pg from "pg";

const DEFAULT_URL = "postgres://tako:tako@localhost:5432/tako_store";
const BIBLIOTECA = (appid) => `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900.jpg`;
const APPID_NA_CAPA = /\/steam\/apps\/(\d+)\//;

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] ?? DEFAULT_URL, max: 10 });

async function existeNoCdn(url) {
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    return response.ok;
  } catch (error) {
    return `cdn indisponível: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const { rows: games } = await pool.query(
  "select id, slug, cover_url from games where published and cover_url is not null order by id",
);
let trocadas = 0;
const semArte = [];
const estranhas = [];
let n = 0;

for (const game of games) {
  n += 1;
  const appid = APPID_NA_CAPA.exec(game.cover_url)?.[1];
  if (appid === undefined) {
    estranhas.push({ slug: game.slug, capa: game.cover_url });
    continue;
  }
  const biblioteca = BIBLIOTECA(appid);
  if (game.cover_url === biblioteca) continue;
  const existe = await existeNoCdn(biblioteca);
  if (existe !== true) {
    semArte.push({ slug: game.slug, appid, motivo: existe });
    continue;
  }
  await pool.query("update games set cover_url = $1 where id = $2", [biblioteca, game.id]);
  trocadas += 1;
  if (n % 100 === 0) console.log(`… ${String(n)}/${String(games.length)} conferidos`);
}

console.log(`Capas trocadas para 2:3: ${String(trocadas)} de ${String(games.length)}`);
for (const item of semArte) console.log(`sem capa de biblioteca: ${item.slug} (app ${item.appid}) — ${item.motivo}`);
for (const item of estranhas) console.log(`capa fora do padrão da Steam: ${item.slug} — ${item.capa}`);
await pool.end();
