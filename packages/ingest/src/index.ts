// Importação (PRD §15): valida, vincula e grava as ofertas de uma fonte. O worker usa este pacote pela linha de
// comando; o painel usa o mesmo código para reprocessar os erros de uma execução (OFR-006) — uma regra só.
//
// O vínculo ambíguo não é decidido aqui: título exato, edição e plataforma iguais entram aprovados; o resto vai para
// a fila do painel. Reimportar não duplica oferta: a chave é produto + loja + fonte + região + plataforma.

import { suggestProduct, validateOfferRow, type ConnectorOutput, type RawOffer } from "@tako/connectors";
import type { Source } from "@tako/domain";
import { foldText, slugify } from "@tako/domain";
import { collectForSource, type CollectOptions } from "./collect";
import {
  approvedProductFor,
  autoApproveMapping,
  finishIngestionRun,
  findGameBySlug,
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
  updateGame,
  upsertExternalProduct,
  upsertGame,
  upsertOffer,
  upsertProduct,
} from "@tako/db";

export * from "./collect";

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

/**
 * Cria o jogo e o produto base que a fonte oficial trouxe. Devolve o id do produto novo, ou `null` quando o
 * slug já pertence a um jogo com outro título — esse caso volta para a fila de revisão em vez de chutar.
 * O jogo nasce publicado: fonte canônica é o registro oficial do jogo (pedido do mantenedor para o catálogo
 * real); o editor oculta em lote quando quiser.
 */
async function createGameFromSource(cache: RunCache, row: RawOffer): Promise<string | null> {
  // Título sem letras latinas (japonês, coreano, chinês) não vira slug: usa o identificador da fonte.
  const base = slugify(row.title) || `jogo-${row.externalId.toLowerCase()}`;
  if (base === "") return null;
  let slug = base;
  const known = cache.games.find((game) => game.slug === slug);
  const existing = known ?? await findGameBySlug(slug);
  if (existing !== null && foldText(existing.title) !== foldText(row.title)) {
    slug = `${base}-${row.externalId.toLowerCase()}`;
    const alternative = cache.games.find((game) => game.slug === slug) ?? await findGameBySlug(slug);
    if (alternative !== null) return null;
  }
  const game = await upsertGame({
    slug,
    title: row.title,
    coverUrl: row.coverUrl ?? null,
    description: row.description ?? null,
    genres: row.genres ?? [],
    platforms: [row.platform],
    published: true,
  });
  if (row.coverUrl !== null && row.coverUrl !== undefined && existing === null) {
    await updateGame(game.id, { coverUrl: row.coverUrl });
  }
  const product = await upsertProduct({ gameId: game.id, kind: "base", platform: row.platform });
  cache.games = [game, ...cache.games];
  cache.products = [product, ...cache.products];
  return product.id;
}

/** Catálogo lido uma vez por execução e atualizado quando a própria execução cria jogo. */
interface RunCache {
  games: Awaited<ReturnType<typeof listAllGames>>;
  products: Awaited<ReturnType<typeof listProducts>>;
}

/** Grava uma linha já validada: produto externo, sugestão de vínculo, aprovação exata e oferta. */
async function persistRow(cache: RunCache, source: Source, row: RawOffer): Promise<RowOutcome> {
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

  const suggestion = suggestProduct(row, cache.games, cache.products);
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

  // Fonte canônica do jogo (fonte oficial da própria vitrine): o que ainda não existe no catálogo nasce da
  // própria fonte, oculto até o editor publicar. Jogo que pode já existir com outro título continua na fila.
  if (suggestion.productId === null && source.autoCreate) {
    const created = await createGameFromSource(cache, row);
    if (created !== null) {
      await autoApproveMapping({
        externalProductId,
        productId: created,
        confidence: 1,
        reason: `Fonte oficial criou o jogo e o produto (${row.platform})`,
      });
    }
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
  // O catálogo entra na memória uma vez por execução: importar milhares de linhas não pode recarregar o
  // banco inteiro por linha.
  const [games, products] = await Promise.all([listAllGames(), listProducts()]);
  const cache: RunCache = { games, products };
  for (const row of collected.rows) {
    const outcome = await persistRow(cache, source, row);
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
 * Coleta e importa uma fonte: execução registrada mesmo quando a coleta falha, com o motivo no relatório.
 * `triggeredBy` diz quem disparou ("worker", "painel", "agendador").
 */
export async function importSource(source: Source, triggeredBy: string, options: CollectOptions = {}): Promise<RunSummary> {
  let collected;
  try {
    collected = await collectForSource(source, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const runId = await startIngestionRun(source.id, triggeredBy);
    await recordIngestionError(runId, { line: null, code: "coleta", message });
    await finishIngestionRun(runId, { status: "failed", received: 0, accepted: 0, rejected: 0, message });
    await touchSourceRun(source.id, true);
    throw new Error(`coleta de "${source.slug}" falhou: ${message}`);
  }
  return importCollected(source, collected, triggeredBy);
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
  const [games, products] = await Promise.all([listAllGames(), listProducts()]);
  const cache: RunCache = { games, products };

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
    const outcome = await persistRow(cache, source, {
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
