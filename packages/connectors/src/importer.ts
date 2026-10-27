// Importador estruturado (OFR-003): arquivo JSON ou CSV com as ofertas de uma fonte. O relatório é por linha —
// quem opera precisa saber qual linha estava errada e por quê.

import type { ConnectorOutput, RawOffer, RowError } from "./connector";
import { validateOfferRow } from "./connector";

/** CSV simples com cabeçalho: vírgula, aspas duplas escapadas por `""`. */
export function parseCsv(text: string): { header: string[]; rows: string[][]; errors: RowError[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const first = lines[0];
  if (first === undefined) return { header: [], rows: [], errors: [{ line: null, code: "vazio", message: "arquivo vazio" }] };

  const split = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  return { header: split(first), rows: lines.slice(1).map(split), errors: [] };
}

/** Converte as linhas para objetos usando o cabeçalho; linha curta ou longa é erro de formato. */
function csvRowsToObjects(rows: string[][], header: string[]): { objects: unknown[]; errors: RowError[] } {
  const errors: RowError[] = [];
  const objects = rows.flatMap((cells, index) => {
    if (cells.length !== header.length) {
      errors.push({
        line: index + 2,
        code: "colunas",
        message: `esperava ${String(header.length)} colunas, veio ${String(cells.length)}`,
        payload: cells,
      });
      return [];
    }
    return [Object.fromEntries(header.map((key, position) => [key, cells[position] ?? ""]))];
  });
  return { objects, errors };
}

export interface StructuredImport extends ConnectorOutput {
  /** Formato detectado. */
  format: "json" | "csv";
}

/** Importa um arquivo já lido: detecta JSON ou CSV e valida cada linha. */
export function importStructured(text: string, now = new Date()): StructuredImport {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { format: "json", rows: [], errors: [{ line: null, code: "json", message: "arquivo não é JSON válido" }] };
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const rows: RawOffer[] = [];
    const errors: RowError[] = [];
    list.forEach((entry, index) => {
      const result = validateOfferRow(entry, index + 1);
      if (result.ok) rows.push({ ...result.row, observedAt: result.row.observedAt ?? now.toISOString() });
      else errors.push(result.error);
    });
    return { format: "json", rows, errors };
  }

  const { header, rows, errors: parseErrors } = parseCsv(text);
  const { objects, errors: formatErrors } = csvRowsToObjects(rows, header);
  const validated = objects.map((object, index) => validateOfferRow(object, index + 2));
  return {
    format: "csv",
    rows: validated.flatMap((result) =>
      result.ok ? [{ ...result.row, observedAt: result.row.observedAt ?? now.toISOString() }] : [],
    ),
    errors: [
      ...parseErrors,
      ...formatErrors,
      ...validated.flatMap((result) => (result.ok ? [] : [result.error])),
    ],
  };
}
