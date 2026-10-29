# ADR-0004 — Arte da Steam: cada consumo na proporção de cada espaço

**Status:** aceita
**Data:** 29/10/2026 (substitui a versão de 28/10, que tratava só da capa)

## Contexto

A loja consome arte em espaços de proporções diferentes, e a arte precisa nascer na proporção do espaço — nunca
ser esticada nem recortada para caber. Os dois primeiros consumos revelaram o problema por caminhos opostos:

- **Card** (`CartaoDeJogo`, proporção 2:3 retrato): o conector gravava a capa paisagem da vitrine (`header.jpg`,
  460×215). O recorte comia ~70% da largura e cortava os títulos ("AYS TO" em vez de "7 Days to Die").
- **Banner da home** (faixa larga): a primeira correção gravou a `hero_capsule.jpg` como herói, assumindo 1920×620.
  A peça foi medida: **374×448, retrata** — é arte de grade, não de faixa. Numa faixa larga, o desencontro é o mesmo
  problema ao contrário.

Regra desta decisão: **a proporção do espaço e a proporção da peça têm de bater**. Quando não houver peça oficial
na proporção do espaço, o espaço se adapta (assume a proporção da peça) — a arte nunca.

Medições de 29/10/2026 (peças oficiais da Steam, por app, no CDN `steamcdn-a.akamaihd.net`):

| Peça | Dimensões medidas | Proporção | Onde entra |
| :- | :- | :- | :- |
| `library_600x900.jpg` | 300×450 (servida) | 2:3 retrato | Card do catálogo — espaço 2:3, encaixe exato |
| `library_hero.jpg` | 1920×620 | 3,10:1 | Faixa do banner — presente em **40/40** apps medidos, inclusive títulos antigos |
| `library_header.jpg` | 920×430 | 2,14:1 | Reserva do banner |
| `header.jpg` | 460×215 | 2,14:1 | Última reserva (arte de card da vitrine) |
| `hero_capsule.jpg` | 374×448 | retrato | **Não usar em faixa** — é peça de grade |

## Decisão

1. **Capa (card, 2:3)**: o conector grava a `library_600x900` — mesma proporção do espaço, sem recorte. A paisagem
   da vitrine fica de reserva para os poucos apps sem a peça.
2. **Herói (banner, faixa larga)**: o conector grava a `library_hero` (1920×620), conferida por HEAD no CDN, com
   `library_header` e depois o `header` de reserva. A `hero_capsule` fica de fora, pela medição.
3. **O espaço assume a proporção da peça**: a faixa do banner usa `aspect-ratio: 1920 / 620` nas larguras em que o
   texto convive com a arte (≥ 1240px). Abaixo disso — e no celular — a arte vai inteira numa faixa própria
   (`width: 100%; height: auto`, sem máscara) e o texto fica embaixo. Em nenhum dos dois layouts a arte é cortada
   ou esticada.
4. **A sincronização é o backfill**: a importação grava a arte na criação e completa o jogo do vínculo aprovado que
   ainda não tem a peça; `npm run worker -- sync --source steam` refaz o catálogo inteiro.

## Consequências

- Cards e banners recebem arte nativa: zero recorte nos dois consumos do catálogo.
- A faixa do banner fica mais alta em telas grandes (≈450px a 1600 de largura, contra 380px antes) — é o preço de
  não cortar a arte.
- A cadeia de reservas continua existindo para apps fora do padrão (títulos muito antigos sem `library_hero`), mas
  na amostra medida ela não foi acionada.
- A arte de OG (1,91:1) segue usando o herói largo; nenhuma peça oficial da Steam tem essa proporção, então o
  recorte do cartão social é aceito e registrado aqui.
- Cada jogo novo custa até três HEADs na importação (capa + herói + reserva) — irrelevante diante da pausa de
  1,5 s entre appdetails.

## Alternativas consideradas

- **Ajustar o card para paisagem.** Rejeitada: quebraria o design system do launcher (ADR-0001) e a convenção de
  vitrines de jogos, para acomodar a limitação da fonte.
- **Recortar no servidor e hospedar a imagem.** Rejeitada por ora: duplicaria a arte, exigiria processamento e
  armazenamento próprios e criaria responsabilidade de direitos sobre imagem já oficial da Steam. Reavaliar só
  quando existir cache de imagens no projeto (CAT-005).
- **Usar a `hero_capsule` como herói.** Rejeitada pela medição: 374×448 é retrato; ficaria pior que a cabeça larga.
- **Deixar a faixa com altura fixa e cortar a arte.** Rejeitada: é exatamente o defeito que originou esta decisão.
