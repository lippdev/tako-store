import test from "node:test";
import assert from "node:assert/strict";

import { groupDuplicates, mergeImpactLabel, type DuplicateGame } from "../src/duplicates";

const game = (overrides: Partial<DuplicateGame> & Pick<DuplicateGame, "id" | "title">): DuplicateGame => ({
  originalTitle: null,
  alternativeTitles: [],
  releaseDate: null,
  slug: overrides.id,
  ...overrides,
});

test("agrupa jogos com o mesmo título normalizado", () => {
  const groups = groupDuplicates([
    game({ id: "a", title: "Chrono Trigger" }),
    game({ id: "b", title: "chrono  trigger" }),
    game({ id: "c", title: "Outro Jogo" }),
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.games.map((item) => item.id).sort(), ["a", "b"]);
});

test("considera título original e alternativo na comparação", () => {
  const groups = groupDuplicates([
    game({ id: "a", title: "Chrono Trigger" }),
    game({ id: "b", title: "Crono Torigger", originalTitle: "Chrono Trigger" }),
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.games.map((item) => item.id).sort(), ["a", "b"]);
});

test("acento não separa candidatos", () => {
  const groups = groupDuplicates([
    game({ id: "a", title: "Ação Total" }),
    game({ id: "b", title: "Acao Total" }),
  ]);

  assert.equal(groups.length, 1);
});

test("jogo sozinho não vira grupo", () => {
  const groups = groupDuplicates([game({ id: "a", title: "Sekiro" }), game({ id: "b", title: "Bloodborne" })]);

  assert.deepEqual(groups, []);
});

test("título vazio não aproxima jogos", () => {
  const groups = groupDuplicates([game({ id: "a", title: "" }), game({ id: "b", title: "   " })]);

  assert.deepEqual(groups, []);
});

test("impacto da união é descrito para a tela", () => {
  assert.equal(
    mergeImpactLabel({ products: 2, offers: 7, externalIdentifiers: 3 }),
    "2 produto(s) · 7 oferta(s) · 3 identificador(es) externo(s)",
  );
});
