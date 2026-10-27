// Worker de coleta e importação (PRD §15). Comandos:
//
//   npm run worker -- sources
//   npm run worker -- runs [--limit 10]
//   npm run worker -- import --source arquivo-demo [--file ./catalogo.csv]
//   npm run worker -- retry --run <id da execução>
//   npm run worker -- due                 # uma passada pelas fontes com coleta devida
//   npm run worker -- daemon [--interval 60]
//
// O agendador respeita `cadence_hours` de cada fonte: coleta a que está devida, registra a execução e volta a dormir.
// Ele não substitui um supervisor de processo (systemd, container restart), só dispensa um cron por fonte.

import { connectorFor } from "@tako/connectors";
import {
  closePool,
  getSourceBySlug,
  listDueSources,
  listIngestionRuns,
  listSources,
} from "@tako/db";
import { importSource, retryFailedRun, sourceCanCollect, type RunSummary } from "@tako/ingest";

interface Args {
  command: string;
  source?: string;
  file?: string;
  run?: string;
  limit?: number;
  interval?: number;
  once?: boolean;
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
    } else if (token === "--interval" && next !== undefined) {
      args.interval = Number(next);
      index += 1;
    } else if (token === "--once") {
      args.once = true;
    }
  }
  return args;
}

async function showSources(): Promise<void> {
  for (const source of await listSources()) {
    const connector = connectorFor(source.slug);
    const origem = source.feedUrl !== null ? "feed por URL" : connector === null ? "sem conector" : `conector v${connector.version}`;
    console.log(
      `${source.slug}\t${source.name}\t${source.enabled ? "ativa" : "pausada"}\t${source.status}\t${origem}\tcadência ${String(source.cadenceHours ?? "—")} h`,
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

async function importOne(slug: string, file: string | undefined): Promise<void> {
  const source = await getSourceBySlug(slug);
  if (source === null) throw new Error(`fonte "${slug}" não existe no banco`);
  if (!source.enabled) throw new Error(`fonte "${slug}" está pausada`);
  const summary = await importSource(source, "worker", file === undefined ? {} : { file });
  console.log(`Fonte ${source.name} (${source.slug})`);
  printSummary(summary);
}

/** Uma passada: cada fonte devida é coletada uma vez, em série; falha de uma não impede as outras. */
async function runDue(): Promise<number> {
  const due = (await listDueSources()).filter(sourceCanCollect);
  if (due.length === 0) {
    console.log("Nenhuma fonte com coleta devida agora.");
    return 0;
  }
  let failures = 0;
  for (const source of due) {
    try {
      const summary = await importSource(source, "agendador");
      console.log(`${source.slug}: ${String(summary.accepted)} oferta(s) gravada(s), ${String(summary.rejected)} recusada(s)`);
    } catch (error) {
      failures += 1;
      console.error(`${source.slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return failures;
}

async function runDaemon(intervalSeconds: number, once: boolean): Promise<void> {
  console.log(`Agendador: uma passada a cada ${String(intervalSeconds)} s${once ? " (uma vez)" : ""}.`);
  for (;;) {
    const failures = await runDue();
    if (failures > 0) console.error(`${String(failures)} fonte(s) falharam nesta passada.`);
    if (once) return;
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
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
      `${run.id}\t${run.sourceSlug}\t${run.status}\t${String(run.accepted)}/${String(run.received)}\terros abertos: ${String(run.openErrors)}\t${run.startedAt}`,
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
      await importOne(args.source, args.file);
      return;
    case "retry":
      if (args.run === undefined) throw new Error("informe a execução com --run <id>");
      await retryRun(args.run);
      return;
    case "due": {
      const failures = await runDue();
      if (failures > 0) process.exitCode = 1;
      return;
    }
    case "daemon":
      await runDaemon(args.interval ?? 60, args.once ?? false);
      return;
    default:
      console.log(
        "Uso:\n  npm run worker -- sources\n  npm run worker -- runs [--limit 10]\n  npm run worker -- import --source <slug> [--file <arquivo>]\n  npm run worker -- retry --run <id>\n  npm run worker -- due\n  npm run worker -- daemon [--interval 60] [--once]",
      );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
