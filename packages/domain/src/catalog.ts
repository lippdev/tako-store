// Catálogo: jogo, produto, edição, DLC e bundle (PRD §7.1). Jogo é a identidade; produto é o que se compara.

export const ACTIVATION_PLATFORMS = ["steam", "epic", "gog", "xbox", "other"] as const;
export type ActivationPlatform = (typeof ACTIVATION_PLATFORMS)[number];

export const OPERATING_SYSTEMS = ["windows", "linux", "macos"] as const;
export type OperatingSystem = (typeof OPERATING_SYSTEMS)[number];

/** O que um produto é dentro do jogo. */
export const PRODUCT_KINDS = ["base", "edition", "dlc", "bundle"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export interface GameMedia {
  cover: string | null;
  hero: string | null;
  logo: string | null;
  screenshots: string[];
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  /** Título original, quando o título em português é uma tradução. */
  originalTitle: string | null;
  /** Títulos alternativos: busca e identificação usam todos (PRD §11.2). */
  alternativeTitles: string[];
  description: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: ActivationPlatform[];
  operatingSystems: OperatingSystem[];
  media: GameMedia;
  published: boolean;
  /** Arquivado: saiu do catálogo, mas o histórico continua existindo (união de duplicata, por exemplo). */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  gameId: string;
  kind: ProductKind;
  /** Nome da edição ("Deluxe", "Ultimate"), quando `kind` é `edition`. */
  editionName: string | null;
  /** Plataforma de ativação do produto. Chave Steam e chave Xbox são produtos diferentes (PRD §7.1). */
  platform: ActivationPlatform;
  /** DLC precisa do jogo base; bundle lista o que inclui. */
  requiresProductId: string | null;
  bundleProductIds: string[];
  published: boolean;
}

/**
 * O que identifica um produto para efeito de comparação: jogo, tipo, edição, plataforma e o que ele exige.
 * Ofertas de produtos com chaves diferentes nunca disputam o mesmo menor preço (PRD §10.2).
 */
export function productComparisonKey(product: Product): string {
  return [product.gameId, product.kind, product.editionName ?? "", product.platform, product.requiresProductId ?? ""].join(
    "|",
  );
}

/** Nome que a tela mostra para o produto: "Jogo", "Jogo — Deluxe", "Jogo (DLC)". */
export function productLabel(game: Pick<Game, "title">, product: Product): string {
  switch (product.kind) {
    case "base":
      return game.title;
    case "edition":
      return `${game.title} — ${product.editionName ?? "Edição especial"}`;
    case "dlc":
      return `${game.title} (DLC)`;
    case "bundle":
      return `${game.title} (pacote)`;
  }
}
