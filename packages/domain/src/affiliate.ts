// Link de afiliado (PAR-002): a loja pode ter um parâmetro ou um molde de URL próprio. O destino final continua
// preso ao domínio cadastrado — o molde não é desculpa para mandar o usuário a outro lugar.

import { isAllowedRedirect, normalizeDomain } from "./links";
import type { Store } from "./offers";

export interface AffiliateConfig {
  linkKind: Store["linkKind"];
  affiliateParam: string | null;
  affiliateValue: string | null;
  /** Molde com `{url}` onde entra o endereço da oferta, já codificado. */
  affiliateTemplate: string | null;
  allowedDomains: readonly string[];
}

export type AffiliateLinkResult = { ok: true; url: string } | { ok: false; error: string };

const PARAM_NAME = /^[a-zA-Z0-9_.-]{1,40}$/;

/** Só aceita parâmetro e valor que não quebrem a URL; vazio é "sem afiliado". */
export function isAffiliateParam(name: string): boolean {
  return PARAM_NAME.test(name);
}

/**
 * Endereço final do botão "ir para a loja":
 * - loja sem parceria de afiliado devolve a URL da oferta como está;
 * - com molde, o endereço da oferta entra codificado no lugar de `{url}`;
 * - com parâmetro, ele é acrescentado (ou substituído) na query, preservando o resto;
 * - o resultado precisa passar na regra de domínio permitido.
 */
export function buildAffiliateLink(input: {
  offerUrl: string;
  config: AffiliateConfig;
}): AffiliateLinkResult {
  const { offerUrl, config } = input;
  if (config.linkKind !== "affiliate") {
    return isAllowedRedirect({ url: offerUrl, storeAllowedDomains: config.allowedDomains })
      ? { ok: true, url: offerUrl }
      : { ok: false, error: "endereço da oferta fora do domínio permitido" };
  }

  let final: string;
  if (config.affiliateTemplate !== null && config.affiliateTemplate.trim() !== "") {
    if (!config.affiliateTemplate.includes("{url}")) {
      return { ok: false, error: "o molde do link precisa conter {url}" };
    }
    final = config.affiliateTemplate.replace("{url}", encodeURIComponent(offerUrl));
  } else if (config.affiliateParam !== null && config.affiliateValue !== null) {
    if (!isAffiliateParam(config.affiliateParam)) {
      return { ok: false, error: `parâmetro de afiliado inválido: "${config.affiliateParam}"` };
    }
    let parsed: URL;
    try {
      parsed = new URL(offerUrl);
    } catch {
      return { ok: false, error: "endereço da oferta inválido" };
    }
    parsed.searchParams.set(config.affiliateParam, config.affiliateValue);
    final = parsed.toString();
  } else {
    final = offerUrl;
  }

  if (!isAllowedRedirect({ url: final, storeAllowedDomains: config.allowedDomains })) {
    return { ok: false, error: "link de afiliado fora do domínio permitido" };
  }
  return { ok: true, url: final };
}

export const AFFILIATE_TEMPLATE_HINT = "https://loja.example/afiliado?url={url}";

/** Ordem das tentativas: molde, parâmetro, oferta crua — usada pelo painel para explicar o que está valendo. */
export function affiliateMode(config: AffiliateConfig): "template" | "param" | "none" {
  if (config.linkKind !== "affiliate") return "none";
  if (config.affiliateTemplate !== null && config.affiliateTemplate.trim() !== "") return "template";
  if (config.affiliateParam !== null && config.affiliateValue !== null) return "param";
  return "none";
}

/** Slug de URL a partir do título: sem acento, minúsculo, hífen no lugar do que não é letra ou número. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Confere o domínio do molde: ele também precisa estar na lista da loja (ou o link não sai). */
export function templateDomain(template: string | null): string | null {
  if (template === null || !template.includes("{url}")) return null;
  try {
    return normalizeDomain(new URL(template.replace("{url}", "https://example.com/x")).hostname);
  } catch {
    return null;
  }
}
