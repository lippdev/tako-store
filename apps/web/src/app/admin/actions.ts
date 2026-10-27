"use server";

import { redirect } from "next/navigation";
import {
  addMediaAsset,
  deleteSection,
  decideMapping,
  finishIngestionRun,
  getGameById,
  listMediaAssets,
  mergeGames,
  removeExternalIdentifier,
  removeMediaAsset,
  replacePrimaryImage,
  setExternalIdentifier,
  setGameVisibility,
  setPrimaryMedia,
  setSectionPublished,
  setSourceEnabled,
  startIngestionRun,
  updateGame,
  updateSourceMatrix,
  upsertSection,
  upsertStore,
  writeAudit,
} from "@tako/db";
import { retryFailedRun } from "@tako/ingest";
import { isMediaKind, normalizeDomain, parseMediaUrl, type HomeRule, type MediaKind } from "@tako/domain";
import { requirePermission, signIn, signOut } from "@/server/session";

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
  const ok = await signIn(email, password);
  redirect(ok ? destination : `/admin/entrar?erro=1&destino=${encodeURIComponent(destination)}`);
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
  const store = await upsertStore({
    slug: text(form, "slug"),
    name: text(form, "nome"),
    partnerStatus:
      partner === "active" || partner === "pending" || partner === "none" || partner === "disabled" ? partner : "none",
    enabled: bool(form, "ativa"),
    allowedDomains: domains,
    linkKind: text(form, "link") === "affiliate" ? "affiliate" : text(form, "link") === "source" ? "source" : "direct",
    attribution: optional(form, "atribuicao"),
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

/** Execução manual do conector de demonstração: registra a execução e o resultado (OFR-006). */
export async function executarImportacao(form: FormData): Promise<void> {
  const user = await requirePermission("sources:write");
  const sourceId = text(form, "id");
  const runId = await startIngestionRun(sourceId, user.email);
  await finishIngestionRun(runId, {
    status: "success",
    received: 0,
    accepted: 0,
    rejected: 0,
    message: "Execução manual registrada; o conector de demonstração roda pelo worker (npm run worker).",
  });
  await writeAudit({ actor: user, action: "fonte:executar", entity: "source", entityId: sourceId, detail: { runId } });
  redirect("/admin/fontes?ok=1");
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
