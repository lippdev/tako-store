import "server-only";

import {
  type HomeSection,
  listOffersForProducts,
  listPriceHistoryForProducts,
  listProducts,
  listPublishedGames,
  listSources,
  listStores,
} from "@tako/db";
import {
  cheapestOffer,
  discountPercent,
  type HistorySummary,
  matchesSearch,
  rankOffers,
  searchScore,
  selectSectionGames,
  sortCatalog,
  summarizeHistory,
  type ActivationPlatform,
  type CatalogCandidate,
  type CatalogOrder,
  type EligibilityContext,
  type Game,
  type Offer,
  type OperatingSystem,
  type Product,
  type ProductKind,
  type Source,
  type Store,
} from "@tako/domain";

export interface BestPrice {
  offer: Offer;
  store: Store;
  discount: number | null;
}

export interface ShopData {
  games: Game[];
  products: Product[];
  stores: Store[];
  sources: Source[];
  offerings: Offer[];
  /** Ofertas agrupadas por produto, para a página do jogo não voltar ao banco a cada produto. */
  offersByProduct: Map<string, Offer[]>;
  context: EligibilityContext;
  /** Menor preço por produto (a regra do domínio, aplicada uma vez por requisição). */
  bestByProduct: Map<string, BestPrice>;
}

/** Carrega o catálogo publicado e já calcula o menor preço elegível de cada produto. */
export async function loadShop(now = new Date()): Promise<ShopData> {
  const [games, products, stores, sources] = await Promise.all([
    listPublishedGames(),
    listProducts({ publishedOnly: true }),
    listStores({ enabledOnly: true }),
    listSources({ enabledOnly: true }),
  ]);
  const offers = await listOffersForProducts(products.map((product) => product.id));

  const context: EligibilityContext = {
    region: "BR",
    currency: "BRL",
    now,
    stores: new Map(stores.map((store) => [store.id, store])),
    sources: new Map(sources.map((source) => [source.id, source])),
  };

  const offersByProduct = new Map<string, Offer[]>();
  for (const offer of offers) {
    const list = offersByProduct.get(offer.productId) ?? [];
    list.push(offer);
    offersByProduct.set(offer.productId, list);
  }

  const bestByProduct = new Map<string, BestPrice>();
  for (const product of products) {
    const offer = cheapestOffer(
      offers.filter((candidate) => candidate.productId === product.id),
      context,
    );
    const store = offer === null ? null : stores.find((candidate) => candidate.id === offer.storeId);
    if (offer !== null && store !== null && store !== undefined) {
      bestByProduct.set(product.id, {
        offer,
        store,
        discount: discountPercent(offer.priceCents, offer.referencePriceCents),
      });
    }
  }

  return { games, products, stores, sources, offerings: offers, offersByProduct, context, bestByProduct };
}

/**
 * Histórico de preço do jogo (EXP-001, PRD §10.6), calculado só com o que foi observado. Fica fora do componente
 * para a leitura do relógio não virar render impuro.
 */
export async function priceHistory(data: ShopData, gameId: string, windowDays = 90): Promise<HistorySummary | null> {
  const products = data.products.filter((product) => product.gameId === gameId);
  const base = products.find((product) => product.kind === "base") ?? products[0];
  if (base === undefined) return null;
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const history = await listPriceHistoryForProducts([base.id], since);
  return summarizeHistory(history.get(base.id) ?? [], { windowDays, now: new Date() });
}

/** Produto que representa o jogo na vitrine: o base, ou o primeiro publicado. */
export function displayProduct(data: ShopData, gameId: string): Product | null {
  const products = data.products.filter((product) => product.gameId === gameId);
  return products.find((product) => product.kind === "base") ?? products[0] ?? null;
}

export interface GameCard {
  game: Game;
  product: Product | null;
  best: BestPrice | null;
}

export function cardFor(data: ShopData, game: Game): GameCard {
  const product = displayProduct(data, game.id);
  return { game, product, best: product === null ? null : (data.bestByProduct.get(product.id) ?? null) };
}

export interface CatalogParams {
  q?: string;
  genero?: string;
  plataforma?: string;
  sistema?: string;
  loja?: string;
  precoMax?: number;
  promo?: boolean;
  tipo?: string;
  ordem?: string;
}

const ORDERS: readonly CatalogOrder[] = ["relevance", "price", "discount", "name", "release"];

function orderParam(value: string | undefined): CatalogOrder {
  return ORDERS.find((order) => order === value) ?? (value === undefined ? "relevance" : "name");
}

