import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectSectionGames, sortCatalog, type CatalogCandidate } from "../src/index";
import { NOW } from "./fixtures";

const candidates: CatalogCandidate[] = [
  {
    gameId: "god-of-war",
    publishedAt: "2026-10-20T00:00:00.000Z",
    genres: ["Ação", "Aventura"],
    best: { priceCents: 12_990, referencePriceCents: 19_990, storeSlug: "nuuvem" },
  },
  {
    gameId: "hades-2",
    publishedAt: "2026-10-26T00:00:00.000Z",
    genres: ["Roguelike", "Ação"],
    best: { priceCents: 6_990, referencePriceCents: 9_990, storeSlug: "outraloja" },
  },
  {
    gameId: "sem-oferta",
    publishedAt: "2026-10-01T00:00:00.000Z",
    genres: ["Puzzle"],
    best: null,
  },
];

describe("seções automáticas da home", () => {
  it("escolhe por desconto mínimo, do maior desconto para o menor", () => {
    const ids = selectSectionGames(candidates, { kind: "discount", minPercent: 30 }, NOW);
    // god-of-war: 35% de desconto; hades-2: 30%.
    assert.deepEqual(ids, ["god-of-war", "hades-2"]);
  });

  it("escolhe por preço máximo, sem incluir jogo sem oferta", () => {
    assert.deepEqual(selectSectionGames(candidates, { kind: "below-price", maxCents: 10_000, currency: "BRL" }, NOW), [
      "hades-2",
    ]);
  });

  it("escolhe por gênero, ignorando caixa e acento", () => {
    assert.deepEqual(selectSectionGames(candidates, { kind: "genre", genre: "acao" }, NOW), [
      "hades-2",
      "god-of-war",
    ]);
  });

  it("escolhe por novidade", () => {
    assert.deepEqual(selectSectionGames(candidates, { kind: "recent", days: 3 }, NOW), ["hades-2"]);
  });

  it("escolhe por loja", () => {
    assert.deepEqual(selectSectionGames(candidates, { kind: "store", storeSlugs: ["Nuuvem"] }, NOW), ["god-of-war"]);
  });

  it("mantém a ordem escolhida a dedo e ignora id inexistente", () => {
    assert.deepEqual(
      selectSectionGames(candidates, { kind: "manual", gameIds: ["hades-2", "nao-existe", "god-of-war"] }, NOW),
      ["hades-2", "god-of-war"],
    );
  });

  it("devolve vazio quando nada se qualifica", () => {
    assert.deepEqual(selectSectionGames(candidates, { kind: "discount", minPercent: 90 }, NOW), []);
  });
});

describe("ordenação do catálogo", () => {
  const games = [
    { gameId: "a", title: "Zelda", releaseDate: "2023-05-12", best: { priceCents: 29_900, referencePriceCents: null } },
    { gameId: "b", title: "Hades II", releaseDate: "2024-09-30", best: { priceCents: 6_990, referencePriceCents: 9_990 } },
    { gameId: "c", title: "Baralho", releaseDate: null, best: null },
  ];

  it("ordena por preço e joga quem não tem oferta para o fim", () => {
    assert.deepEqual(sortCatalog(games, "price").map((g) => g.gameId), ["b", "a", "c"]);
  });

  it("ordena por desconto", () => {
    assert.deepEqual(sortCatalog(games, "discount").map((g) => g.gameId), ["b", "a", "c"]);
  });

  it("ordena por nome em pt-BR", () => {
    assert.deepEqual(sortCatalog(games, "name").map((g) => g.gameId), ["c", "b", "a"]);
  });

  it("ordena por lançamento, mais novo primeiro e sem data no fim", () => {
    assert.deepEqual(sortCatalog(games, "release").map((g) => g.gameId), ["b", "a", "c"]);
  });
});
