// Seções automáticas da home (PRD §12.4): a regra é dada pelo painel e resolvida aqui, sem SQL específico.

import { discountPercent } from "./money";
import { foldText } from "./search";

export type HomeRule =
  /** Jogos escolhidos a dedo, na ordem em que aparecem. */
  | { kind: "manual"; gameIds: string[] }
  /** Jogos com desconto de pelo menos `minPercent` sobre o preço de referência. */
  | { kind: "discount"; minPercent: number }
  /** Ofertas abaixo de um preço. */
  | { kind: "below-price"; maxCents: number; currency: string }
  /** Jogos de um gênero. */
  | { kind: "genre"; genre: string }
  /** Jogos publicados nos últimos `days` dias. */
  | { kind: "recent"; days: number }
  /** Jogos com menor preço em uma das lojas escolhidas. */
  | { kind: "store"; storeSlugs: string[] };

export interface CatalogCandidate {
  gameId: string;
  publishedAt: string;
  genres: string[];
  /** Menor oferta elegível do jogo, já calculada pelo motor de preço. */
  best: {
    priceCents: number;
    referencePriceCents: number | null;
    storeSlug: string;
  } | null;
}

/**
 * Resolve uma seção automática. Jogo sem oferta elegível não entra em seção de preço, e a seção pode voltar vazia —
 * a home esconde seção vazia em vez de mostrar um buraco (PRD §11.1).
 */
export function selectSectionGames(
  candidates: readonly CatalogCandidate[],
  rule: HomeRule,
  now: Date,
  limit = 12,
): string[] {
  let selected: CatalogCandidate[];
  switch (rule.kind) {
    case "manual": {
      const byId = new Map(candidates.map((candidate) => [candidate.gameId, candidate]));
      return rule.gameIds
        .map((id) => byId.get(id))
        .filter((candidate): candidate is CatalogCandidate => candidate !== undefined)
        .slice(0, limit)
        .map((candidate) => candidate.gameId);
    }
    case "discount": {
      selected = candidates
        .filter((candidate) => {
          const percent = candidate.best
            ? discountPercent(candidate.best.priceCents, candidate.best.referencePriceCents)
            : null;
          return percent !== null && percent >= rule.minPercent;
        })
        .sort((a, b) => {
          const percentA = a.best ? (discountPercent(a.best.priceCents, a.best.referencePriceCents) ?? 0) : 0;
          const percentB = b.best ? (discountPercent(b.best.priceCents, b.best.referencePriceCents) ?? 0) : 0;
          return percentB - percentA || (a.best?.priceCents ?? 0) - (b.best?.priceCents ?? 0);
        });
      break;
    }
    case "below-price": {
      selected = candidates
        .filter((candidate) => candidate.best !== null && candidate.best.priceCents <= rule.maxCents)
        .sort((a, b) => (a.best?.priceCents ?? 0) - (b.best?.priceCents ?? 0));
      break;
    }
    case "genre": {
      const genre = foldText(rule.genre);
      selected = candidates
        .filter((candidate) => candidate.genres.some((value) => foldText(value) === genre))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      break;
    }
    case "recent": {
      const since = now.getTime() - rule.days * 86_400_000;
      selected = candidates
        .filter((candidate) => new Date(candidate.publishedAt).getTime() >= since)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      break;
    }
    case "store": {
      const slugs = new Set(rule.storeSlugs.map((slug) => slug.toLowerCase()));
      selected = candidates
        .filter((candidate) => candidate.best !== null && slugs.has(candidate.best.storeSlug.toLowerCase()))
        .sort((a, b) => (a.best?.priceCents ?? 0) - (b.best?.priceCents ?? 0));
      break;
    }
  }
  return selected.slice(0, limit).map((candidate) => candidate.gameId);
}
