# O design system aqui é emprestado

`design/desktop/` é uma cópia do design system do [Tako Launcher](https://github.com/lippdev/tako-launcher). A
fonte continua sendo o launcher; aqui ele é **somente leitura**. Mudou o visual? Muda lá e roda a sincronia — este
diretório é sobrescrito.

## O que veio

| Caminho | O que é |
| :- | :- |
| `README.md` | As regras do sistema: marca, cor, tipografia, superfícies, ícones, movimento, acessibilidade, entradas. É a referência que o [`AGENTS.md`](../../AGENTS.md) manda ler antes de montar tela. |
| `tokens.css` | As variáveis CSS dos temas (TAKO, Escuro, Meia-noite, Preto OLED, Liquid Glass) e as classes de tipografia. É a fonte dos tokens do app. |
| `tokens.json` | Os mesmos tokens, em JSON, com a origem (Slint) e a direção do rebranding. |
| `design-system.json` | O índice do sistema na ferramenta de design do launcher: grupos de assets, componentes e cartões. |
| `assets/Icones/` | O conjunto de ícones em SVG (traço de 1,7, 24×24). O app gera o componente `Icon` a partir daqui. |
| `assets/Logos/` | A marca: polvo, palavra, kana e o logo horizontal. |
| `fonts/` | Poppins (display) e Plus Jakarta Sans (base), com as licenças OFL. |
| `components/<Nome>/README.md` | A especificação de cada uma das 90 peças: medidas, estados, quando usar. |

## O que ficou de fora, e por quê

- **`preview.html` e `components/bundle.css`/`bundle.js`** (≈ 13,6 MB): as prévias são o protótipo do mantenedor
  rodando, com o CSS do bundle injetado pelo visualizador do launcher. Fora do launcher elas abrem sem estilo. Neste
  repositório o critério visual é outro e é melhor: a galeria `#/componentes` do app, montada com os mesmos
  componentes React que a loja usa, conferida a 1600×900 contra a especificação em `components/<Nome>/README.md`.
- **`Backlog.md` e `Implementacao.md`**: são do produto launcher (backlog de telas e o caminho técnico em Slint),
  não do design system.

## Origem e atualização

Copiado de `lippdev/tako-launcher`, commit [`615e48e`](https://github.com/lippdev/tako-launcher/commit/615e48e494605f45c2257fd3ff0a1e8710104aed)
(`main`, 2026-10-26), em 27/10/2026.

```bash
node scripts/sync-design-system.mjs              # último main do launcher
node scripts/sync-design-system.mjs --ref 615e48e
```

Depois da sincronia, gere de novo o que o app consome (`web/src/styles/`, ícones e marca):

```bash
cd web && npm run sync:design
```

Se a sincronia trouxer um token novo, ele entra no `tokens.css` do app sozinho — quem usa o token é que precisa
do ajuste, e é isso que a galeria mostra.

## Licença

O Tako Launcher é do Filipe Moreira; a marca e os ícones são dele. As fontes vêm com a licença SIL Open Font (OFL),
em `fonts/`. O logotipo não é para uso de terceiros fora do produto.
