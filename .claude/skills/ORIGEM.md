# Skills de agentes

Os skills do [lippstack](https://github.com/lippdev/lippstack) que este repositório usa, copiados para
`.claude/skills/` — o diretório que o Claude Code lê sozinho. Em outro agente (Codex, Gemini CLI, Capy), o
`SKILL.md` vale do mesmo jeito: é o formato aberto [Agent Skills](https://agentskills.io), e o [`AGENTS.md`](../../AGENTS.md)
diz quando abrir cada um.

| Skill | De onde vem | Quando usar |
| :- | :- | :- |
| `investigate` | lippstack, `eng-skills` | Bug, teste quebrando, comportamento estranho. Lei de ferro: nenhuma correção antes da causa provada. |
| `qa` | lippstack, `eng-skills` | Verificar o que foi feito, de ponta a ponta, com teste de regressão obrigatório. |
| `ship` | lippstack, `eng-skills` | Antes de abrir o PR: conferências de saída, sincronia de documentação, o PR em si. |
| `apple-design` | Emil Kowalski, via lippstack | Movimento, gestos e materiais no estilo Apple na interface web. |
| `review-animations` | Emil Kowalski, via lippstack | Revisar animação que já existe e achar o que quebra a sensação. |
| `break-ui` | Emil Kowalski, via lippstack | Testar a interface com dado de pior caso: texto longo, zero itens, número enorme. |
| `prototype` | Emil Kowalski, via lippstack | Várias versões de uma tela atrás de um seletor, para escolher antes de assumir. |
| `animation-performance` | Emil Kowalski, via lippstack | Animação que perde quadro. |

## O que não está aqui, de propósito

- **`hallmark`** (lippstack, `design-skills`): são 6,9 MB de referências, quase todo imagem. Fica de fora para não
  pesar o repositório. Se for usar, instale pelo marketplace: `claude plugin install design-skills@lippstack`.
- **`po-skills`, `ponytail`, `humanizer`, `video-editor-skills`**: não são deste repositório. Os quatro se instalam
  direto do seu próprio marketplace.

## Origem e atualização

Copiado de `lippdev/lippstack`, commit [`9024e71`](https://github.com/lippdev/lippstack/commit/9024e71844a873a7111a7e85735564f0328de64f)
(`main`, 2026-10-23), em 27/10/2026.

Não edite um arquivo daqui à mão: a próxima sincronia sobrescreve. Para atualizar:

```bash
node scripts/sync-skills.mjs            # último main do lippstack
node scripts/sync-skills.mjs --ref 9024e71
```

O script copia só os skills desta lista, mostra o que mudou e para com erro se um deles sumiu do upstream. Rode o
`node scripts/check.mjs` depois para conferir que todo `SKILL.md` continua com `name` e `description`.

## Licença

`eng-skills` é do lippstack (MIT, © 2026 Filipe Moreira). Os `design-skills` vêm de
[emilkowalski/skills](https://github.com/emilkowalski/skills); cada skill traz o próprio `LICENSE` ao lado do
`SKILL.md`, e ele vale sobre o conteúdo daquela pasta.
