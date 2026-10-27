// Home configurável (STO-001): seções com regra, posição e janela de publicação.

import type { HomeRule } from "@tako/domain";
import { getPool, query, queryOne } from "../pool";

export interface HomeSection {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  rule: HomeRule;
  position: number;
  published: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

interface HomeSectionRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  rule: HomeRule;
  position: number;
  published: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
}

function toSection(row: HomeSectionRow): HomeSection {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    rule: row.rule,
    position: row.position,
    published: row.published,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
  };
}

/** Seções que valem agora: publicadas e dentro da janela (ou sem janela). */
export async function listLiveSections(now = new Date()): Promise<HomeSection[]> {
  const rows = await query<HomeSectionRow>(
    `select id, slug, title, subtitle, rule, position, published, starts_at, ends_at
     from home_sections
     where published and (starts_at is null or starts_at <= $1) and (ends_at is null or ends_at > $1)
     order by position, title`,
    [now],
  );
  return rows.map(toSection);
}

/** Todas as seções, para o painel de conteúdo. */
export async function listAllSections(): Promise<HomeSection[]> {
  const rows = await query<HomeSectionRow>(
    `select id, slug, title, subtitle, rule, position, published, starts_at, ends_at
     from home_sections order by position, title`,
  );
  return rows.map(toSection);
}

