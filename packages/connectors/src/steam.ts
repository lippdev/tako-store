// Conector da Steam (OFR-008): API pública da vitrine, preços na região do Brasil em BRL. O dado é da própria
// origem — destaque, mais vendidos, ofertas e lançamentos chegam com preço, desconto e capa oficiais. A coleta é
// um pedido só; o catálogo cresce a cada execução e o jogo criado nasce publicado — esconder em lote é do painel.

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
    "API pública da vitrine (featuredcategories), sem contrato de parceiro. Termos de uso comerciais precisam de confirmação antes do lançamento público (OPS-003). Jogo criado da fonte nasce publicado; capa no formato 2:3 da biblioteca com a da vitrine de reserva.",
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
        rows.push({
          ...validated.row,
          observedAt,
          coverUrl: await capaNoFormatoDoCartao(item.id, validated.row["coverUrl"] as string | null),
        });
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

/** Capa retrata 600×900 (2:3) da biblioteca: o formato dos cartões da loja. Nem todo app tem a peça. */
export function capaDeBiblioteca(appid: number | string): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${String(appid)}/library_600x900.jpg`;
}

/** Peças de arte da biblioteca da Steam, por app, na ordem do consumo: herói do banner e cabeça da biblioteca. */
export function pecaDaBiblioteca(appid: number | string, peca: "hero_capsule" | "library_header"): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${String(appid)}/${peca}.jpg`;
}

async function existeNoCdn(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Capa no formato do cartão (2:3 retrato): a da biblioteca quando existe; a paisagem da vitrine fica de reserva. */
export async function capaNoFormatoDoCartao(appid: number | string, reserva: string | null): Promise<string | null> {
  const biblioteca = capaDeBiblioteca(appid);
  return (await existeNoCdn(biblioteca)) ? biblioteca : reserva;
}

/**
 * Herói do banner, na ordem da peça certa: a cápsula de herói da biblioteca (1920×620, feita para faixas largas),
 * depois a cabeça da biblioteca (920×430); a cabeça pequena da vitrine fica de reserva. Medição de 10/2026:
 * hero_capsule existe para ~80% dos apps, library_header cobre parte do resto.
 */
export async function heroNoFormatoDoBanner(appid: number | string, reserva: string | null): Promise<string | null> {
  for (const peca of ["hero_capsule", "library_header"] as const) {
    const url = pecaDaBiblioteca(appid, peca);
    if (await existeNoCdn(url)) return url;
  }
  return reserva;
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
    heroUrl: item.header_image,
    observedAt,
  };
}

/** Pausa entre pedidos de appdetails: o limite da vitrine é ~200 por 5 minutos. */
const STEAM_CRAWL_DELAY_MS = 1_500;

/** Texto sem as tags HTML da descrição da vitrine. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** App oficial da vitrine: preço em BRL, capa, descrição e gêneros. `null` quando o app não tem página de loja. */
export async function steamAppDetails(
  appid: number,
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; code: string; message: string }> {
  let parsed: unknown;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${String(appid)}&cc=br&l=brazilian`,
      { signal: controller.signal, headers: { accept: "application/json", "user-agent": "TakoStore/1.0 (+https://github.com/lippdev/tako-store)" } },
    );
    if (response.status === 429 || response.status === 403) return { ok: false, code: "limite", message: `a Steam pediu espera (${String(response.status)})` };
    if (!response.ok) return { ok: false, code: "resposta", message: `a Steam respondeu ${String(response.status)}` };
    parsed = await response.json();
  } catch (error) {
    return { ok: false, code: "rede", message: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
  const entry =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, Record<string, unknown>>)[String(appid)]
      : undefined;
  const data = entry?.["data"];
  if (entry?.["success"] !== true || typeof data !== "object" || data === null) {
    return { ok: false, code: "indisponivel", message: `app ${String(appid)} não tem página de loja` };
  }
  const app = data as Record<string, unknown>;
  if (app["type"] !== "game") {
    return { ok: false, code: "nao-jogo", message: `app ${String(appid)} não é um jogo (${String(app["type"] ?? "?")})` };
  }
  const overview = typeof app["price_overview"] === "object" && app["price_overview"] !== null
    ? (app["price_overview"] as Record<string, unknown>)
    : null;
  const price = typeof overview?.["final"] === "number" ? overview["final"] : null;
  if (price === null || price <= 0) {
    return { ok: false, code: "gratuito", message: `${String(app["name"] ?? appid)} é gratuito ou não tem preço na região` };
  }
  if (overview?.["currency"] !== "BRL") {
    return { ok: false, code: "moeda", message: `preço veio em ${String(overview?.["currency"] ?? "?")}, não em BRL` };
  }
  const initial = typeof overview?.["initial"] === "number" ? overview["initial"] : null;
  const genres = Array.isArray(app["genres"])
    ? app["genres"]
        .map((genre) => (typeof genre === "object" && genre !== null ? (genre as Record<string, unknown>)["description"] : null))
        .filter((genre): genre is string => typeof genre === "string")
    : [];
  const platforms = typeof app["platforms"] === "object" && app["platforms"] !== null
    ? (app["platforms"] as Record<string, unknown>)
    : {};
  const sistemas = Object.entries(platforms)
    .filter(([, value]) => value === true)
    .map(([system]) => ({ windows: "windows", mac: "macos", linux: "linux" })[system] ?? system)
    .filter((system): system is string => typeof system === "string");

  return {
    ok: true,
    row: {
      externalId: String(appid),
      title: app["name"],
      platform: "steam",
      region: "BR",
      currency: "BRL",
      priceCents: price,
      referencePriceCents: initial !== null && initial > price ? initial : null,
      url: `https://store.steampowered.com/app/${String(appid)}/`,
      storeSlug: "steam",
      coverUrl: await capaNoFormatoDoCartao(
        appid,
        typeof app["header_image"] === "string" ? app["header_image"] : null,
      ),
      heroUrl: await heroNoFormatoDoBanner(
        appid,
        typeof app["header_image"] === "string" ? app["header_image"] : null,
      ),
      description: typeof app["short_description"] === "string" ? stripHtml(app["short_description"]) : null,
      genres,
      operatingSystems: sistemas,
      observedAt: new Date().toISOString(),
    },
  };
}

