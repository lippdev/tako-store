// Lojas, fontes, ofertas e importação. A escrita de oferta é idempotente e nunca deixa uma observação velha
// sobrescrever uma nova (PRD §14 e §15).

import type { ActivationPlatform, Availability, Offer, PartnerStatus, Source, SourceKind, Store } from "@tako/domain";
import { query, queryOne } from "../pool";
import { toOffer, toSource, toStore, type OfferRow, type SourceRow, type StoreRow } from "../mappers";

const STORE_COLUMNS = `id, slug, name, partner_status, enabled, allowed_domains, link_kind, attribution, regions, currencies`;
const SOURCE_COLUMNS = `id, slug, name, kind, enabled, max_age_hours, regions, currencies, notes`;
const OFFER_COLUMNS = `id, product_id, store_id, source_id, price_cents, reference_price_cents, currency, region,
  platform, availability, coupon, subscription, url, observed_at`;

export async function listStores(options: { enabledOnly?: boolean } = {}): Promise<Store[]> {
  const rows = await query<StoreRow>(
    `select ${STORE_COLUMNS} from stores ${options.enabledOnly === true ? "where enabled" : ""} order by name`,
  );
  return rows.map(toStore);
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const row = await queryOne<StoreRow>(`select ${STORE_COLUMNS} from stores where slug = $1`, [slug]);
  return row === null ? null : toStore(row);
}

export interface StoreInput {
  slug: string;
  name: string;
  partnerStatus?: PartnerStatus;
  enabled?: boolean;
  allowedDomains?: string[];
  linkKind?: Store["linkKind"];
  attribution?: string | null;
  regions?: string[];
  currencies?: string[];
}

/** Cadastra a loja antes de existir integração (PAR-001). O estado da parceria é só administrativo. */
export async function upsertStore(input: StoreInput): Promise<Store> {
  const row = await queryOne<StoreRow>(
    `insert into stores (slug, name, partner_status, enabled, allowed_domains, link_kind, attribution, regions, currencies)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (slug) do update set
       name = excluded.name,
       partner_status = excluded.partner_status,
       enabled = excluded.enabled,
       allowed_domains = excluded.allowed_domains,
       link_kind = excluded.link_kind,
       attribution = excluded.attribution,
       regions = excluded.regions,
       currencies = excluded.currencies,
       updated_at = now()
     returning ${STORE_COLUMNS}`,
    [
      input.slug,
      input.name,
      input.partnerStatus ?? "none",
      input.enabled ?? true,
      input.allowedDomains ?? [],
      input.linkKind ?? "direct",
      input.attribution ?? null,
      input.regions ?? ["BR"],
      input.currencies ?? ["BRL"],
    ],
  );
  if (row === null) throw new Error("upsert de loja não devolveu linha");
  return toStore(row);
}

export async function listSources(options: { enabledOnly?: boolean } = {}): Promise<Source[]> {
  const rows = await query<SourceRow>(
    `select ${SOURCE_COLUMNS} from sources ${options.enabledOnly === true ? "where enabled" : ""} order by name`,
  );
  return rows.map(toSource);
}

export async function getSourceBySlug(slug: string): Promise<Source | null> {
  const row = await queryOne<SourceRow>(`select ${SOURCE_COLUMNS} from sources where slug = $1`, [slug]);
  return row === null ? null : toSource(row);
}

export interface SourceInput {
  slug: string;
  name: string;
  kind: SourceKind;
  enabled?: boolean;
  maxAgeHours?: number;
  regions?: string[];
  currencies?: string[];
  notes?: string | null;
}

