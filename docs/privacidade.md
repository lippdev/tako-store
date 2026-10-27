# Privacidade

O que a loja registra de fato, e por quanto tempo. A página pública está em `/privacidade`. Nada aqui descreve um
serviço que o código não usa.

## O que é coletado

| Registro | O que guarda | Para quê | Prazo |
| :- | :- | :- | :- |
| Clique em oferta (`offer_clicks`) | identificador da oferta e horário | saber quais ofertas as pessoas abrem; não entra na ordem do preço | 180 dias |
| Tentativa de login (`login_attempts`) | e-mail, IP, sucesso ou falha | impedir adivinhação de senha no painel | 24 horas |
| Sessão do painel | token httpOnly no navegador | manter o editor autenticado | até sair ou ser revogada |
| Auditoria (`audit_events`) | quem fez, qual ação, qual registro | prestar contas da operação | 365 dias |
| Erro de importação resolvido | linha, código, mensagem | diagnóstico da coleta | 90 dias depois de resolvido |
| Observação de preço | valor, moeda, loja, horário | histórico mostrado na página do jogo | fica; não tem dado de pessoa |

A loja pública não cria conta, não pede e-mail e não grava cookie de rastreio. A compra acontece na loja parceira.

## Como a retenção roda

`npm run worker -- retain` apaga o que passou do prazo. A passada `due` e o `daemon` fazem o mesmo antes de coletar,
para o ambiente que já roda o agendador não precisar de outro cron.

Observação de preço não entra nessa limpeza. Apagar o histórico quebraria a página do jogo, e o registro não identifica
quem consultou.

## O que não pode aparecer de novo

Chave de afiliado, molde com token e URL de feed com query não voltam para o formulário depois de cadastrados. Campo
vazio mantém o valor. A auditoria guarda só o host do feed, sem a query.
