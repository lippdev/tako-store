// Contrato de conector (PRD §15) e a fonte de demonstração. O que vem de fora é validado aqui, antes de virar
// oferta: preço inteiro, moeda e região informadas, URL https e plataforma conhecida.

import { readFile } from "node:fs/promises";
import type { ActivationPlatform, Availability } from "@tako/domain";

export const CONNECTOR_PLATFORMS: readonly ActivationPlatform[] = ["steam", "epic", "gog", "xbox", "other"];

export interface RawOffer {
  /** Identificador do produto na fonte. */
  externalId: string;
  title: string;
  edition: string | null;
  platform: ActivationPlatform;
  region: string;
  currency: string;
  priceCents: number;
  referencePriceCents: number | null;
  availability: Availability;
  url: string;
  coupon: string | null;
  subscription: string | null;
  observedAt: string | null;
  /** Loja para a qual a oferta aponta (slug cadastrado no banco). */
  storeSlug: string;
}

export interface RowError {
  /** Linha do arquivo, quando houver; `null` para JSON de objeto único. */
  line: number | null;
  code: string;
  message: string;
  payload?: unknown;
}

export interface ConnectorOutput {
  rows: RawOffer[];
  errors: RowError[];
}

/** O que todo conector entrega, com a documentação que o PRD exige de cada fonte. */
export interface Connector {
  slug: string;
  name: string;
  version: string;
  access: "api" | "feed" | "file" | "page";
  regions: string[];
  currencies: string[];
  /** Limites e frequência recomendada. */
  limits: string;
  /** Regras de link e atribuição que não podem ser perdidas. */
  linkRules: string;
  /** Documentação operacional da fonte. */
  notes: string;
}

export interface CollectInput {
  /** Arquivo de origem, para conector do tipo arquivo. */
  file?: string;
  now?: Date;
}

export type ValidationResult = { ok: true; row: RawOffer } | { ok: false; error: RowError };

const PLATFORMS = new Set<string>(CONNECTOR_PLATFORMS);
const AVAILABILITIES = new Set<string>(["available", "unavailable", "unknown"]);

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * Valida uma linha crua. Cada motivo de recusa tem código próprio para o relatório de importação dizer o que
 * corrigir, linha por linha (OFR-003).
 */
export function validateOfferRow(input: unknown, line: number | null): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: { line, code: "formato", message: "linha não é um objeto", payload: input } };
  }
  const row = input as Record<string, unknown>;
  const text = (key: string): string => (typeof row[key] === "string" ? (row[key] as string).trim() : "");

  const externalId = text("externalId") || text("id") || text("sku");
  if (externalId === "") return { ok: false, error: { line, code: "sem-id", message: "sem identificador na fonte", payload: input } };

  const title = text("title") || text("titulo");
  if (title === "") return { ok: false, error: { line, code: "sem-titulo", message: "sem título", payload: input } };

  const platform = text("platform") || text("plataforma");
  if (!PLATFORMS.has(platform)) {
    return { ok: false, error: { line, code: "plataforma", message: `plataforma desconhecida: "${platform}"`, payload: input } };
  }

  const priceCents = asInt(row["priceCents"] ?? row["precoCentavos"]);
  if (priceCents === null || priceCents <= 0) {
    return { ok: false, error: { line, code: "preco", message: "preço ausente ou não inteiro em centavos", payload: input } };
  }
  const referencePriceCents = asInt(row["referencePriceCents"] ?? row["precoReferenciaCentavos"]);

  const region = (text("region") || text("regiao") || "BR").toUpperCase();
  const currency = (text("currency") || text("moeda") || "BRL").toUpperCase();

  const url = text("url");
  if (!url.startsWith("https://")) {
    return { ok: false, error: { line, code: "url", message: "link da oferta precisa ser https", payload: input } };
  }

  const storeSlug = text("storeSlug") || text("loja");
  if (storeSlug === "") return { ok: false, error: { line, code: "sem-loja", message: "oferta sem loja", payload: input } };

  const availability = text("availability") || text("disponibilidade") || "available";
  if (!AVAILABILITIES.has(availability)) {
    return { ok: false, error: { line, code: "disponibilidade", message: `disponibilidade desconhecida: "${availability}"`, payload: input } };
  }

  return {
    ok: true,
    row: {
      externalId,
      title,
      edition: text("edition") || text("edicao") || null,
      platform: platform as ActivationPlatform,
      region,
      currency,
      priceCents,
      referencePriceCents: referencePriceCents === null ? null : referencePriceCents,
      availability: availability as Availability,
      url,
      coupon: text("coupon") || text("cupom") || null,
      subscription: text("subscription") || text("assinatura") || null,
      observedAt: text("observedAt") || text("observadoEm") || null,
      storeSlug,
    },
  };
}

/** Fonte de demonstração: lê um arquivo JSON com uma lista de ofertas. Nenhum acesso externo. */
export const demoFileConnector: Connector & { collect: (input: CollectInput) => Promise<ConnectorOutput> } = {
  slug: "arquivo-demo",
  name: "Arquivo de demonstração",
  version: "1.0.0",
  access: "file",
  regions: ["BR"],
  currencies: ["BRL"],
  limits: "Arquivo local; sem limite de requisições.",
  linkRules: "Os links vêm prontos da fonte e não são alterados.",
  notes: "Fonte fictícia usada nos testes de importação. O arquivo padrão fica em packages/connectors/fixtures.",
  async collect({ file, now }: CollectInput): Promise<ConnectorOutput> {
    const target = file ?? new URL("../fixtures/catalogo-demo.json", import.meta.url);
    const text = await readFile(target, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { rows: [], errors: [{ line: null, code: "json", message: "arquivo não é JSON válido" }] };
    }
    const list = Array.isArray(parsed) ? parsed : [];
    if (!Array.isArray(parsed)) {
      return { rows: [], errors: [{ line: null, code: "formato", message: "esperava uma lista de ofertas" }] };
    }
    const rows: RawOffer[] = [];
    const errors: RowError[] = [];
    list.forEach((entry, index) => {
      const result = validateOfferRow(entry, index + 1);
      if (result.ok) rows.push({ ...result.row, observedAt: result.row.observedAt ?? (now ?? new Date()).toISOString() });
      else errors.push(result.error);
    });
    return { rows, errors };
  },
};

/**
 * Fonte "feed" de demonstração: lê o mesmo arquivo local, mas se apresenta como feed. Serve para exercitar o
 * caminho de uma fonte que não é arquivo enviado à mão, sem depender de rede.
 */
export const demoFeedConnector: Connector & { collect: (input: CollectInput) => Promise<ConnectorOutput> } = {
  ...demoFileConnector,
  slug: "feed-demo",
  name: "Feed de demonstração",
  access: "feed",
  notes: "Feed fictício servido do mesmo arquivo local da fonte de arquivo; nenhum acesso externo.",
};

export const CONNECTORS: readonly Connector[] = [demoFileConnector, demoFeedConnector];

export function connectorFor(sourceSlug: string): Connector | null {
  return CONNECTORS.find((connector) => connector.slug === sourceSlug) ?? null;
}
