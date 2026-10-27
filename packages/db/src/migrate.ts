// Migrações numeradas, aplicadas em ordem e registradas em `schema_migrations`. Sem ORM: o SQL é o documento.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./pool";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export function migrationFiles(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), "utf8") }));
}

export async function migrate(): Promise<string[]> {
  const pool = getPool();
  await pool.query(`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  const { rows } = await pool.query<{ name: string }>("select name from schema_migrations");
  const applied = new Set(rows.map((row) => row.name));

  const done: string[] = [];
  for (const migration of migrationFiles()) {
    if (applied.has(migration.name)) continue;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(migration.sql);
      await client.query("insert into schema_migrations (name) values ($1)", [migration.name]);
      await client.query("commit");
      done.push(migration.name);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`migração ${migration.name} falhou: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }
  return done;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate()
    .then((done) => {
      console.log(done.length === 0 ? "Banco já está na última migração." : `Aplicadas: ${done.join(", ")}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
