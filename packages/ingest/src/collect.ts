// Coleta de uma fonte (OFR-004): arquivo local, feed por URL ou conector registrado. A mesma função serve o worker,
// o painel e o agendador — a origem do dado não muda a regra de validação.

import { readFile } from "node:fs/promises";
import { collectFeed, connectorFor, importStructured, type ConnectorOutput } from "@tako/connectors";
import type { Source } from "@tako/domain";

export interface CollectOptions {
  /** Arquivo local, quando quem chamou já tem o conteúdo em disco. */
  file?: string;
  now?: Date;
}

/** Fonte com URL de feed vira conector genérico; fonte sem conector e sem feed não coleta. */
export async function collectForSource(source: Source, options: CollectOptions = {}): Promise<ConnectorOutput> {
  if (options.file !== undefined) {
    return importStructured(await readFile(options.file, "utf8"));
  }
  if (source.feedUrl !== null && source.feedUrl.trim() !== "") {
    return collectFeed(
      {
        url: source.feedUrl,
        format: source.format === "json" || source.format === "csv" ? source.format : "auto",
        fieldMap: source.fieldMap,
      },
      options.now ?? new Date(),
    );
  }
  const connector = connectorFor(source.slug);
  if (connector === null) {
    throw new Error(`fonte "${source.slug}" não tem conector nem URL de feed`);
  }
  if (!("collect" in connector) || typeof connector.collect !== "function") {
    throw new Error(`conector "${source.slug}" não sabe coletar sozinho`);
  }
  return connector.collect({ file: undefined, now: options.now ?? new Date() });
}

/** A fonte pode ser coletada automaticamente? Feed configurado ou conector registrado. */
export function sourceCanCollect(source: Source): boolean {
  if (source.feedUrl !== null && source.feedUrl.trim() !== "") return true;
  const connector = connectorFor(source.slug);
  return connector !== null && "collect" in connector && typeof connector.collect === "function";
}
