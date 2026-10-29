import test from "node:test";
import assert from "node:assert/strict";

import { decodeEntities, parseXml, xmlRecords } from "../src/xml";
import { collectFeed } from "../src/feed";
import { setFeedHostResolver } from "../src/public-url";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<ofertas>
  <!-- comentário que não pode virar campo -->
  <item>
    <sku>A1</sku>
    <nome><![CDATA[As Crônicas de Vela]]></nome>
    <plataforma>steam</plataforma>
    <preco_centavos>7990</preco_centavos>
    <link>https://loja.example/jogo/vela?a=1&amp;b=2</link>
    <loja>pixel-store</loja>
  </item>
  <item>
    <sku>A2</sku>
    <nome>&Oacute;rbita &amp; Cia</nome>
    <plataforma>steam</plataforma>
    <preco_centavos></preco_centavos>
    <link>https://loja.example/jogo/orbita</link>
    <loja>pixel-store</loja>
  </item>
</ofertas>`;

const MAP = { externalId: "sku", title: "nome", platform: "plataforma", priceCents: "preco_centavos", url: "link", storeSlug: "loja" };

test("lê registros do XML com CDATA e entidades", () => {
  const { element, records } = xmlRecords(XML);
  assert.equal(element, "item");
  assert.equal(records.length, 2);
  assert.equal(records[0]?.nome, "As Crônicas de Vela");
  assert.equal(records[0]?.link, "https://loja.example/jogo/vela?a=1&b=2");
});

test("entidades numéricas e nomeadas", () => {
  assert.equal(decodeEntities("caf&eacute; &amp; p&atilde;o"), "café & pão");
  assert.equal(decodeEntities("&#65;&#x42;"), "AB");
  assert.equal(decodeEntities("sem entidade"), "sem entidade");
});

test("árvore ignora declaração, comentário e doctype", () => {
  const root = parseXml("<?xml version='1.0'?><!DOCTYPE x><raiz><a>1</a></raiz>");
  assert.equal(root?.name, "raiz");
  assert.equal(root?.children[0]?.text, "1");
});

function withFetch(body: string, contentType = "application/xml") {
  const original = globalThis.fetch;
  setFeedHostResolver(async () => ["203.0.113.10"]);
  globalThis.fetch = (async () => new Response(body, { status: 200, headers: { "content-type": contentType } })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
    setFeedHostResolver(null);
  };
}

test("feed XML vira linha validada e erro por linha", async () => {
  const restore = withFetch(XML);
  try {
    const result = await collectFeed({ url: "https://feed.example/ofertas.xml", format: "auto", fieldMap: MAP });
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.title, "As Crônicas de Vela");
    assert.equal(result.rows[0]?.priceCents, 7990);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.code, "preco");
  } finally {
    restore();
  }
});

test("XML sem registros é recusado com mensagem clara", async () => {
  const restore = withFetch("<lista><vazio/></lista>");
  try {
    const result = await collectFeed({ url: "https://feed.example/vazio.xml", format: "xml", fieldMap: MAP });
    assert.equal(result.rows.length, 0);
    assert.equal(result.errors[0]?.code, "xml");
  } finally {
    restore();
  }
});
