// Painel de qualidade (PRD §12.7): o que está publicado pela metade, oferta vencida, vínculo pendente, fonte
// falhando e link fora do domínio permitido.

import { isAllowedRedirect, MAX_PRICE_CENTS } from "@tako/domain";
import { query } from "../pool";
import { toIso } from "../mappers";

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
    unidentifiedPlatform: number;
    unidentifiedEdition: number;
    invalidPrices: number;
    abnormalPrices: number;
    unmappedProducts: number;
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
        where published and ends_at is not null and ends_at between $1::timestamptz and $1::timestamptz + interval '7 days') as "sectionsExpiring",
      (select count(*)::int from offers
        where platform not in ('steam', 'epic', 'gog', 'xbox', 'other')) as "unidentifiedPlatform",
      (select count(*)::int from products
        where published and kind = 'edition' and (edition_name is null or edition_name = '')) as "unidentifiedEdition",
      (select count(*)::int from offers
        where price_cents > $2::bigint
           or (reference_price_cents is not null and reference_price_cents < price_cents)) as "invalidPrices",
      (select count(*)::int from offers o
        where exists (
          select 1 from price_observations prev
          where prev.offer_id = o.id
            and prev.observed_at < o.observed_at
            and prev.observed_at = (
              select max(older.observed_at) from price_observations older
              where older.offer_id = o.id and older.observed_at < o.observed_at
            )
            and (o.price_cents * 5 < prev.price_cents or o.price_cents > prev.price_cents * 5)
        )) as "abnormalPrices",
      (select count(*)::int from external_products ep
        where not exists (select 1 from product_mappings m where m.external_product_id = ep.id)) as "unmappedProducts"`,
    [now, MAX_PRICE_CENTS],
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
    kind: "sem-plataforma",
    label: "Ofertas sem plataforma identificada",
    detail: "A plataforma não é uma das conhecidas. Sem isso, a oferta pode ser comparada com o produto errado.",
    href: "/admin/ofertas",
    count: row?.unidentifiedPlatform ?? 0,
  });
  add({
    kind: "sem-edicao",
    label: "Edições publicadas sem nome",
    detail: "Produto marcado como edição, sem o nome da edição. A comparação não sabe o que está vendendo.",
    href: "/admin/jogos",
    count: row?.unidentifiedEdition ?? 0,
  });
  add({
    kind: "preco-invalido",
    label: "Preços inválidos",
    detail: "Referência abaixo do preço, ou valor acima do que ainda é um preço. Desconto inventado não aparece na loja.",
    href: "/admin/ofertas",
    count: row?.invalidPrices ?? 0,
  });
  add({
    kind: "variacao-anormal",
    label: "Variações anormais de preço",
    detail: "O preço caiu para menos de um quinto do anterior, ou subiu mais de cinco vezes. Confira a fonte antes de confiar.",
    href: "/admin/ofertas",
    count: row?.abnormalPrices ?? 0,
  });
  add({
    kind: "produto-sem-vinculo",
    label: "Produtos de fonte sem vínculo",
    detail: "Chegou da fonte e não entrou na fila de revisão. Sem vínculo, não vira oferta da loja.",
    href: "/admin/vinculos",
    count: row?.unmappedProducts ?? 0,
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

export interface IntegrationHealth {
  database: "ok" | "down";
  sources: { slug: string; name: string; enabled: boolean; lastRunAt: string | null; consecutiveFailures: number; openErrors: number }[];
  staleOffers: number;
  openErrors: number;
  failingSources: number;
  lastSuccessfulRun: string | null;
}

/**
 * Saúde da operação (OPS-001): falha de integração e oferta vencida precisam ter nome e número, não um "está tudo
 * bem" genérico. É o que o /api/health publica e o que o monitor externo consulta.
 */
export async function integrationHealth(now = new Date()): Promise<IntegrationHealth> {
  const rows = await query<{
    lastRunAt: Date | null;
    slug: string;
    name: string;
    enabled: boolean;
    consecutiveFailures: number;
    openErrors: number;
  }>(
    `select s.slug, s.name, s.enabled, s.last_run_at as "lastRunAt", s.consecutive_failures as "consecutiveFailures",
            (select count(*)::int from ingestion_errors e join ingestion_runs r on r.id = e.run_id
              where r.source_id = s.id and e.resolved_at is null) as "openErrors"
     from sources s where s.status = 'approved' order by s.name`,
  );
  const sources = rows.map((row) => ({ ...row, lastRunAt: toIso(row.lastRunAt) }));
  const totals = await query<{ staleOffers: number; openErrors: number; lastSuccess: Date | null }>(
    `select
       (select count(*)::int from offers o join sources s on s.id = o.source_id
         where o.observed_at < $1::timestamptz - make_interval(hours => s.max_age_hours)) as "staleOffers",
       (select count(*)::int from ingestion_errors where resolved_at is null) as "openErrors",
       (select max(finished_at)::text from ingestion_runs where status = 'success') as "lastSuccess"`,
    [now],
  );
  const row = totals[0];
  return {
    database: "ok",
    sources,
    staleOffers: row?.staleOffers ?? 0,
    openErrors: row?.openErrors ?? 0,
    failingSources: sources.filter((source) => source.consecutiveFailures > 0).length,
    lastSuccessfulRun: toIso(row?.lastSuccess ?? null),
  };
}
