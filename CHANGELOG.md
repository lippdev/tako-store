# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem
[SemVer](https://semver.org/lang/pt-BR/).

## [0.3.0] — 2026-10-27

Deixa a operação ligável sem código: chave de afiliado no painel, fonte real por URL, coleta automática e o que
faltava de criação no catálogo.

### Adicionado

- **Link de afiliado (PAR-002)**: parâmetro + valor ou molde com `{url}` por loja, aplicado no servidor em
  `/ir/<oferta>` e validado contra os domínios permitidos; contagem de cliques por oferta em `/admin/ofertas`.
- **Feed real (OFR-004/OFR-008)**: cadastro de fonte por URL (JSON/CSV) com de-para de campos validado, execução pelo
  painel com relatório e conector genérico sem dependência externa.
- **Coleta contínua**: `worker due` e `worker daemon` respeitando a cadência de cada fonte; unidades systemd em
  `deploy/systemd/` e `deploy/env.example`.
- **Catálogo**: criar jogo pelo painel (slug automático, nasce oculto) e gerenciar banners da home.
- **Loja**: carrossel de até três destaques na home, com navegação por pontos.
- **Backup**: `--keep N` para retenção de dumps.
- **Documentação**: `docs/integracoes.md` com o passo a passo para ligar loja, chave, feed e agendador.

### Notas

- Falta apenas o acesso autorizado dos parceiros para existir oferta real; o mecanismo está pronto e testado.

## [0.2.0] — 2026-10-27

Fecha as pendências das fases 1 a 4 e completa a administração. Nada disso muda a regra de preço: o motor do
domínio continua sendo o único lugar que decide o menor preço elegível.

### Adicionado

- **Imagens (CAT-005)**: biblioteca por jogo com capa, fundo, logo e capturas; origem e atribuição obrigatórias,
  `addMediaAsset`/`replacePrimaryImage`/`removeMediaAsset`, galeria na página do jogo e arte de demonstração gerada
  pelo projeto.
- **Identificadores externos (CAT-007)**: associar, listar por fonte e remover no cadastro do jogo.
- **Duplicatas (CAT-008)**: `/admin/duplicatas` com candidatos por título normalizado, impacto antes da união,
  união transacional (`mergeGames`) e histórico em `game_merges`; o duplicado é arquivado, não apagado.
- **Matriz de fontes (PAR-004)**: acesso, formato, cobertura em BRL, frequência, documentação, termos, atribuição e
  situação por fonte; `sourceIsUsable` decide quem alimenta a comparação.
- **Reprocessamento (OFR-006)**: `@tako/ingest` concentra a persistência da importação; o painel e o worker rodam o
  mesmo código, o erro resolvido fica marcado com a execução que o resolveu e a linha recusada guarda o conteúdo.
- **Histórico de preço (EXP-001)**: `summarizeHistory` com cobertura explícita e bloco na página do jogo.
- **Administração**: `/admin/usuarios` (papel, ativação, revogação de sessão), `/admin/auditoria` filtrável e
  segundo fator TOTP em `/admin/seguranca` com login em duas etapas.
- **Produtos**: cadastro de edição, DLC e bundle pelo painel, com publicação.
- **Operação (OPS-001)**: `/api/health` com 503 quando degrada, `scripts/healthcheck.mjs`, tabela de integrações no
  painel de qualidade e limites em `docs/monitoracao.md`.
- **Backup (OPS-002)**: `scripts/backup.sh` e `scripts/restore.sh`, com restauração provada e procedimento em
  `docs/backup.md`.
- **Acessibilidade (STO-006)**: `scripts/check-contrast.mjs` (porta do `check.mjs`), link de pular conteúdo, foco
  visível, `aria-current` e auditoria em `docs/acessibilidade.md`.

### Corrigido

- `redirect()` dentro de `try` fazia o painel exibir `NEXT_REDIRECT` no banner de erro.
- Timestamps do Postgres chegavam como `Date` e quebravam o histórico de preço no navegador.
- Reprocessar erros não conta mais como falha da fonte.
- Credenciais de demonstração só aparecem com `DEMO_CATALOG` ligado.

### Processo

- Feature entra na `develop` por merge commit, nunca squash: os commits pequenos continuam no histórico.

### Notas

- Continua sem integração real de loja (OFR-008/009), licença (WEB-002), proteção de branch (WEB-004) e publicação
  (OPS-003/004). Ver `docs/estado-do-prd.md`.

## [0.1.0] — 2026-10-27

Primeira versão funcional da Tako Store, com catálogo fictício e as fases 0 a 3 do PRD.

### Adicionado

- **Design system**: cópia do design system do Tako Launcher em `design/desktop/`, com 90 especificações, tokens,
  ícones, marca e fontes; sincronia por script; galeria em `/dev/componentes` e base visual em `/dev`.
- **Método**: skills do lippstack em `.claude/skills/` (`investigate`, `qa`, `ship` e cinco de design), com
  sincronia e `AGENTS.md` dizendo quando abrir cada um.
- **Domínio**: elegibilidade de oferta por produto, região, moeda, disponibilidade, plataforma e prazo da fonte;
  menor preço com empate estável e sem favorecer parceira; desconto só com referência confiável; busca sem acento;
  seções automáticas da home; validação de destino do redirecionamento.
- **Banco**: PostgreSQL com migração numerada, dinheiro em inteiro, histórico de observações, auditoria e seed
  fictício de 12 jogos, 4 lojas, 3 fontes e 31 ofertas.
- **Painel**: login com scrypt e sessão revogável, permissões por perfil verificadas no servidor, jogos (editar,
  publicar, ocultar, arquivar), vínculos, ofertas com veredito, lojas, fontes, home e painel de qualidade.
- **Importação**: contrato de conector, fonte de demonstração, importador JSON/CSV com erro por linha, sugestão de
  vínculo por confiança e worker idempotente.
- **Loja pública**: home configurável, catálogo com filtros na URL, página do jogo, busca com sugestões,
  redirecionamento seguro, `sitemap.xml`, `robots.txt` e dados estruturados.

### Notas

- Nenhuma integração real de loja: depende de acesso e contrato com parceiros (OFR-008/009).
- O catálogo é de demonstração e a loja avisa isso no rodapé (`DEMO_CATALOG=0` desliga o aviso).
- Licença do repositório ainda não definida.
