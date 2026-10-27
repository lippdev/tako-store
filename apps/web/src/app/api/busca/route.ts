import { NextResponse } from "next/server";
import { formatBRL, matchesSearch, searchScore } from "@tako/domain";
import { loadShop } from "@/server/shop";

interface Suggestion {
  slug: string;
  title: string;
  price: string | null;
  cover: string | null;
}

/** Sugestões da busca (PRD §11.2): mesma regra de acento e de título alternativo do catálogo. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ items: [] satisfies Suggestion[] });

  const shop = await loadShop();
  const items = shop.games
    .filter((game) =>
      matchesSearch(
        { title: game.title, originalTitle: game.originalTitle, alternativeTitles: game.alternativeTitles },
        query,
      ),
    )
    .map((game) => ({
      game,
      score: searchScore(
        { title: game.title, originalTitle: game.originalTitle, alternativeTitles: game.alternativeTitles },
        query,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ game }): Suggestion => {
      const product = shop.products.find((candidate) => candidate.gameId === game.id && candidate.kind === "base");
      const best = product === undefined ? undefined : shop.bestByProduct.get(product.id);
      return {
        slug: game.slug,
        title: game.title,
        price: best === undefined ? null : formatBRL(best.offer.priceCents),
        cover: game.media.cover,
      };
    });

  return NextResponse.json({ items });
}
