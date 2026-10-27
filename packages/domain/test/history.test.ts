import test from "node:test";
import assert from "node:assert/strict";

import { historyPeriodLabel, summarizeHistory, type PricePoint } from "../src/history";

const now = new Date("2026-10-27T12:00:00.000Z");
const day = (daysAgo: number): string => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const point = (daysAgo: number, priceCents: number, sourceId = "fonte-a"): PricePoint => ({
  observedAt: day(daysAgo),
  priceCents,
  sourceId,
});

test("resume menor, maior e último preço da janela", () => {
  const summary = summarizeHistory([point(100, 29_900), point(10, 19_900), point(3, 24_900)], {
    windowDays: 30,
    now,
  });

  assert.equal(summary.min?.priceCents, 19_900);
  assert.equal(summary.max?.priceCents, 24_900);
  assert.equal(summary.last?.priceCents, 24_900);
  assert.equal(summary.observations, 2);
});

test("não promete janela que a coleta não cobre", () => {
  const summary = summarizeHistory([point(10, 19_900), point(3, 24_900)], { windowDays: 90, now });

  assert.equal(summary.coversWindow, false);
  assert.match(historyPeriodLabel(summary), /início da coleta/);
});

test("cobre a janela quando a primeira observação é anterior ao recorte", () => {
  const summary = summarizeHistory([point(200, 39_900), point(10, 19_900)], { windowDays: 90, now });

  assert.equal(summary.coversWindow, true);
  assert.match(historyPeriodLabel(summary), /últimos 90 dias/);
  assert.equal(summary.coverageStart, day(200));
});

test("histórico vazio não inventa preço", () => {
  const summary = summarizeHistory([], { windowDays: 30, now });

  assert.equal(summary.min, null);
  assert.equal(summary.max, null);
  assert.equal(summary.last, null);
  assert.equal(summary.observations, 0);
  assert.equal(summary.coversWindow, false);
  assert.equal(historyPeriodLabel(summary), "sem observação no período");
});

test("observação fora da janela não entra na conta", () => {
  const summary = summarizeHistory([point(400, 9_900), point(5, 29_900)], { windowDays: 30, now });

  assert.equal(summary.min?.priceCents, 29_900);
  assert.equal(summary.observations, 1);
});

test("empate no menor preço mantém a primeira observação mais recente da janela", () => {
  const summary = summarizeHistory([point(20, 19_900), point(2, 19_900)], { windowDays: 30, now });

  assert.equal(summary.min?.at, day(20));
  assert.equal(summary.observations, 2);
});
