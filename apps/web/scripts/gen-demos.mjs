// Gera o registro das demos da galeria: o Next não tem `import.meta.glob`, então cada componente com
// `<Nome>.demo.tsx` vira uma linha explícita aqui. Rode `npm run gen:demos` (ou `npm run sync:design`, que chama
// este script) depois de criar ou remover uma demo.

import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const components = join(web, "src", "components");
const target = join(web, "src", "dev", "demos.generated.ts");

const names = readdirSync(components)
  .filter((name) => {
    try {
      return readdirSync(join(components, name)).includes(`${name}.demo.tsx`);
    } catch {
      return false;
    }
  })
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

const lines = names.map(
  (name) => `  () => import("../components/${name}/${name}.demo"),`,
);

writeFileSync(
  target,
  `// Gerado por scripts/gen-demos.mjs a partir de src/components/*/*.demo.tsx. Não edite à mão.

/** Demos da galeria, carregadas sob demanda pela rota \`/dev/componentes\`. */
export const demoModules = [
${lines.join("\n")}
] as const;
`,
);

console.log(`${String(names.length)} demos → src/dev/demos.generated.ts`);
