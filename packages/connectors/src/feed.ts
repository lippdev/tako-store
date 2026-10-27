// Conector de feed (OFR-004/OFR-008): o parceiro entrega um arquivo por URL, em JSON ou CSV, e o painel cadastra o
// de-para dos campos. O que sai daqui é linha validada ou erro com código — nada entra pela metade.

import type { ActivationPlatform, Availability } from "@tako/domain";
import { validateOfferRow, type ConnectorOutput, type RawOffer, type RowError } from "./connector";
import { parseCsv } from "./importer";
import { assertPublicFeedUrl, FEED_MAX_REDIRECTS } from "./public-url";
import { xmlRecords } from "./xml";

/** Campos canônicos que o de-para pode apontar. */
export const CANONICAL_FIELDS = [
  "externalId",
  "title",
  "edition",
  "platform",
  "region",
  "currency",
  "priceCents",
  "referencePriceCents",
  "availability",
  "url",
  "coupon",
  "subscription",
  "observedAt",
  "storeSlug",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export interface FeedConfig {
  url: string;
  format: "json" | "csv" | "xml" | "auto";
  /** Canônico → nome do campo na fonte. Ex.: `{ priceCents: "preco_centavos" }`. */
  fieldMap: Record<string, string>;
  timeoutMs?: number;
}

/** Confere o de-para antes de salvar: chave precisa ser canônica, valor não pode ser vazio. */
export function validateFieldMap(fieldMap: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const [canonical, source] of Object.entries(fieldMap)) {
    if (!(CANONICAL_FIELDS as readonly string[]).includes(canonical)) problems.push(`campo canônico desconhecido: ${canonical}`);
    if (source.trim() === "") problems.push(`campo "${canonical}" sem nome na fonte`);
  }
  return problems;
}

/** Aplica o de-para: o valor canônico passa a existir com o nome que a fonte usa. */
export function applyFieldMap(row: Record<string, unknown>, fieldMap: Record<string, string>): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...row };
  for (const [canonical, source] of Object.entries(fieldMap)) {
    const value = row[source];
    if (value !== undefined && value !== null && value !== "") {
      mapped[canonical] = value;
    } else if (mapped[canonical] === undefined) {
      mapped[canonical] = value;
    }
  }
  return mapped;
}

/** Objetos a partir de CSV: cabeçalho na primeira linha. */
function csvObjects(text: string): { objects: Record<string, unknown>[]; errors: RowError[] } {
  const parsed = parseCsv(text);
  if (parsed.header.length === 0) return { objects: [], errors: parsed.errors };
  const objects = parsed.rows.map((cells, index) => {
    if (cells.length !== parsed.header.length) {
      return { __line: index + 2, __error: `esperava ${String(parsed.header.length)} colunas, veio ${String(cells.length)}` };
    }
    return Object.fromEntries(parsed.header.map((key, position) => [key, cells[position] ?? ""]));
  });
  return { objects, errors: parsed.errors };
}

/** Lista de objetos: aceita array puro ou `{ items: [] }` / `{ data: [] }` / `{ offers: [] }`. */
function listFromJson(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null) {
    for (const key of ["items", "data", "offers", "produtos", "results"]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return null;
}

export interface FeedFetch {
  text: string;
  contentType: string;
  url: string;
}

/** Busca o feed. Erro de rede, status fora de 2xx, corpo vazio e destino interno viram erro para o operador. */
export async function fetchFeedText(config: Pick<FeedConfig, "url" | "timeoutMs">): Promise<FeedFetch> {
  await assertPublicFeedUrl(config.url);
  let current = new URL(config.url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 20_000);
  try {
    for (let hop = 0; hop <= FEED_MAX_REDIRECTS; hop += 1) {
      if (hop > 0) await assertPublicFeedUrl(current.toString());
      const response = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { accept: "application/json, text/csv, text/plain;q=0.9", "user-agent": "TakoStore/0.2 (+https://github.com/lippdev/tako-store)" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location === null || location.trim() === "") throw new Error("o feed redirecionou sem destino");
        if (hop === FEED_MAX_REDIRECTS) throw new Error("o feed redirecionou demais");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new Error(`o feed respondeu ${String(response.status)}`);
      const text = await response.text();
      if (text.trim() === "") throw new Error("o feed respondeu vazio");
      return { text, contentType: response.headers.get("content-type") ?? "", url: response.url || current.toString() };
    }
    throw new Error("o feed redirecionou demais");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("o feed demorou demais para responder");
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(timeout);
  }
}

/** Coleta de um feed: busca, detecta formato, aplica o de-para e valida cada linha. */
export async function collectFeed(config: FeedConfig, now = new Date()): Promise<ConnectorOutput> {
  const fetched = await fetchFeedText(config);
  const head = fetched.text.trimStart();
  const format =
    config.format === "auto"
      ? fetched.contentType.includes("json") || head.startsWith("[") || head.startsWith("{")
        ? "json"
        : fetched.contentType.includes("xml") || head.startsWith("<")
          ? "xml"
          : "csv"
      : config.format;

  let objects: unknown[];
  if (format === "xml") {
    const { element, records } = xmlRecords(fetched.text);
    if (records.length === 0) {
      return {
        rows: [],
        errors: [
          {
            line: null,
            code: "xml",
            message: element === null ? "o feed não é XML válido" : `o XML não tem registros com campos dentro de <${element}>`,
          },
        ],
      };
    }
    objects = records;
  } else if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fetched.text);
    } catch {
      return { rows: [], errors: [{ line: null, code: "json", message: "o feed não é JSON válido" }] };
    }
    const list = listFromJson(parsed);
    if (list === null) return { rows: [], errors: [{ line: null, code: "formato", message: "o JSON não tem lista de ofertas (array, items, data)" }] };
    objects = list;
  } else {
    const csv = csvObjects(fetched.text);
    objects = csv.objects;
    if (csv.errors.length > 0) {
      return { rows: [], errors: csv.errors };
    }
  }

  const rows: RawOffer[] = [];
  const errors: RowError[] = [];
  objects.forEach((entry, index) => {
    if (typeof entry === "object" && entry !== null && "__error" in entry) {
      const record = entry as { __line?: number; __error?: string };
      errors.push({ line: record.__line ?? null, code: "colunas", message: record.__error ?? "linha inválida" });
      return;
    }
    const mapped = typeof entry === "object" && entry !== null ? applyFieldMap(entry as Record<string, unknown>, config.fieldMap) : entry;
    const result = validateOfferRow(mapped, index + 1);
    if (result.ok) {
      rows.push({ ...result.row, observedAt: result.row.observedAt ?? now.toISOString() });
    } else {
      errors.push(result.error);
    }
  });
  return { rows, errors };
}

/** Conector virtual para uma fonte cadastrada com URL de feed. */
export function feedConnectorFor(feedUrl: string, format: FeedConfig["format"], fieldMap: Record<string, string>) {
  return {
    slug: "feed",
    name: "Feed por URL",
    version: "1.0.0",
    access: "feed" as const,
    regions: ["BR"],
    currencies: ["BRL"],
    limits: "Respeita o timeout de 20 s e não faz requisições em paralelo.",
    linkRules: "O link vem do feed e é validado contra o domínio cadastrado da loja.",
    notes: "Conector genérico: o de-para dos campos é definido no painel.",
    collect: (input: { now?: Date } = {}) => collectFeed({ url: feedUrl, format, fieldMap }, input.now),
  };
}

export type { ActivationPlatform, Availability };
