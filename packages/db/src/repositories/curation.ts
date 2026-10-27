// Curadoria do catálogo (CAT-008): candidatos a duplicata e união registrada. A união arquiva o jogo duplicado,
// move o que não colide e deixa rastro em `game_merges` e `audit_events` — nada é apagado em silêncio.

import { groupDuplicates, type DuplicateGame, type DuplicateGroup, type MergeImpact } from "@tako/domain";
import { query, withTransaction } from "../pool";
import { toIso } from "../mappers";

export interface DuplicateCandidateGroup extends DuplicateGroup {
  /** Produtos e ofertas que a união move para o jogo principal. */
  impact: MergeImpact[];
}

export async function duplicateCandidates(): Promise<DuplicateCandidateGroup[]> {
  const games = await query<{
    id: string;
    title: string;
    originalTitle: string | null;
    alternativeTitles: string[];
    releaseDate: string | null;
    slug: string;
    archived: boolean;
  }>(
    `select id, title, original_title as "originalTitle", alternative_titles as "alternativeTitles",
            release_date as "releaseDate", slug, archived
     from games where not archived`,
  );
  const counts = await query<{ gameId: string; products: number; offers: number; identifiers: number }>(
    `select g.id as "gameId",
            (select count(*)::int from products p where p.game_id = g.id) as products,
            (select count(*)::int from offers o join products p on p.id = o.product_id where p.game_id = g.id) as offers,
            (select count(*)::int from external_identifiers e where e.game_id = g.id) as identifiers
     from games g`,
  );
  const byGame = new Map(counts.map((row) => [row.gameId, row]));

  const groups = groupDuplicates(games satisfies DuplicateGame[]);
  return groups.map((group) => ({
    ...group,
    impact: group.games.map((game) => {
      const row = byGame.get(game.id);
      return {
        products: row?.products ?? 0,
        offers: row?.offers ?? 0,
        externalIdentifiers: row?.identifiers ?? 0,
      };
    }),
  }));
}

export interface MergeResult {
  survivorId: string;
  duplicateId: string;
  impact: {
    productsMoved: number;
    productsKept: number;
    offersMoved: number;
    identifiersMoved: number;
    mediaMoved: number;
    titlesAdded: number;
  };
  summary: string;
}

/**
 * Une o jogo duplicado ao principal. Produto cuja identidade colide com um produto do principal fica no jogo
 * arquivado (o histórico de preço não é reescrito); o resto é movido. O duplicado vira arquivado e ganha o título
 * alternativo para a busca continuar achando pelo nome antigo.
 */
