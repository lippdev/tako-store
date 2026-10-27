"use server";

import { redirect } from "next/navigation";
import {
  addMediaAsset,
  createAdminUser,
  revokeUserSessions,
  setAdminUserActive,
  setAdminUserRole,
  deleteBanner,
  deleteSection,
  decideMapping,
  disableSourceOffers,
  findGameBySlug,
  getGameById,
  getSourceBySlug,
  getStoreBySlug,
  listAllGames,
  listMediaAssets,
  mergeGames,
  removeExternalIdentifier,
  removeMediaAsset,
  replacePrimaryImage,
  setExternalIdentifier,
  setGameVisibility,
  setBannerPublished,
  setPrimaryMedia,
  setProductPublished,
  setSectionPublished,
  setSourceEnabled,
  updateGame,
  updateSourceMatrix,
  applyCatalogImport,
  upsertBanner,
  upsertGame,
  upsertProduct,
  upsertSection,
  upsertSource,
  upsertStore,
  writeAudit,
} from "@tako/db";
import { importSource, retryFailedRun } from "@tako/ingest";
import { assertPublicFeedUrl, validateFieldMap } from "@tako/connectors";
import {
  disableMfa,
  enableMfa,
  generateTotpSecret,
  mfaState,
  storeMfaSecret,
  verifyTotp,
  verifyUserTotp,
} from "@tako/db";
import {
  isAffiliateParam,
  isMediaKind,
  normalizeDomain,
  parseCatalogFile,
  parseMediaUrl,
  redactUrl,
  serializeCatalogFile,
  slugify,
  templateDomain,
  type HomeRule,
  type MediaKind,
} from "@tako/domain";
import { completeMfaSignIn, requirePermission, requireUser, signIn, signOut } from "@/server/session";

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optional(form: FormData, name: string): string | null {
  const value = text(form, name);
  return value === "" ? null : value;
}

