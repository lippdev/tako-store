// Mapeia linhas do banco para os tipos do domínio. Um lugar só para saber o que é `snake_case` e o que é `camelCase`.

import type { Availability, Game, Offer, OperatingSystem, PartnerStatus, Product, ProductKind, Source, Store } from "@tako/domain";

export interface GameRow {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  alternative_titles: string[];
  description: string | null;
  release_date: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: string[];
  operating_systems: string[];
  cover_url: string | null;
  hero_url: string | null;
  logo_url: string | null;
  screenshots: string[];
  published: boolean;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
}

export function toGame(row: GameRow): Game {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    originalTitle: row.original_title,
    alternativeTitles: row.alternative_titles,
    description: row.description,
    releaseDate: row.release_date === null ? null : String(row.release_date),
    developers: row.developers,
    publishers: row.publishers,
    genres: row.genres,
    platforms: row.platforms as Game["platforms"],
    operatingSystems: row.operating_systems as OperatingSystem[],
    media: {
      cover: row.cover_url,
      hero: row.hero_url,
      logo: row.logo_url,
      screenshots: row.screenshots,
    },
    published: row.published,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface ProductRow {
  id: string;
  game_id: string;
  kind: ProductKind;
  edition_name: string | null;
  platform: Product["platform"];
  requires_product_id: string | null;
  bundle_product_ids: string[];
  published: boolean;
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    gameId: row.game_id,
    kind: row.kind,
    editionName: row.edition_name,
    platform: row.platform,
    requiresProductId: row.requires_product_id,
    bundleProductIds: row.bundle_product_ids,
    published: row.published,
  };
}

export interface StoreRow {
  id: string;
  slug: string;
  name: string;
  partner_status: PartnerStatus;
  enabled: boolean;
  allowed_domains: string[];
  link_kind: Store["linkKind"];
  attribution: string | null;
  regions: string[];
  currencies: string[];
}

export function toStore(row: StoreRow): Store {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    partnerStatus: row.partner_status,
    enabled: row.enabled,
    allowedDomains: row.allowed_domains,
    linkKind: row.link_kind,
    attribution: row.attribution,
    regions: row.regions,
    currencies: row.currencies,
  };
}

export interface SourceRow {
  id: string;
  slug: string;
  name: string;
  kind: Source["kind"];
  enabled: boolean;
  max_age_hours: number;
  regions: string[];
  currencies: string[];
  notes: string | null;
  access: Source["access"];
  format: Source["format"];
  covers_brl: boolean;
  cadence_hours: number | null;
  docs_url: string | null;
  terms_url: string | null;
  attribution: string | null;
  status: Source["status"];
  last_run_at: string | null;
  consecutive_failures: number;
}

export function toSource(row: SourceRow): Source {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    enabled: row.enabled,
    maxAgeHours: row.max_age_hours,
    regions: row.regions,
    currencies: row.currencies,
    notes: row.notes,
    access: row.access,
    format: row.format,
    coversBrl: row.covers_brl,
    cadenceHours: row.cadence_hours,
    docsUrl: row.docs_url,
    termsUrl: row.terms_url,
    attribution: row.attribution,
    status: row.status,
    lastRunAt: row.last_run_at,
    consecutiveFailures: row.consecutive_failures,
  };
}

export interface OfferRow {
  id: string;
  product_id: string;
  store_id: string;
  source_id: string;
  price_cents: string | number;
  reference_price_cents: string | number | null;
  currency: string;
  region: string;
  platform: Offer["platform"];
  availability: Availability;
  coupon: string | null;
  subscription: string | null;
  url: string;
  observed_at: Date;
}

export function toOffer(row: OfferRow): Offer {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    sourceId: row.source_id,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    referencePriceCents: row.reference_price_cents === null ? null : Number(row.reference_price_cents),
    region: row.region,
    platform: row.platform,
    availability: row.availability,
    conditions: { coupon: row.coupon, subscription: row.subscription },
    url: row.url,
    observedAt: row.observed_at.toISOString(),
  };
}
