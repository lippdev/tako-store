// Autenticação do painel (CAT-002, CAT-003): senha com scrypt, sessão por token opaco e papel verificado no
// servidor. O token só existe em claro no cookie do navegador; o banco guarda o hash.

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query, queryOne } from "./pool";
import { verifyTotp } from "./totp";

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
  /** Segundo fator ativo: o login pede o código TOTP depois da senha. */
  mfaEnabled: boolean;
}

export interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  password_hash: string;
  mfa_enabled: boolean;
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
     returning id, email, name, role, active, password_hash, mfa_enabled`,
    [input.email.toLowerCase(), input.name, passwordHash, input.role],
  );
  if (row === null) throw new Error("usuário administrativo não foi gravado");
  return toUser(row);
}

function toUser(row: AdminRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    mfaEnabled: row.mfa_enabled,
  };
}

/** Confere e-mail e senha. Devolve `null` em qualquer falha, sem dizer qual campo errou. */
export async function authenticate(email: string, password: string): Promise<AdminUser | null> {
  const row = await queryOne<AdminRow>(
    "select id, email, name, role, active, password_hash, mfa_enabled from admin_users where email = $1 and active",
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
    `select u.id, u.email, u.name, u.role, u.active, u.password_hash, u.mfa_enabled
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

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  sessions: number;
}

/** Usuários do painel com sessões ativas — a tela de administração (PRD §12.1). */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  return query<AdminUserRow>(
    `select u.id, u.email, u.name, u.role, u.active, u.last_login_at as "lastLoginAt",
            (select count(*)::int from admin_sessions s
              where s.user_id = u.id and s.revoked_at is null and s.expires_at > now()) as sessions
     from admin_users u order by u.active desc, u.name`,
  );
}

export async function setAdminUserActive(id: string, active: boolean): Promise<void> {
  await query("update admin_users set active = $2 where id = $1", [id, active]);
  if (!active) await revokeUserSessions(id);
}

export async function setAdminUserRole(id: string, role: Role): Promise<void> {
  await query("update admin_users set role = $2 where id = $1", [id, role]);
}

/** Revoga todas as sessões do usuário: o próximo acesso pede senha de novo. */
export async function revokeUserSessions(userId: string): Promise<number> {
  const rows = await query<{ id: string }>(
    "update admin_sessions set revoked_at = now() where user_id = $1 and revoked_at is null returning id",
    [userId],
  );
  return rows.length;
}

export async function countAdminUsers(): Promise<number> {
  const row = await queryOne<{ total: number }>("select count(*)::int as total from admin_users where active");
  return row?.total ?? 0;
}

export interface AuditRecord {
  id: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: unknown;
  createdAt: string;
}

