#!/usr/bin/env node
// Traz o design system do Tako Launcher para `design/desktop/`. A fonte é o launcher: aqui é só leitura.
//
//   node scripts/sync-design-system.mjs                  # último main
//   node scripts/sync-design-system.mjs --ref 615e48e    # um commit ou tag
//
// Copia as regras (README), os tokens, os assets, as fontes e a especificação de cada componente. As prévias
// (`preview.html`) e o bundle delas ficam no launcher: fora de lá abrem sem estilo (ver design/desktop/ORIGEM.md).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "design", "desktop");
const REPO = "https://github.com/lippdev/tako-launcher.git";
const SOURCE = "design/desktop";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const refIndex = process.argv.indexOf("--ref");
const ref = refIndex === -1 ? "main" : process.argv[refIndex + 1];
if (!ref) {
  console.error("--ref precisa de um valor (commit, tag ou branch).");
  process.exit(1);
}

const temp = mkdtempSync(join(tmpdir(), "tako-launcher-"));
try {
  git(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", REPO, temp], root);
  git(["fetch", "--depth", "1", "origin", ref], temp);
  git(["checkout", "--detach", "FETCH_HEAD"], temp);
  const sha = git(["rev-parse", "HEAD"], temp);

  const from = join(temp, SOURCE);
  for (const file of ["README.md", "tokens.css", "tokens.json", "design-system.json"]) {
    if (!existsSync(join(from, file))) throw new Error(`o launcher não tem ${SOURCE}/${file} neste commit.`);
    cpSync(join(from, file), join(target, file));
  }
  cpSync(join(from, "assets"), join(target, "assets"), { recursive: true });
  cpSync(join(from, "fonts"), join(target, "fonts"), { recursive: true });

  // Só a especificação de cada componente: as prévias e o bundle ficam no launcher.
  const specs = execFileSync("git", ["ls-tree", "-d", "--name-only", "HEAD", `${SOURCE}/components/`], {
    cwd: temp,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  rmSync(join(target, "components"), { recursive: true, force: true });
  for (const path of specs) {
    const name = path.slice(`${SOURCE}/components/`.length).replace(/\/$/, "");
    const spec = join(temp, path, "README.md");
    if (!existsSync(spec)) continue;
    cpSync(spec, join(target, "components", name, "README.md"), { recursive: true });
  }

  const origin = join(target, "ORIGEM.md");
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  writeFileSync(
    origin,
    readFileSync(origin, "utf8")
      .replace(
        /commit \[`\w+`\]\([^)]*\)/,
        `commit [\`${sha.slice(0, 7)}\`](https://github.com/lippdev/tako-launcher/commit/${sha})`,
      )
      .replace(/em \d{2}\/\d{2}\/\d{4}\.$/m, `em ${date}.`),
  );

  console.log(`tako-launcher ${sha.slice(0, 7)} → design/desktop (${specs.length} componentes)`);
  console.log("Agora: cd web && npm run sync:design");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
