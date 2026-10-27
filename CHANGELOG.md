# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem
[SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] — 2026-10-27

Primeira versão funcional da Tako Store, com catálogo fictício e as fases 0 a 3 do PRD.

### Adicionado

- **Design system**: cópia do design system do Tako Launcher em `design/desktop/`, com 90 especificações, tokens,
  ícones, marca e fontes; sincronia por script; galeria em `/dev/componentes` e base visual em `/dev`.
- **Método**: skills do lippstack em `.claude/skills/` (`investigate`, `qa`, `ship` e cinco de design), com
  sincronia e `AGENTS.md` dizendo quando abrir cada um.
- **Domínio**: elegibilidade de oferta por produto, região, moeda, disponibilidade, plataforma e prazo da fonte;
  menor preço com empate estável e sem favorecer parceira; desconto só com referência confiável; busca sem acento;
  seções automáticas da home; validação de destino do redirecionamento.
- **Banco**: PostgreSQL com migração numerada, dinheiro em inteiro, histórico de observações, auditoria e seed
  fictício de 12 jogos, 4 lojas, 3 fontes e 31 ofertas.
- **Painel**: login com scrypt e sessão revogável, permissões por perfil verificadas no servidor, jogos (editar,
  publicar, ocultar, arquivar), vínculos, ofertas com veredito, lojas, fontes, home e painel de qualidade.
- **Importação**: contrato de conector, fonte de demonstração, importador JSON/CSV com erro por linha, sugestão de
  vínculo por confiança e worker idempotente.
- **Loja pública**: home configurável, catálogo com filtros na URL, página do jogo, busca com sugestões,
  redirecionamento seguro, `sitemap.xml`, `robots.txt` e dados estruturados.

### Notas

- Nenhuma integração real de loja: depende de acesso e contrato com parceiros (OFR-008/009).
- O catálogo é de demonstração e a loja avisa isso no rodapé (`DEMO_CATALOG=0` desliga o aviso).
- Licença do repositório ainda não definida.
