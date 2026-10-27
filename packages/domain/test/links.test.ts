import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedRedirect, normalizeDomain } from "../src/index";

describe("redirecionamento", () => {
  const allowed = ["nuuvem.com.br"];

  it("aceita o domínio cadastrado e seus subdomínios", () => {
    assert.equal(isAllowedRedirect({ url: "https://nuuvem.com.br/item/1", storeAllowedDomains: allowed }), true);
    assert.equal(isAllowedRedirect({ url: "https://www.nuuvem.com.br/item/1", storeAllowedDomains: allowed }), true);
  });

  it("recusa host que só termina com o texto do domínio", () => {
    assert.equal(
      isAllowedRedirect({ url: "https://nuuvem.com.br.malicioso.net/item", storeAllowedDomains: allowed }),
      false,
    );
    assert.equal(isAllowedRedirect({ url: "https://naonuuvem.com.br/item", storeAllowedDomains: allowed }), false);
  });

  it("recusa http, outro host e URL com usuário", () => {
    assert.equal(isAllowedRedirect({ url: "http://nuuvem.com.br/item", storeAllowedDomains: allowed }), false);
    assert.equal(isAllowedRedirect({ url: "https://outraloja.com/item", storeAllowedDomains: allowed }), false);
    assert.equal(isAllowedRedirect({ url: "https://tako@nuuvem.com.br/item", storeAllowedDomains: allowed }), false);
    assert.equal(isAllowedRedirect({ url: "nao e url", storeAllowedDomains: allowed }), false);
  });

  it("recusa quando a loja não cadastrou domínio", () => {
    assert.equal(isAllowedRedirect({ url: "https://nuuvem.com.br/item", storeAllowedDomains: [] }), false);
  });

  it("preserva o caminho e os parâmetros da oferta", () => {
    const url = "https://nuuvem.com.br/item/1?utm_source=tako&cupom=X";
    assert.equal(isAllowedRedirect({ url, storeAllowedDomains: allowed }), true);
    assert.equal(new URL(url).searchParams.get("utm_source"), "tako");
  });
});

describe("domínio cadastrado", () => {
  it("normaliza o que a pessoa digita", () => {
    assert.equal(normalizeDomain("https://WWW.Nuuvem.com.br/itens"), "www.nuuvem.com.br");
    assert.equal(normalizeDomain("  nuuvem.com.br/  "), "nuuvem.com.br");
    assert.equal(normalizeDomain("nuuvem.com.br:443"), "nuuvem.com.br");
  });
});
