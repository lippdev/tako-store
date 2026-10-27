-- 0001 — schema inicial do catálogo, das ofertas e da operação (PRD §14).
--
-- Regras que o schema faz valer sozinho:
-- * dinheiro em inteiro (centavos), nunca ponto flutuante (§10.3);
-- * identificador externo é único dentro da fonte (§14, integridade);
-- * uma oferta por produto, loja, fonte, região e plataforma — reimportar atualiza, não duplica (§15);
-- * histórico e auditoria sobrevivem à desativação de produtos e lojas (§14).

create extension if not exists unaccent;
create extension if not exists pgcrypto;

-- Jogo: identidade principal do título.
create table games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  original_title text,
  alternative_titles text[] not null default '{}',
  description text,
  release_date date,
  developers text[] not null default '{}',
  publishers text[] not null default '{}',
  genres text[] not null default '{}',
  platforms text[] not null default '{}',
  operating_systems text[] not null default '{}',
  cover_url text,
  hero_url text,
  logo_url text,
  screenshots text[] not null default '{}',
  published boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_published_idx on games (published, archived);
create index games_release_idx on games (release_date desc);

-- Produto comparável: jogo base, edição, DLC ou bundle.
create table products (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  kind text not null check (kind in ('base', 'edition', 'dlc', 'bundle')),
  edition_name text,
  platform text not null check (platform in ('steam', 'epic', 'gog', 'xbox', 'other')),
  requires_product_id uuid references products(id) on delete set null,
  bundle_product_ids uuid[] not null default '{}',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_game_idx on products (game_id);
create unique index products_identity_idx on products (
  game_id,
  kind,
  coalesce(edition_name, ''),
  platform
);

-- Loja apresentada ao usuário. A parceria é administrativa e não entra em regra de preço (§8.2).
create table stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  partner_status text not null default 'none' check (partner_status in ('active', 'pending', 'none', 'disabled')),
  enabled boolean not null default true,
  allowed_domains text[] not null default '{}',
  link_kind text not null default 'direct' check (link_kind in ('affiliate', 'source', 'direct')),
  attribution text,
  regions text[] not null default '{BR}',
  currencies text[] not null default '{BRL}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Origem técnica dos dados. O prazo de validade é por fonte (§10.4).
create table sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('api', 'feed', 'file', 'page')),
  enabled boolean not null default true,
  max_age_hours integer not null default 24 check (max_age_hours > 0),
  regions text[] not null default '{BR}',
  currencies text[] not null default '{BRL}',
  notes text,
  last_run_at timestamptz,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Identificador do jogo em fontes externas (CAT-007).
create table external_identifiers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index external_identifiers_game_idx on external_identifiers (game_id);

-- Produto como recebido da fonte, antes do vínculo com o produto canônico.
create table external_products (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  external_id text not null,
  title text not null,
  edition text,
  platform text not null,
  region text not null default 'BR',
  currency text not null default 'BRL',
  raw jsonb,
  seen_at timestamptz not null default now(),
  unique (source_id, external_id)
);

-- Vínculo entre produto externo e produto canônico (CAT-008, OFR-005). Ambiguidade não é publicada.
create table product_mappings (
  id uuid primary key default gen_random_uuid(),
  external_product_id uuid not null unique references external_products(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'suggested', 'approved', 'rejected')),
  confidence numeric(4, 3),
  reason text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_mappings_status_idx on product_mappings (status);

-- Oferta atual: uma por produto, loja, fonte, região e plataforma.
create table offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  external_product_id uuid references external_products(id) on delete set null,
  price_cents bigint not null check (price_cents > 0),
  reference_price_cents bigint check (reference_price_cents is null or reference_price_cents > 0),
  currency text not null default 'BRL',
  region text not null default 'BR',
  platform text not null,
  availability text not null default 'available' check (availability in ('available', 'unavailable', 'unknown')),
  coupon text,
  subscription text,
  url text not null,
  observed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (product_id, store_id, source_id, region, platform)
);

create index offers_product_idx on offers (product_id);
create index offers_observed_idx on offers (observed_at);

-- Histórico: cada observação fica registrada com origem e data (§10.6).
create table price_observations (
  id bigserial primary key,
  offer_id uuid not null references offers(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  price_cents bigint not null,
  reference_price_cents bigint,
  availability text not null,
  observed_at timestamptz not null
);

create index price_observations_offer_idx on price_observations (offer_id, observed_at desc);

-- Execução de importação (OFR-003, OFR-006).
create table ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  triggered_by text not null default 'manual',
  received integer not null default 0,
  accepted integer not null default 0,
  rejected integer not null default 0,
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index ingestion_runs_source_idx on ingestion_runs (source_id, started_at desc);

create table ingestion_errors (
  id bigserial primary key,
  run_id uuid not null references ingestion_runs(id) on delete cascade,
  line integer,
  code text not null,
  message text not null,
  payload jsonb
);

-- Imagem e sua origem (CAT-005).
create table media_assets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  kind text not null check (kind in ('cover', 'hero', 'logo', 'screenshot')),
  url text not null,
  origin text not null,
  attribution text,
  created_at timestamptz not null default now()
);

create index media_assets_game_idx on media_assets (game_id);

-- Home configurável (STO-001).
create table home_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  rule jsonb not null,
  position integer not null default 0,
  published boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Banner principal da home.
create table home_banners (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete set null,
  eyebrow text,
  title text not null,
  subtitle text,
  cta_label text,
  position integer not null default 0,
  published boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- Painel: usuários, sessões revogáveis, auditoria (§12.1).
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'catalog', 'content', 'integrations', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references admin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index admin_sessions_user_idx on admin_sessions (user_id);

create table audit_events (
  id bigserial primary key,
  actor_id uuid references admin_users(id) on delete set null,
  actor_email text not null,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_entity_idx on audit_events (entity, entity_id, created_at desc);

-- Clique no botão de oferta, com o mínimo necessário (§11.5).
create table offer_clicks (
  id bigserial primary key,
  offer_id uuid not null references offers(id) on delete cascade,
  created_at timestamptz not null default now()
);
