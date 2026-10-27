-- 0005 — limite de tentativas de login (PRD §12.1).
--
-- Cada tentativa fica registrada por e-mail e por IP; a janela é curta e o registro é apagado depois de 24 h. Sem
-- isso, senha de 12 caracteres ainda pode ser atacada por força bruta distribuída.

create table login_attempts (
  id bigserial primary key,
  email text not null,
  ip text,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index login_attempts_email_idx on login_attempts (lower(email), created_at desc);
create index login_attempts_ip_idx on login_attempts (ip, created_at desc);
