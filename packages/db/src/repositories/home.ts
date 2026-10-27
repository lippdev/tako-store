// Home configurável (STO-001): seções com regra, posição e janela de publicação.

import type { HomeRule } from "@tako/domain";
import { query, queryOne } from "../pool";

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
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  published: boolean;
}

interface HomeBannerRow {
  id: string;
  game_id: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  published: boolean;
}

export async function listLiveBanners(now = new Date()): Promise<HomeBanner[]> {
  const rows = await query<HomeBannerRow>(
    `select id, game_id, eyebrow, title, subtitle, cta_label, published from home_banners
     where published and (starts_at is null or starts_at <= $1) and (ends_at is null or ends_at > $1)
     order by position, title limit 3`,
    [now],
  );
  return rows.map((row) => ({
    id: row.id,
    gameId: row.game_id,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.cta_label,
    published: row.published,
  }));
}

export async function upsertBanner(input: {
  gameId: string | null;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  position?: number;
  published?: boolean;
}): Promise<void> {
  await query(
    `insert into home_banners (game_id, eyebrow, title, subtitle, cta_label, position, published)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [input.gameId, input.eyebrow ?? null, input.title, input.subtitle ?? null, input.ctaLabel ?? null, input.position ?? 0, input.published ?? true],
  );
}
