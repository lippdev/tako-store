# Tako Store

Loja web de jogos e comparador de preços do ecossistema [Tako](https://github.com/lippdev/tako-launcher). O usuário
descobre jogos, compara ofertas válidas para o Brasil e conclui a compra no site da loja escolhida.

**Status: Fase 0 — fundação.** O repositório tem o design system, o método de trabalho e o processo. As telas de
produto começam na Fase 1 (catálogo e administração).

- Produto, escopo e regras de preço: [`docs/PRD.md`](docs/PRD.md)
- Decisões com contexto: [`docs/adr/`](docs/adr/)
- Como contribuir (Git Flow, commits, PR): [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Como um agente deve trabalhar aqui: [`AGENTS.md`](AGENTS.md)

## Estrutura

```
design/desktop/        design system do Tako Launcher, cópia somente leitura (+ ORIGEM.md)
  components/<Nome>/   a especificação de cada uma das 90 peças
  tokens.css           as variáveis dos temas e as classes de tipografia
  assets/, fonts/      ícones, marca, Poppins e Plus Jakarta Sans
web/                   app Vite + React + TypeScript (galeria e base visual)
  src/components/      os componentes do sistema, com a demo de cada um
  src/app/             as telas
  src/dev/             galeria (#/componentes) e base visual (#/dev)
.claude/skills/        skills do lippstack que este repositório usa (+ ORIGEM.md)
scripts/               sincronia do design system e dos skills, e as conferências
docs/                  PRD e ADRs
```

## Rodar

Precisa de Node 24.

```bash
cd web
npm install
npm run dev          # http://localhost:5174
```

Rotas: `#/` início, `#/componentes` galeria, `#/dev` base visual (temas, tipografia, paleta, ícones).

Verificação antes do PR:

```bash
cd web
npm run typecheck
npm run lint
npm run build

node ../scripts/check.mjs    # ou, da raiz: node scripts/check.mjs
```

## O design system

O visual não é redefinido aqui: ele vem do design system do Tako Launcher, em
[`design/desktop/`](design/desktop/). O app consome uma cópia gerada — tokens, fontes, ícones e marca — para o build
não depender da pasta de design.

```bash
node scripts/sync-design-system.mjs        # traz o design system do launcher (main)
cd web && npm run sync:design              # gera tokens, fontes, ícones e marca no app
```

A decisão de usar a versão **atual** do sistema, e não a paleta antiga que ainda aparece na §16 do PRD, está na
[ADR-0001](docs/adr/0001-design-system-adaptado-do-launcher.md).

## O método

Os skills de engenharia e de design do [lippstack](https://github.com/lippdev/lippstack) estão em
[`.claude/skills/`](.claude/skills/): `investigate` para achar causa de bug, `qa` para verificar, `ship` para abrir o
PR, e os de design para o visual. Para atualizar:

```bash
node scripts/sync-skills.mjs
```

## Processo

Git Flow, conforme [`CONTRIBUTING.md`](CONTRIBUTING.md): `main` é produção, `develop` é a integração, `feature/*`
sai da `develop` e volta por pull request com commits pequenos. Release e hotfix são os únicos que entram na `main`.
