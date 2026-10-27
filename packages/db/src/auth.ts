// Autenticação do painel (CAT-002, CAT-003): senha com scrypt, sessão por token opaco e papel verificado no
// servidor. O token só existe em claro no cookie do navegador; o banco guarda o hash.

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query, queryOne } from "./pool";

const scrypt = promisify(scryptCallback);

export const ROLES = ["admin", "catalog", "content", "integrations", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** O que cada papel pode fazer. A checagem acontece no servidor, antes de cada operação. */
export const PERMISSIONS = {
  "games:write": ["admin", "catalog"],
  "products:write": ["admin", "catalog"],
  "mappings:write": ["admin", "catalog"],
  "stores:write": ["admin", "integrations"],
  "sources:write": ["admin", "integrations"],
  "home:write": ["admin", "content"],
  "users:write": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  password_hash: string;
}

const SESSION_HOURS = 12;

/** `scrypt` com sal aleatório; o formato guarda algoritmo, sal e hash para permitir troca futura. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || salt === undefined || hash === undefined) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
}): Promise<AdminUser> {
  const passwordHash = await hashPassword(input.password);
  const row = await queryOne<AdminRow>(
    `insert into admin_users (email, name, password_hash, role) values ($1, $2, $3, $4)
     on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash, role = excluded.role
     returning id, email, name, role, active, password_hash`,
    [input.email.toLowerCase(), input.name, passwordHash, input.role],
  );
  if (row === null) throw new Error("usuário administrativo não foi gravado");
  return toUser(row);
}

function toUser(row: AdminRow): AdminUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role, active: row.active };
}

/** Confere e-mail e senha. Devolve `null` em qualquer falha, sem dizer qual campo errou. */
export async function authenticate(email: string, password: string): Promise<AdminUser | null> {
  const row = await queryOne<AdminRow>(
    "select id, email, name, role, active, password_hash from admin_users where email = $1 and active",
    [email.toLowerCase()],
  );
  if (row === null) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  await query("update admin_users set last_login_at = now() where id = $1", [row.id]);
  return toUser(row);
}

/** Cria a sessão e devolve o token em claro, que vai para o cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await query("insert into admin_sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

/** Usuário da sessão, ou `null` se o token não existe, venceu ou foi revogado. */
export async function sessionUser(token: string): Promise<AdminUser | null> {
  if (token === "") return null;
  const row = await queryOne<AdminRow>(
    `select u.id, u.email, u.name, u.role, u.active, u.password_hash
     from admin_sessions s join admin_users u on u.id = s.user_id
     where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and u.active`,
    [hashToken(token)],
  );
  return row === null ? null : toUser(row);
}

export async function revokeSession(token: string): Promise<void> {
  await query("update admin_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [
    hashToken(token),
  ]);
}

/** Auditoria de ação administrativa (PRD §12.1). */
export async function writeAudit(input: {
  actor: AdminUser | null;
  action: string;
  entity: string;
  entityId: string | null;
  detail?: unknown;
}): Promise<void> {
  await query(
    `insert into audit_events (actor_id, actor_email, action, entity, entity_id, detail)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      input.actor?.id ?? null,
      input.actor?.email ?? "sistema",
      input.action,
      input.entity,
      input.entityId,
      input.detail === undefined ? null : JSON.stringify(input.detail),
    ],
  );
}

export async function listAudit(limit = 50): Promise<
  { id: string; actorEmail: string; action: string; entity: string; entityId: string | null; createdAt: string }[]
> {
  return query(
    `select id::text, actor_email as "actorEmail", action, entity, entity_id as "entityId", created_at as "createdAt"
     from audit_events order by created_at desc limit $1`,
    [limit],
  );
}
