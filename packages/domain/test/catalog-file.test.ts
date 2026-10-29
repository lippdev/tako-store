import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_FILE_FORMAT,
  parseCatalogFile,
  planCatalogImport,
  serializeCatalogFile,
  type CatalogEntry,
  type Game,
} from "../src/index";

const game: Game = {
  id: "1",
  slug: "as-cronicas-de-vela",
  title: "As Crônicas de Vela",
  originalTitle: null,
  alternativeTitles: ["Vela"],
  description: "Um jogo de navegação.",
  releaseDate: "2025-03-14",
  developers: ["Estúdio Vela"],
  publishers: [],
  genres: ["aventura"],
  platforms: ["steam"],
  operatingSystems: ["windows"],
  media: { cover: null, hero: null, logo: null, screenshots: [] },
  published: true,
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const entry: CatalogEntry = {
  slug: "as-cronicas-de-vela",
  title: "As Crônicas de Vela",
  originalTitle: null,
  alternativeTitles: ["Vela"],
  description: "Um jogo de navegação.",
  releaseDate: "2025-03-14",
  developers: ["Estúdio Vela"],
  publishers: [],
  genres: ["aventura"],
  platforms: ["steam"],
  operatingSystems: ["windows"],
  published: true,
};

describe("arquivo de catálogo", () => {
  it("exporta e reimporta sem perder nada", () => {
    const text = serializeCatalogFile([game], new Date("2026-10-27T12:00:00Z"));
    const parsed = parseCatalogFile(text);
    assert.deepEqual(parsed.issues, []);
    assert.deepEqual(parsed.entries, [entry]);
    const plan = planCatalogImport([game], parsed.entries);
    assert.equal(plan.unchanged.length, 1);
    assert.equal(plan.created.length, 0);
    assert.equal(plan.updated.length, 0);
  });

  it("separa jogo novo de jogo alterado", () => {
    const novo: CatalogEntry = { ...entry, slug: "orbita", title: "Órbita" };
    const alterado: CatalogEntry = { ...entry, title: "As Crônicas de Vela — Edição Definitiva" };
    const plan = planCatalogImport([game], [alterado, novo]);
    assert.deepEqual(plan.created.map((item) => item.slug), ["orbita"]);
    assert.deepEqual(plan.updated.map((item) => item.slug), ["as-cronicas-de-vela"]);
  });

  it("recusa arquivo de outro formato e versão errada", () => {
    assert.equal(parseCatalogFile("{").issues[0]?.code, "json");
    assert.equal(parseCatalogFile("[]").issues[0]?.code, "formato");
    const outroFormato = JSON.stringify({ formato: "outro", versao: 1, jogos: [] });
    assert.equal(parseCatalogFile(outroFormato).issues[0]?.code, "formato");
    const outraVersao = JSON.stringify({ formato: CATALOG_FILE_FORMAT, versao: 99, jogos: [] });
    assert.equal(parseCatalogFile(outraVersao).issues[0]?.code, "versao");
    const semLista = JSON.stringify({ formato: CATALOG_FILE_FORMAT, versao: 1, jogos: {} });
    assert.equal(parseCatalogFile(semLista).issues[0]?.code, "jogos");
  });

  it("aponta o índice e o código de cada jogo com problema", () => {
    const arquivo = JSON.stringify({
      formato: CATALOG_FILE_FORMAT,
      versao: 1,
      jogos: [
        { slug: "Sem Slug Valido", titulo: "X" },
        { slug: "sem-titulo" },
        { slug: "plataforma-errada", titulo: "X", plataformas: ["nintendo"] },
        { slug: "data-errada", titulo: "X", lancamento: "14/03/2025" },
        { slug: "duplicado", titulo: "X" },
        { slug: "duplicado", titulo: "Y" },
        { slug: "ok", titulo: "Certo" },
      ],
    });
    const parsed = parseCatalogFile(arquivo);
    assert.deepEqual(
      parsed.issues.map((issue) => [issue.index, issue.code]),
      [
        [0, "slug"],
        [1, "titulo"],
        [2, "plataformas"],
        [3, "lancamento"],
        [5, "duplicado"],
      ],
    );
    assert.deepEqual(parsed.entries.map((item) => item.slug), ["duplicado", "ok"]);
  });

  it("trata lista vazia como limpeza e ausência como vazio", () => {
    const arquivo = JSON.stringify({
      formato: CATALOG_FILE_FORMAT,
      versao: 1,
      jogos: [{ slug: "sem-listas", titulo: "Sem listas", generos: [] }],
    });
    const parsed = parseCatalogFile(arquivo);
    assert.deepEqual(parsed.entries[0]?.genres, []);
    assert.deepEqual(parsed.entries[0]?.platforms, []);
    assert.equal(parsed.entries[0]?.published, false);
    assert.equal(parsed.entries[0]?.description, null);
  });
});
