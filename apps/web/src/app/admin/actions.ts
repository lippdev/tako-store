"use server";

import { redirect } from "next/navigation";
import {
  deleteSection,
  decideMapping,
  finishIngestionRun,
  getGameById,
  setGameVisibility,
  setSectionPublished,
  setSourceEnabled,
  startIngestionRun,
  updateGame,
  upsertSection,
  upsertStore,
  writeAudit,
} from "@tako/db";
import { normalizeDomain, type HomeRule } from "@tako/domain";
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
    coverUrl: optional(form, "capa"),
    heroUrl: optional(form, "fundo"),
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