/** Catálogo filtrado e ordenado. Todo critério vira URL, para o link ser compartilhável (PRD §11.3). */
export function catalog(data: ShopData, params: CatalogParams): GameCard[] {
  let cards = data.games.map((game) => cardFor(data, game));

  if (params.q !== undefined && params.q.trim() !== "") {
    cards = cards.filter((card) =>
      matchesSearch(
        {
          title: card.game.title,
          originalTitle: card.game.originalTitle,
          alternativeTitles: card.game.alternativeTitles,
        },
        params.q ?? "",
      ),
    );
  }
  if (params.genero !== undefined && params.genero !== "") {
    cards = cards.filter((card) => card.game.genres.includes(params.genero ?? ""));
  }
  if (params.plataforma !== undefined && params.plataforma !== "") {
    cards = cards.filter((card) => card.game.platforms.includes(params.plataforma as ActivationPlatform));
  }
  if (params.sistema !== undefined && params.sistema !== "") {
    cards = cards.filter((card) => card.game.operatingSystems.includes(params.sistema as OperatingSystem));
  }
  if (params.loja !== undefined && params.loja !== "") {
    cards = cards.filter((card) => card.best?.store.slug === params.loja);
  }
  if (params.precoMax !== undefined && Number.isFinite(params.precoMax)) {
    const limit = params.precoMax;
    cards = cards.filter((card) => card.best !== null && card.best.offer.priceCents <= limit);
  }
  if (params.promo === true) {
    cards = cards.filter((card) => card.best?.discount !== null && card.best?.discount !== undefined);
  }
  if (params.tipo !== undefined && params.tipo !== "") {
    const kind = params.tipo as ProductKind;
    cards = cards.filter((card) => data.products.some((product) => product.gameId === card.game.id && product.kind === kind));
  }

  const sortable = cards.map((card) => ({
    gameId: card.game.id,
    title: card.game.title,
    releaseDate: card.game.releaseDate,
    best: card.best === null ? null : { priceCents: card.best.offer.priceCents, referencePriceCents: card.best.offer.referencePriceCents },
    score: searchScore(
      {
        title: card.game.title,
        originalTitle: card.game.originalTitle,
        alternativeTitles: card.game.alternativeTitles,
      },
      params.q ?? "",
    ),
  }));
  const order = sortCatalog(sortable, orderParam(params.ordem));
  const byId = new Map(cards.map((card) => [card.game.id, card]));
  return order.flatMap((item) => {
    const card = byId.get(item.gameId);
    return card === undefined ? [] : [card];
  });
}

/** Gêneros, lojas e plataformas que existem no catálogo, para montar os filtros. */
export function facets(data: ShopData): { genres: string[]; stores: Store[]; platforms: ActivationPlatform[] } {
  const genres = new Set<string>();
  const platforms = new Set<ActivationPlatform>();
  for (const game of data.games) {
    for (const genre of game.genres) genres.add(genre);
    for (const platform of game.platforms) platforms.add(platform);
  }
  return { genres: [...genres].sort((a, b) => a.localeCompare(b, "pt-BR")), stores: data.stores, platforms: [...platforms] };
}

export interface SectionView {
  section: HomeSection;
  cards: GameCard[];
}

/** Seções da home resolvidas: cada regra vira uma fileira de jogos, e seção vazia é escondida (§11.1). */
export function homeSections(data: ShopData, sections: readonly HomeSection[], now = new Date()): SectionView[] {
  const candidates: CatalogCandidate[] = data.games.map((game) => {
    const card = cardFor(data, game);
    return {
      gameId: game.id,
      publishedAt: game.createdAt,
      genres: game.genres,
      best:
        card.best === null
          ? null
          : {
              priceCents: card.best.offer.priceCents,
              referencePriceCents: card.best.offer.referencePriceCents,
              storeSlug: card.best.store.slug,
            },
    };
  });
  const byGame = new Map(data.games.map((game) => [game.id, game]));

  return sections.flatMap((section) => {
    const ids = selectSectionGames(candidates, section.rule, now, section.slug === "escolhas-da-redacao" ? 6 : 12);
    const cards = ids.flatMap((id) => {
      const game = byGame.get(id);
      return game === undefined ? [] : [cardFor(data, game)];
    });
    return cards.length === 0 ? [] : [{ section, cards }];
  });
}

export interface GameDetail {
  game: Game;
  products: {
    product: Product;
    best: BestPrice | null;
    offers: { offer: Offer; store: Store; discount: number | null }[];
  }[];
  related: GameCard[];
}

/** Página do jogo: cada produto com as ofertas elegíveis, na ordem da comparação (PRD §11.4). */
export function gameDetail(data: ShopData, game: Game): GameDetail {
  const products = data.products.filter((product) => product.gameId === game.id);
  const related = data.games
    .filter(
      (candidate) =>
        candidate.id !== game.id && candidate.genres.some((genre) => game.genres.includes(genre)),
    )
    .slice(0, 6)
    .map((candidate) => cardFor(data, candidate));

  const detailed = products.map((product) => {
    const ranked = rankOffers(data.offersByProduct.get(product.id) ?? [], data.context);
    const rows = ranked.flatMap((offer) => {
      const store = data.stores.find((candidate) => candidate.id === offer.storeId);
      return store === undefined
        ? []
        : [{ offer, store, discount: discountPercent(offer.priceCents, offer.referencePriceCents) }];
    });
    return { product, best: data.bestByProduct.get(product.id) ?? null, offers: rows };
  });

  return { game, products: detailed, related };
}
