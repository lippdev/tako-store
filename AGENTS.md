# Instruções para agentes

Você está no repositório da **Tako Store**: a loja web de jogos e comparador de preços do ecossistema Tako, mercado
inicial Brasil, produto em português. Este arquivo vale para qualquer agente (Claude Code, Codex, Gemini CLI, Kimi,
Capy…). `CLAUDE.md` aponta para cá.

## 1. Ordem de verdade

1. O **brief** da sua tarefa (a issue ou o pedido).
2. [`docs/PRD.md`](docs/PRD.md) — o produto, o escopo da primeira versão, as regras de preço e o que não pode ser
   inventado.
3. Os **[ADRs](docs/adr/)** — decisões já tomadas com contexto: o design system vem do launcher
   ([0001](docs/adr/0001-design-system-adaptado-do-launcher.md)), a stack é Next + PostgreSQL + worker
   ([0003](docs/adr/0003-stack-next-postgres-worker.md)).
4. [`CONTRIBUTING.md`](CONTRIBUTING.md) — Git Flow, commits, PR.
5. Visual: [`design/desktop/`](design/desktop/) — `README.md` (as regras), `tokens.css`, `components/<Nome>/README.md`
   e a galeria do app em `/dev/componentes`, a 1600×900.

Se o brief contradiz o PRD ou um ADR, **pare e diga no relatório**; não escolha sozinho.

## 2. Regras de produto

- **Mock não é integração.** Use dados fictícios à vontade, mas nunca apresente dado inventado como oferta real de
  uma loja parceira, nem invente acesso a parceiro que não existe (PRD §19). Enquanto o catálogo for de
  demonstração, o rodapé da loja avisa (`DEMO_CATALOG=0` desliga o aviso quando houver dado real).
- **A regra de preço mora em `packages/domain`.** Elegibilidade, menor preço, empate, vencimento e desconto são
  funções puras, testadas, usadas pela loja e pelo painel. Não reimplemente a conta em componente, em SQL de tela ou
  em rota: importe do domínio. A tela nunca decide o que é "o menor preço".
- **A parceria não decide o preço.** A ordem sai do menor preço elegível: produto e edição, região, moeda,
  disponibilidade e validade (PRD §10). Loja parceira não sobe na fila.
- **Sem métrica inventada.** Nota, desconto, "menor preço em 90 dias" e afins só aparecem quando a fonte responde.
  Sem dado, o bloco some.
- **Preço vencido não é preço.** Oferta fora do prazo da fonte continua no histórico, mas não aparece como atual.
- **A compra acontece na loja.** A Tako Store encaminha; não existe checkout próprio na primeira versão. O
  redirecionamento só aceita domínio cadastrado da loja e nunca URL vinda do usuário.
- **Português na interface, inglês no código.**

## 3. Regras de código

- **Tokens, não valores soltos.** Cor, raio, sombra e tipografia vêm de `var(--…)` do `tokens.css`. Token novo nasce
  no launcher e chega pela sincronia — não se inventa `#1f2024` no componente.
- **Animação só de `transform` e `opacity`**; curva padrão `cubic-bezier(0.22, 1, 0.36, 1)`; "Reduzir animações" zera
  duração e atraso.
- **Acessibilidade não é acabamento:** texto mínimo 12, alvo mínimo 24×24, botão só de ícone com `aria-label`, foco
  visível, contraste 4,5:1 inclusive sobre arte.
- **Dinheiro é inteiro em centavos**, sempre. Nunca ponto flutuante, nunca conversão de moeda.
- **Erro de dado externo tem código e linha.** A importação relata o que recusou e por quê; não descarte em silêncio.
- **Nada de `any` para calar o compilador** e nada de `as` para atravessar fronteira de tipo sem checar.

## 4. Fluxo de trabalho

Git Flow (detalhes em `CONTRIBUTING.md`): a base é `develop`; trabalho novo vai em `feature/<id>-<slug>`; release e
hotfix são os únicos que tocam a `main`. **Nunca** faça push direto em `main` ou `develop`.

```bash
npm run db:up            # Postgres de desenvolvimento
npm run db:migrate
npm run db:seed          # catálogo fictício + contas do painel
npm run dev              # loja em http://localhost:5174

node scripts/check.mjs
npm run typecheck
npm run lint
npm test                 # domínio, banco e conectores
npm run build
```

- **Commits pequenos e frequentes**, em Conventional Commits. Uma tarefa grande rende dez commits, não um.
- Abra o PR com base em `develop`, dizendo o que mudou, por quê e **como foi verificado** (comando e resultado).
- Mudança de interface se confere no navegador a 1600×900 e em 390×844, com captura.
- Nunca encerre processo que você não iniciou (`pkill`, `killall`, `Stop-Process`). A 5174 é desta máquina para a
  loja; a 5173 é do launcher.
- Nada de segredo no repositório: nem `.env`, nem token, nem credencial em fixture.

## 5. Design system

`design/desktop/` é **cópia somente leitura** do design system do
[Tako Launcher](https://github.com/lippdev/tako-launcher). A fonte é o launcher.

| Preciso… | Faço |
| :- | :- |
| Usar uma peça que já existe | Importo de `apps/web/src/components/<Nome>/`. A especificação está em `design/desktop/components/<Nome>/README.md`. |
| Conferir como a peça deve parecer | Abro `/dev/componentes` a 1600×900 e comparo com a especificação. |
| Mudar o visual de uma peça do sistema | Mudo **no launcher**, e trago com `node scripts/sync-design-system.mjs` + `npm run sync:design`. Aqui não se edita `design/desktop/`. |
| Criar uma peça da loja (card de jogo, preço, selo de desconto) | Crio em `apps/web/src/components/loja/`, com CSS Module e tokens do sistema. |

## 6. Skills (lippstack)

Os skills estão em [`.claude/skills/`](.claude/skills/), que o Claude Code lê sozinho; em outro agente, abra o
`SKILL.md` do caminho. Use quando:

- **`investigate`** — bug, teste quebrando, comportamento estranho. Lei de ferro: nenhuma correção antes da causa
  provada.
- **`qa`** — verificar o que você fez, de ponta a ponta, com teste de regressão.
- **`ship`** — antes de abrir o PR.
- **`apple-design`** / **`review-animations`** / **`animation-performance`** — movimento e sensação.
- **`break-ui`** — antes de considerar uma tela pronta: texto longo, lista vazia, número gigante.
- **`prototype`** — quando há mais de um caminho visual.

## 7. Relatório de entrega

Termine com este formato, sem enfeite:

```
## <ID> — relatório
Estado: pronto | parcial | bloqueado
Feito: <o que existe agora, em poucas linhas>
Commits: <hash curto e título de cada um>
Arquivos: <lista>
Verificação: <cada comando rodado e o resultado; números medidos, se houver>
Divergências do brief: <o que e por quê, ou "nenhuma">
Em aberto: <dúvidas, riscos, o que falta, ou "nada">
```

"Pronto" só com a saída da verificação. Se algo não pôde ser verificado, diga qual e por quê.
