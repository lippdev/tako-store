// Conexão com o PostgreSQL. Um pool por processo; no Next, o pool sobrevive ao hot reload porque fica no global.

import pg from "pg";

const DEFAULT_URL = "postgres://tako:tako@localhost:5432/tako_store";

export function databaseUrl(): string {
  return process.env["DATABASE_URL"] ?? DEFAULT_URL;
}

export function createPool(): pg.Pool {
  const pool = new pg.Pool({ connectionString: databaseUrl(), max: 10 });
  return pool;
}

const globalForPool = globalThis as typeof globalThis & { takoPool: pg.Pool | undefined };

export function getPool(): pg.Pool {
  globalForPool.takoPool ??= createPool();
  return globalForPool.takoPool;
}

/** Consulta com parâmetros; devolve as linhas tipadas por quem chama. */
export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

/** Uma linha só, ou `null`. */
export async function queryOne<T extends pg.QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Transação: ou tudo entra, ou nada entra. */
export async function withTransaction<T>(run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await globalForPool.takoPool?.end();
  globalForPool.takoPool = undefined;
}
