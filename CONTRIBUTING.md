# Como contribuir

O fluxo é o **Git Flow** descrito pela Atlassian em
[gitflow-workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow). Este arquivo é a
versão curta que vale para este repositório; em caso de dúvida, a documentação da Atlassian manda.

## As cinco branches

| Branch | Vive | Vem de | Vai para | Regra |
| :- | :- | :- | :- | :- |
| `main` | sempre | — | — | Só recebe release e hotfix. Cada commit aqui é uma versão publicável. |
| `develop` | sempre | `main` (uma vez) | — | Integração do que está pronto para a próxima release. É a base de todo trabalho novo. |
| `feature/*` | até entrar na `develop` | `develop` | `develop` | Uma feature por branch, por menor que seja. Nunca fala com `main`. |
| `release/*` | até virar tag | `develop` | `main` **e** `develop` | Só correção de release: versão, changelog, ajuste de último minuto. Nada de feature nova. |
| `hotfix/*` | até virar tag | `main` | `main` **e** `develop` | Conserto urgente do que está em produção. |

```
main     ──●──────────────────●─────────●──
             \                ↑         ↑
release/1.0   \───●───●───────┘         │
               \                       │
develop  ──●────●────●────●────●───────●──
            \        ↑         ↑
feature/x    ●───●───┘         │
feature/y        ●───●───●─────┘
```

## O ciclo

**Feature.** `git switch develop && git pull`, `git switch -c feature/nome-curto`, commits pequenos, PR com base
em `develop`. A feature só entra na `develop` por pull request revisado.

**Release.** Quando a `develop` junta o que fecha uma versão: `git switch -c release/1.2.0`, sobe a versão e o
changelog, PR para `main`. Depois do merge, tag `v1.2.0` na `main` e o back-merge `main` → `develop`, para a
`develop` não perder o que a release corrigiu.

**Hotfix.** `git switch -c hotfix/descricao` a partir da `main`, conserto, PR para `main`, tag de patch, e o
back-merge `main` → `develop` pelo mesmo motivo.

`main` e `develop` não recebem push direto. A única exceção foi o commit de bootstrap, num repositório que ainda
não tinha nenhum.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `tipo(escopo): resumo no imperativo`.

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
Escopos deste repositório: `web`, `design`, `skills`, `scripts`, `docs`.

- **Commits pequenos e frequentes.** Cada commit é uma etapa que se entende sozinha e que se pode reverter sem
  levar o resto junto. Uma feature grande vira vários commits: o scaffolding, cada peça, os testes, a documentação.
- Um commit, uma ideia. Não misture formatação com comportamento, nem renomeação com mudança de lógica.
- Se o trabalho veio de uma tarefa, feche com `Refs: <ID>` no rodapé.
- Nunca commite segredo, `.env`, `node_modules` ou artefato de build.

## Pull requests

Título no formato de commit. O corpo diz o que mudou, por quê, e **como foi verificado** (comandos e resultado).
Um PR por assunto, com base na `develop` — exceto release e hotfix, que apontam para a `main`.

O merge é do revisor. Quem abriu o PR não faz o merge.

## Proteção das branches

`main` e `develop` são protegidas: PR obrigatório, CI verde (`verificar`) e sem force-push. Quem tem administração do
repositório aplica com:

```bash
for b in main develop; do
  gh api -X PUT "repos/lippdev/tako-store/branches/$b/protection" \
    -f "required_status_checks[strict]=true" \
    -f 'required_status_checks[contexts][]=verificar' \
    -F "enforce_admins=false" \
    -F "required_pull_request_reviews[required_approving_review_count]=1" \
    -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
    -F "restrictions=null" \
    -F "allow_force_pushes=false" \
    -F "allow_deletions=false"
done
```

A integração do GitHub que abre os PRs daqui não tem permissão de administração para aplicar isso sozinha (a API
responde `403 Resource not accessible by integration`), então a primeira vez é manual.

## Verificação antes de abrir o PR

Na raiz do repositório:

```bash
node scripts/check.mjs
npm run typecheck
npm run lint
npm test          # domínio, banco (precisa do Postgres em docker compose) e conectores
npm run build
```

Para os testes de banco: `npm run db:up && npm run db:migrate && npm run db:seed`.

Mudança visual também se confere no navegador, a 1600×900 (a medida do design system) e em 390×844, contra a galeria
`/dev/componentes` e a especificação em `design/desktop/components/<Nome>/README.md`.
