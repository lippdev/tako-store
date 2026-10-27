// Endereço de feed (PRD §17.4): https público, sem usuário na URL, sem IP de rede interna.
// Um feed que aponta para 127.0.0.1, 169.254.169.254 ou um nome que resolve para isso não é coletado.

import { lookup } from "node:dns/promises";

/** Teto de saltos ao seguir redirecionamento, cada um conferido de novo. */
export const FEED_MAX_REDIRECTS = 3;

function isIpv4(address: string): boolean {
  const parts = address.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/** IP de loopback, rede privada, link-local ou não especificado. IPv4 mapeado em IPv6 conta também. */
export function isPrivateAddress(address: string): boolean {
  const raw = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ip = mapped?.[1] ?? raw;
  if (ip === "::1" || ip === "::" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (!isIpv4(ip)) return false;
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function integerToIpv4(value: string): string | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > 0xffffffff) return null;
  return [(number >>> 24) & 255, (number >>> 16) & 255, (number >>> 8) & 255, number & 255].join(".");
}

/**
 * Problema da URL em si, antes de resolver DNS. `null` quando a forma é aceitável.
 * Host só de dígitos é tratado como IPv4 inteiro: `2130706433` é `127.0.0.1`.
 */
export function feedUrlProblem(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "endereço do feed inválido";
  }
  if (parsed.protocol !== "https:") return "o feed precisa ser https";
  if (parsed.username !== "" || parsed.password !== "") return "o feed não pode trazer usuário ou senha na URL";
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "metadata"
  ) {
    return "o feed não pode apontar para a rede local";
  }
  const asInteger = integerToIpv4(host);
  if (asInteger !== null) {
    return isPrivateAddress(asInteger) ? "o feed não pode apontar para a rede local" : "endereço do feed inválido";
  }
  if (isPrivateAddress(host)) return "o feed não pode apontar para a rede local";
  return null;
}

/** Problema dos endereços resolvidos. Lista vazia é falha: sem IP confirmado, não busca. */
export function feedAddressesProblem(addresses: readonly string[]): string | null {
  if (addresses.length === 0) return "não foi possível resolver o endereço do feed";
  if (addresses.some((address) => isPrivateAddress(address))) return "o feed não pode apontar para a rede local";
  return null;
}

async function defaultResolve(hostname: string): Promise<readonly string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

let resolveHost: (hostname: string) => Promise<readonly string[]> = defaultResolve;

/** Só para teste: troca a resolução de DNS. `null` volta ao padrão. */
export function setFeedHostResolver(
  resolver: ((hostname: string) => Promise<readonly string[]>) | null,
): void {
  resolveHost = resolver ?? defaultResolve;
}

function isIpLiteral(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host.includes(":") || isIpv4(host);
}

/** Recusa URL que não seja https público. Resolve o nome e confere cada endereço. */
export async function assertPublicFeedUrl(url: string): Promise<void> {
  const problem = feedUrlProblem(url);
  if (problem !== null) throw new Error(problem);
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (isIpLiteral(host)) return;
  let addresses: readonly string[];
  try {
    addresses = await resolveHost(host);
  } catch {
    throw new Error("não foi possível resolver o endereço do feed");
  }
  const addressProblem = feedAddressesProblem(addresses);
  if (addressProblem !== null) throw new Error(addressProblem);
}
