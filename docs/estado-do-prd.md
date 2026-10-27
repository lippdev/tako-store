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
| CAT-005 Gestão de imagens | ✅ | Biblioteca em `/admin/jogos/[id]`: capa/fundo/logo substituem a anterior, capturas na galeria, toda imagem com origem e atribuição; galeria na página do jogo |
| CAT-006 Busca básica | ✅ | `foldText`, `/api/busca`, `/jogos?q=` |
| CAT-007 Identificadores externos | ✅ | Seção no cadastro do jogo: associar, listar por fonte e remover, com auditoria |
| CAT-008 Revisão de duplicatas | ✅ | `/admin/duplicatas`: candidatos por título normalizado, impacto antes da união, união transacional com histórico em `game_merges` e auditoria; o duplicado é arquivado, não apagado |

## Fase 2 — Lojas, ofertas e integrações

| Item | Estado | Onde |
| :- | :- | :- |
| PAR-001 Cadastro de lojas | ✅ | `/admin/lojas` |
| PAR-002 Gestão de links | ✅ | Tipo de link, domínios permitidos e atribuição por loja |
| PAR-003 Comparação sem favorecimento | ✅ | `compareOffers` + teste com loja parceira mais cara |
| PAR-004 Matriz de fontes | ✅ | `/admin/fontes`: acesso, formato, cobertura em BRL, frequência, documentação, termos, atribuição e situação por fonte, inclusive candidatas; `sourceIsUsable` decide quem alimenta a comparação |
| OFR-001 Modelo de ofertas | ✅ | Tabela `offers` + histórico `price_observations` |
| OFR-002 Motor de menor preço | ✅ | `packages/domain/src/offers.ts`, 41 testes |
| OFR-003 Importador estruturado | ✅ | `importStructured` (JSON/CSV) com erro por linha |
| OFR-004 Contrato de conectores | ✅ | `packages/connectors`, fonte de demonstração |
| OFR-005 Fila de revisão de vínculos | ✅ | `/admin/vinculos`, regra de confiança em `suggestProduct` |
| OFR-006 Administração de fontes | ✅ | Pausar, executar, ver execuções com erros abertos e reprocessar pelo painel ou por `npm run worker -- retry --run <id>`; o erro resolvido fica marcado com a execução que o resolveu |
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
| STO-006 Acessibilidade | ✅ | Auditoria em [acessibilidade.md](acessibilidade.md): contraste medido por `scripts/check-contrast.mjs` (barrado em `check.mjs`), link de pular, foco visível, `aria-current`, rótulos e landmarks. Pendências registradas: token `--text-dim` no launcher e sessão com leitor de tela real |
| STO-007 SEO | ✅ | Metadados por página, canônica, `sitemap.xml`, `robots.txt`, JSON-LD |

## Fase 4 — Operação e lançamento

| Item | Estado | Onde |
| :- | :- | :- |
| OPS-001 Monitoramento | ✅ | `/api/health` (503 quando degradado) com falha de fonte, erro aberto e oferta vencida; `scripts/healthcheck.mjs` para monitor externo; tabela de integrações no painel; limites e alertas em [monitoracao.md](monitoracao.md) |
| OPS-002 Backup e restauração | 🟡 | `scripts/backup.sh` e `scripts/restore.sh` com restauração provada num banco novo (contagens conferidas) e procedimento em [backup.md](backup.md); rotina automática e retenção dependem do ambiente de produção |
| OPS-003 Homologação com dados reais | ⛔ | Depende de fontes autorizadas |
| OPS-004 Publicação inicial | ⛔ | Depende de hospedagem, domínio e parceiros |

## Evolução (P1/P2)

| Item | Estado | Onde |
| :- | :- | :- |
| EXP-001 Histórico de preços | ✅ | `packages/domain/src/history.ts` + `priceHistory` na página do jogo, sempre com período e cobertura declarados |
| EXP-002 Lista de desejos | ⛔ | Depende de conta pública, que o PRD deixa fora da primeira versão |
| EXP-003 Alertas de preço | ⛔ | Depende de conta e de canal de notificação |
| EXP-004 Integração com launcher | ⛔ | Depende do launcher consumir a API da loja |
| EXP-005 Inglês e outras regiões | ⛔ | Depende de decisão de mercado (o produto é Brasil, em português) |
| EXP-006 Recomendações personalizadas | ⛔ | Depende de conta e de dados de uso |
| EXP-007 Extensão de navegador | ⛔ | Depende de decisão de produto |

## O que falta e de quem depende

1. **Licença do repositório** — decisão do mantenedor (WEB-002).
2. **Proteção de `main` e `develop`** — exige administração do repositório no GitHub; o comando está no
   `CONTRIBUTING.md`.
3. **Framework e hospedagem** — a stack está decidida na ADR-0003; falta o ambiente de produção e o domínio.
4. **Acesso às lojas** — sem contrato não existe conector real (OFR-008/009), e sem conector o catálogo continua
   fictício. O caminho para validar a plataforma é o importador de arquivo, que já está pronto.
5. **Rotina de backup e retenção** — o procedimento está provado em ambiente de teste; onde guardar e por quanto
   tempo é decisão de infraestrutura (OPS-002).
6. **Sessão com leitor de tela** — a auditoria de STO-006 conferiu semântica, rótulos, foco e contraste; falta a
   passagem com NVDA/VoiceOver.
7. **Token `--text-dim`** — 3,02:1 no design system do launcher; a correção é lá (ADR-0001), não aqui.
