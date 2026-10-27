-- 0004 — link de afiliado configurável (PAR-002) e fonte alimentada por URL (OFR-004/OFR-008).
--
-- A chave de afiliado é operacional: quem opera cola o parâmetro ou o molde no painel, sem mudar código. O endereço
-- final continua validado contra os domínios cadastrados da loja.

alter table stores
  add column affiliate_param text,
  add column affiliate_value text,
  add column affiliate_template text;

-- Fonte que entrega arquivo por URL (feed do parceiro). O token, quando existe, vai na própria URL — por isso a
-- coluna não aparece em tela para quem não tem permissão de integração.
alter table sources
  add column feed_url text,
  add column field_map jsonb not null default '{}'::jsonb;