export async function mergeGames(input: {
  survivorId: string;
  duplicateId: string;
  actorEmail: string;
}): Promise<MergeResult> {
  if (input.survivorId === input.duplicateId) throw new Error("o jogo principal e o duplicado são o mesmo registro");

  return withTransaction(async (client) => {
    const games = await client.query<{ id: string; title: string; slug: string; archived: boolean; alternative_titles: string[] }>(
      `select id, title, slug, archived, alternative_titles from games where id = any($1::uuid[]) for update`,
      [[input.survivorId, input.duplicateId]],
    );
    const survivor = games.rows.find((row) => row.id === input.survivorId);
    const duplicate = games.rows.find((row) => row.id === input.duplicateId);
    if (survivor === undefined || duplicate === undefined) throw new Error("jogo não encontrado");
    if (duplicate.archived) throw new Error("o jogo duplicado já está arquivado");

    const moved = await client.query<{ id: string }>(
      `update products p set game_id = $1, updated_at = now()
       where p.game_id = $2
         and not exists (
           select 1 from products s where s.game_id = $1 and s.kind = p.kind
             and coalesce(s.edition_name, '') = coalesce(p.edition_name, '') and s.platform = p.platform
         )
       returning p.id`,
      [input.survivorId, input.duplicateId],
    );
    const kept = await client.query<{ id: string }>(
      `update products set published = false, updated_at = now() where game_id = $1 and published returning id`,
      [input.duplicateId],
    );
    const offersMoved = await client.query<{ count: number }>(
      "select count(*)::int as count from offers where product_id = any($1::uuid[])",
      [moved.rows.map((row) => row.id)],
    );
    const identifiers = await client.query(
      `with moved as (
         update external_identifiers e set game_id = $1
         where e.game_id = $2
           and not exists (select 1 from external_identifiers k where k.source_id = e.source_id and k.external_id = e.external_id)
         returning e.id
       )
       select count(*)::int as count from moved`,
      [input.survivorId, input.duplicateId],
    );
    await client.query("delete from external_identifiers where game_id = $1", [input.duplicateId]);

    const media = await client.query<{ count: number }>(
      `with moved as (
         update media_assets m set game_id = $1, updated_at = now()
         where m.game_id = $2
           and not exists (select 1 from media_assets k where k.game_id = $1 and k.url = m.url)
         returning m.id
       ), removed as (
         delete from media_assets where game_id = $2 returning id
       )
       select count(*)::int as count from moved`,
      [input.survivorId, input.duplicateId],
    );

    const titles = new Set([...survivor.alternative_titles, duplicate.title]);
    await client.query(
      `update games set alternative_titles = $2, published = false, archived = true, updated_at = now() where id = $1`,
      [input.duplicateId, [...titles]],
    );
    await client.query(
      `update games set alternative_titles = $2, updated_at = now() where id = $1`,
      [input.survivorId, [...titles]],
    );

    const impact: MergeResult["impact"] = {
      productsMoved: moved.rowCount ?? 0,
      productsKept: kept.rowCount ?? 0,
      offersMoved: offersMoved.rows[0]?.count ?? 0,
      identifiersMoved: identifiers.rows[0]?.count ?? 0,
      mediaMoved: media.rows[0]?.count ?? 0,
      titlesAdded: titles.size - survivor.alternative_titles.length,
    };
    const summary = `"${duplicate.title}" foi unido a "${survivor.title}": ${String(impact.productsMoved)} produto(s) movido(s), ${String(impact.productsKept)} mantido(s) no arquivado, ${String(impact.identifiersMoved)} identificador(es), ${String(impact.mediaMoved)} imagem(ns).`;

    await client.query(
      `insert into game_merges (survivor_id, duplicate_id, duplicate_title, duplicate_slug, actor_email, impact)
       values ($1, $2, $3, $4, $5, $6)`,
      [input.survivorId, input.duplicateId, duplicate.title, duplicate.slug, input.actorEmail, JSON.stringify(impact)],
    );
    await client.query(
      `insert into audit_events (actor_email, action, entity, entity_id, detail)
       values ($1, 'jogo:unir', 'game', $2, $3)`,
      [input.actorEmail, input.survivorId, JSON.stringify({ duplicado: duplicate.id, slug: duplicate.slug, impacto: impact })],
    );

    return { survivorId: input.survivorId, duplicateId: input.duplicateId, impact, summary };
  });
}

export interface GameMergeRecord {
  id: string;
  survivorId: string;
  survivorTitle: string;
  duplicateId: string;
  duplicateTitle: string;
  duplicateSlug: string;
  actorEmail: string;
  impact: MergeResult["impact"];
  createdAt: string;
}

export async function listGameMerges(limit = 20): Promise<GameMergeRecord[]> {
  const rows = await query<Omit<GameMergeRecord, "createdAt"> & { createdAt: Date }>(
    `select m.id::text as id, m.survivor_id as "survivorId", s.title as "survivorTitle",
            m.duplicate_id as "duplicateId", m.duplicate_title as "duplicateTitle", m.duplicate_slug as "duplicateSlug",
            m.actor_email as "actorEmail", m.impact, m.created_at as "createdAt"
     from game_merges m join games s on s.id = m.survivor_id
     order by m.created_at desc limit $1`,
    [limit],
  );
  return rows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) ?? "" }));
}

/** Jogos arquivados que guardam produtos despublicados por causa de uma união — a trilha para reverter. */
export async function archivedGamesForMerge(limit = 20): Promise<{ id: string; title: string; slug: string; products: number }[]> {
  return query(
    `select g.id, g.title, g.slug, count(p.id)::int as products
     from games g left join products p on p.game_id = g.id
     where g.archived group by g.id order by g.updated_at desc limit $1`,
    [limit],
  );
}
