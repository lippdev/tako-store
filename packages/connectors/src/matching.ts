// Vínculo entre o que a fonte mandou e o produto canônico. A regra do PRD §12.3 vale aqui: nome parecido,
// sozinho, não confirma vínculo — edição ou plataforma ambígua vai para revisão.

import { foldText } from "@tako/domain";

export interface CatalogGame {
  id: string;
  title: string;
  originalTitle: string | null;
  alternativeTitles: string[];
}

export interface CatalogProduct {
  id: string;
  gameId: string;
  kind: "base" | "edition" | "dlc" | "bundle";
  editionName: string | null;
  platform: string;
}

export interface ExternalRow {
  title: string;
  edition: string | null;
  platform: string;
}

export interface Suggestion {
  productId: string | null;
  /** 0 a 1. Acima de 0.9 é candidato a aprovação; abaixo, fica na fila. */
  confidence: number | null;
  reason: string;
}

function titles(game: CatalogGame): string[] {
  return [game.title, game.originalTitle ?? "", ...game.alternativeTitles].filter((title) => title.trim() !== "");
}

/**
 * Sugere o produto para uma linha da fonte:
 * - título exato, mesma plataforma, mesma edição → 1.0;
 * - título exato, plataforma igual, mas a fonte informa edição e o catálogo também → 0.75 (revisão);
 * - título exato, plataforma diferente → 0.3 (provavelmente outro produto);
 * - sem título exato → sem sugestão.
 */
export function suggestProduct(
  row: ExternalRow,
  games: readonly CatalogGame[],
  products: readonly CatalogProduct[],
): Suggestion {
  const wanted = foldText(row.title);
  const game = games.find((candidate) => titles(candidate).some((title) => foldText(title) === wanted));
  if (game === undefined) {
    return { productId: null, confidence: null, reason: "Nenhum jogo com esse título no catálogo" };
  }

  const ofGame = products.filter((product) => product.gameId === game.id);
  const samePlatform = ofGame.filter((product) => product.platform === row.platform);
  if (samePlatform.length === 0) {
    const other = ofGame[0];
    return {
      productId: other?.id ?? null,
      confidence: 0.3,
      reason: `Título confere, mas a fonte diz ${row.platform} e o catálogo tem ${ofGame.map((product) => product.platform).join(", ")}`,
    };
  }

  const edition = row.edition === null ? null : foldText(row.edition);
  const exact = samePlatform.find((product) =>
    edition === null ? product.kind === "base" : foldText(product.editionName ?? "") === edition,
  );
  if (exact !== undefined) {
    return {
      productId: exact.id,
      confidence: edition === null ? 1 : 0.95,
      reason: edition === null ? "Título e plataforma iguais ao jogo base" : "Título, edição e plataforma iguais",
    };
  }

  if (edition !== null) {
    return {
      productId: samePlatform[0]?.id ?? null,
      confidence: 0.55,
      reason: `Título e plataforma conferem, mas a edição "${row.edition}" não existe no catálogo`,
    };
  }

  return {
    productId: samePlatform[0]?.id ?? null,
    confidence: 0.6,
    reason: "Título e plataforma conferem; a fonte não informa edição",
  };
}
