#!/usr/bin/env node
// Sincroniza os skills do lippstack usados por este repositório: copia `SKILL.md` (e os arquivos que andam com
// ele) para `.claude/skills/<nome>/`. Rode depois de mudar `VENDORED` ou quando quiser a versão nova do upstream:
//
//   node scripts/sync-skills.mjs                  # último main
//   node scripts/sync-skills.mjs --ref 9024e71    # um commit ou tag
//
// O script clona raso num diretório temporário, copia e some. Não mexe em mais nada do repositório.

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, ".claude", "skills");
const REPO = "https://github.com/lippdev/lippstack.git";

/** Skill → pasta de origem no lippstack. Só entra aqui o que este repositório realmente usa (ver ORIGEM.md). */
const VENDORED = {
  investigate: "plugins/eng-skills/skills/investigate",
  qa: "plugins/eng-skills/skills/qa",
  ship: "plugins/eng-skills/skills/ship",
  "apple-design": "plugins/design-skills/skills/apple-design",
  "animation-performance": "plugins/design-skills/skills/animation-performance",
  "break-ui": "plugins/design-skills/skills/break-ui",
  prototype: "plugins/design-skills/skills/prototype",
  "review-animations": "plugins/design-skills/skills/review-animations",
};

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Arquivos de um diretório, recursivo, com caminho relativo. */
function walk(dir, prefix = "") {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, join(prefix, name)) : [join(prefix, name)];
  });
}

/** `name` e `description` do frontmatter, que é o que a especificação Agent Skills exige. */
function frontmatter(file) {
  const text = readFileSync(file, "utf8");
  const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (key) => block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.replace(/^["']|["']$/g, "");
  return { name: field("name"), description: field("description") };
}

const refIndex = process.argv.indexOf("--ref");
const ref = refIndex === -1 ? "main" : process.argv[refIndex + 1];
if (!ref) {
  console.error("--ref precisa de um valor (commit, tag ou branch).");
  process.exit(1);
}

const temp = mkdtempSync(join(tmpdir(), "lippstack-"));
try {
  git(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", REPO, temp], root);
  git(["fetch", "--depth", "1", "origin", ref], temp);
  git(["checkout", "--detach", "FETCH_HEAD"], temp);
  const sha = git(["rev-parse", "HEAD"], temp);

  const changed = [];
  for (const [name, source] of Object.entries(VENDORED)) {
    const from = join(temp, source);
    const skill = join(from, "SKILL.md");
    let meta;
    try {
      meta = frontmatter(skill);
    } catch {
      throw new Error(`lippstack não tem mais ${source}/SKILL.md — confira VENDORED e ORIGEM.md.`);
    }
    if (meta.name !== name) throw new Error(`${source}/SKILL.md declara name "${meta.name}", esperado "${name}".`);
    if (!meta.description) throw new Error(`${source}/SKILL.md está sem description.`);

    const target = join(skillsDir, name);
    const before = new Map(walk(target, "").map((f) => [f, readFileSync(join(target, f), "utf8")]));
    rmSync(target, { recursive: true, force: true });
    cpSync(from, target, { recursive: true });
    for (const file of walk(target, "")) {
      const after = readFileSync(join(target, file), "utf8");
      if (before.get(file) !== after) changed.push(`${name}/${file}`);
      before.delete(file);
    }
    for (const file of before.keys()) changed.push(`${name}/${file} (removido)`);
  }

  const origin = join(root, ".claude", "skills", "ORIGEM.md");
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  const text = readFileSync(origin, "utf8");
  writeFileSync(
    origin,
    text
      .replace(/commit \[`\w+`\]\([^)]*\)/, `commit [\`${sha.slice(0, 7)}\`](https://github.com/lippdev/lippstack/commit/${sha})`)
      .replace(/em \d{2}\/\d{2}\/\d{4}\./, `em ${date}.`),
  );

  console.log(`lippstack ${sha.slice(0, 7)} → .claude/skills (${Object.keys(VENDORED).length} skills)`);
  console.log(changed.length === 0 ? "Nada mudou." : changed.map((f) => `  ${f}`).join("\n"));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
