# ADR-0002 — A fundação roda em Vite + React, com a stack do produto ainda em aberto

**Status:** aceita (provisória, para a Fase 0)
**Data:** 27/10/2026

## Contexto

O PRD (§13) recomenda TypeScript, React "com framework adequado a renderização no servidor e SEO", PostgreSQL,
workers e um monorepo com `apps/web`, `apps/admin`, `packages/ui`, `packages/design-tokens`. Ao mesmo tempo,
`§4 — Decisões ainda abertas` deixa a stack web e a infraestrutura definitivas em aberto, e a si mesmo impõe um
ADR antes de fechar.

A Fase 0 (WEB-001 a WEB-006) precisa de uma base que rode, e o item WEB-006 é objetivo: "tokens e componentes
visuais disponíveis para web".

## Decisão

A fundação tem **um app Vite + React + TypeScript** em [`web/`](../../web), cujo único produto hoje é a galeria de
componentes (`#/componentes`) e a página de base visual (`#/dev`). Ele não é a loja pública.

O que a loja pública vai usar para renderizar no servidor é a **ADR-0003**, ainda por escrever — provavelmente um
framework com SSR. A escolha não bloqueia este trabalho porque:

- Os componentes são React puro com CSS Modules: nenhum importa API do Vite, do Next ou de qualquer bundler.
- O único uso de API de bundler é `import.meta.glob` na galeria, que é ferramenta de desenvolvimento e some se o
  app for substituído.
- Os tokens são CSS puro e as fontes, arquivos locais.
- A galeria continua útil em qualquer stack: ela existe para comparar a peça com a especificação, não para ser
  publicada.

## Consequências

- Quando a ADR-0003 fechar o framework, o caminho esperado é o PRD §13 sugerido: `packages/ui` e
  `packages/design-tokens` recebem o que hoje está em `web/src/components` e `web/src/styles`, e `apps/web` passa a
  ser a loja pública. Os arquivos de `design/desktop/` continuam sendo a fonte.
- Um site público com SSR não pode nascer deste app: SEO (§17.3) e LCP (§17.2) não se resolvem numa SPA.
- Enquanto a decisão não sai, qualquer tela de produto que alguém começar aqui é retrabalho avisado. Este app é
  vitrine de componentes.

## Alternativas consideradas

- **Escolher Next.js agora.** É a recomendação provável e seria a mais rápida, mas o PRD manda registrar a decisão
  num ADR que considera alternativas, custo de hospedagem e execução local; fechar isso sozinho, na fundação,
  seria decidir por quem opera.
- **Fazer só a biblioteca, sem app.** Rejeitada: sem galeria não há como conferir a peça contra a especificação, e
  o item WEB-006 fala em componentes "disponíveis", não em arquivos soltos.
