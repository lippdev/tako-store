import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { foldText, matchesSearch, searchScore } from "../src/index";

const game = {
  title: "God of War Ragnarök",
  originalTitle: "God of War Ragnarök",
  alternativeTitles: ["Deuses da Guerra"],
};

describe("busca", () => {
  it("ignora acentos, maiúsculas e espaços extras", () => {
    assert.equal(matchesSearch(game, "ragnarok"), true);
    assert.equal(matchesSearch(game, "  RAGNARÖK  "), true);
    assert.equal(matchesSearch(game, "god of   war"), true);
    assert.equal(foldText("  São   PAULO "), "sao paulo");
  });

  it("encontra por título alternativo", () => {
    assert.equal(matchesSearch(game, "deuses"), true);
  });

  it("exige que todos os termos apareçam", () => {
    assert.equal(matchesSearch(game, "war zelda"), false);
  });

  it("trata busca vazia como tudo", () => {
    assert.equal(matchesSearch(game, ""), true);
    assert.equal(matchesSearch(game, "   "), true);
  });

  it("pontua título exato acima de prefixo, e prefixo acima de meio", () => {
    const exato = searchScore({ title: "Hades", originalTitle: null, alternativeTitles: [] }, "hades");
    const prefixo = searchScore({ title: "Hades II", originalTitle: null, alternativeTitles: [] }, "hades");
    const meio = searchScore({ title: "Um Hades Qualquer", originalTitle: null, alternativeTitles: [] }, "hades");
    assert.ok(exato > prefixo);
    assert.ok(prefixo > meio);
  });
});
