// Gera as capas de demonstração do catálogo: nenhuma arte real, nenhuma dependência externa. Cada capa é um SVG
// com gradiente próprio e o título, servido de `apps/web/public/covers/`.
//
//   node scripts/gen-demo-covers.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps", "web", "public", "covers");
mkdirSync(out, { recursive: true });

const GAMES = [
  ["as-cronicas-de-vela", "As Crônicas de Vela", ["#2a1d4f", "#7a4fa3", "#f0c987"]],
  ["estacao-orbita", "Estação Órbita", ["#0d1b2a", "#1b4965", "#bee9e8"]],
  ["fenda", "Fenda", ["#1a1a2e", "#16213e", "#e94560"]],
  ["rota-9", "Rota 9", ["#3d0f0f", "#8a2b06", "#ffb703"]],
  ["jardim-de-vidro", "Jardim de Vidro", ["#12332b", "#2d6a4f", "#b7e4c7"]],
  ["o-ultimo-farol", "O Último Farol", ["#101820", "#2c3a47", "#f4d35e"]],
  ["furia-de-aco", "Fúria de Aço", ["#1b1b1b", "#5c2018", "#e0a458"]],
  ["cafe-das-4", "Café das 4", ["#3b2416", "#6f4e37", "#f2e8dc"]],
  ["vento-sul", "Vento Sul", ["#0b3d2e", "#3a7d44", "#f6f7d7"]],
  ["neblina", "Neblina", ["#1f2421", "#4a5759", "#dedbd2"]],
  ["maquina-de-chuva", "Máquina de Chuva", ["#14213d", "#37538a", "#8ecae6"]],
  ["ceu-partido", "Céu Partido", ["#2b2d42", "#6d597a", "#ffcad4"]],
];

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

for (const [slug, title, [from, to, ink]] of GAMES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" role="img" aria-label="${escape(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.75" cy="0.2" r="0.6">
      <stop offset="0" stop-color="${ink}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${ink}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="800" fill="url(#g)"/>
  <circle cx="450" cy="160" r="320" fill="url(#glow)"/>
  <g fill="none" stroke="${ink}" stroke-opacity="0.28" stroke-width="2">
    <path d="M-40 620 C 140 520, 260 700, 420 580 S 640 470, 700 540"/>
    <path d="M-40 690 C 150 600, 300 760, 470 650 S 660 560, 720 620"/>
  </g>
  <text x="48" y="700" fill="${ink}" font-family="Poppins, system-ui, sans-serif" font-size="52" font-weight="800" letter-spacing="-1">${escape(title)}</text>
  <text x="48" y="740" fill="${ink}" fill-opacity="0.7" font-family="system-ui, sans-serif" font-size="20" letter-spacing="4">DEMONSTRAÇÃO</text>
</svg>
`;
  writeFileSync(join(out, `${slug}.svg`), svg);
}

console.log(`${String(GAMES.length)} capas → apps/web/public/covers/`);