function list(form: FormData, name: string): string[] {
  return text(form, name)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function bool(form: FormData, name: string): boolean {
  return form.get(name) === "on" || form.get(name) === "1";
}

export async function entrar(form: FormData): Promise<void> {
  const email = text(form, "email");
  const password = text(form, "senha");
  const destination = text(form, "destino") === "" ? "/admin" : text(form, "destino");
  const result = await signIn(email, password, text(form, "codigo"));
  if (result === "ok") redirect(destination);
  if (result === "mfa") redirect(`/admin/entrar?mfa=1&destino=${encodeURIComponent(destination)}`);
  if (result === "throttled") redirect(`/admin/entrar?bloqueado=15&destino=${encodeURIComponent(destination)}`);
  redirect(`/admin/entrar?erro=1&destino=${encodeURIComponent(destination)}`);
}

/** Segunda etapa do login: só o código, com o pedido que o servidor guardou. */
export async function entrarComCodigo(form: FormData): Promise<void> {
  const destination = text(form, "destino") === "" ? "/admin" : text(form, "destino");
  const result = await completeMfaSignIn(text(form, "codigo"));
  if (result === "ok") redirect(destination);
  if (result === "expired") redirect(`/admin/entrar?erro=1&destino=${encodeURIComponent(destination)}`);
  redirect(`/admin/entrar?mfa=1&erro=1&destino=${encodeURIComponent(destination)}`);
}

export async function sair(): Promise<void> {
  await signOut();
  redirect("/admin/entrar");
}

export async function publicarJogo(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const id = text(form, "id");
  const change = text(form, "acao");
  const before = await getGameById(id);
  if (before === null) redirect("/admin/jogos?erro=nao-encontrado");

  if (change === "publicar") await setGameVisibility(id, { published: true, archived: false });
  if (change === "ocultar") await setGameVisibility(id, { published: false });
  if (change === "arquivar") await setGameVisibility(id, { published: false, archived: true });
  await writeAudit({
    actor: user,
    action: `jogo:${change}`,
    entity: "game",
    entityId: id,
    detail: { antes: before.published, titulo: before.title },
  });
  redirect("/admin/jogos?ok=1");
}

export async function salvarJogo(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const id = text(form, "id");
  const before = await getGameById(id);
  if (before === null) redirect("/admin/jogos?erro=nao-encontrado");

  const patch = {
    title: text(form, "titulo"),
    slug: text(form, "slug"),
    description: optional(form, "descricao"),
    originalTitle: optional(form, "tituloOriginal"),
    alternativeTitles: list(form, "titulosAlternativos"),
    releaseDate: optional(form, "lancamento"),
    developers: list(form, "desenvolvedoras"),
    publishers: list(form, "distribuidoras"),
    genres: list(form, "generos"),
  };
  const after = await updateGame(id, patch);
  await writeAudit({
    actor: user,
    action: "jogo:editar",
    entity: "game",
    entityId: id,
    detail: { titulo: after?.title, slug: after?.slug },
  });
  redirect(`/admin/jogos/${id}?ok=1`);
}

export async function decidirVinculo(form: FormData): Promise<void> {
  const user = await requirePermission("mappings:write");
  const id = text(form, "id");
  const decision = text(form, "decisao");
  const productId = optional(form, "produtoId");
  if (decision === "aprovar") {
    await decideMapping({ id, status: "approved", productId, decidedBy: user.email });
  } else if (decision === "rejeitar") {
    await decideMapping({ id, status: "rejected", productId: null, decidedBy: user.email });
  } else {
    await decideMapping({ id, status: "pending", productId: null, decidedBy: user.email });
  }
  await writeAudit({
    actor: user,
    action: `vinculo:${decision}`,
    entity: "product_mapping",
    entityId: id,
    detail: { produtoId: productId },
  });
  redirect("/admin/vinculos?ok=1");
}

export async function salvarLoja(form: FormData): Promise<void> {
  const user = await requirePermission("stores:write");
  const domains = list(form, "dominios").map(normalizeDomain).filter((domain) => domain !== "");
  const partner = text(form, "parceria");
  const affiliateParam = optional(form, "afiliadoParam");
  const existing = await getStoreBySlug(text(form, "slug"));
  // Campo vazio mantém o segredo já cadastrado. Só some quando a pessoa pede para remover (PRD §12.1).
  const affiliateValue = bool(form, "removerChave") ? null : optional(form, "afiliadoValor") ?? existing?.affiliateValue ?? null;
  const affiliateTemplate = bool(form, "removerMolde")
    ? null
    : optional(form, "afiliadoMolde") ?? existing?.affiliateTemplate ?? null;
  if (affiliateParam !== null && !isAffiliateParam(affiliateParam)) redirect("/admin/lojas?erro=afiliado");
  if (affiliateTemplate !== null) {
    const host = templateDomain(affiliateTemplate);
    const allowed = domains.some((domain) => host === domain || (host !== null && host.endsWith(`.${domain}`)));
    if (host === null || !allowed) redirect("/admin/lojas?erro=molde");
  }
  const store = await upsertStore({
    slug: text(form, "slug"),
    name: text(form, "nome"),
    partnerStatus:
      partner === "active" || partner === "pending" || partner === "none" || partner === "disabled" ? partner : "none",
    enabled: bool(form, "ativa"),
    allowedDomains: domains,
    linkKind: text(form, "link") === "affiliate" ? "affiliate" : text(form, "link") === "source" ? "source" : "direct",
    attribution: optional(form, "atribuicao"),
    affiliateParam,
    affiliateValue,
    affiliateTemplate,
  });
  await writeAudit({ actor: user, action: "loja:salvar", entity: "store", entityId: store.id, detail: { slug: store.slug } });
  redirect("/admin/lojas?ok=1");
}

export async function alternarFonte(form: FormData): Promise<void> {
  const user = await requirePermission("sources:write");
  const id = text(form, "id");
  const enabled = bool(form, "ativa");
  await setSourceEnabled(id, enabled);
  await writeAudit({ actor: user, action: `fonte:${enabled ? "ativar" : "pausar"}`, entity: "source", entityId: id });
  redirect("/admin/fontes?ok=1");
}

/** Coleta e importa agora, pelo painel, com o mesmo código do worker (OFR-004, OFR-006). */
/** Tira as ofertas atuais da fonte da comparação. O histórico fica; a próxima coleta pode repor (PRD §12.6). */
export async function desativarOfertasDaFonte(form: FormData): Promise<void> {
  const user = await requirePermission("sources:write");
  const id = text(form, "id");
  const removed = await disableSourceOffers(id);
  await writeAudit({
    actor: user,
    action: "fonte:desativar-ofertas",
    entity: "source",
    entityId: id,
    detail: { desativadas: removed },
  });
  redirect(`/admin/fontes?ok=ofertas&desativadas=${String(removed)}`);
}

export async function executarImportacao(form: FormData): Promise<void> {
  const user = await requirePermission("sources:write");
  const slug = text(form, "slug");
  const source = await getSourceBySlug(slug);
  if (source === null) redirect("/admin/fontes?erro=fonte-inexistente");
  if (!source.enabled) redirect("/admin/fontes?erro=pausada");

  let summary: { accepted: number; rejected: number; runId: string } | null = null;
  let failure: string | null = null;
  try {
    const result = await importSource(source, `painel:${user.email}`);
    summary = { accepted: result.accepted, rejected: result.rejected, runId: result.runId };
    await writeAudit({
      actor: user,
      action: "fonte:executar",
      entity: "source",
      entityId: source.id,
      detail: { executado: result.runId, aceitas: result.accepted, recusadas: result.rejected },
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : "erro desconhecido";
    await writeAudit({ actor: user, action: "fonte:executar-falhou", entity: "source", entityId: source.id, detail: { motivo: failure } });
  }
  if (failure !== null) redirect(`/admin/fontes?erro=${encodeURIComponent(failure)}`);
  redirect(
    `/admin/fontes?ok=executado&aceitas=${String(summary?.accepted ?? 0)}&recusadas=${String(summary?.rejected ?? 0)}`,
  );
}

function regra(form: FormData): HomeRule {
  const kind = text(form, "regra");
  if (kind === "discount") return { kind: "discount", minPercent: Number(text(form, "minPercent") || "20") };
  if (kind === "below-price") return { kind: "below-price", maxCents: Number(text(form, "maxReais") || "50") * 100, currency: "BRL" };
  if (kind === "genre") return { kind: "genre", genre: text(form, "genero") || "Aventura" };
  if (kind === "recent") return { kind: "recent", days: Number(text(form, "dias") || "30") };
  if (kind === "store") return { kind: "store", storeSlugs: list(form, "lojas") };
  return { kind: "manual", gameIds: list(form, "jogos") };
}

export async function salvarSecao(form: FormData): Promise<void> {
  const user = await requirePermission("home:write");
  const section = await upsertSection({
    slug: text(form, "slug"),
    title: text(form, "titulo"),
    subtitle: optional(form, "subtitulo"),
    rule: regra(form),
    position: Number(text(form, "posicao") || "0"),
    published: bool(form, "publicada"),
    endsAt: optional(form, "termina"),
  });
  await writeAudit({ actor: user, action: "home:salvar", entity: "home_section", entityId: section.id, detail: { slug: section.slug } });
  redirect("/admin/home?ok=1");
}

export async function alternarSecao(form: FormData): Promise<void> {
  const user = await requirePermission("home:write");
  const slug = text(form, "slug");
  const published = bool(form, "publicada");
  await setSectionPublished(slug, published);
  await writeAudit({ actor: user, action: `home:${published ? "publicar" : "ocultar"}`, entity: "home_section", entityId: slug });
  redirect("/admin/home?ok=1");
}

export async function removerSecao(form: FormData): Promise<void> {
  const user = await requirePermission("home:write");
  const slug = text(form, "slug");
  await deleteSection(slug);
  await writeAudit({ actor: user, action: "home:remover", entity: "home_section", entityId: slug });
  redirect("/admin/home?ok=1");
}

const PRIMARY_KINDS = new Set<MediaKind>(["cover", "hero", "logo"]);

/** Imagem com procedência (CAT-005): capa, fundo e logo substituem a anterior; captura entra na galeria. */
export async function salvarImagem(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const gameId = text(form, "jogoId");
  const game = await getGameById(gameId);
  if (game === null) redirect("/admin/jogos?erro=nao-encontrado");

  const kindValue = text(form, "tipo");
  const kind: MediaKind = isMediaKind(kindValue) ? kindValue : "screenshot";
  const parsed = parseMediaUrl(text(form, "endereco"));
  const origin = text(form, "origem");
  if (!parsed.ok || origin.length < 3) {
    redirect(`/admin/jogos/${gameId}?erro=imagem`);
  }

  const input = {
    gameId,
    kind,
    url: parsed.url,
    origin,
    attribution: optional(form, "atribuicao"),
  };
  if (PRIMARY_KINDS.has(kind)) {
    await replacePrimaryImage(input);
    await setPrimaryMedia(gameId, kind === "cover" ? "cover" : kind === "hero" ? "hero" : "logo", parsed.url);
  } else {
    await addMediaAsset(input);
  }
  await writeAudit({
    actor: user,
    action: "jogo:imagem",
    entity: "game",
    entityId: gameId,
    detail: { tipo: kind, url: parsed.url, origem: origin },
  });
  redirect(`/admin/jogos/${gameId}?ok=imagem`);
}

/** Remove a imagem e, se ela era a principal do tipo, aponta a mais recente que sobrou (ou nenhuma). */
export async function removerImagem(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const id = text(form, "id");
  const removed = await removeMediaAsset(id);
  if (removed === null) redirect("/admin/jogos?erro=nao-encontrado");

  if (PRIMARY_KINDS.has(removed.kind)) {
    const remaining = (await listMediaAssets(removed.gameId)).filter((asset) => asset.kind === removed.kind);
    const next = remaining.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    await setPrimaryMedia(removed.gameId, removed.kind === "cover" ? "cover" : removed.kind === "hero" ? "hero" : "logo", next?.url ?? null);
  }
  await writeAudit({
    actor: user,
    action: "jogo:imagem-remover",
    entity: "game",
    entityId: removed.gameId,
    detail: { tipo: removed.kind, url: removed.url },
  });
  redirect(`/admin/jogos/${removed.gameId}?ok=imagem`);
}

/** Identificador do jogo numa fonte externa (CAT-007). */
export async function salvarIdentificador(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const gameId = text(form, "jogoId");
  const sourceId = text(form, "fonteId");
  const externalId = text(form, "identificador");
  if (sourceId === "" || externalId === "") redirect(`/admin/jogos/${gameId}?erro=identificador`);

  await setExternalIdentifier(gameId, sourceId, externalId);
  await writeAudit({
    actor: user,
    action: "jogo:identificador",
    entity: "game",
    entityId: gameId,
    detail: { fonte: sourceId, identificador: externalId },
  });
  redirect(`/admin/jogos/${gameId}?ok=identificador`);
}

export async function removerIdentificador(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const gameId = text(form, "jogoId");
  const sourceId = text(form, "fonteId");
  await removeExternalIdentifier(gameId, sourceId);
  await writeAudit({ actor: user, action: "jogo:identificador-remover", entity: "game", entityId: gameId, detail: { fonte: sourceId } });
  redirect(`/admin/jogos/${gameId}?ok=identificador`);
}

/** União de duplicata (CAT-008): o jogo duplicado é arquivado e a união fica no histórico. */
export async function unirJogos(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const survivorId = text(form, "principalId");
  const duplicateId = text(form, "duplicadoId");
  let failure: string | null = null;
  try {
    const result = await mergeGames({ survivorId, duplicateId, actorEmail: user.email });
    console.log(result.summary);
  } catch (error) {
    failure = error instanceof Error ? error.message : "erro desconhecido";
    await writeAudit({
      actor: user,
      action: "jogo:unir-falhou",
      entity: "game",
      entityId: survivorId,
      detail: { duplicado: duplicateId, motivo: failure },
    });
  }
  redirect(failure === null ? "/admin/duplicatas?ok=uniao" : `/admin/duplicatas?erro=${encodeURIComponent(failure)}`);
}

/** Matriz de fontes (PAR-004): acesso, formato, cobertura em BRL, frequência, links e atribuição. */
export async function salvarMatrizFonte(form: FormData): Promise<void> {
  const user = await requirePermission("sources:write");
  const id = text(form, "id");
  const access = text(form, "acesso");
  const format = text(form, "formato");
  const status = text(form, "situacao");
  const cadence = optional(form, "frequencia");
  await updateSourceMatrix(id, {
    access:
      access === "api" || access === "partner-feed" || access === "public-page" || access === "unknown" ? access : "unknown",
    format: format === "json" || format === "csv" || format === "xml" || format === "html" ? format : "unknown",
    coversBrl: bool(form, "cobreBrl"),
    cadenceHours: cadence === null || Number.isNaN(Number(cadence)) ? null : Number(cadence),
    docsUrl: optional(form, "documentacao"),
    termsUrl: optional(form, "termos"),
    attribution: optional(form, "atribuicao"),
    status:
      status === "candidate" || status === "evaluating" || status === "approved" || status === "rejected"
        ? status
        : "candidate",
    notes: optional(form, "observacoes"),
  });
  await writeAudit({ actor: user, action: "fonte:matriz", entity: "source", entityId: id, detail: { acesso: access, formato: format, situacao: status } });
  redirect("/admin/fontes?ok=matriz");
}

/** Reprocessa os erros de uma execução (OFR-006), pelo painel, com o mesmo código do worker. */
export async function reprocessarExecucao(form: FormData): Promise<void> {
  const user = await requirePermission("sources:write");
  const runId = text(form, "execucaoId");
  let failure: string | null = null;
  let summary: { runId: string; resolved: number; retried: number } | null = null;
  try {
    const result = await retryFailedRun(runId, user.email);
    summary = { runId: result.runId, resolved: result.resolved, retried: result.retried };
    await writeAudit({
      actor: user,
      action: "fonte:reprocessar",
      entity: "ingestion_run",
      entityId: runId,
      detail: { novaExecucao: result.runId, resolvidos: result.resolved, tentados: result.retried },
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : "erro desconhecido";
    await writeAudit({ actor: user, action: "fonte:reprocessar-falhou", entity: "ingestion_run", entityId: runId, detail: { motivo: failure } });
  }
  if (failure !== null) redirect(`/admin/fontes?erro=${encodeURIComponent(failure)}`);
  redirect(
    `/admin/fontes?ok=reprocessado&resolvidos=${String(summary?.resolved ?? 0)}&tentados=${String(summary?.retried ?? 0)}`,
  );
}

const ROLES = new Set(["admin", "catalog", "content", "integrations", "viewer"]);

/** Usuário do painel (PRD §12.1): criar, trocar papel, desativar e revogar sessões. */
export async function salvarUsuario(form: FormData): Promise<void> {
  const actor = await requirePermission("users:write");
  const name = text(form, "nome");
  const email = text(form, "email").toLowerCase();
  const role = text(form, "papel");
  const password = text(form, "senha");
  if (email === "" || name === "" || !ROLES.has(role)) redirect("/admin/usuarios?erro=dados");
  if (password !== "" && password.length < 12) redirect("/admin/usuarios?erro=senha");
  if (password === "") redirect("/admin/usuarios?erro=senha");

  const user = await createAdminUser({ email, name, role: role as "admin" | "catalog" | "content" | "integrations" | "viewer", password });
  await writeAudit({
    actor,
    action: "usuario:salvar",
    entity: "admin_user",
    entityId: user.id,
    detail: { email, papel: role },
  });
  redirect("/admin/usuarios?ok=salvo");
}

export async function alternarUsuario(form: FormData): Promise<void> {
  const actor = await requirePermission("users:write");
  const id = text(form, "id");
  const active = bool(form, "ativo");
  if (id === actor.id && !active) redirect("/admin/usuarios?erro=proprio-usuario");
  await setAdminUserActive(id, active);
  await writeAudit({ actor, action: `usuario:${active ? "ativar" : "desativar"}`, entity: "admin_user", entityId: id });
  redirect("/admin/usuarios?ok=salvo");
}

export async function trocarPapel(form: FormData): Promise<void> {
  const actor = await requirePermission("users:write");
  const id = text(form, "id");
  const role = text(form, "papel");
  if (!ROLES.has(role)) redirect("/admin/usuarios?erro=dados");
  if (id === actor.id && role !== "admin") redirect("/admin/usuarios?erro=proprio-usuario");
  await setAdminUserRole(id, role as "admin" | "catalog" | "content" | "integrations" | "viewer");
  await writeAudit({ actor, action: "usuario:papel", entity: "admin_user", entityId: id, detail: { papel: role } });
  redirect("/admin/usuarios?ok=salvo");
}

export async function revogarSessoesDoUsuario(form: FormData): Promise<void> {
  const actor = await requirePermission("users:write");
  const id = text(form, "id");
  const revoked = await revokeUserSessions(id);
  await writeAudit({ actor, action: "usuario:revogar-sessoes", entity: "admin_user", entityId: id, detail: { sessoes: revoked } });
  redirect(`/admin/usuarios?ok=sessoes&revogadas=${String(revoked)}`);
}

/** Produto comparável: jogo base, edição, DLC ou bundle (PRD §7.1, §12.2). */
export async function salvarProduto(form: FormData): Promise<void> {
  const user = await requirePermission("products:write");
  const gameId = text(form, "jogoId");
  const kind = text(form, "tipo");
  const platform = text(form, "plataforma");
  const kindValue = kind === "edition" || kind === "dlc" || kind === "bundle" ? kind : "base";
  const platformValue =
    platform === "steam" || platform === "epic" || platform === "gog" || platform === "xbox" ? platform : "other";
  const product = await upsertProduct({
    gameId,
    kind: kindValue,
    editionName: kindValue === "edition" ? optional(form, "edicao") : null,
    platform: platformValue,
    requiresProductId: optional(form, "requer"),
  });
  await writeAudit({
    actor: user,
    action: "produto:salvar",
    entity: "product",
    entityId: product.id,
    detail: { jogo: gameId, tipo: product.kind, plataforma: product.platform },
  });
  redirect(`/admin/jogos/${gameId}?ok=produto`);
}

export async function alternarProduto(form: FormData): Promise<void> {
  const user = await requirePermission("products:write");
  const gameId = text(form, "jogoId");
  const id = text(form, "id");
  const published = bool(form, "publicado");
  await setProductPublished(id, published);
  await writeAudit({
    actor: user,
    action: `produto:${published ? "publicar" : "ocultar"}`,
    entity: "product",
    entityId: id,
  });
  redirect(`/admin/jogos/${gameId}?ok=produto`);
}

/** Segundo fator (PRD §12.1): gerar segredo, confirmar com um código e desligar exigindo código. */
export async function gerarSegredoMfa(): Promise<void> {
  const user = await requireUser("/admin/seguranca");
  await storeMfaSecret(user.id, generateTotpSecret());
  await writeAudit({ actor: user, action: "usuario:mfa-gerar", entity: "admin_user", entityId: user.id });
  redirect("/admin/seguranca?ok=gerado");
}

export async function confirmarMfa(form: FormData): Promise<void> {
  const user = await requireUser("/admin/seguranca");
  const state = await mfaState(user.id);
  const code = text(form, "codigo");
  if (state === null || state.secret === null) redirect("/admin/seguranca?erro=sem-segredo");
  if (!verifyTotp(state.secret, code)) redirect("/admin/seguranca?erro=codigo");

  await enableMfa(user.id);
  await writeAudit({ actor: user, action: "usuario:mfa-ativar", entity: "admin_user", entityId: user.id });
  redirect("/admin/seguranca?ok=ativo");
}

export async function desativarMfaAction(form: FormData): Promise<void> {
  const user = await requireUser("/admin/seguranca");
  const code = text(form, "codigo");
  if (!(await verifyUserTotp(user.id, code))) redirect("/admin/seguranca?erro=codigo");
  await disableMfa(user.id);
  await writeAudit({ actor: user, action: "usuario:mfa-desativar", entity: "admin_user", entityId: user.id });
  redirect("/admin/seguranca?ok=desligado");
}

/** Cria jogo pelo painel (CAT-004): slug vem do título e não pode repetir. */
export async function criarJogo(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const title = text(form, "titulo");
  const slug = slugify(text(form, "slug") === "" ? title : text(form, "slug"));
  if (title === "" || slug === "") redirect("/admin/jogos?erro=jogo");

  const existing = await findGameBySlug(slug);
  if (existing !== null) redirect(`/admin/jogos?erro=slug&slug=${encodeURIComponent(slug)}`);

  const game = await upsertGame({
    slug,
    title,
    originalTitle: optional(form, "tituloOriginal"),
    releaseDate: optional(form, "lancamento"),
    genres: list(form, "generos"),
    published: false,
  });
  await writeAudit({ actor: user, action: "jogo:criar", entity: "game", entityId: game.id, detail: { slug, titulo: title } });
  redirect(`/admin/jogos/${game.id}?ok=criado`);
}

/** Banner da home (STO-001): criar, editar, publicar e remover. */
export async function salvarBanner(form: FormData): Promise<void> {
  const user = await requirePermission("home:write");
  const id = optional(form, "id");
  const title = text(form, "titulo");
  if (title === "") redirect("/admin/home?erro=banner");
  const banner = await upsertBanner({
    ...(id === null ? {} : { id }),
    gameId: optional(form, "jogoId"),
    eyebrow: optional(form, "sobretitulo"),
    title,
    subtitle: optional(form, "subtitulo"),
    ctaLabel: optional(form, "cta"),
    position: Number(text(form, "posicao") || "0"),
    published: bool(form, "publicado"),
  });
  await writeAudit({ actor: user, action: "home:banner", entity: "home_banner", entityId: banner.id, detail: { titulo: title } });
  redirect("/admin/home?ok=banner");
}

export async function alternarBanner(form: FormData): Promise<void> {
  const user = await requirePermission("home:write");
  const id = text(form, "id");
  const published = bool(form, "publicado");
  await setBannerPublished(id, published);
  await writeAudit({ actor: user, action: `home:banner-${published ? "publicar" : "ocultar"}`, entity: "home_banner", entityId: id });
  redirect("/admin/home?ok=banner");
}

export async function removerBanner(form: FormData): Promise<void> {
  const user = await requirePermission("home:write");
  const id = text(form, "id");
  await deleteBanner(id);
  await writeAudit({ actor: user, action: "home:banner-remover", entity: "home_banner", entityId: id });
  redirect("/admin/home?ok=banner");
}

/** De-para do feed: uma linha por campo, `canonico=nome_na_fonte`. */
function lerMapaDeCampos(value: string): { map: Record<string, string>; errors: string[] } {
  const map: Record<string, string> = {};
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const [canonical, ...rest] = trimmed.split("=");
    const sourceField = rest.join("=").trim();
    if (canonical === undefined || sourceField === "") return { map, errors: [`linha inválida: "${trimmed}"`] };
    map[canonical.trim()] = sourceField;
  }
  return { map, errors: validateFieldMap(map) };
}

/** Nova fonte por URL de feed, ou atualização da existente (OFR-008). */
export async function salvarFonte(form: FormData): Promise<void> {
  const user = await requirePermission("sources:write");
  const slug = slugify(text(form, "slug") === "" ? text(form, "nome") : text(form, "slug"));
  const name = text(form, "nome");
  const existing = await getSourceBySlug(slug);
  const feedUrl = bool(form, "removerFeed") ? null : optional(form, "feedUrl") ?? existing?.feedUrl ?? null;
  if (slug === "" || name === "") redirect("/admin/fontes?erro=fonte");
  if (feedUrl !== null) {
    try {
      await assertPublicFeedUrl(feedUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      redirect(message.includes("https") ? "/admin/fontes?erro=feed-https" : "/admin/fontes?erro=feed-rede");
    }
  }

  const { map, errors } = lerMapaDeCampos(text(form, "mapa"));
  if (errors.length > 0) redirect(`/admin/fontes?erro=mapa&detalhe=${encodeURIComponent(errors[0] ?? "")}`);

  const source = await upsertSource({
    slug,
    name,
    kind: text(form, "tipo") === "page" ? "page" : "feed",
    maxAgeHours: Number(text(form, "validade") || "24"),
    access: feedUrl === null ? "unknown" : "partner-feed",
    format:
      text(form, "formato") === "csv"
        ? "csv"
        : text(form, "formato") === "json"
          ? "json"
          : text(form, "formato") === "xml"
            ? "xml"
            : "unknown",
    coversBrl: bool(form, "cobreBrl"),
    cadenceHours: Number(text(form, "cadencia") || "24"),
    feedUrl,
    fieldMap: map,
    status: "evaluating",
    notes: optional(form, "observacoes"),
  });
  await writeAudit({
    actor: user,
    action: "fonte:salvar",
    entity: "source",
    entityId: source.id,
    detail: { slug, feed: feedUrl === null ? null : redactUrl(feedUrl) },
  });
  redirect("/admin/fontes?ok=fonte");
}

/** Catálogo em arquivo (PRD §12.2): exportar o que existe agora. */
export async function exportarCatalogo(): Promise<void> {
  const user = await requirePermission("games:write");
  const games = await listAllGames();
  await writeAudit({ actor: user, action: "catalogo:exportar", entity: "game", entityId: null, detail: { jogos: games.length } });
  const body = serializeCatalogFile(games, new Date());
  await redirect(`/admin/jogos/exportar?arquivo=catalogo.json&conteudo=${encodeURIComponent(body)}`);
}

/** Prévia da importação: lê o arquivo, mostra o que entra, o que muda e o que está errado. Nada grava aqui. */
export async function preverImportacaoCatalogo(form: FormData): Promise<void> {
  await requirePermission("games:write");
  const file = form.get("arquivo");
  if (!(file instanceof File) || file.size === 0) redirect("/admin/jogos?erro=arquivo");
  if (file.size > 5_000_000) redirect("/admin/jogos?erro=arquivo-grande");
  const conteudo = await file.text();
  const target = new URLSearchParams({ arquivo: file.name, conteudo });
  redirect(`/admin/jogos/importar?${target.toString()}`);
}

/** Confirma a prévia: grava tudo em uma transação, ou nada. */
export async function confirmarImportacaoCatalogo(form: FormData): Promise<void> {
  const user = await requirePermission("games:write");
  const conteudo = text(form, "conteudo");
  if (conteudo === "") redirect("/admin/jogos?erro=arquivo");
  const { entries, issues } = parseCatalogFile(conteudo);
  if (issues.length > 0 || entries.length === 0) redirect("/admin/jogos?erro=arquivo-invalido");
  const result = await applyCatalogImport(entries);
  await writeAudit({
    actor: user,
    action: "catalogo:importar",
    entity: "game",
    entityId: null,
    detail: { jogos: result.applied.length, recusados: result.failed.length },
  });
  redirect(`/admin/jogos?ok=importado&jogos=${String(result.applied.length)}`);
}
