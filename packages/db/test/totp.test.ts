import test from "node:test";
import assert from "node:assert/strict";

import { base32Decode, base32Encode, generateTotpSecret, otpauthUrl, totpCode, verifyTotp } from "../src/totp";

// Vetor do RFC 6238 (SHA-1, 8 dígitos) reduzido a 6: o segredo é "12345678901234567890".
const SECRET = base32Encode(Buffer.from("12345678901234567890", "utf8"));

test("base32 vai e volta", () => {
  assert.deepEqual(base32Decode(SECRET).toString("utf8"), "12345678901234567890");
});

test("código confere com o vetor do RFC 6238", () => {
  assert.equal(totpCode(SECRET, 59), "287082");
  assert.equal(totpCode(SECRET, 1_111_111_109), "081804");
});

test("aceita o código do passo atual e o anterior, recusa o distante", () => {
  const now = new Date(59_000);
  assert.equal(verifyTotp(SECRET, totpCode(SECRET, 59), { now }), true);
  assert.equal(verifyTotp(SECRET, totpCode(SECRET, 29), { now }), true);
  assert.equal(verifyTotp(SECRET, totpCode(SECRET, 89), { now }), true);
  assert.equal(verifyTotp(SECRET, totpCode(SECRET, 200), { now }), false);
});

test("recusa formato errado sem quebrar", () => {
  assert.equal(verifyTotp(SECRET, "12345", { now: new Date(59_000) }), false);
  assert.equal(verifyTotp(SECRET, "abcdef", { now: new Date(59_000) }), false);
  assert.equal(verifyTotp(SECRET, "", { now: new Date(59_000) }), false);
});

test("segredo gerado é base32 de 160 bits", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(base32Decode(secret).length, 20);
});

test("URI do autenticador carrega emissor, conta e parâmetros", () => {
  const url = otpauthUrl({ secret: SECRET, account: "admin@tako.dev" });
  assert.match(url, /^otpauth:\/\/totp\/Tako%20Store%3Aadmin%40tako\.dev\?/);
  assert.match(url, /period=30/);
  assert.match(url, /digits=6/);
});
