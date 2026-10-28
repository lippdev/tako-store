# Tako Store

Loja web de jogos e comparador de preços do ecossistema [Tako](https://github.com/lippdev/tako-launcher). O usuário
descobre jogos, compara ofertas válidas para o Brasil e conclui a compra no site da loja escolhida.

**Status: loja rodando com catálogo real da Steam (736 jogos com preço em BRL).** Catálogo, ofertas, painel
administrativo, importação com reprocessamento, loja pública, monitoramento e backup funcionam de ponta a ponta. O
catálogo de demonstração foi arquivado. As demais integrações reais (OFR-009) esperam aprovação de afiliados — a
lista de cadastros está em [`docs/integracoes.md`](docs/integracoes.md) §7 — e a publicação (OPS-004) depende de
hospedagem e domínio.

- Produto, escopo e regras de preço: [`docs/PRD.md`](docs/PRD.md)
- Decisões com contexto: [`docs/adr/`](docs/adr/)
- Como contribuir (Git Flow, commits, PR): [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Como um agente deve trabalhar aqui: [`AGENTS.md`](AGENTS.md)

## O que existe

| Área | Estado |
| :- | :- |
| Catálogo e produtos | Jogo, edição, DLC e bundle; identificadores por fonte; biblioteca de imagens com procedência e galeria |
| Curadoria | Revisão de duplicatas com impacto e união registrada em histórico; nenhuma união automática |
| Ofertas e preço | Menor preço elegível por produto, região, moeda, disponibilidade e validade; empate documentado |
| Painel | Login com perfis e segundo fator, jogos (criar, editar, imagens, identificadores), duplicatas, vínculos, ofertas com cliques, lojas com chave de afiliado, fontes (feed por URL, matriz, execução e reprocessamento), produtos, usuários, auditoria, home com banners e seções, qualidade |
| Importação | Contrato de conector, feed por URL (JSON/CSV) com de-para de campos, arquivo local, erro por linha, reprocessamento pelo painel e agendador que respeita a cadência |
| Loja pública | Home com carrossel de destaques, catálogo com filtros na URL, página do jogo com galeria e histórico de preço, busca com sugestões, redirecionamento com link de afiliado, sitemap |
| Operação | `/api/health` com sinal de degradação, monitor em `scripts/healthcheck.mjs`, backup e restauração provados |
| Integrações reais | **Steam, em produção no catálogo**: API pública da vitrine em BRL, rastreio amplo por prioridade do SteamSpy; as demais lojas esperam aprovação de afiliados (mapa em `docs/integracoes.md` §6 e §7) |

Todos os dados do seed são fictícios: lojas, jogos, preços e imagens de demonstração. O rodapé da loja diz isso
(`DEMO_CATALOG=0` em `apps/web/.env.local` desliga o aviso quando há dado real — é o estado atual). O seed se recusa
a apagar o catálogo real da Steam sem `SEED_DEMO=1`, e as ofertas reais não são apresentadas como demonstração.

## Rodar

Precisa de Node 24 e Docker (para o banco).

```bash
npm install
npm run db:up          # Postgres 17 em docker compose
npm run db:migrate     # schema
npm run db:seed        # catálogo de demonstração

npm run dev            # http://localhost:5174
```

Rotas:

| Rota | O que é |
| :- | :- |
| `/` | home com banners e seções configuradas |
| `/jogos` | catálogo com filtros e ordenação na URL |
| `/jogo/<slug>` | página do jogo, produtos e ofertas elegíveis |
| `/ir/<id-da-oferta>` | redirecionamento para a loja (domínio validado) |
| `/admin` | painel (login `admin@tako.dev` / `tako-demo-2026`), com usuários, auditoria, segurança (segundo fator) |
| `/dev` e `/dev/componentes` | base visual e galeria do design system |

Importação pelo worker:

```bash
npm run worker -- sources                        # fontes, situação na matriz e conector disponível
npm run worker -- runs                           # últimas execuções e erros abertos
npm run worker -- import --source arquivo-demo   # importa a fonte de demonstração
npm run worker -- import --source steam          # coleta os destaques da vitrine da Steam (BRL)
npm run worker -- crawl --source steam --topo N  # rastreio amplo: prioridade do SteamSpy, pulando conhecidos
npm run worker -- import --source arquivo-demo --file ./catalogo.csv
npm run worker -- retry --run <id>               # reprocessa os erros de uma execução
npm run worker -- due                            # uma passada pelas fontes com coleta devida
npm run worker -- daemon                         # agendador (60 s por padrão, respeita a cadência)
```

Para ligar uma loja real — domínios, chave de afiliado, feed e agendamento — siga
[`docs/integracoes.md`](docs/integracoes.md).

O mesmo reprocessamento está no painel, em **Fontes → Erros aguardando reprocessamento**.

Operação:

```bash
node scripts/healthcheck.mjs            # status da operação (sai 1 quando degradada)
./scripts/backup.sh                     # dump em backups/tako-store-<data>.dump
./scripts/restore.sh <dump> --database tako_store_restore   # restaura num banco novo
```

Procedimentos: [`docs/monitoracao.md`](docs/monitoracao.md) e [`docs/backup.md`](docs/backup.md).

## Estrutura

```
apps/
  web/                 Next 16: loja pública, painel e rotas de API
  worker/              importação (coleta → validação → vínculo → oferta)
packages/
  domain/              regras puras: preço elegível, empate, vencimento, busca, seções, histórico, duplicatas
  db/                  schema, migrações, seed e repositórios (SQL escrito à mão)
  connectors/          contrato de conector, fonte de demonstração e importador
  ingest/              persistência da importação e reprocessamento (usado pelo worker e pelo painel)
design/desktop/        design system do Tako Launcher, cópia somente leitura (+ ORIGEM.md)
.claude/skills/        skills do lippstack usados aqui (+ ORIGEM.md)
docs/                  PRD e ADRs
scripts/               sincronias, conferências e capas de demonstração
```

## Verificar

```bash
node scripts/check.mjs   # arquivos, skills, tokens, ícones e contraste em dia
npm run typecheck        # todos os workspaces
npm run lint             # apps/web
npm test                 # domínio, banco (precisa do Postgres), conectores e ingestão
npm run build            # build de produção do Next
```

## Deploy

`deploy/` traz o que não depende de código para subir: unidades systemd para a loja e para o worker (`daemon`) e um
`env.example` com as variáveis esperadas. O arquivo de ambiente real fica fora do repositório, em
`/etc/tako-store/env`, com permissão 0600.

```bash
npm ci && npm run build
sudo cp deploy/systemd/tako-*.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now tako-web tako-worker
```

## Design system

O visual vem de [`design/desktop/`](design/desktop/), cópia do launcher. O app consome uma versão gerada — tokens,
fontes, ícones e marca:

```bash
node scripts/sync-design-system.mjs   # traz do launcher
npm run sync:design                   # gera tokens, fontes, ícones e marca no app
```

A decisão de usar a versão atual do sistema, e não a paleta antiga da §16 do PRD, está na
[ADR-0001](docs/adr/0001-design-system-adaptado-do-launcher.md). A stack está na
[ADR-0003](docs/adr/0003-stack-next-postgres-worker.md).

## Processo

Git Flow, conforme [`CONTRIBUTING.md`](CONTRIBUTING.md): `main` é produção, `develop` é a integração, `feature/*`
sai da `develop` e volta por pull request com commits pequenos. O merge é **merge commit**, nunca squash: cada commit
da branch continua na `develop`.
