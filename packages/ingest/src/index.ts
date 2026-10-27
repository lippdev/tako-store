// Importação (PRD §15): valida, vincula e grava as ofertas de uma fonte. O worker usa este pacote pela linha de
// comando; o painel usa o mesmo código para reprocessar os erros de uma execução (OFR-006) — uma regra só.
//
// O vínculo ambíguo não é decidido aqui: título exato, edição e plataforma iguais entram aprovados; o resto vai para
// a fila do painel. Reimportar não duplica oferta: a chave é produto + loja + fonte + região + plataforma.

import { suggestProduct, validateOfferRow, type ConnectorOutput, type RawOffer } from "@tako/connectors";
import type { Source } from "@tako/domain";
import {
  approvedProductFor,
  autoApproveMapping,
  finishIngestionRun,
  getIngestionRun,
  getSourceBySlug,
  getStoreBySlug,
  listAllGames,
  listIngestionErrorsDetailed,
  listProducts,
  recordIngestionError,
  resolveIngestionErrors,
  startIngestionRun,
  suggestMapping,
  touchSourceRun,
  upsertExternalProduct,
  upsertOffer,
} from "@tako/db";

export interface ImportedError {
  line: number | null;
  code: string;
  message: string;
}

export interface RunSummary {
  runId: string;
  status: "success" | "partial" | "failed";
  received: number;
  accepted: number;
  linked: number;
  rejected: number;
  message: string;
  errors: ImportedError[];
}

interface RowOutcome {
  accepted: boolean;
  linked: boolean;
  error?: ImportedError;
  /** Linha normalizada, guardada junto do erro para o reprocessamento poder tentar de novo (OFR-006). */
  payload?: RawOffer;
}

/** Grava uma linha já validada: produto externo, sugestão de vínculo, aprovação exata e oferta. */
async function persistRow(source: Source, row: RawOffer): Promise<RowOutcome> {
  const store = await getStoreBySlug(row.storeSlug);
  if (store === null) {
    return {
      accepted: false,
      linked: false,
      error: { line: null, code: "loja-desconhecida", message: `loja "${row.storeSlug}" não cadastrada` },
      payload: row,
    };
  }

  const externalProductId = await upsertExternalProduct({
    sourceId: source.id,
    externalId: row.externalId,
    title: row.title,
    edition: row.edition,
    platform: row.platform,
    region: row.region,
    currency: row.currency,
  });

  const [games, products] = await Promise.all([listAllGames(), listProducts()]);
  const suggestion = suggestProduct(row, games, products);
  await suggestMapping({
    externalProductId,
    productId: suggestion.productId,
    confidence: suggestion.confidence,
    reason: suggestion.reason,
  });

  const confidence = suggestion.confidence ?? 0;
  if (suggestion.productId !== null && confidence >= 0.95) {
    await autoApproveMapping({
      externalProductId,
      productId: suggestion.productId,
      confidence,
      reason: suggestion.reason,
    });
  }

  const productId = await approvedProductFor(externalProductId);
  if (productId === null) {
    return {
      accepted: false,
      linked: false,
      error: { line: null, code: "vinculo-pendente", message: `"${row.title}" aguarda vínculo no painel` },
      payload: row,
    };
  }

  await upsertOffer({
    productId,
    storeId: store.id,
    sourceId: source.id,
    externalProductId,
    priceCents: row.priceCents,
    referencePriceCents: row.referencePriceCents,
    currency: row.currency,
    region: row.region,
    platform: row.platform,
    availability: row.availability,
    coupon: row.coupon,
    subscription: row.subscription,
    url: row.url,
    observedAt: row.observedAt === null ? new Date() : new Date(row.observedAt),
  });
  return { accepted: true, linked: confidence >= 0.95 };
}

