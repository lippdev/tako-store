import type { MetadataRoute } from "next";
import { listPublishedGames } from "@tako/db";

const BASE = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:5174";

/** Sitemap com as páginas públicas indexáveis (STO-007). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sem banco (build de CI, por exemplo) o sitemap sai só com as páginas fixas; a loja pública continua exigindo
  // banco para responder. Assim o build não vira um teste de conexão.
  const games = await listPublishedGames().catch(() => []);
  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/jogos`, changeFrequency: "daily", priority: 0.8 },
    ...games.map((game) => ({
      url: `${BASE}/jogo/${game.slug}`,
      lastModified: new Date(game.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
