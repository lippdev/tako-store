// Verificação de saúde para monitor externo (OPS-001): sai com código 1 quando a operação está degradada.
//
//   node scripts/healthcheck.mjs [--url http://localhost:5174]

const index = process.argv.indexOf("--url");
const base = index === -1 ? process.env.TAKO_HEALTH_URL ?? "http://localhost:5174" : process.argv[index + 1];

try {
  const response = await fetch(new URL("/api/health", base), { headers: { accept: "application/json" } });
  const body = await response.json();
  console.log(JSON.stringify({ httpStatus: response.status, ...body }, null, 2));
  process.exitCode = response.ok ? 0 : 1;
} catch (error) {
  console.error(`Falha ao consultar ${base}/api/health: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
