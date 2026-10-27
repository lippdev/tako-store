-- 0006 — rascunho, prévia e histórico da home (PRD §12.4).
--
-- O painel salva rascunho sem publicar, publica quando quiser e pode restaurar uma versão anterior. A versão guarda
-- o estado completo da home (seções e banners) em um JSON, com quem salvou e quando.

create table home_versions (
  id uuid primary key default gen_random_uuid(),
  state jsonb not null,
  saved_by text not null,
  note text,
  created_at timestamptz not null default now()
);

create index home_versions_created_idx on home_versions (created_at desc);

-- Rascunho: publicada passa a ter versão válida em produção, e o painel edita em rascunho antes.
alter table home_sections add column draft jsonb;
alter table home_banners add column draft jsonb;
