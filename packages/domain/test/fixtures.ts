// Fixtures dos testes: lojas, fontes e ofertas. Nenhum dado real de loja — tudo fictício, como o PRD exige.

import type { Offer, Source, Store } from "../src/index";

export const NOW = new Date("2026-10-27T12:00:00.000Z");

export function store(overrides: Partial<Store> = {}): Store {
  return {
    id: "store-nuuvem",
    slug: "nuuvem",
    name: "Nuuvem",
    partnerStatus: "none",
    enabled: true,
    allowedDomains: ["nuuvem.com.br"],
    linkKind: "direct",
    attribution: null,
    regions: ["BR"],
    currencies: ["BRL"],
    affiliateParam: null,
    affiliateValue: null,
    affiliateTemplate: null,
    ...overrides,
  };
}

export function source(overrides: Partial<Source> = {}): Source {
  return {
    id: "source-demo",
    slug: "demo",
    name: "Fonte de demonstração",
    kind: "file",
    enabled: true,
    maxAgeHours: 24,
    regions: ["BR"],
    currencies: ["BRL"],
    notes: null,
    access: "api",
    format: "json",
    coversBrl: true,
    cadenceHours: 24,
    docsUrl: null,
    termsUrl: null,
    attribution: null,
    status: "approved",
    lastRunAt: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

export function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer-1",
    productId: "product-1",
    storeId: "store-nuuvem",
    sourceId: "source-demo",
    priceCents: 12_990,
    currency: "BRL",
    referencePriceCents: 19_990,
    region: "BR",
    platform: "steam",
    availability: "available",
    conditions: { coupon: null, subscription: null },
    url: "https://www.nuuvem.com/item/exemplo",
    observedAt: "2026-10-27T11:00:00.000Z",
    ...overrides,
  };
}

export function context(overrides: Partial<Parameters<typeof evaluateContext>[0]> = {}) {
  return evaluateContext({ ...overrides });
}

function evaluateContext(input: {
  stores?: Store[];
  sources?: Source[];
  platform?: "steam" | "epic" | "gog" | "xbox" | "other";
}) {
  return {
    region: "BR",
    currency: "BRL",
    now: NOW,
    ...(input.platform === undefined ? {} : { platform: input.platform }),
    stores: new Map((input.stores ?? [store()]).map((s) => [s.id, s])),
    sources: new Map((input.sources ?? [source()]).map((s) => [s.id, s])),
  };
}
