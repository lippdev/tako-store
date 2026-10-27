# Acessibilidade (STO-006)

O que foi conferido, com que medida, e o que ainda não está conforme.

## Escopo auditado

Loja: home, catálogo (`/jogos`), página do jogo, busca e o redirecionamento para a loja. Painel: login, listas
(jogos, duplicatas, fontes, qualidade), formulários de cadastro e as ações de publicação.

## Contraste

`node scripts/check-contrast.mjs` mede os pares de token que a interface usa e falha quando algum texto fica abaixo
de 4,5:1 (WCAG 2.2 AA, critério 1.4.3) ou quando `--text-dim` aparece como cor de texto.

```text
ok    17.27:1  (mínimo 4.5)  texto sobre superfície  --text sobre --surface
ok    17.49:1  (mínimo 4.5)  texto sobre o fundo da página  --text sobre --canvas
ok    16.52:1  (mínimo 4.5)  texto sobre superfície elevada  --text sobre --surface-raised
ok     6.13:1  (mínimo 4.5)  texto secundário sobre superfície  --text-muted sobre --surface
ok     6.21:1  (mínimo 4.5)  texto secundário sobre o fundo  --text-muted sobre --canvas
ok     5.76:1  (mínimo 4.5)  texto secundário sobre card  --text-muted sobre --tile
nota   3.02:1  (mínimo 4.5)  texto apagado sobre superfície (decorativo)  --text-dim sobre --surface
ok    17.02:1  (mínimo 4.5)  texto do botão primário  --on-primary sobre --primary
ok     7.74:1  (mínimo 4.5)  mensagem de erro  --error sobre --surface
ok    10.88:1  (mínimo 4.5)  mensagem de sucesso  --success sobre --surface
ok    13.20:1  (mínimo 4.5)  aviso  --warning sobre --surface

Todos os 11 pares passam.
```

O que mudou para chegar nisso: a loja e o painel usavam `--text-dim` (#625d63) como cor de texto secundário — 3,02:1,
reprovado. Todo texto dessas telas passou a usar `--text-muted` (6,13:1). O token `--text-dim` continua no design
system para uso decorativo, e o script barra o uso dele como `color`.

## Teclado e foco

Conferido no navegador, a 1600×900, com captura de tela em cada passo:

- **Primeiro Tab** — o link “Ir para o conteúdo” aparece no topo, com anel de foco de 3 px, e leva ao `<main>`.
- **Tab seguinte** — foco no logotipo (link com `aria-label="Tako Store, início"`), depois no menu principal.
- **Menu principal** — o item da seção atual tem `aria-current="page"` e a marca visual (sublinhado) junto com o foco
  visível; a navegação é a mesma em qualquer página.
- **Anel de foco** — `outline: 3px solid var(--focus-ring)` em `:focus-visible`, definido em `src/styles/base.css`;
  nada depende de `:hover`.
- **Formulários do painel** — todo campo tem `<label>` com o nome visível, botão de envio é `<button type="submit">`
  e a ordem de tabulação segue a ordem visual.

Estrutura semântica: um `<h1>` por página, `header`/`nav`/`main`/`footer` como landmarks, `main` com `id="conteudo"`,
tabelas com `<th>` no cabeçalho, listas reais (`<ul>`/`<li>`) para ofertas e capturas, `aria-label` nas seções que não
têm título visível e nos controles só de ícone.

## Alvos e movimento

- Alvo mínimo de 24×24: botões do painel têm 36 px de altura, o link de pular tem 44 px, e os cards inteiros são
  clicáveis.
- “Reduzir animações”: `base.css` zera duração e atraso de animação e transição em `prefers-reduced-motion: reduce`,
  inclusive para `::before`/`::after`.

## Pendências conhecidas

1. **`--text-dim` no design system.** O token está em 3,02:1 e continua usado como cor de texto em 24 componentes
   copiados do launcher (`BibliotecaGrade`, `Dialogo`, `PainelDownloads`, `PerfilColecoes`…). Eles não aparecem nas
   jornadas da loja nem do painel, mas aparecem em `/dev/componentes`. A correção é no launcher (ADR-0001); aqui só se
   importa a versão corrigida.
2. **Leitor de tela real.** A auditoria conferiu semântica, rótulos e ordem de foco por inspeção e teclado; não houve
   sessão com NVDA ou VoiceOver. É o próximo passo antes de chamar a jornada de homologada.
3. **Texto alternativo das imagens de demonstração.** As capturas usam “`<jogo>` — imagem de demonstração”, o que
   descreve a origem, não o conteúdo (que é arte fictícia). Com arte real, o alt precisa vir do cadastro.
4. **Zoom de 200% e reflow** não foram medidos em navegador; a grade usa `minmax` e quebra em 390 px, mas a medição
   formal em 320 px com zoom ainda falta.
