# ADR-0004 — Capas no formato 2:3 da biblioteca Steam

**Status:** aceita
**Data:** 28/10/2026

## Contexto

O cartão de jogo do design system é retrato **2:3** (`aspect-ratio: 2 / 3`), padrão de vitrines de jogos. Com o
catálogo real da Steam, os títulos saíam cortados nos cartões ("AYS TO" em vez de "7 Days to Die").

A causa foi medida nas duas pontas:

- **Card** (`apps/web/src/components/loja/CartaoDeJogo/`): 2:3 com `object-fit: cover`, conforme a especificação —
  correto, e o design system é cópia somente leitura do launcher (ADR-0001): o cartão não se mexe aqui.
- **Chegada**: o conector da Steam gravava como `cover_url` a capa **paisagem** da vitrine (`header.jpg`, 460×215,
  ~2,14:1). Encaixar paisagem em retrato recorta ~70% da largura.

A Steam oferece a arte no formato certo: a cápsula de biblioteca `library_600x900.jpg` (600×900, exatamente 2:3),
servida por `steamcdn-a.akamaihd.net` (o host `shared.akamai.steamstatic.com` responde 404 para essa peça). A
conferência em amostra dos jogos do catálogo mostrou a peça presente em ~95% dos apps.

## Decisão

O ajuste é no **recebimento**, não no card:

1. O conector da Steam grava como `cover_url` a cápsula da biblioteca (`capaDeBiblioteca(appid)`), conferida por
   requisição HEAD no CDN no momento da importação, com timeout. Falha de rede ou 404 degrada para a capa
   paisagem da vitrine — a reserva — sem recusar a oferta (a oferta é dado; a capa é acabamento).
2. O catálogo já importado é corrigido pelo script `scripts/backfill-covers-steam.mjs`: extrai o appid da própria
   URL guardada (inclusive o formato novo com hash), confere o CDN e troca, relatando o que não achou com motivo.
3. Nenhum token ou componente muda: a decisão não cria peça visual nova, só passa a alimentar a existente com o
   formato que ela já espera.

## Consequências

- **710 de 736** jogos do catálogo com capa 2:3 completa; **26** apps sem a peça no CDN (títulos antigos) ficam
  com a reserva recortada no cartão. Cobrir esses casos é cadastro manual de capa no painel (CAT-005).
- Cada jogo novo custa um HEAD a mais na importação — irrelevante diante da pausa de 1,5 s entre appdetails.
- A URL da capa depende de um CDN de conteúdo, não da API de preços; imagem indisponível não afeta a comparação.
- O mesmo formato vale para a home e para a imagem OG, que também consomem `cover_url`.

## Alternativas consideradas

- **Ajustar o card para paisagem.** Rejeitada: quebraria o design system do launcher (ADR-0001) e a convenção de
  vitrines de jogos, para acomodar a limitação da fonte.
- **Recortar no servidor e hospedar a imagem.** Rejeitada por ora: duplicaria a arte, exigiria processamento e
  armazenamento próprios e criaria responsabilidade de direitos sobre imagem já oficial da Steam. Reavaliar só
  quando existir cache de imagens no projeto (CAT-005).
