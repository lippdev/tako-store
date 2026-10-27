// Catálogo: leitura para a loja e escrita para o painel. As consultas devolvem tipos do domínio, já mapeados.

import type { ActivationPlatform, Game, OperatingSystem, Product, ProductKind } from "@tako/domain";
import { query, queryOne } from "../pool";
import { toGame, toProduct, type GameRow, type ProductRow } from "../mappers";

const GAME_COLUMNS = `id, slug, title, original_title, alternative_titles, description, release_date, developers,
  publishers, genres, platforms, operating_systems, cover_url, hero_url, logo_url, screenshots, published, archived,
  created_at, updated_at`;

export interface GameInput {
  slug: string;
  title: string;
  originalTitle?: string | null;
  alternativeTitles?: string[];
  description?: string | null;
  releaseDate?: string | null;
  developers?: string[];
  publishers?: string[];
  genres?: string[];
  platforms?: ActivationPlatform[];
  operatingSystems?: OperatingSystem[];
  coverUrl?: string | null;
  heroUrl?: string | null;
  logoUrl?: string | null;
  screenshots?: string[];
  published?: boolean;
}

/** Jogos para a loja pública: publicados, não arquivados. */
export async function listPublishedGames(): Promise<Game[]> {
  const rows = await query<GameRow>(
    `select ${GAME_COLUMNS} from games where published and not archived order by title`,
  );
  return rows.map(toGame);
}

/** Jogos para o painel: todos, inclusive ocultos e arquivados. */
export async function listAllGames(): Promise<Game[]> {
  const rows = await query<GameRow>(`select ${GAME_COLUMNS} from games order by updated_at desc`);
  return rows.map(toGame);
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const row = await queryOne<GameRow>(`select ${GAME_COLUMNS} from games where slug = $1 and published and not archived`, [
    slug,
  ]);
  return row === null ? null : toGame(row);
}

export async function getGameById(id: string): Promise<Game | null> {
  const row = await queryOne<GameRow>(`select ${GAME_COLUMNS} from games where id = $1`, [id]);
  return row === null ? null : toGame(row);
}

export async function findGameBySlug(slug: string): Promise<Game | null> {
  const row = await queryOne<GameRow>(`select ${GAME_COLUMNS} from games where slug = $1`, [slug]);
  return row === null ? null : toGame(row);
}

/** Cria ou atualiza pelo `slug`: importar de novo não duplica (PRD §14). */
export async function upsertGame(input: GameInput): Promise<Game> {
  const row = await queryOne<GameRow>(
    `insert into games (slug, title, original_title, alternative_titles, description, release_date, developers,
       publishers, genres, platforms, operating_systems, cover_url, hero_url, logo_url, screenshots, published)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     on conflict (slug) do update set
       title = excluded.title,
       original_title = excluded.original_title,
       alternative_titles = excluded.alternative_titles,
       description = coalesce(excluded.description, games.description),
       release_date = coalesce(excluded.release_date, games.release_date),
       developers = excluded.developers,
       publishers = excluded.publishers,
       genres = excluded.genres,
       platforms = excluded.platforms,
       operating_systems = excluded.operating_systems,
       cover_url = coalesce(excluded.cover_url, games.cover_url),
       hero_url = coalesce(excluded.hero_url, games.hero_url),
       logo_url = coalesce(excluded.logo_url, games.logo_url),
       screenshots = case when cardinality(excluded.screenshots) > 0 then excluded.screenshots else games.screenshots end,
       updated_at = now()
     returning ${GAME_COLUMNS}`,
    [
      input.slug,
      input.title,
      input.originalTitle ?? null,
      input.alternativeTitles ?? [],
      input.description ?? null,
      input.releaseDate ?? null,
      input.developers ?? [],
      input.publishers ?? [],
      input.genres ?? [],
      input.platforms ?? [],
      input.operatingSystems ?? [],
      input.coverUrl ?? null,
      input.heroUrl ?? null,
      input.logoUrl ?? null,
      input.screenshots ?? [],
      input.published ?? false,
    ],
  );
  if (row === null) throw new Error("upsert de jogo não devolveu linha");
  return toGame(row);
}

