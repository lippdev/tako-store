# Tako Store

Loja web de jogos e comparador de preços do ecossistema [Tako](https://github.com/lippdev/tako-launcher). O usuário
descobre jogos, compara ofertas válidas para o Brasil e conclui a compra no site da loja escolhida.

**Status: fases 0 a 3 e a operação da fase 4 entregues com dados fictícios.** Catálogo, ofertas, painel
administrativo, importação com reprocessamento, loja pública, monitoramento e backup funcionam de ponta a ponta. As
integrações reais de loja (OFR-008/009) dependem de acesso a parceiros; a publicação (OPS-004) depende de hospedagem e
domínio.

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
| Painel | Login com perfis e segundo fator, jogos, duplicatas, vínculos, ofertas, lojas, fontes (matriz e reprocessamento), produtos, usuários, auditoria, home e qualidade |
| Importação | Contrato de conector, fonte de demonstração, arquivo JSON/CSV com erro por linha e reprocessamento dos erros pelo painel |
| Loja pública | Home configurável, catálogo com filtros na URL, página do jogo com galeria e histórico de preço, busca com sugestões, redirecionamento seguro, sitemap |
| Operação | `/api/health` com sinal de degradação, monitor em `scripts/healthcheck.mjs`, backup e restauração provados |
| Integrações reais | **Não**: depende de acesso e contrato com as lojas (PRD §9) |

Todos os dados do seed são fictícios: lojas, jogos, preços e imagens de demonstração. O rodapé da loja diz isso.

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
npm run worker -- import --source arquivo-demo --file ./catalogo.csv
npm run worker -- retry --run <id>               # reprocessa os erros de uma execução
```

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
