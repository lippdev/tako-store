# Ligar uma loja de verdade

O caminho do painel até o primeiro clique com a sua chave de afiliado. Nada aqui depende de alterar código: quando a
loja liberar o acesso, você preenche e o resto já está pronto.

## 1. Cadastrar a loja e os domínios

`/admin/lojas` → **Nova loja**.

- **Domínios permitidos**: os domínios para onde o botão pode levar, sem esquema (`loja.com.br`). Se o link de
  afiliado passa por uma rede (`go.rede.com`), esse domínio também entra aqui — o redirecionamento recusa qualquer
  destino fora da lista.
- **Tipo de link**: `Afiliado próprio`.
- **Parceria**: `Parceira ativa` (é status administrativo; não muda a ordem por preço).

## 2. Colar a chave de afiliado

Na mesma tela da loja:

- **Parâmetro de afiliado** + **Valor do afiliado**: o nome do parâmetro e a sua chave. Exemplo: `tag` + `tako-20`
  resulta em `…?tag=tako-20`, preservando a query original da oferta.
- **Molde do link** (quando a loja não aceita parâmetro simples): o endereço com `{url}` no lugar da oferta, por
  exemplo `https://go.rede.com/afiliado?url={url}`. O domínio do molde precisa estar na lista de domínios permitidos.

A tela mostra qual dos dois está valendo, sem repetir a chave. Depois de salvar, o campo volta vazio de propósito:
deixe em branco para manter, preencha só para trocar, ou marque remover. O link final é montado no servidor, no
clique — a URL da oferta nunca vem do usuário, e o resultado é validado de novo antes do redirecionamento.

## 3. Cadastrar a fonte (feed do parceiro)

`/admin/fontes` → **Conectar fonte por URL**.

- **URL do feed**: `https://…` (o token, quando existir, vai na própria URL; a lista de fontes mostra só o host, e a
  auditoria também). Endereço local, IP privado ou nome que resolve para a rede interna é recusado. Deixar o campo
  vazio numa fonte já cadastrada mantém a URL.
- **Formato**: JSON, CSV, XML ou detecção automática. O JSON pode ser uma lista ou `{ "items": [...] }` /
  `{ "data": [...] }`; o XML é lido como elementos repetidos dentro da raiz (`<item>`, `<produto>`, `<offer>`), com
  CDATA e entidades (`&amp;`, `&ccedil;`).
- **Mapa de campos**: uma linha por campo, `canonico=campo_na_fonte`. Exemplo:

  ```
  externalId=sku
  title=nome
  platform=plataforma
  priceCents=preco_centavos
  url=link
  storeSlug=loja
  ```

  Campos canônicos aceitos: `externalId`, `title`, `edition`, `platform`, `region`, `currency`, `priceCents`,
  `referencePriceCents`, `availability`, `url`, `coupon`, `subscription`, `observedAt`, `storeSlug`.

`platform` aceita `steam`, `epic`, `gog`, `xbox` ou `other`; `priceCents` é inteiro em centavos. Linha errada não entra:
fica no relatório com linha e código do motivo.

## 4. Testar agora

Na lista de fontes, **Executar agora** roda a coleta no servidor e devolve quantas ofertas entraram e quantas linhas
foram recusadas. **Erros aguardando reprocessamento** mostra o que ficou de fora e permite tentar de novo depois de
corrigir o cadastro ou aprovar um vínculo.

## 5. Deixar coletando sozinho

O worker tem um agendador que respeita a cadência de cada fonte:

```bash
npm run worker -- due                 # uma passada agora
npm run worker -- daemon              # uma passada a cada 60 s
npm run worker -- daemon --interval 300
```

Em produção, rode o `daemon` sob um supervisor (systemd, container com restart) ou troque por um cron chamando `due`.
O agendador não é um serviço interno ao Next: ele é um processo à parte, como o worker de importação.

## 6. Conferir o clique

Cada botão "Ir para a loja" passa por `/ir/<id-da-oferta>`, que:

1. confere o domínio da oferta contra o cadastro da loja;
2. aplica o parâmetro ou o molde de afiliado;
3. registra o clique (`offer_clicks`);
4. redireciona com `302`.

`/admin/ofertas` mostra os cliques dos últimos 30 dias por oferta — é o sinal mais rápido de que a chave está certa.
Se o clique chega na loja e o painel de afiliado não registra, o problema é o parâmetro/molde, não a Tako.

## O que continua fora do alcance do código

