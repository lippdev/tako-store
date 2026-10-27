import test from "node:test";
import assert from "node:assert/strict";

import {
  affiliateMode,
  buildAffiliateLink,
  isAffiliateParam,
  slugify,
  templateDomain,
  type AffiliateConfig,
} from "../src/affiliate";

const config = (overrides: Partial<AffiliateConfig> = {}): AffiliateConfig => ({
  linkKind: "affiliate",
  affiliateParam: null,
  affiliateValue: null,
  affiliateTemplate: null,
  allowedDomains: ["loja.example"],
  ...overrides,
});

const OFFER = "https://loja.example/jogo/vela?utm_source=tako";

test("loja sem afiliado devolve o endereço da oferta", () => {
  const result = buildAffiliateLink({ offerUrl: OFFER, config: config({ linkKind: "direct" }) });
  assert.deepEqual(result, { ok: true, url: OFFER });
});

test("parâmetro é acrescentado preservando a query existente", () => {
  const result = buildAffiliateLink({
    offerUrl: OFFER,
    config: config({ affiliateParam: "tag", affiliateValue: "tako-20" }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const url = new URL(result.url);
  assert.equal(url.searchParams.get("tag"), "tako-20");
  assert.equal(url.searchParams.get("utm_source"), "tako");
  assert.equal(url.hostname, "loja.example");
});

test("parâmetro repetido é substituído, não duplicado", () => {
  const result = buildAffiliateLink({
    offerUrl: "https://loja.example/jogo?tag=antigo",
    config: config({ affiliateParam: "tag", affiliateValue: "novo" }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(new URL(result.url).searchParams.getAll("tag").length, 1);
  assert.equal(new URL(result.url).searchParams.get("tag"), "novo");
});

test("molde recebe o endereço codificado", () => {
  const result = buildAffiliateLink({
    offerUrl: OFFER,
    config: config({
      affiliateTemplate: "https://loja.example/afiliado?url={url}",
      allowedDomains: ["loja.example"],
    }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.url,
    `https://loja.example/afiliado?url=${encodeURIComponent(OFFER)}`,
  );
});

test("molde sem {url} é recusado", () => {
  const result = buildAffiliateLink({
    offerUrl: OFFER,
    config: config({ affiliateTemplate: "https://loja.example/afiliado" }),
  });
  assert.equal(result.ok, false);
});

test("link de afiliado fora do domínio permitido não sai", () => {
  const result = buildAffiliateLink({
    offerUrl: OFFER,
    config: config({ affiliateTemplate: "https://outra-rede.example/afiliado?url={url}" }),
  });
  assert.equal(result.ok, false);
});

test("parâmetro inválido não vira link", () => {
  const result = buildAffiliateLink({
    offerUrl: OFFER,
    config: config({ affiliateParam: "tag com espaço", affiliateValue: "x" }),
  });
  assert.equal(result.ok, false);
  assert.equal(isAffiliateParam("tag"), true);
  assert.equal(isAffiliateParam("tag com espaço"), false);
});

test("modo do link é explicado para o painel", () => {
  assert.equal(affiliateMode(config({ linkKind: "direct" })), "none");
  assert.equal(affiliateMode(config()), "none");
  assert.equal(affiliateMode(config({ affiliateParam: "tag", affiliateValue: "x" })), "param");
  assert.equal(affiliateMode(config({ affiliateTemplate: "https://loja.example/a?url={url}" })), "template");
});

test("slug vem do título, sem acento e com hífen", () => {
  assert.equal(slugify("As Crônicas de Vela"), "as-cronicas-de-vela");
  assert.equal(slugify("  Café das 4!  "), "cafe-das-4");
  assert.equal(slugify("Ação / Aventura — Parte 2"), "acao-aventura-parte-2");
  assert.equal(slugify("..."), "");
});

test("domínio do molde é extraído para a conferência", () => {
  assert.equal(templateDomain("https://loja.example/afiliado?url={url}"), "loja.example");
  assert.equal(templateDomain("https://loja.example/afiliado"), null);
  assert.equal(templateDomain("não é url"), null);
});