export interface HomeSectionInput {
  slug: string;
  title: string;
  subtitle?: string | null;
  rule: HomeRule;
  position?: number;
  published?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export async function upsertSection(input: HomeSectionInput): Promise<HomeSection> {
  const row = await queryOne<HomeSectionRow>(
    `insert into home_sections (slug, title, subtitle, rule, position, published, starts_at, ends_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (slug) do update set
       title = excluded.title, subtitle = excluded.subtitle, rule = excluded.rule, position = excluded.position,
       published = excluded.published, starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_at = now()
     returning id, slug, title, subtitle, rule, position, published, starts_at, ends_at`,
    [
      input.slug,
      input.title,
      input.subtitle ?? null,
      JSON.stringify(input.rule),
      input.position ?? 0,
      input.published ?? true,
      input.startsAt ?? null,
      input.endsAt ?? null,
    ],
  );
  if (row === null) throw new Error("seção da home não foi gravada");
  return toSection(row);
}

export async function setSectionPublished(slug: string, published: boolean): Promise<void> {
  await query("update home_sections set published = $2, updated_at = now() where slug = $1", [slug, published]);
}

export async function deleteSection(slug: string): Promise<void> {
  await query("delete from home_sections where slug = $1", [slug]);
}

export interface HomeBanner {
  id: string;
  gameId: string | null;
  gameTitle: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  position: number;
  published: boolean;
}

interface HomeBannerRow {
  id: string;
  game_id: string | null;
  game_title: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  position: number;
  published: boolean;
}

export async function listLiveBanners(now = new Date()): Promise<HomeBanner[]> {
  const rows = await query<HomeBannerRow>(
    `select b.id, b.game_id, g.title as game_title, b.eyebrow, b.title, b.subtitle, b.cta_label, b.position, b.published
     from home_banners b left join games g on g.id = b.game_id
     where b.published and (b.starts_at is null or b.starts_at <= $1) and (b.ends_at is null or b.ends_at > $1)
     order by b.position, b.title limit 3`,
    [now],
  );
  return rows.map(toBanner);
}

function toBanner(row: HomeBannerRow): HomeBanner {
  return {
    id: row.id,
    gameId: row.game_id,
    gameTitle: row.game_title,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.cta_label,
    position: row.position,
    published: row.published,
  };
}

/** Banners do painel: todos, inclusive os ocultos. */
export async function listAllBanners(): Promise<HomeBanner[]> {
  const rows = await query<HomeBannerRow>(
    `select b.id, b.game_id, g.title as game_title, b.eyebrow, b.title, b.subtitle, b.cta_label, b.position, b.published
     from home_banners b left join games g on g.id = b.game_id
     order by b.position, b.title`,
  );
  return rows.map(toBanner);
}

export async function upsertBanner(input: {
  id?: string;
  gameId: string | null;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  position?: number;
  published?: boolean;
}): Promise<HomeBanner> {
  const row = await queryOne<HomeBannerRow>(
    `insert into home_banners as b (id, game_id, eyebrow, title, subtitle, cta_label, position, published)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set
       game_id = excluded.game_id, eyebrow = excluded.eyebrow, title = excluded.title, subtitle = excluded.subtitle,
       cta_label = excluded.cta_label, position = excluded.position, published = excluded.published
     returning id, game_id,
       (select title from games where id = b.game_id) as game_title,
       eyebrow, title, subtitle, cta_label, position, published`,
    [
      input.id ?? null,
      input.gameId,
      input.eyebrow ?? null,
      input.title,
      input.subtitle ?? null,
      input.ctaLabel ?? null,
      input.position ?? 0,
      input.published ?? true,
    ],
  );
  if (row === null) throw new Error("banner não foi gravado");
  return toBanner(row);
}

export async function setBannerPublished(id: string, published: boolean): Promise<void> {
  await query("update home_banners set published = $2 where id = $1", [id, published]);
}

export async function deleteBanner(id: string): Promise<void> {
  await query("delete from home_banners where id = $1", [id]);
}

// Rascunho e histórico (PRD §12.4): o estado inteiro da home guardado como versão, para restaurar.

export interface HomeSnapshot {
  sections: {
    slug: string;
    title: string;
    subtitle: string | null;
    rule: HomeRule;
    position: number;
    published: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }[];
  banners: {
    gameId: string | null;
    eyebrow: string | null;
    title: string;
    subtitle: string | null;
    ctaLabel: string | null;
    position: number;
    published: boolean;
  }[];
}

export interface HomeVersion {
  id: string;
  state: HomeSnapshot;
  savedBy: string;
  note: string | null;
  createdAt: string;
}

interface HomeVersionRow {
  id: string;
  state: HomeSnapshot;
  saved_by: string;
  note: string | null;
  created_at: Date;
}

function toVersion(row: HomeVersionRow): HomeVersion {
  return { id: row.id, state: row.state, savedBy: row.saved_by, note: row.note, createdAt: row.created_at.toISOString() };
}

/** Como a home está agora, para virar versão. */
export async function homeSnapshot(): Promise<HomeSnapshot> {
  const [sections, banners] = await Promise.all([listAllSections(), listAllBanners()]);
  return {
    sections: sections.map((section) => ({
      slug: section.slug,
      title: section.title,
      subtitle: section.subtitle,
      rule: section.rule,
      position: section.position,
      published: section.published,
      startsAt: section.startsAt,
      endsAt: section.endsAt,
    })),
    banners: banners.map((banner) => ({
      gameId: banner.gameId,
      eyebrow: banner.eyebrow,
      title: banner.title,
      subtitle: banner.subtitle,
      ctaLabel: banner.ctaLabel,
      position: banner.position,
      published: banner.published,
    })),
  };
}

/** Últimas versões, mais nova primeiro. */
export async function listHomeVersions(limit = 10): Promise<HomeVersion[]> {
  const rows = await query<HomeVersionRow>(
    `select id, state, saved_by, note, created_at from home_versions order by created_at desc limit $1`,
    [limit],
  );
  return rows.map(toVersion);
}

export async function getHomeVersion(id: string): Promise<HomeVersion | null> {
  const row = await queryOne<HomeVersionRow>(`select id, state, saved_by, note, created_at from home_versions where id = $1`, [id]);
  return row === null ? null : toVersion(row);
}

/** Guarda o estado atual como versão. A pré-visualização usa o mesmo estado, sem gravar. */
export async function saveHomeVersion(savedBy: string, note: string | null, snapshot?: HomeSnapshot): Promise<HomeVersion> {
  const state = snapshot ?? (await homeSnapshot());
  const row = await queryOne<HomeVersionRow>(
    `insert into home_versions (state, saved_by, note) values ($1, $2, $3)
     returning id, state, saved_by, note, created_at`,
    [JSON.stringify(state), savedBy, note],
  );
  if (row === null) throw new Error("versão da home não foi gravada");
  return toVersion(row);
}

/** Devolve a home ao estado de uma versão. A versão restaurada não é apagada: o histórico fica. */
export async function restoreHomeVersion(id: string): Promise<HomeSnapshot> {
  const version = await getHomeVersion(id);
  if (version === null) throw new Error("versão da home não existe");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("delete from home_sections");
    await client.query("delete from home_banners");
    for (const section of version.state.sections) {
      await client.query(
        `insert into home_sections (slug, title, subtitle, rule, position, published, starts_at, ends_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          section.slug,
          section.title,
          section.subtitle,
          JSON.stringify(section.rule),
          section.position,
          section.published,
          section.startsAt,
          section.endsAt,
        ],
      );
    }
    for (const banner of version.state.banners) {
      await client.query(
        `insert into home_banners (game_id, eyebrow, title, subtitle, cta_label, position, published)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [banner.gameId, banner.eyebrow, banner.title, banner.subtitle, banner.ctaLabel, banner.position, banner.published],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    client.release();
  }
  return version.state;
}