- Contrato e acesso de cada parceiro. Sem feed autorizado não há oferta real; o mecanismo está pronto e testado.
- Segredo do feed: fica na URL cadastrada no banco. Proteja o banco e o acesso ao painel (o segundo fator existe para
  isso) e prefira tokens que possam ser rotacionados pelo parceiro.

## 4. Fonte real: Steam (já conectada)

A Steam tem API pública da vitrine, sem chave e sem contrato. O conector `steam` coleta destaque, mais vendidos,
ofertas e lançamentos em um pedido só, já com preço em BRL, desconto, capa oficial e link canônico do app.

- **Loja**: `Steam` (slug `steam`) com `store.steampowered.com` nos domínios permitidos — o botão leva à página do
  jogo na Steam.
- **Fonte**: `steam` (slug `steam`) com `auto_create` ligado: jogo que ainda não existe no catálogo é criado da
  própria fonte (título e capa oficiais) e **nasce publicado** — esconder em lote é do painel (`/admin/jogos`).
- **Coleta**: `npm run worker -- import --source steam`, botão "Executar agora" no painel, ou o agendador
  (`due`/`daemon`, cadência de 6 h). Sem preço (gratuito, em breve) e moeda fora do BRL são recusados com código.
- **Capa**: a retrata 2:3 da biblioteca Steam (`library_600x900`), com a paisagem da vitrine de reserva para os
  apps sem a peça no CDN — ver [ADR-0004](adr/0004-capas-retrato-da-biblioteca-steam.md).
- **Termos**: a API é pública, mas o uso comercial precisa de confirmação antes do lançamento público (OPS-003).
  A atribuição "Preços e disponibilidade: Steam" acompanha a oferta.

### Rastreio amplo do catálogo

Os destaques da vitrine trazem poucas dezenas por execução. Para crescer além deles, o worker tem o rastreio:

```bash
npm run worker -- crawl --source steam --topo 500
```

- A lista de prioridade vem do SteamSpy (sem chave): os 100 mais populares de três listas (`top100forever`,
  `top100in2weeks`, `top100owned`) e, depois, o `all` ordenado por donos estimados, do mais possuído ao menos.
- Cada app da lista é consultado no `appdetails` da vitrine (`cc=br&l=brazilian`) com **pausa de 1,5 s** — o
  limite da vitrine é ~200 pedidos por 5 minutos; ao bater limite (429/403), o lote para e a próxima execução
  continua de onde parou.
- App já conhecido da fonte é pulado: repetir o mesmo `--topo N` custa poucas consultas e traz só o novo.
- A lista de 1.000 apps de prioridade do SteamSpy está **esgotada** (736 jogos publicados; a repetição completa
  traz 0 novo). Catálogo maior exige outra lista ou outra fonte.
- **Backfill de capas** do catálogo já importado: `node scripts/backfill-covers-steam.mjs` (relata o que ficou
  de fora, com motivo).

## 5. Próximas fontes

A Epic Games não tem API pública de preços; a GOG tem um endpoint de vitrine não documentado. As duas estão no
radar da matriz como candidatas — conectar uma delas segue o mesmo molde do conector da Steam.

## 6. Mapa de APIs das lojas (pesquisa de outubro de 2026)

O que cada loja oferece para comparador de preços, e o que destrava. A regra do PRD vale para todas: sem acesso
autorizado não há oferta real, e sem BRL a oferta não entra na comparação do Brasil.

| Loja | O que fornece | Moeda | O que destrava |
| :- | :- | :- | :- |
| **Steam** | API pública da vitrine (já conectada) | BRL ✔ | Nada — já está rodando. Termos de uso comercial a confirmar antes do lançamento |
| **Nuuvem** | API oficial documentada: produtos com `steam_app_id`, preços em BRL, sync incremental | BRL ✔ | Pedido de acesso ao suporte da Nuuvem (API em beta, parceiros selecionados) |
| **Eneba** | Feed XML/CSV para afiliados aprovados | BRL na loja BR | Aprovação no programa de afiliados; a API GraphQL é só para merchants |
| **Green Man Gaming** | Catálogo por API para Business Affiliate (direto ou via Admitad) | BRL na loja BR | Aprovação no Business Affiliate Program |
| **Gamivo** | Feed XML sob pedido (`affiliate@gamivo.com`) | BRL na loja BR | Aprovação no programa de afiliados |
| **Fanatical** | MCP oficial público, sem autenticação, com `steam_id`; feed de afiliados existe (`feed.fanatical.com`, chave por e-mail); programa de afiliados via CJ (sites) e Tapfiliate (canais) | USD para BR | Chave do feed: `affiliates@fanatical.com`; sem BRL não entra na comparação do Brasil |
| **CDKeys (Loaded)** | Programa de afiliados próprio com **feed de dados de todo o catálogo para comparadores de preço** (`loaded.com/affiliate-program`); também via Awin e Admitad | BRL a confirmar | Aprovação no programa (`affiliates@loaded.com`); feed vem depois da aprovação |
| **Instant Gaming** | Programa de indicação no próprio site (link de referência); na Admitad via Mitgame (UK/PL/PT); sem API nem feed público | BRL na loja BR | Cadastro no programa do site e na Admitad; cobertura em BRL a confirmar |
| **GOG** | Programa de afiliados próprio (`affiliate.gog.com`, 6%); endpoint público de catálogo é USD-only | BRL na loja BR | Cadastro no programa próprio (ou CJ/Adtraction); cobertura em BRL do feed a confirmar |

