// Retenção (PRD §17.4 e §17.5). O que é dado pessoal ou operacional de curto prazo sai no prazo.
// Observação de preço não entra aqui: o histórico da loja depende dela, e ela não tem dado de pessoa.

import { queryOne } from "./pool";

export const LOGIN_ATTEMPT_RETENTION_HOURS = 24;
export const CLICK_RETENTION_DAYS = 180;
export const RESOLVED_ERROR_RETENTION_DAYS = 90;
export const AUDIT_RETENTION_DAYS = 365;

export interface RetentionResult {
  loginAttempts: number;
  clicks: number;
  resolvedErrors: number;
  auditEvents: number;
}

async function removeCount(sql: string, params: readonly unknown[]): Promise<number> {
  const row = await queryOne<{ count: number }>(sql, params);
  return row?.count ?? 0;
}

/** Apaga o que passou do prazo. Devolve quantas linhas saíram, para o log do worker. */
export async function applyRetention(now = new Date()): Promise<RetentionResult> {
  const loginAttempts = await removeCount(
    `with removed as (
       delete from login_attempts
       where created_at < $1::timestamptz - make_interval(hours => $2::int)
       returning 1
     ) select count(*)::int as count from removed`,
    [now, LOGIN_ATTEMPT_RETENTION_HOURS],
  );
  const clicks = await removeCount(
    `with removed as (
       delete from offer_clicks
       where created_at < $1::timestamptz - make_interval(days => $2::int)
       returning 1
     ) select count(*)::int as count from removed`,
    [now, CLICK_RETENTION_DAYS],
  );
  const resolvedErrors = await removeCount(
    `with removed as (
       delete from ingestion_errors
       where resolved_at is not null
         and resolved_at < $1::timestamptz - make_interval(days => $2::int)
       returning 1
     ) select count(*)::int as count from removed`,
    [now, RESOLVED_ERROR_RETENTION_DAYS],
  );
  const auditEvents = await removeCount(
    `with removed as (
       delete from audit_events
       where created_at < $1::timestamptz - make_interval(days => $2::int)
       returning 1
     ) select count(*)::int as count from removed`,
    [now, AUDIT_RETENTION_DAYS],
  );
  return { loginAttempts, clicks, resolvedErrors, auditEvents };
}
