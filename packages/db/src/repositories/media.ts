// Biblioteca de imagens (CAT-005): associar, substituir e remover, sempre com a procedência registrada.

import type { MediaAsset, MediaKind } from "@tako/domain";
import { query, queryOne } from "../pool";

interface MediaRow {
  id: string;
  game_id: string;
  kind: MediaKind;
  url: string;
  origin: string;
  attribution: string | null;
  position: number;
  created_at: string;
}

const MEDIA_COLUMNS = `id, game_id, kind, url, origin, attribution, position, created_at`;

function toMediaAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    gameId: row.game_id,
    kind: row.kind,
    url: row.url,
    origin: row.origin,
    attribution: row.attribution,
    position: row.position,
    createdAt: row.created_at,
  };
}

export async function listMediaAssets(gameId: string): Promise<MediaAsset[]> {
  const rows = await query<MediaRow>(
    `select ${MEDIA_COLUMNS} from media_assets where game_id = $1 order by kind, position, created_at`,
    [gameId],
  );
  return rows.map(toMediaAsset);
}

/** Imagens do jogo, agrupadas por id — a loja carrega tudo de uma vez. */
export async function listMediaForGames(gameIds: readonly string[]): Promise<Map<string, MediaAsset[]>> {
  if (gameIds.length === 0) return new Map();
  const rows = await query<MediaRow>(
    `select ${MEDIA_COLUMNS} from media_assets where game_id = any($1::uuid[]) order by game_id, kind, position, created_at`,
    [gameIds],
  );
  const byGame = new Map<string, MediaAsset[]>();
  for (const row of rows) {
    const asset = toMediaAsset(row);
    const list = byGame.get(asset.gameId) ?? [];
    list.push(asset);
    byGame.set(asset.gameId, list);
  }
  return byGame;
}

export async function addMediaAsset(input: {
  gameId: string;
  kind: MediaKind;
  url: string;
  origin: string;
  attribution?: string | null;
}): Promise<MediaAsset> {
  const row = await queryOne<MediaRow>(
    `insert into media_assets (game_id, kind, url, origin, attribution, position)
     values ($1, $2, $3, $4, $5,
       coalesce((select max(position) + 1 from media_assets where game_id = $1 and kind = $2), 0))
     on conflict (game_id, url) do update set
       kind = excluded.kind, origin = excluded.origin, attribution = excluded.attribution, updated_at = now()
     returning ${MEDIA_COLUMNS}`,
    [input.gameId, input.kind, input.url, input.origin, input.attribution ?? null],
  );
  if (row === null) throw new Error("imagem não foi gravada");
  return toMediaAsset(row);
}

export async function removeMediaAsset(id: string): Promise<{ gameId: string; kind: MediaKind; url: string } | null> {
  const row = await queryOne<{ gameId: string; kind: MediaKind; url: string }>(
    "delete from media_assets where id = $1 returning game_id as \"gameId\", kind, url",
    [id],
  );
  return row;
}

/** Substitui a imagem principal de um tipo: a nova entra e a antiga sai. */
export async function replacePrimaryImage(input: {
  gameId: string;
  kind: MediaKind;
  url: string;
  origin: string;
  attribution?: string | null;
}): Promise<MediaAsset> {
  const asset = await addMediaAsset(input);
  await query("delete from media_assets where game_id = $1 and kind = $2 and id <> $3", [input.gameId, input.kind, asset.id]);
  return asset;
}