Quando uma dessas aprovar o cadastro, o caminho não muda: feed por URL em `/admin/fontes` (o importador já lê
XML, CSV e JSON) ou conector próprio no molde do da Steam.

## 7. Onde se cadastrar (afiliados) — a lista completa

Pesquisa de outubro de 2026, páginas conferidas ao ar. Ordem prática: **Nuuvem, CDKeys/Loaded e Fanatical
primeiro** (são os três com feed/API de catálogo documentados), depois Eneba, Gamivo e Green Man Gaming, depois
GOG e Instant Gaming.

**Direto na loja:**

| Loja | Onde se cadastrar | O que pede | O que destrava |
| :- | :- | :- | :- |
| **Nuuvem** | Pedido ao suporte (não há formulário público); documentação em `docs.nuuvem.com` | Dizer que é um comparador de preços que quer credenciais da API v3 | API oficial em BRL com `steam_app_id` |
| **CDKeys (Loaded)** | `loaded.com/affiliate-program` · `affiliates@loaded.com` | Cadastro do site; o programa declara atender comparadores de preço e oferece **feed de dados de todo o catálogo** | Feed do catálogo após aprovação |
| **Fanatical** | `fanatical.com/en/affiliates` · feed: `affiliates@fanatical.com` | Programa via CJ para sites (o FAQ cita comparadores de preço); chave do feed por e-mail | Chave do feed de afiliados (`feed.fanatical.com`) |
| **Eneba** | `eneba.com/br/become-affiliate` | Cadastro do site e do meio de divulgação | Feed XML/CSV em BRL |
| **Gamivo** | `gamivo.com/affiliate` · `affiliate@gamivo.com` | Aprovação no programa; o feed XML para comparadores se pede por e-mail | Feed XML em BRL |
| **Green Man Gaming** | `greenmangaming.com/affiliates/` | Cadastro no Business Affiliate Program | API de catálogo (7.000+ jogos), direto ou via Admitad |
| **GOG** | `affiliate.gog.com` | Cadastro direto (6% de comissão) | Feed/API do programa próprio; cobertura em BRL a confirmar |
| **Instant Gaming** | Programa de indicação no próprio site (painel do afiliado) | Cadastro na conta | Link de referência; sem feed público (coletor PAR-005 é o caminho) |

**Redes de afiliados** — cadastrar uma vez e pedir várias lojas de dentro delas:

| Rede | Lojas da Tako que estão lá |
| :- | :- |
| **Awin** (`awin.com`) | CDKeys/Loaded, Fanatical (depósito de $5, devolvido no primeiro pagamento) |
| **Admitad** (`admitad.com`) | Green Man Gaming, Instant Gaming (via Mitgame), CDKeys/Loaded |
| **CJ** (`cj.com`) | Fanatical, GOG |
| **Rakuten Advertising** (`rakutenadvertising.com`) | Nuuvem (programa de afiliados clássico) |

**O que preencher em todos:** descrição da Tako Store como comparador de preços brasileiro, URL do site, como
funciona a atribuição (link com o nosso template, seções 1 e 2 deste documento) e volume esperado de cliques.
Onde pedirem tipo de parceiro, **comparador de preços** é categoria aceita — CDKeys e Fanatical a citam
explicitamente.

**Estado do mapa:** a Steam já está conectada; a Fanatical responde USD para a região BR (não entra na
comparação do Brasil até servir BRL); a Epic Games não tem API nem programa que exponha preços.
