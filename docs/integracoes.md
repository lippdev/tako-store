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

A tela mostra qual dos dois está valendo. O link final é montado no servidor, no clique — a URL da oferta nunca vem do
usuário, e o resultado é validado de novo antes do redirecionamento.

## 3. Cadastrar a fonte (feed do parceiro)

`/admin/fontes` → **Conectar fonte por URL**.

- **URL do feed**: `https://…` (o token, quando existir, vai na própria URL; a lista de fontes mostra só o host).
- **Formato**: JSON, CSV ou detecção automática. O JSON pode ser uma lista ou `{ "items": [...] }` / `{ "data": [...] }`.
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
