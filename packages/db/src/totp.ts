// Segundo fator TOTP (RFC 6238) para administradores (PRD §12.1). Sem dependência externa: HMAC-SHA1 do Node.
//
// O código é de 6 dígitos, janela de 30 segundos, e a verificação aceita um passo para cada lado (relógio fora de
// sincronia por até 30 s).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD_SECONDS = 30;

/** Base32 sem preenchimento, como o aplicativo autenticador espera. */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("segredo TOTP inválido");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Segredo novo: 20 bytes aleatórios em base32 (160 bits, o tamanho recomendado pelo RFC 4226). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Código do passo de tempo informado (em segundos). */
export function totpCode(secret: string, atSeconds: number): string {
  const counter = Math.floor(atSeconds / PERIOD_SECONDS);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Confere o código dentro de uma janela de ±1 passo. Recusa formato diferente de 6 dígitos antes de calcular — e a
 * comparação é em tempo constante.
 */
export function verifyTotp(secret: string, code: string, options: { now?: Date; window?: number } = {}): boolean {
  const candidate = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const window = options.window ?? 1;
  let valid = false;
  for (let step = -window; step <= window; step += 1) {
    const expected = Buffer.from(totpCode(secret, now + step * PERIOD_SECONDS));
    const received = Buffer.from(candidate);
    if (expected.length === received.length && timingSafeEqual(expected, received)) valid = true;
  }
  return valid;
}

/** URI para o aplicativo autenticador (formato `otpauth://totp/...`). */
export function otpauthUrl(input: { secret: string; account: string; issuer?: string }): string {
  const issuer = input.issuer ?? "Tako Store";
  const label = encodeURIComponent(`${issuer}:${input.account}`);
  const params = new URLSearchParams({ secret: input.secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(PERIOD_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
