# ADR-0003 — Next.js, PostgreSQL e um worker Node, em monorepo npm

**Status:** aceita
**Data:** 27/10/2026

## Contexto

A [ADR-0002](0002-stack-da-fundacao.md) deixou a stack do produto em aberto e prometeu esta decisão antes da
primeira tela de loja. O PRD (§13, §17) exige: React com renderização no servidor e SEO, banco relacional,
workers para importação, TypeScript em tudo, PostgreSQL sugerido, e um monorepo com fronteiras entre loja, painel,
domínio e conectores ("é possível começar com menos aplicações implantáveis, desde que as fronteiras entre
responsabilidades sejam mantidas").

O que a loja tem de específico: as páginas de jogo e de catálogo precisam ser indexáveis (§17.3), o preço de uma
oferta vale por até 24 horas e não pode aparecer vencido como atual (§10.4), e a importação roda fora do ciclo de
uma requisição.

## Decisão

| Responsabilidade | Escolha | Por quê |
| :- | :- | :- |
| Loja pública, painel e API | **Next.js 16 (App Router) + React 19** | Um só app entrega SSR, metadados por página, sitemap e as rotas de API; o painel é um segmento `/admin` com as mesmas peças do design system. |
| Domínio | **`packages/domain`**, TypeScript puro | As regras de preço e elegibilidade (§10) são o coração do produto e precisam de teste rápido, sem banco e sem HTTP. |
| Banco | **PostgreSQL 17**, via `pg` | Relacional como o PRD pede; inteiros para dinheiro (§10.3); `unaccent` para a busca (§11.2); transações para a importação idempotente (§15). |
| Acesso a dados | **`packages/db`**, SQL escrito à mão e migrações numeradas | Sem ORM: o schema é pequeno, as consultas de preço são específicas e o SQL aparece inteiro para quem revisa. |
| Conectores | **`packages/connectors`** | Contrato único (§15) e uma fonte de demonstração; as lojas reais entram depois como pacotes do mesmo formato. |
| Importação e tarefas | **`apps/worker`**, processo Node separado | Importação não disputa o processo da loja e pode ser reiniciada sozinha (§17.2). |
| Monorepo | **npm workspaces** | O npm já é o gerenciador do repositório; não há ganho em trocar. |
| Testes | `node:test` para domínio e integração | Já vem no Node 24, sem dependência de framework. |

O painel **não** nasce como app separado: é o segmento `/admin` do mesmo Next. A fronteira que importa é a de
autorização (verificada no servidor, §12.1), e ela é feita no mesmo lugar em que as rotas existem. Se o painel
ganhar escala própria, sai como segundo app sem mexer no domínio.

Os componentes e os tokens também ficam em `apps/web` por enquanto (`src/components`, `src/styles`). Só existe um
consumidor; empacotar `ui` e `design-tokens` agora criaria uma fronteira sem uso. A extração é mecânica no dia em
que o segundo app aparecer.

## Consequências

- O app Vite da fundação é substituído: `web/` vira `apps/web` em Next. A galeria `#/componentes` passa a `/dev` +
  `/dev/base`, e deixa de ser SPA com hash — não há nada publicado que dependa das rotas antigas.
- Publicar exige um host Node e um Postgres gerenciado; não é site estático. Isso estava implícito no PRD ao pedir
  catálogo, ofertas, painel e importação.
- O CI ganha um serviço de Postgres para os testes de integração.
- A instalação local precisa de Docker Compose (banco) e de dois processos (`web` e `worker`).

## Alternativas consideradas

- **Astro + ilhas de React.** Ótimo para SEO e leveza, mas o painel e o catálogo interativo (filtros, tabelas,
  edição) dariam muito mais trabalho em ilhas do que em um app React completo.
- **Remix/React Router 7.** Equivalente em capacidade; Next tem mais gente, mais documentação de SEO e hospedagem
  mais simples para quem vem de React.
- **Manter a SPA Vite.** Rejeitada: sem SSR não há SEO (§17.3), e sem SEO a loja perde o canal pelo qual ela
  existe.
- **ORM (Prisma/Drizzle).** Rejeitada por ora: o schema é pequeno, e as consultas de elegibilidade e menor preço
  são mais claras em SQL do que em query builder.
