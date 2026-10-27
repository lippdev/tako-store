import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  authenticate,
  can,
  createSession,
  revokeSession,
  sessionUser,
  type AdminUser,
  type Permission,
} from "@tako/db";

export const SESSION_COOKIE = "tako_admin";

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

export async function signIn(email: string, password: string): Promise<boolean> {
  const user = await authenticate(email, password);
  if (user === null) return false;
  const { token, expiresAt } = await createSession(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
  return true;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token !== undefined) await revokeSession(token);
  jar.delete(SESSION_COOKIE);
}
