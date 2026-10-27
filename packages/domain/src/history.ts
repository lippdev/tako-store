// Histórico de preço (PRD §10.6): a Tako só pode falar de "menor preço" quando informa o período e a cobertura.
// Antes do início da coleta não existe preço conhecido — e o código não inventa um.

export interface PricePoint {
  observedAt: string;
  priceCents: number;
  sourceId: string;
}

export interface HistorySummary {
  /** Menor preço observado na janela. */
  min: { priceCents: number; at: string } | null;
  /** Maior preço observado na janela. */
  max: { priceCents: number; at: string } | null;
  /** Preço da observação mais recente. */
  last: { priceCents: number; at: string } | null;
  /** Quantas observações entraram na conta. */
  observations: number;
  /** Primeira observação que a Tako tem, mesmo fora da janela. */
  coverageStart: string | null;
  /** Dias cobertos pela janela consultada. */
  windowDays: number;
  /**
   * A cobertura conhecida cobre a janela inteira? Só com `true` a tela pode dizer "menor preço em N dias".
   * Caso contrário, fala do que foi observado no período, sem prometer o passado anterior à coleta.
   */
  coversWindow: boolean;
}

/** Resume o histórico de um produto dentro de uma janela, com a cobertura explícita. */
export function summarizeHistory(
  points: readonly PricePoint[],
  options: { windowDays: number; now: Date },
): HistorySummary {
  const since = options.now.getTime() - options.windowDays * 86_400_000;
  const inside = points
    .filter((point) => new Date(point.observedAt).getTime() >= since)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const first = [...points].sort((a, b) => a.observedAt.localeCompare(b.observedAt))[0] ?? null;

  const reduce = (winner: (current: PricePoint, next: PricePoint) => boolean): PricePoint | null =>
    inside.reduce<PricePoint | null>((current, point) => (current === null || winner(current, point) ? point : current), null);

  const min = reduce((current, next) => next.priceCents < current.priceCents);
  const max = reduce((current, next) => next.priceCents > current.priceCents);
  const last = inside[inside.length - 1] ?? null;

  return {
    min: min === null ? null : { priceCents: min.priceCents, at: min.observedAt },
    max: max === null ? null : { priceCents: max.priceCents, at: max.observedAt },
    last: last === null ? null : { priceCents: last.priceCents, at: last.observedAt },
    observations: inside.length,
    coverageStart: first?.observedAt ?? null,
    windowDays: options.windowDays,
    coversWindow: first !== null && new Date(first.observedAt).getTime() <= since,
  };
}

/**
 * Texto do período, sem prometer o que não se mediu: com cobertura completa, "em N dias"; sem, "desde o início da
 * coleta". Nunca "menor preço histórico" seco.
 */
export function historyPeriodLabel(summary: HistorySummary): string {
  if (summary.observations === 0) return "sem observação no período";
  if (summary.coversWindow) return `nos últimos ${String(summary.windowDays)} dias`;
  const start = summary.coverageStart === null ? null : new Date(summary.coverageStart);
  const formatted = start === null ? null : start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return formatted === null ? "desde o início da coleta" : `desde ${formatted} (início da coleta)`;
}
