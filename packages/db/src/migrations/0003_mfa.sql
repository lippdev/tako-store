-- 0003 — segundo fator para administradores (PRD §12.1).
--
-- O segredo TOTP precisa ser lido pelo servidor para conferir o código, então fica no banco. O que protege o segredo
-- é o acesso ao banco e o fato de ele nunca ser exibido de novo depois da inscrição.

alter table admin_users
  add column mfa_secret text,
  add column mfa_enabled boolean not null default false;

-- Login em duas etapas: depois da senha, o servidor guarda um pedido de código por alguns minutos, ligado ao
-- usuário. O token vai para um cookie httpOnly e o banco guarda só o hash.
create table admin_mfa_pending (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references admin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index admin_mfa_pending_user_idx on admin_mfa_pending (user_id);
