# Estado do PRD

Mapa dos itens do §20 do [PRD](PRD.md) para o que existe no código hoje. O PRD é o documento do produto; este aqui é
o retrato da implementação e envelhece com ela.

**Legenda:** ✅ entregue · 🟡 entregue em parte · ⛔ bloqueado (depende de decisão, acesso ou infraestrutura).

## Fase 0 — Fundação

| Item | Estado | Onde |
| :- | :- | :- |
| WEB-001 Repositório | ✅ | Estrutura, README, `AGENTS.md`, `CONTRIBUTING.md` |
| WEB-002 Licença e decisões iniciais | ⛔ | **Falta a licença**: decisão do mantenedor. As decisões técnicas estão nas ADRs |
| WEB-003 ADR de stack | ✅ | [ADR-0003](adr/0003-stack-next-postgres-worker.md) |
| WEB-004 Git Flow e CI | 🟡 | Fluxo e CI prontos; **proteção de `main`/`develop` precisa de administrador do repositório** |
| WEB-005 Ambiente local | ✅ | `docker-compose.yml`, `npm run db:*`, seed com dados fictícios |
| WEB-006 Tokens e componentes | ✅ | `design/desktop/` + galeria em `/dev/componentes` |

## Fase 1 — Catálogo e administração

| Item | Estado | Onde |
| :- | :- | :- |
| CAT-001 Jogos e produtos | ✅ | `packages/domain/src/catalog.ts`, tabelas `games`/`products` |
| CAT-002 Autenticação administrativa | ✅ | `packages/db/src/auth.ts` (scrypt, sessão revogável) |
| CAT-003 Perfis e permissões | ✅ | `PERMISSIONS` no domínio, verificado em cada ação do painel |
| CAT-004 Gestão de jogos | ✅ | `/admin/jogos` (editar, publicar, ocultar, arquivar, auditoria) |
| CAT-005 Gestão de imagens | 🟡 | Campos de capa/fundo e tabela `media_assets` com origem; falta a galeria de imagens |
| CAT-006 Busca básica | ✅ | `foldText`, `/api/busca`, `/jogos?q=` |
| CAT-007 Identificadores externos | 🟡 | Tabela e repositório prontos; o painel ainda não edita IDs à mão |
| CAT-008 Revisão de duplicatas | 🟡 | Fila de vínculos com decisão e auditoria; falta unir duplicatas de jogo |

## Fase 2 — Lojas, ofertas e integrações

| Item | Estado | Onde |
| :- | :- | :- |
| PAR-001 Cadastro de lojas | ✅ | `/admin/lojas` |
| PAR-002 Gestão de links | ✅ | Tipo de link, domínios permitidos e atribuição por loja |
| PAR-003 Comparação sem favorecimento | ✅ | `compareOffers` + teste com loja parceira mais cara |
| PAR-004 Matriz de fontes | 🟡 | Fontes, prazo, notas e execuções; falta a matriz de avaliação das candidatas |
| OFR-001 Modelo de ofertas | ✅ | Tabela `offers` + histórico `price_observations` |
| OFR-002 Motor de menor preço | ✅ | `packages/domain/src/offers.ts`, 41 testes |
| OFR-003 Importador estruturado | ✅ | `importStructured` (JSON/CSV) com erro por linha |
| OFR-004 Contrato de conectores | ✅ | `packages/connectors`, fonte de demonstração |
| OFR-005 Fila de revisão de vínculos | ✅ | `/admin/vinculos`, regra de confiança em `suggestProduct` |
| OFR-006 Administração de fontes | 🟡 | Pausar, executar e ver execuções; reprocessar item com erro ainda não |
| OFR-007 Expiração de ofertas | ✅ | `evaluateOffer` + `/admin/ofertas` com o veredito |
| OFR-008 Primeiro conector real | ⛔ | Depende de acesso e contrato com a loja |
| OFR-009 Segunda fonte real | ⛔ | Idem |

## Fase 3 — Loja pública

| Item | Estado | Onde |
| :- | :- | :- |
| STO-001 Home configurável | ✅ | `/admin/home` + `selectSectionGames` |
| STO-002 Catálogo | ✅ | `/jogos` com filtros e ordenação na URL |
| STO-003 Página do jogo | ✅ | `/jogo/[slug]` |
| STO-004 Redirecionamento seguro | ✅ | `/ir/[offerId]` valida domínio e registra clique |
| STO-005 Responsividade | ✅ | Conferido a 1600×900 e 390×844 |
| STO-006 Acessibilidade | 🟡 | Foco, rótulos e contraste do design system; falta auditoria WCAG 2.2 AA |
| STO-007 SEO | ✅ | Metadados por página, canônica, `sitemap.xml`, `robots.txt`, JSON-LD |

## Fase 4 — Operação e lançamento

| Item | Estado | Onde |
| :- | :- | :- |
| OPS-001 Monitoramento | 🟡 | Painel de qualidade, execuções e falhas consecutivas; falta métrica e alerta externo |
| OPS-002 Backup e restauração | ⛔ | Depende do ambiente de produção |
| OPS-003 Homologação com dados reais | ⛔ | Depende de fontes autorizadas |
| OPS-004 Publicação inicial | ⛔ | Depende de hospedagem, domínio e parceiros |

## O que falta e de quem depende

1. **Licença do repositório** — decisão do mantenedor (WEB-002).
2. **Proteção de `main` e `develop`** — exige administração do repositório no GitHub; o comando está no
   `CONTRIBUTING.md`.
3. **Framework e hospedagem** — a stack está decidida na ADR-0003; falta o ambiente de produção e o domínio.
4. **Acesso às lojas** — sem contrato não existe conector real (OFR-008/009), e sem conector o catálogo continua
   fictício. O caminho para validar a plataforma é o importador de arquivo, que já está pronto.