export async function upsertSource(input: SourceInput): Promise<Source> {
  const row = await queryOne<SourceRow>(
    `insert into sources (slug, name, kind, enabled, max_age_hours, regions, currencies, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (slug) do update set
       name = excluded.name,
       kind = excluded.kind,
       enabled = excluded.enabled,
       max_age_hours = excluded.max_age_hours,
       regions = excluded.regions,
       currencies = excluded.currencies,
       notes = excluded.notes,
       updated_at = now()
     returning ${SOURCE_COLUMNS}`,
    [
      input.slug,
      input.name,
      input.kind,
      input.enabled ?? true,
      input.maxAgeHours ?? 24,
      input.regions ?? ["BR"],
      input.currencies ?? ["BRL"],
      input.notes ?? null,
    ],
  );
  if (row === null) throw new Error("upsert de fonte não devolveu linha");
  return toSource(row);
}

export async function setSourceEnabled(id: string, enabled: boolean): Promise<void> {
  await query("update sources set enabled = $2, updated_at = now() where id = $1", [id, enabled]);
}

export interface OfferInput {
  productId: string;
  storeId: string;
  sourceId: string;
  externalProductId?: string | null;
  priceCents: number;
  referencePriceCents?: number | null;
  currency?: string;
  region?: string;
  platform: ActivationPlatform;
  availability?: Availability;
  coupon?: string | null;
  subscription?: string | null;
  url: string;
  observedAt: Date;
}

export interface OfferWrite {
  id: string;
  /** `false` quando a observação era mais velha que a oferta em vigor e foi ignorada. */
  applied: boolean;
}

/**
 * Grava a oferta atual. A chave é (produto, loja, fonte, região, plataforma): reimportar atualiza a mesma linha.
 * Se a observação que chega é mais antiga que a que está gravada, ela não substitui nada — só entra no histórico.
 */
