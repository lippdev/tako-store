// Conector da Steam (OFR-008): API pública da vitrine, preços na região do Brasil em BRL. O dado é da própria
// origem — destaque, mais vendidos, ofertas e lançamentos chegam com preço, desconto e capa oficiais. A coleta é
// um pedido só; o catálogo cresce a cada execução e o jogo criado nasce oculto para o editor publicar.

import type { ConnectorOutput, Connector, CollectInput, RawOffer, RowError } from "./connector";
import { validateOfferRow } from "./connector";

const FEATURED_URL = "https://store.steampowered.com/api/featuredcategories/?cc=br&l=brazilian";

/** Categorias que valem oferta: o que está à venda agora. Spotlights não tem preço; "em breve" não tem preço. */
export const STEAM_COLLECTION_CATEGORIES = ["top_sellers", "specials", "new_releases"] as const;

export type SteamCategory = (typeof STEAM_COLLECTION_CATEGORIES)[number];

/** Item de categoria da vitrine, com o preço já na moeda da região pedida. */
export interface SteamFeaturedItem {
  id: number;
  name: string;
  currency: string;
  original_price: number | null;
  final_price: number | null;
  discounted: boolean;
  header_image: string | null;
}

export const steamConnector: Connector & { collect: (input: CollectInput) => Promise<ConnectorOutput> } = {
  slug: "steam",
  name: "Steam",
  version: "1.0.0",
  access: "api",
  regions: ["BR"],
  currencies: ["BRL"],
  limits: "1 requisição por coleta (featuredcategories). A vitrine não publica preço de tudo em lista; o catálogo cresce a cada execução pelos destaques. Sem chave.",
  linkRules: "Link canônico da página do app (store.steampowered.com/app/<id>). Atribuição: dados de preço e disponibilidade da Steam.",
  notes:
    "API pública da vitrine (featuredcategories), sem contrato de parceiro. Termos de uso comerciais precisam de confirmação antes do lançamento público (OPS-003). Jogo criado da fonte nasce oculto.",
  async collect({ now }: CollectInput): Promise<ConnectorOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let items: SteamFeaturedItem[];
    try {
      const response = await fetch(FEATURED_URL, {
        signal: controller.signal,
        headers: { accept: "application/json", "user-agent": "TakoStore/1.0 (+https://github.com/lippdev/tako-store)" },
      });
      if (!response.ok) throw new Error(`a Steam respondeu ${String(response.status)}`);
      items = steamFeaturedItems(await response.json());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("a Steam demorou demais para responder");
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }

    const observedAt = (now ?? new Date()).toISOString();
    const rows: RawOffer[] = [];
    const errors: RowError[] = [];
    const seen = new Set<number>();
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      // A fonte cobre o Brasil em BRL; preço em outra moeda não é oferta para esta comparação.
      if (item.currency !== "BRL") {
        errors.push({ line: null, code: "moeda", message: `"${item.name}" veio em ${item.currency}, não em BRL` });
        continue;
      }
      const validated = validateOfferRow(steamRow(item, observedAt), null);
      if (validated.ok) {
        rows.push({ ...validated.row, observedAt });
      } else {
        // Item sem preço (gratuito, em breve) fica de fora com o motivo: nada entra pela metade.
        errors.push({ ...validated.error, code: validated.error.code === "preco" ? "sem-preco" : validated.error.code });
      }
    }
    return { rows, errors };
  },
};

/** Lista plana de itens de oferta entre as categorias que vendem, na ordem da vitrine. */
export function steamFeaturedItems(payload: unknown): SteamFeaturedItem[] {
  if (typeof payload !== "object" || payload === null) return [];
  const root = payload as Record<string, unknown>;
  const items: SteamFeaturedItem[] = [];
  for (const category of STEAM_COLLECTION_CATEGORIES) {
    const block = root[category];
    if (typeof block !== "object" || block === null) continue;
    const list = (block as Record<string, unknown>)["items"];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry !== "object" || entry === null) continue;
      const item = entry as Record<string, unknown>;
      if (typeof item["id"] !== "number" || typeof item["name"] !== "string") continue;
      items.push({
        id: item["id"],
        name: item["name"],
        currency: typeof item["currency"] === "string" ? item["currency"] : "BRL",
        original_price: typeof item["original_price"] === "number" ? item["original_price"] : null,
        final_price: typeof item["final_price"] === "number" ? item["final_price"] : null,
        discounted: item["discounted"] === true,
        header_image: typeof item["header_image"] === "string" ? item["header_image"] : null,
      });
    }
  }
  return items;
}

/** Item da vitrine na forma que o validador entende. Moeda fora do BRL e preço zero são recusados no validador. */
export function steamRow(item: SteamFeaturedItem, observedAt: string): Record<string, unknown> {
  return {
    externalId: String(item.id),
    title: item.name,
    platform: "steam",
    region: "BR",
    currency: item.currency,
    priceCents: item.final_price,
    referencePriceCents: item.discounted && item.original_price !== null ? item.original_price : null,
    url: `https://store.steampowered.com/app/${String(item.id)}/`,
    storeSlug: "steam",
    coverUrl: item.header_image,
    observedAt,
  };
}
