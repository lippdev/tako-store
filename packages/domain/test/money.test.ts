import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discountPercent, formatBRL, isValidPrice } from "../src/index";

describe("dinheiro", () => {
  it("formata centavos em reais", () => {
    // O Intl usa espaço não separável entre símbolo e valor; na tela é o mesmo espaço.
    const plain = (value: string) => value.replace(/\u00a0/g, " ");
    assert.equal(plain(formatBRL(12_990)), "R$ 129,90");
    assert.equal(plain(formatBRL(500)), "R$ 5,00");
  });

  it("só calcula desconto com referência confiável e maior que o preço", () => {
    assert.equal(discountPercent(10_000, 20_000), 50);
    assert.equal(discountPercent(15_000, 20_000), 25);
    assert.equal(discountPercent(20_000, 20_000), null);
    assert.equal(discountPercent(25_000, 20_000), null);
    assert.equal(discountPercent(10_000, null), null);
    assert.equal(discountPercent(10_000, 0), null);
  });

  it("arredonda o desconto para baixo, para não prometer mais do que existe", () => {
    // 19990 → 12990 é 35,01% de desconto; a tela pode dizer 35%, nunca 36%.
    assert.equal(discountPercent(12_990, 19_990), 35);
  });

  it("recusa preço que não é inteiro positivo", () => {
    assert.equal(isValidPrice(0), false);
    assert.equal(isValidPrice(-1), false);
    assert.equal(isValidPrice(12.5), false);
    assert.equal(isValidPrice(Number.NaN), false);
    assert.equal(isValidPrice(12_990), true);
  });
});
