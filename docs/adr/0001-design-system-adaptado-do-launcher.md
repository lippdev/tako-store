# ADR-0001 — O design system vem do Tako Launcher, na versão atual

**Status:** aceita
**Data:** 27/10/2026

## Contexto

O PRD (§16) manda adaptar o design system do Tako Launcher para web e lista o que preservar: fundo `#0E1116`,
acento `#C8102E`, fallback `#2B3A55`, **Source Sans 3** nos títulos e **Inter** nos textos, cantos arredondados e
botões em pílula.

Esses valores são de antes do rebranding de outubro de 2026 do launcher. O design system atual
([`design/desktop/README.md`](../../design/desktop/README.md)) trocou tudo isso: fundo `#0b0b0e`, UI monocromática
com a cor de destaque só para estado, primário branco com chip escuro, **Poppins** nos títulos e **Plus Jakarta
Sans** no resto, raio de 11 nos botões. O Source Sans 3 continua entre as fontes do launcher, mas não é mais
usado na interface desktop.

Ou seja: o PRD pede o sistema antigo; o launcher, que é a fonte citada pelo próprio PRD, já está dois passos à
frente.

## Decisão

O que vale é o design system **atual** do launcher: `design/desktop/` deste repositório, copiado de
`lippdev/tako-launcher` (ver [`ORIGEM.md`](../../design/desktop/ORIGEM.md)).

- Tokens, fontes, ícones e marca vêm de lá e não são redefinidos aqui.
- A §16 do PRD fica desatualizada na lista de cores e fontes. A parte do que **adaptar** para web (escala
  responsiva, componentes de preço e oferta, tabelas do painel, estados, foco, contraste sobre arte) continua
  valendo e é o trabalho deste repositório.
- Paleta, tipografia e raios novos não entram por decisão de tela: se faltar uma cor de estado para preço ou
  desconto, ela é criada no launcher e chega aqui pela sincronia.

## Consequências

- Quem abrir o PRD vai encontrar valores de cor e fonte que não batem com o código. Este ADR é a resposta; a §16
  deve ser corrigida na próxima revisão do PRD, pelo dono do documento.
- A loja herda a UI monocromática do launcher. Isso é bom para a comparação de preços — o preço e o desconto
  ganham destaque justamente por não competirem com cor de interface — e diferente do que uma loja colorida
  faria.
- A adaptação para web precisa de decisões novas (grade responsiva, cards de oferta, tabela do painel). Elas
  entram como componentes deste repositório, marcados como da loja, e não como mudança no `design/desktop/`.

## Alternativas consideradas

- **Seguir a §16 do PRD ao pé da letra.** Rejeitada: recria no código uma identidade que o produto abandonou, e
  afasta a loja do launcher, que é o requisito central (§2).
- **Manter os dois sistemas em paralelo.** Rejeitada: dobra a manutenção e a loja passaria a parecer outro produto.