/** Importa o que o conector entregou, registrando a execução e o relatório de erros por linha. */
export async function importCollected(source: Source, collected: ConnectorOutput, triggeredBy: string): Promise<RunSummary> {
  const runId = await startIngestionRun(source.id, triggeredBy);
  const errors: ImportedError[] = [];

  for (const error of collected.errors) {
    await recordIngestionError(runId, {
      line: error.line,
      code: error.code,
      message: error.message,
      ...(error.payload === undefined ? {} : { payload: error.payload }),
    });
    errors.push({ line: error.line, code: error.code, message: error.message });
  }

  let accepted = 0;
  let linked = 0;
  for (const row of collected.rows) {
    const outcome = await persistRow(source, row);
    if (outcome.accepted) {
      accepted += 1;
      if (outcome.linked) linked += 1;
    } else if (outcome.error !== undefined) {
      await recordIngestionError(runId, {
        line: outcome.error.line,
        code: outcome.error.code,
        message: outcome.error.message,
        ...(outcome.payload === undefined ? {} : { payload: outcome.payload }),
      });
      errors.push(outcome.error);
    }
  }

  const rejected = collected.errors.length + (collected.rows.length - accepted);
  const status: RunSummary["status"] = rejected === 0 ? "success" : accepted > 0 ? "partial" : "failed";
  const message = `${String(accepted)} oferta(s) gravada(s), ${String(linked)} vínculo(s) automático(s), ${String(rejected)} linha(s) rejeitada(s)`;
  await finishIngestionRun(runId, { status, received: collected.rows.length + collected.errors.length, accepted, rejected, message });
  await touchSourceRun(source.id, status === "failed");

  return { runId, status, received: collected.rows.length + collected.errors.length, accepted, linked, rejected, message, errors };
}

/**
 * Reprocessa os erros de uma execução (OFR-006): cada payload guardado passa de novo pela validação e, se agora
 * estiver correto, é gravado. O erro resolvido fica marcado com a execução que o resolveu; o que continua errado
 * segue aberto na nova execução, com o mesmo motivo.
 */
export async function retryFailedRun(runId: string, actor: string): Promise<RunSummary & { resolved: number; retried: number }> {
  const run = await getRunContext(runId);
  const source = await getSourceBySlug(run.sourceSlug);
  if (source === null) throw new Error(`fonte "${run.sourceSlug}" não existe mais`);

  const pending = await listIngestionErrorsDetailed(runId);
  const retried = pending.filter((error) => error.payload !== null && error.payload !== undefined && error.resolvedAt === null);
  if (retried.length === 0) {
    throw new Error(`a execução ${runId} não tem erro com conteúdo guardado para reprocessar`);
  }

  const newRunId = await startIngestionRun(source.id, `reprocessamento:${runId} por ${actor}`);
  const resolvedIds: string[] = [];
  const errors: ImportedError[] = [];
  let accepted = 0;
  let linked = 0;

  for (const error of retried) {
    const validation = validateOfferRow(error.payload, error.line);
    if (!validation.ok) {
      await recordIngestionError(newRunId, {
        line: validation.error.line,
        code: validation.error.code,
        message: validation.error.message,
        payload: validation.error.payload,
      });
      errors.push({ line: validation.error.line, code: validation.error.code, message: validation.error.message });
      continue;
    }
    const outcome = await persistRow(source, {
      ...validation.row,
      observedAt: validation.row.observedAt ?? new Date().toISOString(),
    });
    if (outcome.accepted) {
      accepted += 1;
      if (outcome.linked) linked += 1;
      resolvedIds.push(error.id);
    } else if (outcome.error !== undefined) {
      const failure = { line: error.line, code: outcome.error.code, message: outcome.error.message };
      await recordIngestionError(newRunId, { ...failure, payload: outcome.payload ?? error.payload });
      errors.push(failure);
    }
  }

  await resolveIngestionErrors(resolvedIds, newRunId);
  const rejected = retried.length - accepted;
  const status: RunSummary["status"] = rejected === 0 ? "success" : accepted > 0 ? "partial" : "failed";
  const message = `Reprocessamento de ${runId}: ${String(accepted)} de ${String(retried.length)} erro(s) resolvido(s)`;
  await finishIngestionRun(newRunId, { status, received: retried.length, accepted, rejected, message });
  // Reprocessar não é coleta: o estado da fonte (falha seguida) já foi registrado pela execução original.

  return {
    runId: newRunId,
    status,
    received: retried.length,
    accepted,
    linked,
    rejected,
    message,
    errors,
    resolved: accepted,
    retried: retried.length,
  };
}

interface RunContext {
  id: string;
  sourceId: string;
  sourceSlug: string;
  sourceName: string;
  status: string;
  startedAt: string;
}

async function getRunContext(runId: string): Promise<RunContext> {
  const run = await getIngestionRun(runId);
  if (run === null) throw new Error(`execução ${runId} não encontrada`);
  return run;
}
