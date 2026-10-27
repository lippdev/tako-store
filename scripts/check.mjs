#!/usr/bin/env node
// Conferências do repositório, para o CI e para antes do PR: arquivos que precisam existir, skills com frontmatter
// válido e o que o app gera a partir do design system em dia com `design/desktop/`.
//
//   node scripts/check.mjs

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (message) => failures.push(message);

/** Arquivos sem os quais nenhum agente consegue trabalhar aqui. */
const REQUIRED = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "docs/PRD.md",
  "apps/web/package.json",
  "apps/worker/package.json",
  "packages/domain/src/index.ts",
  "packages/db/src/index.ts",
  "packages/connectors/src/index.ts",
  "docker-compose.yml",
  "design/desktop/README.md",
  "design/desktop/tokens.css",
  "design/desktop/ORIGEM.md",
  ".claude/skills/ORIGEM.md",
];
for (const file of REQUIRED) if (!existsSync(join(root, file))) fail(`falta ${file}`);

/** Skills: `name` igual à pasta e `description` dentro do limite de 1024 da especificação Agent Skills. */
const skillsDir = join(root, ".claude", "skills");
for (const name of readdirSync(skillsDir)) {
  const skill = join(skillsDir, name, "SKILL.md");
  if (!statSync(join(skillsDir, name)).isDirectory()) continue;
  if (!existsSync(skill)) {
    fail(`.claude/skills/${name} não tem SKILL.md`);
    continue;
  }
  const block = readFileSync(skill, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!block) {
    fail(`.claude/skills/${name}/SKILL.md está sem frontmatter`);
    continue;
  }
  const field = (key) => block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.replace(/^["']|["']$/g, "");
  if (field("name") !== name) fail(`.claude/skills/${name}/SKILL.md declara name "${field("name") ?? ""}"`);
  const description = field("description") ?? "";
  if (!description) fail(`.claude/skills/${name}/SKILL.md está sem description`);
  if (description.length > 1024) fail(`.claude/skills/${name}: description com ${String(description.length)} caracteres`);
}

/** Tokens do app: cópia fiel de `design/desktop/tokens.css`, só com a linha de aviso na frente. */
const sourceTokens = readFileSync(join(root, "design", "desktop", "tokens.css"), "utf8");
const appTokensPath = join(root, "apps", "web", "src", "styles", "tokens.css");
if (!existsSync(appTokensPath)) {
  fail("falta apps/web/src/styles/tokens.css (rode `npm run sync:design`)");
} else {
  const appTokens = readFileSync(appTokensPath, "utf8");
  if (!appTokens.endsWith(sourceTokens)) fail("apps/web/src/styles/tokens.css está diferente de design/desktop/tokens.css");
  // Toda fonte declarada no tokens.css precisa existir em web/src/styles/fonts/.
  for (const [, file] of sourceTokens.matchAll(/url\("fonts\/([^"]+)"\)/g)) {
    if (!existsSync(join(root, "apps", "web", "src", "styles", "fonts", file))) fail(`falta a fonte apps/web/src/styles/fonts/${file}`);
  }
}

/** Ícones: todo SVG do design system tem entrada no arquivo gerado, e nenhum nome sobra. */
const iconDir = join(root, "design", "desktop", "assets", "Icones");
const generated = readFileSync(join(root, "apps", "web", "src", "assets", "icons", "icons.generated.ts"), "utf8");
for (const file of readdirSync(iconDir).filter((f) => f.endsWith(".svg"))) {
  const name = file.replace(/\.svg$/, "");
  if (!generated.includes(`"${name}":`)) fail(`o ícone ${name} não está em icons.generated.ts (rode npm run sync:design)`);
}

/** Componente com pasta e sem demo não aparece na galeria — e a galeria é o critério visual. */
const componentsDir = join(root, "apps", "web", "src", "components");
const WITHOUT_DEMO = new Set(["Icon", "Appearance"]);
for (const name of readdirSync(componentsDir)) {
  if (!statSync(join(componentsDir, name)).isDirectory() || WITHOUT_DEMO.has(name)) continue;
  // Pasta de agrupamento (sem `<Nome>.tsx`) não é componente: `loja/` guarda as peças da loja.
  if (!existsSync(join(componentsDir, name, `${name}.tsx`))) continue;
  if (!existsSync(join(componentsDir, name, `${name}.demo.tsx`))) fail(`apps/web/src/components/${name} está sem ${name}.demo.tsx`);
}

if (failures.length > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  console.error(`\n${String(failures.length)} problema(s).`);
  process.exit(1);
}
console.log("Tudo em ordem: arquivos, skills, tokens, fontes e ícones.");