export async function listAudit(limit = 50): Promise<AuditRecord[]> {
  const rows = await query<Omit<AuditRecord, "createdAt"> & { createdAt: Date }>(
    `select id::text, actor_email as "actorEmail", action, entity, entity_id as "entityId", detail,
            created_at as "createdAt"
     from audit_events order by created_at desc limit $1`,
    [limit],
  );
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

// ——— Segundo fator (PRD §12.1) ———

export interface MfaState {
  enabled: boolean;
  /** Segredo em inscrição (ainda não confirmado) ou já ativo. Nunca sai do servidor para a tela. */
  secret: string | null;
}

export async function mfaState(userId: string): Promise<MfaState | null> {
  const row = await queryOne<{ mfa_enabled: boolean; mfa_secret: string | null }>(
    "select mfa_enabled, mfa_secret from admin_users where id = $1",
    [userId],
  );
  return row === null ? null : { enabled: row.mfa_enabled, secret: row.mfa_secret };
}

/** Guarda o segredo em inscrição; só `enableMfa` liga o segundo fator. */
export async function storeMfaSecret(userId: string, secret: string): Promise<void> {
  await query("update admin_users set mfa_secret = $2, mfa_enabled = false where id = $1", [userId, secret]);
}

export async function enableMfa(userId: string): Promise<void> {
  await query("update admin_users set mfa_enabled = true where id = $1 and mfa_secret is not null", [userId]);
}

export async function disableMfa(userId: string): Promise<void> {
  await query("update admin_users set mfa_enabled = false, mfa_secret = null where id = $1", [userId]);
}

/** Pedido de código: token em claro vai para o cookie, hash fica no banco por 5 minutos. */
export async function createMfaPending(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await query(
    `insert into admin_mfa_pending (token_hash, user_id, expires_at) values ($1, $2, now() + interval '5 minutes')`,
    [hashToken(token), userId],
  );
  return token;
}

export async function consumeMfaPending(token: string): Promise<{ userId: string; email: string } | null> {
  const row = await queryOne<{ userId: string; email: string }>(
    `update admin_mfa_pending p set expires_at = now()
     from admin_users u
     where p.token_hash = $1 and p.user_id = u.id and p.expires_at > now()
     returning p.user_id as "userId", u.email as email`,
    [hashToken(token)],
  );
  return row;
}

export async function findMfaPending(token: string): Promise<{ userId: string; email: string } | null> {
  return queryOne(
    `select p.user_id as "userId", u.email as email
     from admin_mfa_pending p join admin_users u on u.id = p.user_id
     where p.token_hash = $1 and p.expires_at > now()`,
    [hashToken(token)],
  );
}

export async function clearMfaPending(token: string): Promise<void> {
  await query("delete from admin_mfa_pending where token_hash = $1", [hashToken(token)]);
}

/** Confere o código TOTP do usuário; devolve `false` quando não há segundo fator ativo. */
export async function verifyUserTotp(userId: string, code: string): Promise<boolean> {
  const row = await queryOne<{ mfa_secret: string | null; mfa_enabled: boolean }>(
    "select mfa_secret, mfa_enabled from admin_users where id = $1 and active",
    [userId],
  );
  if (row === null || !row.mfa_enabled || row.mfa_secret === null) return false;
  return verifyTotp(row.mfa_secret, code);
}

// ——— Limite de tentativas (PRD §12.1) ———

export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 5;

/** Registra a tentativa; sucesso limpa o histórico daquele e-mail. */
export async function recordLoginAttempt(input: { email: string; ip: string | null; succeeded: boolean }): Promise<void> {
  const email = input.email.trim().toLowerCase();
  await query("insert into login_attempts (email, ip, succeeded) values ($1, $2, $3)", [email, input.ip, input.succeeded]);
  if (input.succeeded) {
    await query("delete from login_attempts where lower(email) = $1 and not succeeded", [email]);
  }
  await query("delete from login_attempts where created_at < now() - interval '24 hours'");
}

/**
 * A conta (ou o endereço) está bloqueada por excesso de falhas na janela? Devolve quantas falhas houve e quantos
 * minutos faltam para liberar.
 */
export async function loginThrottle(input: {
  email: string;
  ip: string | null;
  now?: Date;
}): Promise<{ blocked: boolean; failures: number; retryAfterMinutes: number }> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60_000);
  const row = await queryOne<{ failures: number; oldest: Date | null }>(
    `select count(*)::int as failures, min(created_at) as oldest
     from login_attempts
     where created_at >= $1 and not succeeded and (lower(email) = $2 or ($3::text is not null and ip = $3::text))`,
    [since, input.email.trim().toLowerCase(), input.ip],
  );
  const failures = row?.failures ?? 0;
  const blocked = failures >= LOGIN_MAX_FAILURES;
  const oldest = row?.oldest ?? null;
  const retryAfterMinutes =
    blocked && oldest !== null
      ? Math.max(1, Math.ceil((oldest.getTime() + LOGIN_WINDOW_MINUTES * 60_000 - now.getTime()) / 60_000))
      : 0;
  return { blocked, failures, retryAfterMinutes };
}
