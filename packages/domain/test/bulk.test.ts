import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulkChange,
  gamesAffectedByBulk,
  matchesBulkFilter,
  type BulkFilter,
  type Game,
} from "../src/index";

function jogo(patch: Partial<Game>): Game {
  return {
    id: patch.slug ?? "id",
    slug: "jogo",
    title: "Jogo",
    originalTitle: null,
    alternativeTitles: [],
    description: "descrição",
    releaseDate: null,
    developers: [],
    publishers: [],
    genres: [],
    platforms: ["steam"],
    operatingSystems: ["windows"],
    media: { cover: "https://x.example/capa.jpg", hero: null, logo: null, screenshots: [] },
    published: true,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

const pub = jogo({ slug: "publicado" });
const oculto = jogo({ slug: "oculto", published: false });
const semCapa = jogo({ slug: "sem-capa", media: { cover: null, hero: null, logo: null, screenshots: [] } });
const semDescricao = jogo({ slug: "sem-descricao", description: null });
const arquivado = jogo({ slug: "arquivado", published: false, archived: true });
const todos = [pub, oculto, semCapa, semDescricao, arquivado];

describe("filtro do lote", () => {
  it("separa publicado, oculto e arquivado sem misturar", () => {
    const slugs = (filter: BulkFilter) => todos.filter((game) => matchesBulkFilter(game, filter)).map((g) => g.slug);
    assert.deepEqual(slugs("publicados"), ["publicado", "sem-capa", "sem-descricao"]);
    assert.deepEqual(slugs("ocultos"), ["oculto"]);
    assert.deepEqual(slugs("arquivados"), ["arquivado"]);
    assert.deepEqual(slugs("sem-capa"), ["sem-capa"]);
    assert.deepEqual(slugs("sem-descricao"), ["sem-descricao"]);
  });

  it("arquivado nunca entra como publicado nem como oculto", () => {
    assert.equal(matchesBulkFilter(arquivado, "publicados"), false);
    assert.equal(matchesBulkFilter(arquivado, "ocultos"), false);
  });
});

describe("alteração em lote", () => {
  it("a prévia só mostra o jogo que ainda não está como a ação deixaria", () => {
    assert.deepEqual(gamesAffectedByBulk(todos, "sem-capa", "ocultar").map((g) => g.slug), ["sem-capa"]);
    assert.deepEqual(gamesAffectedByBulk(todos, "arquivados", "restaurar").map((g) => g.slug), ["arquivado"]);
    // Publicar um jogo já publicado não muda nada: fora da prévia, fora da gravação.
    assert.deepEqual(gamesAffectedByBulk([pub], "publicados", "publicar"), []);
  });

  it("publicar tira do arquivo, e arquivar despublica", () => {
    assert.deepEqual(bulkChange("publicar"), { published: true, archived: false });
    assert.deepEqual(bulkChange("arquivar"), { published: false, archived: true });
    assert.deepEqual(bulkChange("ocultar"), { published: false });
  });

  it("filtro sem jogo que mude devolve lista vazia", () => {
    assert.deepEqual(gamesAffectedByBulk([pub], "publicados", "publicar"), []);
    assert.deepEqual(gamesAffectedByBulk(todos, "ocultos", "ocultar"), []);
  });
});
