# Instruções para agentes

Você está no repositório da **Tako Store**: a loja web de jogos e comparador de preços do ecossistema Tako, mercado
inicial Brasil, produto em português. Este arquivo vale para qualquer agente (Claude Code, Codex, Gemini CLI, Kimi,
Capy…). `CLAUDE.md` aponta para cá.

## 1. Ordem de verdade

1. O **brief** da sua tarefa (a issue ou o pedido).
2. [`docs/PRD.md`](docs/PRD.md) — o produto, o escopo da primeira versão, as regras de preço e o que não pode ser
   inventado.
3. Os **[ADRs](docs/adr/)** — decisões já tomadas com contexto. Hoje: o design system vem do launcher
   ([0001](docs/adr/0001-design-system-adaptado-do-launcher.md)) e a stack do produto está em aberto
   ([0002](docs/adr/0002-stack-da-fundacao.md)).
4. [`CONTRIBUTING.md`](CONTRIBUTING.md) — Git Flow, commits, PR.
5. Visual: [`design/desktop/`](design/desktop/) — `README.md` (as regras), `tokens.css`, `components/<Nome>/README.md`
   (a especificação de cada peça) e a galeria do app em `#/componentes`, a 1600×900.

Se o brief contradiz o PRD ou um ADR, **pare e diga no relatório**; não escolha sozinho.

## 2. Regras de produto

- **Mock não é integração.** Use dados fictícios à vontade, mas nunca apresente dado inventado como oferta real de
  uma loja parceira, nem invente acesso a parceiro que não existe (PRD §19).
- **A parceria não decide o preço.** A ordem da comparação sai do menor preço elegível: produto, edição, região,
  moeda, disponibilidade e validade (PRD §10). Loja parceira não sobe na fila.
- **Sem métrica inventada.** Nota, desconto, "menor preço em 90 dias" e afins só aparecem quando a fonte responde.
  Sem dado, o bloco some em vez de mostrar zero.
- **Preço vencido não é preço.** Oferta fora da validade nunca aparece como oferta atual.
- **A compra acontece na loja.** A Tako Store encaminha; não existe checkout próprio na primeira versão.
- **Português na interface, inglês no código.** Nomes de variáveis, tipos e arquivos em inglês; texto que o usuário
  lê em português brasileiro.

## 3. Regras de código e de front

- **Tokens, não valores soltos.** Cor, raio, sombra, espaçamento e tipografia vêm de `var(--…)` do `tokens.css`. Se
  falta um token, ele nasce no launcher e chega aqui pela sincronia (§5) — não se inventa `#1f2024` no componente.
- **Animação só de `transform` e `opacity`**, nunca de `width`, `height`, `top`, `left` ou `font-size`. Curva padrão:
  `cubic-bezier(0.22, 1, 0.36, 1)`.
- **"Reduzir animações" zera duração e atraso.** Toda animação nova precisa continuar fazendo sentido com isso
  ligado.
- **Acessibilidade não é acabamento.** Texto mínimo de 12, alvo mínimo de 24×24, botão só de ícone com `aria-label` e
  dica, foco sempre visível, contraste de 4,5:1 — inclusive sobre arte de jogo, onde o texto leva véu ou sombra.
- **Responsivo de verdade.** A loja é web: confira a 1600×900 (a medida do design) e em celular (390×844) antes de
  dizer que está pronto.
- **Estado vazio, carregando e erro** fazem parte da tela, não são pendência.
- Componente novo da loja? Ele nasce em `web/src/components/<Nome>/` com `Nome.tsx`, `Nome.module.css` e
  `Nome.demo.tsx` (a demo entra sozinha na galeria). Componente que já existe no design system não se reescreve.

## 4. Fluxo de trabalho

Git Flow (detalhes em `CONTRIBUTING.md`): a base é `develop`; trabalho novo vai em `feature/<id>-<slug>`; release e
hotfix são os únicos que tocam a `main`. **Nunca** faça push direto em `main` ou `develop`.

- **Commits pequenos e frequentes**, em Conventional Commits: cada etapa que se entende sozinha vira um commit.
  Uma tarefa grande rende dez commits, não um.
- Feche o commit com `Refs: <ID>` quando houver issue.
- Termine com a verificação verde, em `web/`:

```bash
npm run typecheck
npm run lint
npm run build
```

- Abra o PR com base em `develop`, com o que mudou, por quê e **como foi verificado** (comando e resultado). Merge é
  de quem revisa.
- Nunca encerre processo que você não iniciou (`pkill`, `killall`, `Stop-Process` e afins): outros agentes rodam
  builds e servidores na mesma máquina. Use a sua porta (a 5174 é desta máquina para a loja; a 5173 é do launcher).
- Nada de segredo no repositório: nem `.env`, nem token, nem credencial de parceiro em fixture.

## 5. Design system

`design/desktop/` é **cópia somente leitura** do design system do
[Tako Launcher](https://github.com/lippdev/tako-launcher). A fonte é o launcher.

| Preciso… | Faço |
| :- | :- |
| Usar uma peça que já existe | Importo de `web/src/components/<Nome>/`. A especificação está em `design/desktop/components/<Nome>/README.md`. |
| Conferir como a peça deve parecer | Abro a galeria (`npm run dev` → `#/componentes`) a 1600×900 e comparo com a especificação. |
| Mudar o visual de uma peça do sistema | Mudo **no launcher**, e trago com `node scripts/sync-design-system.mjs`. Aqui não se edita `design/desktop/`. |
| Criar uma peça da loja (card de oferta, selo de desconto, tabela do painel) | Crio em `web/src/components/`, com demo. Ela é da loja, não do sistema. |

Depois de sincronizar o design system, regenere o que o app consome: `cd web && npm run sync:design`. O
`scripts/check.mjs` acusa se os arquivos gerados ficaram para trás.

## 6. Skills (lippstack)

Os skills estão em [`.claude/skills/`](.claude/skills/), que o Claude Code lê sozinho; em outro agente, abra o
`SKILL.md` do caminho. Use quando:

- **`investigate`** — bug, teste quebrando, comportamento estranho. Lei de ferro: nenhuma correção antes da causa
  provada.
- **`qa`** — verificar o que você fez, de ponta a ponta, com teste de regressão.
- **`ship`** — antes de abrir o PR: conferências, documentação, o PR.
- **`apple-design`** — movimento, gesto e material na interface.
- **`review-animations`** / **`animation-performance`** — animação que já existe e perde a sensação ou perde quadro.
- **`break-ui`** — antes de considerar uma tela pronta: texto longo, lista vazia, número gigante.
- **`prototype`** — quando há mais de um caminho visual e é melhor escolher olhando.

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
