// Seed de demonstração: catálogo, lojas, fontes, ofertas e home com dados fictícios. Nenhuma loja real, nenhum
// preço real — é o que o PRD chama de "dados fictícios e fontes de demonstração" (§3.3). Rodar de novo limpa e
// recria o banco; use só em desenvolvimento.

import {
  addMediaAsset,
  closePool,
  createAdminUser,
  migrate,
  query,
  startIngestionRun,
  finishIngestionRun,
  upsertBanner,
  upsertExternalProduct,
  upsertGame,
  upsertOffer,
  upsertProduct,
  upsertSection,
  upsertSource,
  upsertStore,
} from "./index";

const HOUR = 3_600_000;
const NOW = new Date();

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * HOUR);
}

async function main(): Promise<void> {
  await migrate();
  await query(`truncate table offer_clicks, price_observations, ingestion_errors, ingestion_runs, product_mappings,
    external_products, offers, products, external_identifiers, media_assets, games, admin_sessions, admin_users,
    audit_events, home_sections, home_banners, sources, stores restart identity cascade`);

  const pixel = await upsertStore({
    slug: "pixel-store",
    name: "Pixel Store",
    partnerStatus: "none",
    allowedDomains: ["pixelstore.example"],
    linkKind: "direct",
  });
  const prisma = await upsertStore({
    slug: "prisma-games",
    name: "Prisma Games",
    partnerStatus: "active",
    linkKind: "affiliate",
    affiliateParam: "utm_source",
    affiliateValue: "tako-store",
    allowedDomains: ["prismagames.example"],
    attribution: "Preço e disponibilidade informados pela Prisma Games.",
  });
  const bazar = await upsertStore({
    slug: "bazar-digital",
    name: "Bazar Digital",
    partnerStatus: "pending",
    allowedDomains: ["bazardigital.example"],
    linkKind: "direct",
  });
  await upsertStore({
    slug: "loja-antiga",
    name: "Loja Antiga",
    partnerStatus: "disabled",
    enabled: false,
    allowedDomains: ["antiga.example"],
  });

  const demoFile = await upsertSource({
    slug: "arquivo-demo",
    name: "Arquivo de demonstração",
    kind: "file",
    maxAgeHours: 24,
    notes: "Exportação estruturada fictícia, usada nos testes de importação.",
    access: "api",
    format: "csv",
    coversBrl: true,
    cadenceHours: 24,
    status: "approved",
    attribution: "Dados fictícios gerados pelo próprio projeto.",
  });
  const demoFeed = await upsertSource({
    slug: "feed-demo",
    name: "Feed de demonstração",
    kind: "feed",
    maxAgeHours: 6,
    notes: "Feed fictício com atualização mais frequente.",
    access: "partner-feed",
    format: "json",
    coversBrl: true,
    cadenceHours: 6,
    status: "approved",
    attribution: "Dados fictícios gerados pelo próprio projeto.",
  });
  await upsertSource({
    slug: "fonte-pausada",
    name: "Fonte pausada (demo)",
    kind: "api",
    enabled: false,
    maxAgeHours: 48,
    notes: "Fonte desligada de propósito: as ofertas dela não aparecem na loja.",
    access: "api",
    format: "json",
    coversBrl: true,
    cadenceHours: 48,
    status: "approved",
  });

  // Matriz de fontes (PAR-004): candidatas em avaliação. São registros fictícios, nomeados como exemplo — não
  // representam acesso real a nenhum parceiro.
  await upsertSource({
    slug: "candidata-pagina-exemplo",
    name: "Página pública (exemplo fictício)",
    kind: "page",
    enabled: false,
    maxAgeHours: 24,
    notes: "Exemplo de candidata: só preço à vista na página, sem API. Avaliar termos antes de qualquer coleta.",
    access: "public-page",
    format: "html",
    coversBrl: false,
    cadenceHours: 24,
    status: "evaluating",
  });
  await upsertSource({
    slug: "candidata-feed-exemplo",
    name: "Feed de parceiro (exemplo fictício)",
    kind: "feed",
    enabled: false,
    maxAgeHours: 12,
    notes: "Exemplo de candidata com feed documentado e cobertura em BRL; falta contrato assinado.",
    access: "partner-feed",
    format: "xml",
    coversBrl: true,
    cadenceHours: 12,
    docsUrl: "https://exemplo.invalid/feed/documentacao",
    termsUrl: "https://exemplo.invalid/termos",
    attribution: "Preços cedidos pelo parceiro de exemplo.",
    status: "candidate",
  });

  const games = [
    {
      slug: "as-cronicas-de-vela",
      title: "As Crônicas de Vela",
      description:
        "Uma cartógrafa navega um arquipélago que muda de lugar toda noite. Cada mapa desenhado abre um caminho novo — e fecha outro.",
      releaseDate: "2026-03-12",
      developers: ["Estúdio Maré Alta"],
      publishers: ["Editora Farol"],
      genres: ["Aventura", "Ação"],
      platforms: ["steam", "gog"] as const,
      operatingSystems: ["windows", "linux"] as const,
    },
    {
      slug: "estacao-orbita",
      title: "Estação Órbita",
      description:
        "Simulador de uma estação espacial em decadência. Você administra ar, energia e o humor de seis pessoas a 400 km da Terra.",
      releaseDate: "2025-11-02",
      developers: ["Núcleo Norte"],
      publishers: ["Núcleo Norte"],
      genres: ["Simulação", "Estratégia"],
      platforms: ["steam"] as const,
      operatingSystems: ["windows", "macos"] as const,
    },
    {
      slug: "fenda",
      title: "Fenda",
      description: "Puzzle de perspectiva: você dobra o cenário para atravessar as próprias paredes.",
      releaseDate: "2024-08-19",
      developers: ["Oficina Dobra"],
      publishers: ["Oficina Dobra"],
      genres: ["Puzzle"],
      platforms: ["steam", "epic"] as const,
      operatingSystems: ["windows"] as const,
    },
    {
      slug: "rota-9",
      title: "Rota 9",
      description: "Corrida noturna por uma estrada que não termina, com trilha que muda conforme a velocidade.",
      releaseDate: "2026-01-30",
      developers: ["Garagem Sul"],
      publishers: ["Garagem Sul"],
      genres: ["Corrida"],
      platforms: ["steam"] as const,
      operatingSystems: ["windows"] as const,
    },
    {
      slug: "jardim-de-vidro",
      title: "Jardim de Vidro",
      description: "Cultive plantas de vidro em estufas suspensas. Sem falha, sem pressa, sem combate.",
      releaseDate: "2025-05-08",
      developers: ["Casa Leve"],
      publishers: ["Casa Leve"],
      genres: ["Puzzle", "Relaxante"],
      platforms: ["steam", "gog"] as const,
      operatingSystems: ["windows", "macos"] as const,
    },
    {
      slug: "o-ultimo-farol",
      title: "O Último Farol",
      description: "Terror em uma ilha onde a luz do farol é a única coisa que ainda obedece às leis da física.",
      releaseDate: "2024-10-31",
      developers: ["Farol Baixo"],
      publishers: ["Editora Farol"],
      genres: ["Terror", "Aventura"],
      platforms: ["steam"] as const,
      operatingSystems: ["windows"] as const,
    },
    {
      slug: "furia-de-aco",
      title: "Fúria de Aço",
      description: "Ação de arena com combate corpo a corpo em fábricas abandonadas.",
      releaseDate: "2025-02-14",
      developers: ["Bigorna"],
      publishers: ["Bigorna"],
      genres: ["Ação"],
      platforms: ["steam", "xbox"] as const,
      operatingSystems: ["windows"] as const,
    },
    {
      slug: "cafe-das-4",
      title: "Café das 4",
      description: "Administre um café de bairro e conheça a rotina de quem passa por lá às quatro da tarde.",
      releaseDate: "2026-06-05",
      developers: ["Mesa Dois"],
      publishers: ["Mesa Dois"],
      genres: ["Simulação", "Relaxante"],
      platforms: ["steam"] as const,
      operatingSystems: ["windows", "macos"] as const,
    },
    {
      slug: "vento-sul",
      title: "Vento Sul",
      description: "Aventura de vela em mar aberto, com clima dinâmico e uma tripulação que lembra do que você fez.",
      releaseDate: "2026-09-18",
      developers: ["Estúdio Maré Alta"],
      publishers: ["Editora Farol"],
      genres: ["Aventura"],
      platforms: ["steam"] as const,
      operatingSystems: ["windows", "linux"] as const,
    },
    {
      slug: "neblina",
      title: "Neblina",
      description: "Terror psicológico em uma cidade que desaparece da memória dos moradores toda manhã.",
      releaseDate: "2025-08-22",
      developers: ["Farol Baixo"],
      publishers: ["Editora Farol"],
      genres: ["Terror"],
      platforms: ["steam", "gog"] as const,
      operatingSystems: ["windows"] as const,
    },
    {
      slug: "maquina-de-chuva",
      title: "Máquina de Chuva",
      description: "Estratégia por turnos para resolver a seca de um vale inteiro com a engenharia que sobrou.",
      releaseDate: "2024-04-11",
      developers: ["Núcleo Norte"],
      publishers: ["Núcleo Norte"],
      genres: ["Estratégia"],
      platforms: ["steam"] as const,
      operatingSystems: ["windows", "linux"] as const,
    },
    {
      slug: "ceu-partido",
      title: "Céu Partido",
      description: "RPG de mundo aberto onde o mapa é literalmente um céu rachado em ilhas flutuantes.",
      releaseDate: "2026-11-20",
      developers: ["Oficina Dobra"],
      publishers: ["Editora Farol"],
      genres: ["RPG", "Aventura"],
      platforms: ["steam", "epic"] as const,
      operatingSystems: ["windows"] as const,
    },
  ];

  const saved = new Map<string, string>();
  for (const game of games) {
    const row = await upsertGame({
      slug: game.slug,
      title: game.title,
      description: game.description,
      releaseDate: game.releaseDate,
      developers: [...game.developers],
      publishers: [...game.publishers],
      genres: [...game.genres],
      platforms: [...game.platforms],
      operatingSystems: [...game.operatingSystems],
      coverUrl: `/covers/${game.slug}.svg`,
      heroUrl: `/covers/${game.slug}.svg`,
      published: true,
    });
    saved.set(game.slug, row.id);

    // Biblioteca de imagens (CAT-005): cada imagem com a procedência registrada.
    await addMediaAsset({
      gameId: row.id,
      kind: "cover",
      url: `/covers/${game.slug}.svg`,
      origin: "Arte de demonstração gerada pelo projeto",
      attribution: "Tako Store — catálogo de demonstração",
    });
    for (const frame of [1, 2]) {
      await addMediaAsset({
        gameId: row.id,
        kind: "screenshot",
        url: `/covers/galeria/${game.slug}-${String(frame)}.svg`,
        origin: "Arte de demonstração gerada pelo projeto",
        attribution: "Tako Store — catálogo de demonstração",
      });
    }
  }

  // Produtos: base para todos; edição, DLC e bundle em alguns, para exercitar as regras de comparação.
  const products = new Map<string, string>();
  for (const game of games) {
    const gameId = saved.get(game.slug);
    if (gameId === undefined) continue;
    const platform = game.platforms[0] ?? "steam";
    const base = await upsertProduct({ gameId, kind: "base", platform });
    products.set(`${game.slug}:base`, base.id);
  }

  const editions: [string, string, number][] = [
    ["as-cronicas-de-vela", "Deluxe", 19_990],
    ["estacao-orbita", "Órbita Completa", 24_990],
    ["ceu-partido", "Edição Celeste", 29_990],
  ];
  for (const [slug, editionName] of editions) {
    const gameId = saved.get(slug);
    if (gameId === undefined) continue;
    const product = await upsertProduct({ gameId, kind: "edition", editionName, platform: "steam" });
    products.set(`${slug}:deluxe`, product.id);
  }

  const dlcGame = saved.get("estacao-orbita");
  const dlcBase = products.get("estacao-orbita:base");
  if (dlcGame !== undefined && dlcBase !== undefined) {
    const dlc = await upsertProduct({
      gameId: dlcGame,
      kind: "dlc",
      platform: "steam",
      requiresProductId: dlcBase,
    });
    products.set("estacao-orbita:dlc", dlc.id);
  }

  const bundleGame = saved.get("fenda");
  const bundleBase = products.get("fenda:base");
  if (bundleGame !== undefined && bundleBase !== undefined) {
    const bundle = await upsertProduct({
      gameId: bundleGame,
      kind: "bundle",
      platform: "steam",
      bundleProductIds: [bundleBase],
    });
    products.set("fenda:bundle", bundle.id);
  }

  // Ofertas: preços fictícios, com os casos que a tela precisa saber tratar.
  type SeedOffer = {
    product: string;
    store: string;
    source: string;
    price: number;
    reference?: number;
    availability?: "available" | "unavailable" | "unknown";
    coupon?: string;
    currency?: string;
    region?: string;
    observedHoursAgo?: number;
  };
  const offers: SeedOffer[] = [
    { product: "as-cronicas-de-vela:base", store: pixel.slug, source: demoFile.slug, price: 8_990, reference: 12_990 },
    { product: "as-cronicas-de-vela:base", store: prisma.slug, source: demoFeed.slug, price: 9_490, reference: 12_990 },
    { product: "as-cronicas-de-vela:base", store: bazar.slug, source: demoFile.slug, price: 7_990, coupon: "VELA10" },
    { product: "as-cronicas-de-vela:deluxe", store: pixel.slug, source: demoFile.slug, price: 15_990, reference: 19_990 },

    { product: "estacao-orbita:base", store: prisma.slug, source: demoFeed.slug, price: 11_990, reference: 14_990 },
    { product: "estacao-orbita:base", store: pixel.slug, source: demoFile.slug, price: 13_490 },
    { product: "estacao-orbita:base", store: bazar.slug, source: demoFile.slug, price: 9_990, availability: "unavailable" },
    { product: "estacao-orbita:deluxe", store: prisma.slug, source: demoFeed.slug, price: 21_990, reference: 24_990 },
    { product: "estacao-orbita:dlc", store: pixel.slug, source: demoFile.slug, price: 3_490 },

    { product: "fenda:base", store: pixel.slug, source: demoFile.slug, price: 2_490, reference: 4_990 },
    // Observada há 40 h: com prazo de 24 h da fonte, é preço vencido e não disputa o selo.
    { product: "fenda:base", store: bazar.slug, source: demoFile.slug, price: 1_990, observedHoursAgo: 40 },
    { product: "fenda:bundle", store: pixel.slug, source: demoFile.slug, price: 3_990, reference: 6_990 },

    { product: "rota-9:base", store: prisma.slug, source: demoFeed.slug, price: 7_490, reference: 9_990 },
    { product: "rota-9:base", store: pixel.slug, source: demoFile.slug, price: 8_240 },

    { product: "jardim-de-vidro:base", store: pixel.slug, source: demoFile.slug, price: 3_190, reference: 5_990 },
    { product: "jardim-de-vidro:base", store: prisma.slug, source: demoFeed.slug, price: 2_990, reference: 5_990 },

    { product: "o-ultimo-farol:base", store: bazar.slug, source: demoFile.slug, price: 4_990, reference: 7_990 },
    { product: "o-ultimo-farol:base", store: pixel.slug, source: demoFile.slug, price: 5_490 },

    { product: "furia-de-aco:base", store: prisma.slug, source: demoFeed.slug, price: 6_990, reference: 9_990 },
    // Em dólar: não entra na comparação em BRL (PRD §10.3).
    { product: "furia-de-aco:base", store: pixel.slug, source: demoFile.slug, price: 1_299, currency: "USD" },

    { product: "cafe-das-4:base", store: pixel.slug, source: demoFile.slug, price: 4_490, reference: 5_990 },
    { product: "cafe-das-4:base", store: prisma.slug, source: demoFeed.slug, price: 4_990 },

    { product: "vento-sul:base", store: prisma.slug, source: demoFeed.slug, price: 10_990, reference: 13_990 },
    { product: "vento-sul:base", store: bazar.slug, source: demoFile.slug, price: 11_990 },

    { product: "neblina:base", store: pixel.slug, source: demoFile.slug, price: 3_990, reference: 6_990 },
    { product: "neblina:base", store: prisma.slug, source: demoFeed.slug, price: 3_690, reference: 6_990 },

    { product: "maquina-de-chuva:base", store: bazar.slug, source: demoFile.slug, price: 2_990 },
    // Região errada: só aparece para quem está nos EUA.
    { product: "maquina-de-chuva:base", store: pixel.slug, source: demoFile.slug, price: 1_990, region: "US" },

    { product: "ceu-partido:base", store: prisma.slug, source: demoFeed.slug, price: 17_990, reference: 22_990 },
    { product: "ceu-partido:base", store: pixel.slug, source: demoFile.slug, price: 18_990 },
    { product: "ceu-partido:deluxe", store: pixel.slug, source: demoFile.slug, price: 27_990, reference: 29_990 },
  ];

  const storeByName = new Map([
    [pixel.slug, pixel],
    [prisma.slug, prisma],
    [bazar.slug, bazar],
  ]);
  const sourceByName = new Map([
    [demoFile.slug, demoFile],
    [demoFeed.slug, demoFeed],
  ]);

  let written = 0;
  for (const item of offers) {
    const productId = products.get(item.product);
    const store = storeByName.get(item.store);
    const source = sourceByName.get(item.source);
    if (productId === undefined || store === undefined || source === undefined) continue;
    const savedOffer = await upsertOffer({
      productId,
      storeId: store.id,
      sourceId: source.id,
      priceCents: item.price,
      referencePriceCents: item.reference ?? null,
      currency: item.currency ?? "BRL",
      region: item.region ?? "BR",
      platform: "steam",
      availability: item.availability ?? "available",
      coupon: item.coupon ?? null,
      url: `https://${store.allowedDomains[0] ?? "example.com"}/item/${item.product}`,
      observedAt: hoursAgo(item.observedHoursAgo ?? 1),
    });
    written += 1;

    // Histórico de demonstração (EXP-001): observações anteriores, mais caras, para a página do jogo poder falar do
    // preço observado no período com a cobertura declarada. Nada disso é preço real.
    await query(
      `insert into price_observations (offer_id, source_id, price_cents, reference_price_cents, availability, observed_at)
       values ($1, $2, $3, $4, 'available', $5), ($1, $2, $6, $4, 'available', $7)`,
      [
        savedOffer.id,
        source.id,
        Math.round(item.price * 1.18),
        item.reference ?? null,
        hoursAgo(55 * 24),
        Math.round(item.price * 1.05),
        hoursAgo(20 * 24),
      ],
    );
  }

  // Home de demonstração: banners e seções, uma de cada tipo de regra.
  await upsertBanner({
    gameId: saved.get("vento-sul") ?? null,
    eyebrow: "Em destaque",
    title: "Vento Sul chegou",
    subtitle: "Aventura de vela com clima dinâmico e tripulação que lembra das suas escolhas.",
    ctaLabel: "Ver o jogo",
    position: 0,
  });
  await upsertBanner({
    gameId: saved.get("jardim-de-vidro") ?? null,
    eyebrow: "Ofertas da semana",
    title: "Jardim de Vidro com 50% de desconto",
    subtitle: "Entre as ofertas acompanhadas, o menor preço elegível para o Brasil.",
    ctaLabel: "Comparar preços",
    position: 1,
  });

  await upsertSection({
    slug: "em-promocao",
    title: "Em promoção",
    subtitle: "Descontos de 25% ou mais entre as ofertas acompanhadas",
    rule: { kind: "discount", minPercent: 25 },
    position: 0,
  });
  await upsertSection({
    slug: "abaixo-de-50",
    title: "Abaixo de R$ 50",
    subtitle: "Bons jogos por menos de cinquenta reais",
    rule: { kind: "below-price", maxCents: 5_000, currency: "BRL" },
    position: 1,
  });
  await upsertSection({
    slug: "aventura",
    title: "Para quem gosta de aventura",
    rule: { kind: "genre", genre: "Aventura" },
    position: 2,
  });
  await upsertSection({
    slug: "novidades",
    title: "Novidades",
    subtitle: "Publicados nos últimos 30 dias",
    rule: { kind: "recent", days: 30 },
    position: 3,
  });
  await upsertSection({
    slug: "destaques-pixel",
    title: "Destaques da Pixel Store",
    rule: { kind: "store", storeSlugs: [pixel.slug] },
    position: 4,
  });
  await upsertSection({
    slug: "escolhas-da-redacao",
    title: "Escolhas da redação",
    rule: {
      kind: "manual",
      gameIds: [
        saved.get("as-cronicas-de-vela") ?? "",
        saved.get("o-ultimo-farol") ?? "",
        saved.get("ceu-partido") ?? "",
      ].filter(Boolean),
    },
    position: 5,
  });
  await upsertSection({
    slug: "secao-expirada",
    title: "Seção que já saiu do ar",
    rule: { kind: "discount", minPercent: 10 },
    position: 9,
    published: false,
    endsAt: new Date(NOW.getTime() - HOUR).toISOString(),
  });

  // Fila de vínculos: um pendente com sugestão e um já aprovado.
  const external = await upsertExternalProduct({
    sourceId: demoFile.id,
    externalId: "demo-001",
    title: "As Crônicas de Vela",
    platform: "steam",
    raw: { arquivo: "catalogo-demo.json", linha: 1 },
  });
  const baseVela = products.get("as-cronicas-de-vela:base");
  if (baseVela !== undefined) {
    // Aprovar direto: é o caso em que a fonte traz o produto canônico sem ambiguidade.
    await query(
      `insert into product_mappings (external_product_id, product_id, status, confidence, reason, decided_by, decided_at)
       values ($1, $2, 'approved', 1.000, 'Título idêntico e mesma plataforma', 'seed', now())`,
      [external, baseVela],
    );
  }
  const ambiguous = await upsertExternalProduct({
    sourceId: demoFeed.id,
    externalId: "demo-002",
    title: "Estação Órbita Deluxe",
    edition: "Deluxe",
    platform: "steam",
    raw: { feed: "promocoes-demo.xml", linha: 4 },
  });
  await query(
    `insert into product_mappings (external_product_id, product_id, status, confidence, reason)
     values ($1, $2, 'suggested', 0.720, 'Nome parecido, edição informada pela fonte')`,
    [ambiguous, products.get("estacao-orbita:deluxe") ?? null],
  );
  const unknown = await upsertExternalProduct({
    sourceId: demoFeed.id,
    externalId: "demo-003",
    title: "O Último Farol — Edição Colecionador",
    edition: "Colecionador",
    platform: "xbox",
    raw: { feed: "promocoes-demo.xml", linha: 9 },
  });
  await query(
    `insert into product_mappings (external_product_id, status, confidence, reason)
     values ($1, 'pending', null, 'Plataforma Xbox não existe neste jogo')`,
    [unknown],
  );

  // Uma execução de importação registrada, para a tela de fontes não nascer vazia.
  const run = await startIngestionRun(demoFile.id, "seed");
  await finishIngestionRun(run, { status: "success", received: written, accepted: written, rejected: 0 });

  await createAdminUser({
    email: "admin@tako.dev",
    name: "Admin de demonstração",
    password: "tako-demo-2026",
    role: "admin",
  });
  await createAdminUser({
    email: "catalogo@tako.dev",
    name: "Editora de catálogo",
    password: "tako-demo-2026",
    role: "catalog",
  });
  await createAdminUser({
    email: "leitura@tako.dev",
    name: "Leitura",
    password: "tako-demo-2026",
    role: "viewer",
  });

  console.log(
    `Seed pronto: ${String(games.length)} jogos, ${String(products.size)} produtos, ${String(written)} ofertas, 6 seções, 2 banners, 3 usuários.`,
  );
  console.log("Painel: admin@tako.dev / tako-demo-2026");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
