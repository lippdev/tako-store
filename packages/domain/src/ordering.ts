// Ordenações do catálogo (PRD §11.3). Ordem estável: quem empata cai no título, nunca na sorte do banco.

import { discountPercent } from "./money";

export const CATALOG_ORDERS = ["relevance", "price", "discount", "name", "release"] as const;
export type CatalogOrder = (typeof CATALOG_ORDERS)[number];

export interface SortableGame {
  gameId: string;
  title: string;
  releaseDate: string | null;
  best: { priceCents: number; referencePriceCents: number | null } | null;
  /** Pontuação de relevância da busca, quando houver busca. */
  score?: number;
}

function byPrice(a: SortableGame, b: SortableGame): number {
  // Quem não tem oferta elegível vai para o fim: melhor escondido no fim da lista do que misturado no preço.
  if (a.best === null && b.best === null) return 0;
  if (a.best === null) return 1;
  if (b.best === null) return -1;
  return a.best.priceCents - b.best.priceCents;
}

function byDiscount(a: SortableGame, b: SortableGame): number {
  const percentA = a.best ? (discountPercent(a.best.priceCents, a.best.referencePriceCents) ?? -1) : -1;
  const percentB = b.best ? (discountPercent(b.best.priceCents, b.best.referencePriceCents) ?? -1) : -1;
  return percentB - percentA || byPrice(a, b);
}

function byRelease(a: SortableGame, b: SortableGame): number {
  if (a.releaseDate === null && b.releaseDate === null) return 0;
  if (a.releaseDate === null) return 1;
  if (b.releaseDate === null) return -1;
  return b.releaseDate.localeCompare(a.releaseDate);
}

export function sortCatalog(games: readonly SortableGame[], order: CatalogOrder): SortableGame[] {
  const sorted = [...games];
  sorted.sort((a, b) => {
    switch (order) {
      case "price":
        return byPrice(a, b) || a.title.localeCompare(b.title, "pt-BR");
      case "discount":
        return byDiscount(a, b) || a.title.localeCompare(b.title, "pt-BR");
      case "name":
        return a.title.localeCompare(b.title, "pt-BR");
      case "release":
        return byRelease(a, b) || a.title.localeCompare(b.title, "pt-BR");
      case "relevance":
        return (b.score ?? 0) - (a.score ?? 0) || byPrice(a, b) || a.title.localeCompare(b.title, "pt-BR");
    }
  });
  return sorted;
}
