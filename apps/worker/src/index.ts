// Worker de importação (PRD §15): coleta da fonte pela linha de comando e entrega ao pacote @tako/ingest, que
// valida, vincula e grava. O mesmo código roda no painel quando o operador reprocessa erros (OFR-006).
//
//   npm run worker -- sources
//   npm run worker -- import --source arquivo-demo
//   npm run worker -- import --source arquivo-demo --file ./catalogo.csv
//   npm run worker -- retry --run <id da execução>
//   npm run worker -- runs [--limit 10]

import { readFile } from "node:fs/promises";
import { connectorFor, importStructured } from "@tako/connectors";
import {
  closePool,
  finishIngestionRun,
  getSourceBySlug,
  listIngestionRuns,
  listSources,
  recordIngestionError,
  startIngestionRun,
  touchSourceRun,
} from "@tako/db";
import { importCollected, retryFailedRun, type RunSummary } from "@tako/ingest";

interface Args {
  command: string;
  source?: string;
  file?: string;
  run?: string;
  limit?: number;
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
    } else if (token === "--run" && next !== undefined) {
      args.run = next;
      index += 1;
    } else if (token === "--limit" && next !== undefined) {
      args.limit = Number(next);
      index += 1;
    }
  }
  return args;
}

async function showSources(): Promise<void> {
  for (const source of await listSources()) {
    const connector = connectorFor(source.slug);
    console.log(
      `${source.slug}\t${source.name}\t${source.enabled ? "ativa" : "pausada"}\t${source.status}\t${connector === null ? "sem conector" : `conector v${connector.version}`}`,
    );
  }
}

function printSummary(summary: RunSummary): void {
  console.log(`  linhas recebidas: ${String(summary.received)}`);
  console.log(`  ofertas gravadas: ${String(summary.accepted)}`);
  console.log(`  linhas rejeitadas: ${String(summary.rejected)}`);
  for (const error of summary.errors) {
    console.log(`    linha ${String(error.line ?? "?")}: ${error.code} — ${error.message}`);
  }
  console.log(`  executado como ${summary.runId}`);
}

async function importSource(slug: string, file: string | undefined): Promise<void> {
  const source = await getSourceBySlug(slug);
  if (source === null) throw new Error(`fonte "${slug}" não existe no banco`);
  if (!source.enabled) throw new Error(`fonte "${slug}" está pausada`);

  const connector = connectorFor(source.slug);
  if (connector === null) throw new Error(`nenhum conector registrado para "${slug}"`);

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
    const runId = await startIngestionRun(source.id, "worker");
    await finishIngestionRun(runId, { status: "failed", received: 0, accepted: 0, rejected: 0, message });
    await recordIngestionError(runId, { line: null, code: "coleta", message });
    await touchSourceRun(source.id, true);
    throw error;
  }

  const summary = await importCollected(source, collected, "worker");
  console.log(`Fonte ${source.name} (${source.slug})`);
  printSummary(summary);
}

async function retryRun(runId: string): Promise<void> {
  const summary = await retryFailedRun(runId, "worker");
  console.log(`Reprocessamento de ${runId}`);
  printSummary(summary);
  console.log(`  erros resolvidos: ${String(summary.resolved)} de ${String(summary.retried)}`);
}

async function showRuns(limit: number): Promise<void> {
  for (const run of await listIngestionRuns(limit)) {
    console.log(
      `${run.id}\t${run.sourceSlug}\t${run.status}\t${String(run.accepted)}/${String(run.received)}\terros abertos: ${String(run.errors)}\t${run.startedAt}`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "sources":
      await showSources();
      return;
    case "runs":
      await showRuns(args.limit ?? 10);
      return;
    case "import":
      if (args.source === undefined) throw new Error("use --source <slug>");
      await importSource(args.source, args.file);
      return;
    case "retry":
      if (args.run === undefined) throw new Error("informe a execução com --run <id>");
      await retryRun(args.run);
      return;
    default:
      console.log(
        "Uso:\n  npm run worker -- sources\n  npm run worker -- runs [--limit 10]\n  npm run worker -- import --source <slug> [--file <arquivo>]\n  npm run worker -- retry --run <id>",
      );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
