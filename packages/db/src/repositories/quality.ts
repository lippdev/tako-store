// Painel de qualidade (PRD §12.7): o que está publicado pela metade, oferta vencida, vínculo pendente, fonte
// falhando e link fora do domínio permitido.

import { isAllowedRedirect } from "@tako/domain";
import { query } from "../pool";

export interface QualityIssue {
  kind: string;
  label: string;
  detail: string;
  href: string;
  count: number;
}

export async function qualityIssues(now = new Date()): Promise<QualityIssue[]> {
  const counts = await query<{
    withoutDescription: number;
    withoutCover: number;
    productsWithoutOffer: number;
    pendingMappings: number;
    staleOffers: number;
    sectionsExpiring: number;
  }>(
    `select
      (select count(*)::int from games where published and not archived and (description is null or description = '')) as "withoutDescription",
      (select count(*)::int from games where published and not archived and cover_url is null) as "withoutCover",
      (select count(*)::int from products p
        where p.published and not exists (select 1 from offers o where o.product_id = p.id)) as "productsWithoutOffer",
      (select count(*)::int from product_mappings where status in ('pending', 'suggested')) as "pendingMappings",
      (select count(*)::int from offers o join sources s on s.id = o.source_id
        where o.observed_at < $1::timestamptz - make_interval(hours => s.max_age_hours)) as "staleOffers",
      (select count(*)::int from home_sections
        where published and ends_at is not null and ends_at between $1::timestamptz and $1::timestamptz + interval '7 days') as "sectionsExpiring"`,
    [now],
  );
  const row = counts[0];
  const issues: QualityIssue[] = [];
  const add = (issue: QualityIssue) => {
    if (issue.count > 0) issues.push(issue);
  };

  add({
    kind: "sem-descricao",
    label: "Jogos publicados sem descrição",
    detail: "A página fica sem contexto de venda. Corrija no cadastro do jogo.",
    href: "/admin/jogos?filtro=sem-descricao",
    count: row?.withoutDescription ?? 0,
  });
  add({
    kind: "sem-arte",
    label: "Jogos publicados sem capa",
    detail: "Card sem capa quebra a leitura da home e do catálogo.",
    href: "/admin/jogos?filtro=sem-capa",
    count: row?.withoutCover ?? 0,
  });
  add({
    kind: "produto-sem-oferta",
    label: "Produtos sem nenhuma oferta",
    detail: "Produto publicado que nunca vai aparecer com preço.",
    href: "/admin/ofertas",
    count: row?.productsWithoutOffer ?? 0,
  });
  add({
    kind: "vinculo-pendente",
    label: "Vínculos aguardando revisão",
    detail: "Produto vindo de fonte sem produto canônico confirmado.",
    href: "/admin/vinculos",
    count: row?.pendingMappings ?? 0,
  });
  add({
    kind: "oferta-vencida",
    label: "Ofertas vencidas",
    detail: "Preço mais velho que o prazo da fonte: não aparece como atual.",
    href: "/admin/fontes",
    count: row?.staleOffers ?? 0,
  });
  add({
    kind: "secao-expirando",
    label: "Seções da home a vencer em 7 dias",
    detail: "A home perde a seção sem aviso quando a janela fecha.",
    href: "/admin/home",
    count: row?.sectionsExpiring ?? 0,
  });

  const failing = await query<{ name: string; failures: number }>(
    "select name, consecutive_failures as failures from sources where consecutive_failures > 0 order by failures desc",
  );
  for (const source of failing) {
    issues.push({
      kind: "fonte-falhando",
      label: `Fonte ${source.name} com falhas seguidas`,
      detail: `${String(source.failures)} execução(ões) falharam desde a última bem-sucedida.`,
      href: "/admin/fontes",
      count: source.failures,
    });
  }

  // Link inválido não se resolve em SQL: a regra é a mesma do redirecionamento público.
  const links = await query<{ id: string; url: string; allowed: string[]; store: string }>(
    `select o.id, o.url, s.allowed_domains as allowed, s.name as store
     from offers o join stores s on s.id = o.store_id`,
  );
  const invalid = links.filter(
    (link) => !isAllowedRedirect({ url: link.url, storeAllowedDomains: link.allowed }),
  );
  add({
    kind: "link-invalido",
    label: "Ofertas com link fora do domínio permitido",
    detail: "O botão de compra não abriria a loja certa (ou não abriria de jeito nenhum).",
    href: "/admin/ofertas",
    count: invalid.length,
  });

  return issues;
}
