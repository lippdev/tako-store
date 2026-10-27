// Lojas, fontes e ofertas. A regra que o produto inteiro defende está aqui: a parceria é administrativa e nunca
// muda a ordem de preço (PRD §8.2, §10.1, §10.5).

import type { ActivationPlatform } from "./catalog";
import { isValidPrice } from "./money";

export const PARTNER_STATUSES = ["active", "pending", "none", "disabled"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const LINK_KINDS = ["affiliate", "source", "direct"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export interface Store {
  id: string;
  slug: string;
  name: string;
  partnerStatus: PartnerStatus;
  /** Loja desativada some da loja pública, com todas as ofertas (PRD §8.2). */
  enabled: boolean;
  /** Domínios para onde o redirecionamento pode ir (PRD §11.5). */
  allowedDomains: string[];
  linkKind: LinkKind;
  /** Texto de atribuição exigido pela fonte, quando houver. */
  attribution: string | null;
  regions: string[];
  currencies: string[];
  /** Nome do parâmetro de afiliado e o valor dele (a chave do parceiro), quando a loja paga por indicação. */
  affiliateParam: string | null;
  affiliateValue: string | null;
  /** Molde alternativo, com `{url}` no lugar do endereço da oferta. */
  affiliateTemplate: string | null;
}

export const SOURCE_KINDS = ["api", "feed", "file", "page"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface Source {
  id: string;
  slug: string;
  name: string;
  kind: SourceKind;
  enabled: boolean;
  /** Validade do preço desta fonte, em horas. O padrão de desenvolvimento é 24 (PRD §10.4). */
  maxAgeHours: number;
  regions: string[];
  currencies: string[];
  /** Regras da fonte que não podem ser perdidas: parâmetros obrigatórios, atribuição, limites. */
  notes: string | null;
  /** Como se chega aos dados: API, feed do parceiro, página pública ou ainda desconhecido (PAR-004). */
  access: SourceAccess;
  /** Formato que a fonte entrega. */
  format: SourceFormat;
  /** A fonte cobre preço em real? Fonte sem BRL não alimenta comparação no Brasil. */
  coversBrl: boolean;
  /** Intervalo de coleta, em horas. `null` quando ainda não se sabe. */
  cadenceHours: number | null;
  /** Documentação de acesso, quando existe. */
  docsUrl: string | null;
  /** Termos de uso e restrições de atribuição. */
  termsUrl: string | null;
  /** Texto de atribuição exigido pela fonte. */
  attribution: string | null;
  /** Estágio da fonte na matriz: candidata, em avaliação, aprovada ou recusada (PAR-004). */
  status: SourceStatus;
  /** Última execução registrada e falhas consecutivas: o alerta de integração (OPS-001). */
  lastRunAt: string | null;
  consecutiveFailures: number;
  /** URL de onde a fonte entrega o arquivo, quando o acesso é por feed (OFR-008). */
  feedUrl: string | null;
  /** De-para dos nomes de campo da fonte para os nomes canônicos do importador. */
  fieldMap: Record<string, string>;
}

export const SOURCE_ACCESSES = ["api", "partner-feed", "public-page", "unknown"] as const;
export type SourceAccess = (typeof SOURCE_ACCESSES)[number];

export const SOURCE_FORMATS = ["json", "csv", "xml", "html", "unknown"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

export const SOURCE_STATUSES = ["candidate", "evaluating", "approved", "rejected"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SOURCE_ACCESS_LABELS: Record<SourceAccess, string> = {
  api: "API",
  "partner-feed": "Feed do parceiro",
  "public-page": "Página pública",
  unknown: "Não informado",
};

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  candidate: "Candidata",
  evaluating: "Em avaliação",
  approved: "Aprovada",
  rejected: "Recusada",
};

/** A fonte pode alimentar a comparação brasileira? Precisa de acesso lícito, formato conhecido e cobertura em BRL. */
export function sourceIsUsable(source: Pick<Source, "access" | "format" | "coversBrl" | "status" | "enabled">): boolean {
  return (
    source.enabled &&
    source.status === "approved" &&
    source.access !== "unknown" &&
    source.format !== "unknown" &&
    source.coversBrl
  );
}

export const AVAILABILITIES = ["available", "unavailable", "unknown"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export interface OfferConditions {
  /** Cupom necessário para chegar ao preço. Aparece na tela junto do preço. */
  coupon: string | null;
  /** Assinatura necessária (clube da loja, plano) para chegar ao preço. */
  subscription: string | null;
}

export interface Offer {
  id: string;
  productId: string;
  storeId: string;
  sourceId: string;
  /** Inteiro na menor unidade da moeda (PRD §10.3). */
  priceCents: number;
  currency: string;
  referencePriceCents: number | null;
  region: string;
  platform: ActivationPlatform;
  availability: Availability;
  conditions: OfferConditions;
  url: string;
  /** Quando a fonte informou este preço. */
  observedAt: string;
}

export const DEFAULT_MAX_AGE_HOURS = 24;

export type IneligibilityReason =
  | "invalid-price"
  | "inactive-store"
  | "inactive-source"
  | "wrong-region"
  | "wrong-currency"
  | "unavailable"
  | "unknown-availability"
  | "stale"
  | "wrong-platform";

export interface EligibilityContext {
  /** Região do usuário: só ofertas válidas para ela disputam (PRD §10.1). */
  region: string;
  currency: string;
  now: Date;
  /** Plataforma escolhida pelo usuário; sem escolha, todas valem. */
  platform?: ActivationPlatform;
  stores: ReadonlyMap<string, Store>;
  sources: ReadonlyMap<string, Source>;
}

export interface Eligibility {
  eligible: boolean;
  reasons: IneligibilityReason[];
  /** Idade da observação em horas, para a tela e para o painel de qualidade. */
  ageHours: number;
}

/** Idade da observação, em horas fracionárias. */
export function offerAgeHours(offer: Offer, now: Date): number {
  return (now.getTime() - new Date(offer.observedAt).getTime()) / 3_600_000;
}

/** Validade do preço: o da fonte quando existe, senão o padrão do desenvolvimento. */
export function maxAgeHoursFor(offer: Offer, sources: ReadonlyMap<string, Source>): number {
  return sources.get(offer.sourceId)?.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;
}

/**
 * A oferta é elegível? Devolve todos os motivos de exclusão, não só o primeiro: o painel de qualidade precisa
 * saber por que uma oferta não aparece.
 */
export function evaluateOffer(offer: Offer, context: EligibilityContext): Eligibility {
  const reasons: IneligibilityReason[] = [];
  const ageHours = offerAgeHours(offer, context.now);
  const store = context.stores.get(offer.storeId);
  const source = context.sources.get(offer.sourceId);

  if (!isValidPrice(offer.priceCents)) reasons.push("invalid-price");
  if (!store || !store.enabled) reasons.push("inactive-store");
  if (!source || !source.enabled) reasons.push("inactive-source");
  if (offer.region !== context.region) reasons.push("wrong-region");
  if (offer.currency !== context.currency) reasons.push("wrong-currency");
  if (offer.availability === "unavailable") reasons.push("unavailable");
  if (offer.availability === "unknown") reasons.push("unknown-availability");
  if (ageHours > maxAgeHoursFor(offer, context.sources)) reasons.push("stale");
  if (context.platform !== undefined && offer.platform !== context.platform) reasons.push("wrong-platform");

  return { eligible: reasons.length === 0, reasons, ageHours };
}

export function eligibleOffers(offers: readonly Offer[], context: EligibilityContext): Offer[] {
  return offers.filter((offer) => evaluateOffer(offer, context).eligible);
}

/**
 * Ordem da comparação, documentada e estável (PRD §10.5):
 * 1. preço crescente;
 * 2. observação mais recente primeiro — preço fresco vale mais que preço empatado e velho;
 * 3. nome da loja em ordem alfabética;
 * 4. identificador da oferta.
 *
 * O estado da parceria não entra em nenhum critério.
 */
export function compareOffers(
  a: Offer,
  b: Offer,
  stores: ReadonlyMap<string, Store>,
): number {
  if (a.priceCents !== b.priceCents) return a.priceCents - b.priceCents;
  const byDate = new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime();
  if (byDate !== 0) return byDate;
  const nameA = stores.get(a.storeId)?.name ?? "";
  const nameB = stores.get(b.storeId)?.name ?? "";
  const byName = nameA.localeCompare(nameB, "pt-BR");
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

/** Ofertas elegíveis, na ordem da comparação. */
export function rankOffers(offers: readonly Offer[], context: EligibilityContext): Offer[] {
  return eligibleOffers(offers, context).sort((a, b) => compareOffers(a, b, context.stores));
}

/** O menor preço elegível, ou `null` quando nenhuma oferta se qualifica. */
export function cheapestOffer(offers: readonly Offer[], context: EligibilityContext): Offer | null {
  return rankOffers(offers, context)[0] ?? null;
}

/** Agrupa ofertas elegíveis por produto — cada produto tem o seu menor preço, nunca um só para o jogo. */
export function cheapestByProduct(
  offers: readonly Offer[],
  context: EligibilityContext,
): Map<string, Offer> {
  const best = new Map<string, Offer>();
  for (const offer of rankOffers(offers, context)) {
    if (!best.has(offer.productId)) best.set(offer.productId, offer);
  }
  return best;
}
