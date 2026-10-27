// Recria o banco do zero: apaga o schema público, migra e roda o seed. Só faz sentido em desenvolvimento.
//
//   npm run db:reset

import { closePool, getPool } from "./pool";
import { migrate } from "./migrate";

async function main(): Promise<void> {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("db:reset não roda em produção.");
  }
  await getPool().query("drop schema public cascade; create schema public;");
  await migrate();
  console.log("Schema recriado. Agora: npm run db:seed");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