/**
 * Prioridade de rastreio (sem chave): os 100 mais populares em três listas do SteamSpy, seguidos dos mil
 * com maior estimativa de donos do `all`, do mais possuído para o menos.
 */
export async function steamSpyTopAppids(): Promise<number[]> {
  const requests = ["top100forever", "top100in2weeks", "top100owned"];
  const lists = await Promise.all(
    requests.map(async (request) => {
      try {
        const response = await fetch(`https://steamspy.com/api.php?request=${request}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return {};
        return (await response.json()) as Record<string, Record<string, unknown>>;
      } catch {
        return {};
      }
    }),
  );
  const ids: number[] = [];
  const push = (id: unknown) => {
    const number = typeof id === "number" ? id : Number(id);
    if (Number.isSafeInteger(number) && number > 0 && !ids.includes(number)) ids.push(number);
  };
  for (const list of lists) {
    for (const key of Object.keys(list)) push(key);
  }

  const all = await fetchSteamSpyAll();
  const byOwners = [...all.entries()]
    .sort((a, b) => ownersLowerBound(b[1]) - ownersLowerBound(a[1]))
    .map(([appid]) => appid);
  for (const appid of byOwners) push(appid);
  return ids;
}

function fetchSteamSpyAll(): Promise<Map<number, Record<string, unknown>>> {
  return fetch("https://steamspy.com/api.php?request=all", { headers: { accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) return new Map();
      const parsed = (await response.json()) as Record<string, Record<string, unknown>>;
      const map = new Map<number, Record<string, unknown>>();
      for (const [key, value] of Object.entries(parsed)) {
        const appid = Number(key);
        if (Number.isSafeInteger(appid) && appid > 0) map.set(appid, value);
      }
      return map;
    })
    .catch(() => new Map<number, Record<string, unknown>>());
}

/** Extremo inferior da estimativa de donos ("1,000,000-2,000,000" → 1.000.000). Sem estimativa, zero. */
function ownersLowerBound(entry: Record<string, unknown>): number {
  const owners = typeof entry["owners"] === "string" ? entry["owners"] : "";
  const first = owners.split("-")[0]?.replace(/,/g, "").trim() ?? "";
  const number = Number(first);
  return Number.isSafeInteger(number) ? number : 0;
}

/** Jogo já conhecido da fonte? Evita pedir de novo à Steam o que a Tako já acompanha. */
export async function steamKnownAppids(sourceId: string, ids: readonly number[]): Promise<Set<number>> {
  const { query } = await import("@tako/db");
  if (ids.length === 0) return new Set();
  const rows = await query<{ external_id: string }>(
    "select external_id from external_products where source_id = $1 and external_id = any($2::text[])",
    [sourceId, ids.map(String)],
  );
  return new Set(rows.map((row) => Number(row.external_id)).filter((id) => Number.isSafeInteger(id)));
}

/**
 * Rastreador (OFR-008): prioridade da SteamSpy, detalhe da vitrine em BRL, um pedido por app, pausando entre
 * pedidos. Página de loja ausente, gratuito e não-jogo ficam no relatório.
 */
/**
 * Consulta cada appid dado no `appdetails`, em ritmo do limite da vitrine; limite e rede param a passada —
 * melhor voltar depois do que martelar o limite. O que já veio continua valendo.
 */
async function coletarAppDetails(ids: readonly number[], delayMs: number): Promise<ConnectorOutput> {
  const rows: RawOffer[] = [];
  const errors: RowError[] = [];
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  for (const appid of ids) {
    const result = await steamAppDetails(appid);
    if (result.ok) {
      const validated = validateOfferRow(result.row, null);
      if (validated.ok) rows.push(validated.row);
      else errors.push(validated.error);
    } else if (result.code !== "indisponivel" && result.code !== "gratuito" && result.code !== "nao-jogo") {
      errors.push({ line: null, code: result.code, message: `app ${String(appid)}: ${result.message}` });
      if (result.code === "limite" || result.code === "rede") break;
    }
    await sleep(delayMs);
  }
  return { rows, errors };
}

/**
 * Rastreio amplo: os apps da lista de prioridade do SteamSpy que a fonte ainda não conhece, até `topo` por
 * execução. O catálogo cresce por aqui.
 */
export async function steamCrawl(options: {
  topo?: number;
  delayMs?: number;
  now?: Date;
  sourceId?: string;
}): Promise<ConnectorOutput> {
  const top = options.topo ?? 300;
  const delayMs = options.delayMs ?? STEAM_CRAWL_DELAY_MS;
  const all = await steamSpyTopAppids();
  const known = options.sourceId === undefined ? new Set<number>() : await steamKnownAppids(options.sourceId, all);
  const ids = all.filter((id) => !known.has(id)).slice(0, top);
  return coletarAppDetails(ids, delayMs);
}

/**
 * Atualização do catálogo: reconsulta os apps cuja observação é a mais antiga, na ordem recebida. Não busca
 * lista nova — quem escolhe a ordem é quem chama (o worker pega a observação mais velha primeiro).
 */
export async function steamRefresh(
  ids: readonly number[],
  delayMs: number = STEAM_CRAWL_DELAY_MS,
): Promise<ConnectorOutput> {
  return coletarAppDetails(ids, delayMs);
}