/** Edição pelo painel: só os campos informados mudam, e o resto fica como está. */
export async function updateGame(
  id: string,
  patch: Partial<Omit<GameInput, "slug">> & { slug?: string },
): Promise<Game | null> {
  const row = await queryOne<GameRow>(
    `update games set
       slug = coalesce($2, slug),
       title = coalesce($3, title),
       original_title = coalesce($4, original_title),
       alternative_titles = coalesce($5, alternative_titles),
       description = coalesce($6, description),
       release_date = coalesce($7::date, release_date),
       developers = coalesce($8, developers),
       publishers = coalesce($9, publishers),
       genres = coalesce($10, genres),
       platforms = coalesce($11, platforms),
       operating_systems = coalesce($12, operating_systems),
       cover_url = coalesce($13, cover_url),
       hero_url = coalesce($14, hero_url),
       logo_url = coalesce($15, logo_url),
       updated_at = now()
     where id = $1
     returning ${GAME_COLUMNS}`,
    [
      id,
      patch.slug ?? null,
      patch.title ?? null,
      patch.originalTitle ?? null,
      patch.alternativeTitles ?? null,
      patch.description ?? null,
      patch.releaseDate ?? null,
      patch.developers ?? null,
      patch.publishers ?? null,
      patch.genres ?? null,
      patch.platforms ?? null,
      patch.operatingSystems ?? null,
      patch.coverUrl ?? null,
      patch.heroUrl ?? null,
      patch.logoUrl ?? null,
    ],
  );
  return row === null ? null : toGame(row);
}

/** Publica, oculta ou arquiva. Publicar e ocultar é o interruptor do painel (CAT-004). */
export async function setGameVisibility(
  id: string,
  change: { published?: boolean; archived?: boolean },
): Promise<void> {
  await query(
    `update games set published = coalesce($2, published), archived = coalesce($3, archived), updated_at = now()
     where id = $1`,
    [id, change.published ?? null, change.archived ?? null],
  );
}

export async function listProducts(options: { publishedOnly?: boolean } = {}): Promise<Product[]> {
  const rows = await query<ProductRow>(
    `select id, game_id, kind, edition_name, platform, requires_product_id, bundle_product_ids, published
     from products ${options.publishedOnly === true ? "where published" : ""} order by created_at`,
  );
  return rows.map(toProduct);
}

export interface ProductInput {
  gameId: string;
  kind: ProductKind;
  editionName?: string | null;
  platform: ActivationPlatform;
  requiresProductId?: string | null;
  bundleProductIds?: string[];
}

/** Produto é único por jogo, tipo, edição e plataforma: criar de novo atualiza o mesmo (PRD §7.1). */
export async function upsertProduct(input: ProductInput): Promise<Product> {
  const row = await queryOne<ProductRow>(
    `insert into products (game_id, kind, edition_name, platform, requires_product_id, bundle_product_ids)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (game_id, kind, coalesce(edition_name, ''), platform) do update set
       requires_product_id = excluded.requires_product_id,
       bundle_product_ids = excluded.bundle_product_ids,
       updated_at = now()
     returning id, game_id, kind, edition_name, platform, requires_product_id, bundle_product_ids, published`,
    [input.gameId, input.kind, input.editionName ?? null, input.platform, input.requiresProductId ?? null, input.bundleProductIds ?? []],
  );
  if (row === null) throw new Error("upsert de produto não devolveu linha");
  return toProduct(row);
}

export async function setProductPublished(id: string, published: boolean): Promise<void> {
  await query("update products set published = $2, updated_at = now() where id = $1", [id, published]);
}

/** Identificadores externos do jogo, para busca e vínculo (CAT-007). */
export async function setExternalIdentifier(gameId: string, sourceId: string, externalId: string): Promise<void> {
  await query(
    `insert into external_identifiers (game_id, source_id, external_id) values ($1, $2, $3)
     on conflict (source_id, external_id) do update set game_id = excluded.game_id`,
    [gameId, sourceId, externalId],
  );
}

/** Remove o identificador da fonte para o jogo (CAT-007). */
export async function removeExternalIdentifier(gameId: string, sourceId: string): Promise<void> {
  await query("delete from external_identifiers where game_id = $1 and source_id = $2", [gameId, sourceId]);
}

/** Identificadores com o nome da fonte, para o painel mostrar de onde veio cada ID. */
export async function listExternalIdentifiersDetailed(
  gameId: string,
): Promise<{ sourceId: string; sourceName: string; sourceSlug: string; externalId: string }[]> {
  return query(
    `select e.source_id as "sourceId", s.name as "sourceName", s.slug as "sourceSlug", e.external_id as "externalId"
     from external_identifiers e join sources s on s.id = e.source_id
     where e.game_id = $1 order by s.name`,
    [gameId],
  );
}

/**
 * Aponta a imagem principal do jogo (capa, fundo ou logo). `null` limpa o campo — diferente do `updateGame`, que
 * só troca o que recebe valor.
 */
export async function setPrimaryMedia(gameId: string, kind: "cover" | "hero" | "logo", url: string | null): Promise<void> {
  const column = kind === "cover" ? "cover_url" : kind === "hero" ? "hero_url" : "logo_url";
  await query(`update games set ${column} = $2, updated_at = now() where id = $1`, [gameId, url]);
}

export async function listExternalIdentifiers(gameId: string): Promise<{ sourceId: string; externalId: string }[]> {
  return query<{ sourceId: string; externalId: string }>(
    "select source_id as \"sourceId\", external_id as \"externalId\" from external_identifiers where game_id = $1",
    [gameId],
  );
}
