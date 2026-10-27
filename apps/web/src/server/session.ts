import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  authenticate,
  can,
  clearMfaPending,
  createMfaPending,
  createSession,
  findMfaPending,
  revokeSession,
  sessionUser,
  verifyUserTotp,
  type AdminUser,
  type Permission,
} from "@tako/db";

export const SESSION_COOKIE = "tako_admin";
export const MFA_COOKIE = "tako_admin_mfa";

export type SignInResult = "ok" | "invalid" | "mfa";

/** Usuário da requisição, ou `null`. Uma leitura por requisição. */
export const currentUser = cache(async (): Promise<AdminUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token === undefined) return null;
  return sessionUser(token);
});

/** Exige sessão; sem ela, manda para o login guardando o destino. */
export async function requireUser(returnTo = "/admin"): Promise<AdminUser> {
  const user = await currentUser();
  if (user === null) redirect(`/admin/entrar?destino=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Exige permissão verificada no servidor (PRD §12.1). */
export async function requirePermission(permission: Permission): Promise<AdminUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/admin?erro=permissao");
  return user;
}

/**
 * Login em duas etapas (PRD §12.1): senha primeiro; se a conta tem segundo fator, o servidor guarda um pedido de
 * código e só abre a sessão depois do TOTP certo.
 */
export async function signIn(email: string, password: string, code = ""): Promise<SignInResult> {
  const user = await authenticate(email, password);
  if (user === null) return "invalid";
  const jar = await cookies();

  if (!user.mfaEnabled) {
    await openSession(user.id);
    return "ok";
  }

  const pending = jar.get(MFA_COOKIE)?.value;
  if (pending === undefined) {
    const token = await createMfaPending(user.id);
    jar.set(MFA_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/admin",
      maxAge: 300,
      secure: process.env.NODE_ENV === "production",
    });
    return "mfa";
  }

  const waiting = await findMfaPending(pending);
  if (waiting === null || waiting.userId !== user.id) {
    jar.delete(MFA_COOKIE);
    return "mfa";
  }
  if (code.trim() === "") return "mfa";
  if (!(await verifyUserTotp(user.id, code.trim()))) return "invalid";

  await clearMfaPending(pending);
  jar.delete(MFA_COOKIE);
  await openSession(user.id);
  return "ok";
}

/**
 * Segunda etapa do login: usa o pedido guardado no cookie e confere só o código. A senha não é pedida de novo nem
 * fica guardada em lugar nenhum.
 */
export async function completeMfaSignIn(code: string): Promise<"ok" | "invalid" | "expired"> {
  const jar = await cookies();
  const pending = jar.get(MFA_COOKIE)?.value;
  if (pending === undefined) return "expired";
  const waiting = await findMfaPending(pending);
  if (waiting === null) {
    jar.delete(MFA_COOKIE);
    return "expired";
  }
  if (!(await verifyUserTotp(waiting.userId, code.trim()))) return "invalid";
  await clearMfaPending(pending);
  jar.delete(MFA_COOKIE);
  await openSession(waiting.userId);
  return "ok";
}

async function openSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token !== undefined) await revokeSession(token);
  jar.delete(SESSION_COOKIE);
}
