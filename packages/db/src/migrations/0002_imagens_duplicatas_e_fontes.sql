-- 0002 — biblioteca de imagens (CAT-005), revisão de duplicatas (CAT-008), matriz de fontes (PAR-004) e
-- reprocessamento de erros de importação (OFR-006).
--
-- Nada aqui inventa dado: a matriz de fontes registra o que se sabe de uma fonte candidata (acesso, formato,
-- cobertura em BRL, frequência, links, atribuição), e a imagem carrega a procedência.

-- CAT-005: ordem da galeria e atualização registrada.
alter table media_assets
  add column position integer not null default 0,
  add column updated_at timestamptz not null default now();

-- A mesma imagem não entra duas vezes para o mesmo jogo.
create unique index media_assets_url_idx on media_assets (game_id, url);
create index media_assets_kind_idx on media_assets (game_id, kind, position);

-- Imagem sem procedência não entra; o endereço é https ou um caminho servido por esta aplicação (demonstração).
alter table media_assets
  add constraint media_assets_origin_check check (length(btrim(origin)) > 0),
  add constraint media_assets_url_check check (url ~ '^(https://|/)');

-- OFR-006: o erro reprocessado fica marcado com a execução que o resolveu.
alter table ingestion_errors
  add column resolved_at timestamptz,
  add column resolved_run_id uuid references ingestion_runs(id) on delete set null;

create index ingestion_errors_open_idx on ingestion_errors (run_id) where resolved_at is null;

-- PAR-004: matriz de fontes candidatas.
alter table sources
  add column access text not null default 'unknown'
    check (access in ('api', 'partner-feed', 'public-page', 'unknown')),
  add column format text not null default 'unknown'
    check (format in ('json', 'csv', 'xml', 'html', 'unknown')),
  add column covers_brl boolean not null default false,
  add column cadence_hours integer check (cadence_hours is null or cadence_hours > 0),
  add column docs_url text,
  add column terms_url text,
  add column attribution text,
  add column status text not null default 'candidate'
    check (status in ('candidate', 'evaluating', 'approved', 'rejected'));

create index sources_status_idx on sources (status, name);

-- CAT-008: histórico da união de duplicatas. O jogo duplicado é arquivado, não apagado — o histórico de preço
-- continua existindo e a união é reversível a partir do que está registrado aqui.
create table game_merges (
  id bigserial primary key,
  survivor_id uuid not null references games(id) on delete cascade,
  duplicate_id uuid not null references games(id) on delete cascade,
  duplicate_title text not null,
  duplicate_slug text not null,
  actor_email text not null,
  impact jsonb not null,
  created_at timestamptz not null default now()
);

create index game_merges_survivor_idx on game_merges (survivor_id, created_at desc);
