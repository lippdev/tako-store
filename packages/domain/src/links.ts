// Redirecionamento para a loja: o usuário nunca informa a URL (PRD §11.5). A URL vem de uma oferta conhecida e o
// destino precisa ser um domínio que a loja cadastrou.

export interface RedirectTarget {
  url: string;
  storeAllowedDomains: readonly string[];
}

/** Host de `url`, ou `null` quando nem é uma URL válida. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Regras do destino:
 * - só `https`;
 * - sem usuário nem senha na URL (nada de `https://tako@loja.com`);
 * - o host precisa ser o domínio permitido ou um subdomínio dele, nunca um prefixo textual
 *   (`loja.com.malicioso.net` não passa).
 */
export function isAllowedRedirect({ url, storeAllowedDomains }: RedirectTarget): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username !== "" || parsed.password !== "") return false;
  const host = parsed.hostname.toLowerCase();
  return storeAllowedDomains.some((domain) => {
    const allowed = domain.trim().toLowerCase();
    if (allowed === "") return false;
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

/** Limpa o domínio cadastrado: minúsculas, sem esquema, sem barra final, sem caminho. */
export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export { hostOf };