export async function upsertOffer(input: OfferInput): Promise<OfferWrite> {
  const applied = await queryOne<{ id: string }>(
    `insert into offers (product_id, store_id, source_id, external_product_id, price_cents, reference_price_cents,
       currency, region, platform, availability, coupon, subscription, url, observed_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     on conflict (product_id, store_id, source_id, region, platform) do update set
       price_cents = excluded.price_cents,
       reference_price_cents = excluded.reference_price_cents,
       currency = excluded.currency,
       availability = excluded.availability,
       coupon = excluded.coupon,
       subscription = excluded.subscription,
       url = excluded.url,
       observed_at = excluded.observed_at,
       updated_at = now()
     where excluded.observed_at >= offers.observed_at
     returning id`,
    [
      input.productId,
      input.storeId,
      input.sourceId,
      input.externalProductId ?? null,
      input.priceCents,
      input.referencePriceCents ?? null,
      input.currency ?? "BRL",
      input.region ?? "BR",
      input.platform,
      input.availability ?? "available",
      input.coupon ?? null,
      input.subscription ?? null,
      input.url,
      input.observedAt,
    ],
  );

  if (applied === null) {
    const current = await queryOne<{ id: string }>(
      `select id from offers where product_id = $1 and store_id = $2 and source_id = $3 and region = $4 and platform = $5`,
      [input.productId, input.storeId, input.sourceId, input.region ?? "BR", input.platform],
    );
    if (current === null) throw new Error("oferta não foi gravada e não existe oferta anterior");
    return { id: current.id, applied: false };
  }

  await query(
    `insert into price_observations (offer_id, source_id, price_cents, reference_price_cents, availability, observed_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [applied.id, input.sourceId, input.priceCents, input.referencePriceCents ?? null, input.availability ?? "available", input.observedAt],
  );
  return { id: applied.id, applied: true };
}

/** Ofertas de um conjunto de produtos, para o motor de preço do domínio decidir. */
export async function listOffersForProducts(productIds: readonly string[]): Promise<Offer[]> {
  if (productIds.length === 0) return [];
  const rows = await query<OfferRow>(
    `select ${OFFER_COLUMNS} from offers where product_id = any($1::uuid[])`,
    [productIds],
  );
  return rows.map(toOffer);
}

export async function listOffersForProduct(productId: string): Promise<Offer[]> {
  const rows = await query<OfferRow>(`select ${OFFER_COLUMNS} from offers where product_id = $1`, [productId]);
  return rows.map(toOffer);
}

export async function getOfferById(id: string): Promise<Offer | null> {
  const row = await queryOne<OfferRow>(`select ${OFFER_COLUMNS} from offers where id = $1`, [id]);
  return row === null ? null : toOffer(row);
}

export async function recordOfferClick(offerId: string): Promise<void> {
  await query("insert into offer_clicks (offer_id) values ($1)", [offerId]);
}

// ——— Importação (OFR-003, OFR-006) ———

export async function startIngestionRun(sourceId: string, triggeredBy: string): Promise<string> {
  const row = await queryOne<{ id: string }>(
    "insert into ingestion_runs (source_id, triggered_by) values ($1, $2) returning id",
    [sourceId, triggeredBy],
  );
  if (row === null) throw new Error("execução de importação não foi criada");
  return row.id;
}

export async function finishIngestionRun(
  id: string,
  result: { status: "success" | "partial" | "failed"; received: number; accepted: number; rejected: number; message?: string },
): Promise<void> {
  await query(
    `update ingestion_runs set status = $2, received = $3, accepted = $4, rejected = $5, message = $6, finished_at = now()
     where id = $1`,
    [id, result.status, result.received, result.accepted, result.rejected, result.message ?? null],
  );
}

export async function recordIngestionError(
  runId: string,
  error: { line: number | null; code: string; message: string; payload?: unknown },
): Promise<void> {
  await query(
    `insert into ingestion_errors (run_id, line, code, message, payload) values ($1, $2, $3, $4, $5)`,
    [runId, error.line, error.code, error.message, error.payload === undefined ? null : JSON.stringify(error.payload)],
  );
}

export interface IngestionRun {
  id: string;
  sourceId: string;
  sourceName: string;
  status: string;
  triggeredBy: string;
  received: number;
  accepted: number;
  rejected: number;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
  errors: number;
}

export async function listIngestionRuns(limit = 30): Promise<IngestionRun[]> {
  return query<IngestionRun>(
    `select r.id, r.source_id as "sourceId", s.name as "sourceName", r.status, r.triggered_by as "triggeredBy",
            r.received, r.accepted, r.rejected, r.message,
            r.started_at as "startedAt", r.finished_at as "finishedAt",
            (select count(*)::int from ingestion_errors e where e.run_id = r.id) as errors
     from ingestion_runs r join sources s on s.id = r.source_id
     order by r.started_at desc limit $1`,
    [limit],
  );
}

export async function listIngestionErrors(
  runId: string,
): Promise<{ line: number | null; code: string; message: string }[]> {
  return query<{ line: number | null; code: string; message: string }>(
    "select line, code, message from ingestion_errors where run_id = $1 order by line nulls last, id",
    [runId],
  );
}

/** Marca a execução na fonte: última execução e falhas consecutivas (OPS-001). */
export async function touchSourceRun(sourceId: string, failed: boolean): Promise<void> {
  await query(
    `update sources set last_run_at = now(),
       consecutive_failures = case when $2 then consecutive_failures + 1 else 0 end,
       updated_at = now()
     where id = $1`,
    [sourceId, failed],
  );
}

// ——— Vínculo entre produto externo e produto canônico (OFR-005, CAT-008) ———

export interface ExternalProductInput {
  sourceId: string;
  externalId: string;
  title: string;
  edition?: string | null;
  platform: ActivationPlatform;
  region?: string;
  currency?: string;
  raw?: unknown;
}

export async function upsertExternalProduct(input: ExternalProductInput): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `insert into external_products (source_id, external_id, title, edition, platform, region, currency, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (source_id, external_id) do update set
       title = excluded.title, edition = excluded.edition, platform = excluded.platform,
       region = excluded.region, currency = excluded.currency, raw = excluded.raw, seen_at = now()
     returning id`,
    [
      input.sourceId,
      input.externalId,
      input.title,
      input.edition ?? null,
      input.platform,
      input.region ?? "BR",
      input.currency ?? "BRL",
      input.raw === undefined ? null : JSON.stringify(input.raw),
    ],
  );
  if (row === null) throw new Error("produto externo não foi gravado");
  return row.id;
}

/**
 * Sugere um vínculo. Vínculo já aprovado por uma pessoa nunca é sobrescrito por sugestão automática (PRD §14).
 */
export async function suggestMapping(input: {
  externalProductId: string;
  productId: string | null;
  confidence: number | null;
  reason: string;
}): Promise<void> {
  await query(
    `insert into product_mappings (external_product_id, product_id, status, confidence, reason)
     values ($1, $2, 'suggested', $3, $4)
     on conflict (external_product_id) do update set
       product_id = excluded.product_id,
       status = 'suggested',
       confidence = excluded.confidence,
       reason = excluded.reason,
       updated_at = now()
     where product_mappings.status in ('pending', 'suggested')`,
    [input.externalProductId, input.productId, input.confidence, input.reason],
  );
}

export interface MappingQueueItem {
  id: string;
  externalProductId: string;
  sourceName: string;
  externalId: string;
  externalTitle: string;
  edition: string | null;
  platform: string;
  region: string;
  status: string;
  confidence: string | null;
  reason: string | null;
  suggestedProductId: string | null;
  suggestedGameTitle: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
}

/** Fila de revisão: o produto que veio da fonte e o que a Tako sugeriu, lado a lado (PRD §12.3). */
export async function listMappingQueue(status = "suggested"): Promise<MappingQueueItem[]> {
  return query<MappingQueueItem>(
    `select m.id, m.external_product_id as "externalProductId", s.name as "sourceName",
            ep.external_id as "externalId", ep.title as "externalTitle", ep.edition, ep.platform, ep.region,
            m.status, m.confidence::text as confidence, m.reason,
            m.product_id as "suggestedProductId", g.title as "suggestedGameTitle",
            m.decided_by as "decidedBy", m.decided_at as "decidedAt"
     from product_mappings m
     join external_products ep on ep.id = m.external_product_id
     join sources s on s.id = ep.source_id
     left join products p on p.id = m.product_id
     left join games g on g.id = p.game_id
     where m.status = $1
     order by m.created_at desc`,
    [status],
  );
}

export async function decideMapping(input: {
  id: string;
  status: "approved" | "rejected" | "pending";
  productId: string | null;
  decidedBy: string;
}): Promise<void> {
  await query(
    `update product_mappings set status = $2, product_id = coalesce($3, product_id), decided_by = $4,
       decided_at = now(), updated_at = now()
     where id = $1`,
    [input.id, input.status, input.productId, input.decidedBy],
  );
}

/**
 * Aprovação automática: só para vínculo sem ambiguidade (mesmo título, mesma edição, mesma plataforma). Vínculo
 * já decidido por uma pessoa nunca é sobrescrito.
 */
export async function autoApproveMapping(input: {
  externalProductId: string;
  productId: string;
  confidence: number;
  reason: string;
}): Promise<void> {
  await query(
    `insert into product_mappings (external_product_id, product_id, status, confidence, reason, decided_by, decided_at)
     values ($1, $2, 'approved', $3, $4, 'importação automática', now())
     on conflict (external_product_id) do update set
       product_id = excluded.product_id,
       status = 'approved',
       confidence = excluded.confidence,
       reason = excluded.reason,
       decided_by = excluded.decided_by,
       decided_at = now(),
       updated_at = now()
     where product_mappings.status in ('pending', 'suggested')`,
    [input.externalProductId, input.productId, input.confidence, input.reason],
  );
}

/** Produto canônico de um produto externo aprovado, para a importação saber onde gravar a oferta. */
export async function approvedProductFor(externalProductId: string): Promise<string | null> {
  const row = await queryOne<{ product_id: string | null }>(
    "select product_id from product_mappings where external_product_id = $1 and status = 'approved'",
    [externalProductId],
  );
  return row?.product_id ?? null;
}
