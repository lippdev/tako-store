-- 0007 — fonte que é o registro canônico cria o jogo na importação (OFR-008, §12.6).
--
-- A loja Steam é a fonte oficial dos jogos dela: título, capa e preço vêm da própria origem. Fonte com
-- auto_create verdadeiro cadastra o jogo (oculto até publicar) quando ele ainda não existe no catálogo.
-- Fonte sem isso continua só sugerindo vínculo, como manda a fila de revisão.

alter table sources add column auto_create boolean not null default false;
