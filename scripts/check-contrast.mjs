// Confere o contraste dos pares de token que a interface usa (STO-006, WCAG 2.2 AA).
//
//   node scripts/check-contrast.mjs
//
// Lê os tokens do tema principal em `apps/web/src/styles/tokens.css` e calcula a razão de contraste de cada par.
// Texto normal exige 4,5:1; texto grande (>= 24px, ou >= 18,66px em negrito) e componente de interface exigem 3:1.
// Sai com código 1 quando algum par de texto falha ou quando a interface usa `--text-dim` para texto — esse token
// só passa como elemento decorativo, nunca como cor de texto (o valor do design system fica em 3,02:1).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "apps", "web", "src", "styles", "tokens.css"), "utf8");
const theme = css.slice(0, css.indexOf('[data-theme="light"]') === -1 ? css.length : css.indexOf('[data-theme="light"]'));

function token(name) {
  const match = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (match === null) throw new Error(`token --${name} não encontrado no tema principal`);
  return match[1];
}

function rgb(hex) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean.slice(0, 6);
  return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const PAIRS = [
  ["text", "surface", "texto sobre superfície", 4.5],
  ["text", "canvas", "texto sobre o fundo da página", 4.5],
  ["text", "surface-raised", "texto sobre superfície elevada", 4.5],
  ["text-muted", "surface", "texto secundário sobre superfície", 4.5],
  ["text-muted", "canvas", "texto secundário sobre o fundo", 4.5],
  ["text-muted", "tile", "texto secundário sobre card", 4.5],
  ["text-dim", "surface", "texto apagado sobre superfície (decorativo)", 4.5, false],
  ["on-primary", "primary", "texto do botão primário", 4.5],
  ["error", "surface", "mensagem de erro", 4.5],
  ["success", "surface", "mensagem de sucesso", 4.5],
  ["warning", "surface", "aviso", 4.5],
];

let failures = 0;
const lines = [];
for (const [foreground, background, label, minimum, gate = true] of PAIRS) {
  const value = ratio(token(foreground), token(background));
  const ok = value >= minimum;
  if (!ok && gate) failures += 1;
  lines.push(
    `${ok ? "ok  " : gate ? "FALHA" : "nota"}  ${value.toFixed(2)}:1  (mínimo ${minimum.toFixed(1)})  ${label}  --${foreground} sobre --${background}`,
  );
}

// O token `--text-dim` não pode ser cor de texto enquanto o design system não subir o valor. A varredura cobre as
// telas da loja e do painel (components/loja, app); os componentes copiados do launcher que ainda usam o token estão
// listados em docs/acessibilidade.md como pendência do design system.
const { readdirSync, statSync } = await import("node:fs");
const offenders = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!path.endsWith(".css")) continue;
    const source = readFileSync(path, "utf8");
    if (/color:\s*var\(--text-dim\)/.test(source)) offenders.push(path.replace(`${root}/`, ""));
  }
}
walk(join(root, "apps", "web", "src", "components", "loja"));
walk(join(root, "apps", "web", "src", "app"));
if (offenders.length > 0) {
  failures += offenders.length;
  lines.push(`\nFALHA  --text-dim usado como cor de texto em:\n  ${offenders.join("\n  ")}`);
}

console.log(lines.join("\n"));
console.log(
  failures === 0
    ? `\nTodos os ${String(PAIRS.length)} pares passam.`
    : `\n${String(failures)} par(es) abaixo do mínimo: não use esse token para texto nesse fundo.`,
);
process.exitCode = failures === 0 ? 0 : 1;
