// Worker de importação (PRD §15): coleta da fonte, valida, vincula e grava as ofertas.
//
//   npm run worker -- sources
//   npm run worker -- import --source arquivo-demo
//   npm run worker -- import --source arquivo-demo --file ./catalogo.csv
//
// O worker não decide vínculo ambíguo: vínculo exato (mesmo título, edição e plataforma) entra aprovado; o resto vai
// para a fila do painel. Importar de novo não duplica oferta: a chave é produto + loja + fonte + região + plataforma.

import { readFile } from "node:fs/promises";
import { connectorFor, importStructured, suggestProduct, type RawOffer } from "@tako/connectors";
import {
  approvedProductFor,
  autoApproveMapping,
  closePool,
  finishIngestionRun,
  getSourceBySlug,
  getStoreBySlug,
  listAllGames,
  listProducts,
  listSources,
  recordIngestionError,
  startIngestionRun,
  suggestMapping,
  touchSourceRun,
  upsertExternalProduct,
  upsertOffer,
} from "@tako/db";

interface Args {
  command: string;
  source?: string;
  file?: string;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const args: Args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const next = rest[index + 1];
    if (token === "--source" && next !== undefined) {
      args.source = next;
      index += 1;
    } else if (token === "--file" && next !== undefined) {
      args.file = next;
      index += 1;
    }
  }
  return args;
}

async function showSources(): Promise<void> {
  const sources = await listSources();
  for (const source of sources) {
    const connector = connectorFor(source.slug);
    console.log(
      `${source.slug}\t${source.name}\t${source.enabled ? "ativa" : "pausada"}\t${connector === null ? "sem conector" : `conector v${connector.version}`}`,
    );
  }
}

async function importSource(slug: string, file: string | undefined): Promise<void> {
  const source = await getSourceBySlug(slug);
  if (source === null) throw new Error(`fonte "${slug}" não existe no banco`);
  if (!source.enabled) throw new Error(`fonte "${slug}" está pausada`);

  const connector = connectorFor(source.slug);
  if (connector === null) throw new Error(`nenhum conector registrado para "${slug}"`);

  const runId = await startIngestionRun(source.id, "worker");
  const [games, products] = await Promise.all([listAllGames(), listProducts()]);

  let collected;
  try {
    if (file !== undefined) {
      collected = importStructured(await readFile(file, "utf8"));
    } else if ("collect" in connector && typeof connector.collect === "function") {
      collected = await connector.collect({ file: undefined, now: new Date() });
    } else {
      throw new Error(`conector "${slug}" não sabe coletar sem arquivo`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishIngestionRun(runId, { status: "failed", received: 0, accepted: 0, rejected: 0, message });
    await recordIngestionError(runId, { line: null, code: "coleta", message });
    await touchSourceRun(source.id, true);
    throw error;
  }

  let accepted = 0;
  let linked = 0;
  const rejected = collected.errors.length;

  for (const error of collected.errors) {
    await recordIngestionError(runId, {
      line: error.line,
      code: error.code,
      message: error.message,
      ...(error.payload === undefined ? {} : { payload: error.payload }),
    });
  }

  for (const row of collected.rows as RawOffer[]) {
    const store = await getStoreBySlug(row.storeSlug);
    if (store === null) {
      await recordIngestionError(runId, {
        line: null,
        code: "loja-desconhecida",
        message: `loja "${row.storeSlug}" não cadastrada`,
        payload: { externalId: row.externalId },
      });
      continue;
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
    if (productId === null) continue;

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
    accepted += 1;
    if (confidence >= 0.95) linked += 1;
  }

  const status = rejected === 0 ? "success" : accepted > 0 ? "partial" : "failed";
  await finishIngestionRun(runId, {
    status,
    received: collected.rows.length + rejected,
    accepted,
    rejected,
    message: `${String(accepted)} oferta(s) gravada(s), ${String(linked)} vínculo(s) automático(s), ${String(rejected)} linha(s) rejeitada(s)`,
  });
  await touchSourceRun(source.id, status === "failed");

  console.log(`Fonte ${source.name} (${source.slug})`);
  console.log(`  linhas recebidas: ${String(collected.rows.length + rejected)}`);
  console.log(`  ofertas gravadas: ${String(accepted)}`);
  console.log(`  linhas rejeitadas: ${String(rejected)}`);
  if (rejected > 0) {
    for (const error of collected.errors) {
      console.log(`    linha ${String(error.line ?? "?")}: ${error.code} — ${error.message}`);
    }
  }
  console.log(`  executado como ${runId}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "sources") {
    await showSources();
    return;
  }
  if (args.command === "import") {
    if (args.source === undefined) throw new Error("use --source <slug>");
    await importSource(args.source, args.file);
    return;
  }
  console.log("Uso:\n  npm run worker -- sources\n  npm run worker -- import --source <slug> [--file <arquivo>]");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
