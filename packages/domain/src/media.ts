// Imagem do catálogo (CAT-005): todo endereço é https — ou um caminho servido por esta aplicação, no catálogo de
// demonstração — e toda imagem tem procedência registrada. Sem origem, não entra.

export type MediaKind = "cover" | "hero" | "logo" | "screenshot";

export const MEDIA_KINDS: readonly MediaKind[] = ["cover", "hero", "logo", "screenshot"];

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

export interface MediaAsset {
  id: string;
  gameId: string;
  kind: MediaKind;
  url: string;
  /** De onde a imagem veio: imprensa da distribuidora, site oficial, captura própria. */
  origin: string;
  attribution: string | null;
  position: number;
  createdAt: string;
}

export type MediaUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Aceita https absoluto ou caminho interno (`/covers/x.svg`); recusa `javascript:`, `data:` e afins. */
export function parseMediaUrl(value: string): MediaUrlResult {
  const url = value.trim();
  if (url === "") return { ok: false, error: "informe o endereço da imagem" };
  if (url.startsWith("/")) {
    if (url.startsWith("//")) return { ok: false, error: "endereço de protocolo relativo não é aceito" };
    return { ok: true, url };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "endereço inválido: use https:// ou um caminho interno" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "só endereço https é aceito" };
  return { ok: true, url };
}

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  cover: "Capa",
  hero: "Fundo",
  logo: "Logo",
  screenshot: "Captura",
};

/** Imagens da galeria, na ordem em que aparecem na página do jogo. */
export function galleryAssets(assets: readonly MediaAsset[]): MediaAsset[] {
  return assets
    .filter((asset) => asset.kind === "screenshot")
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

/** A capa/fundo/logo vigente para o jogo: a imagem mais recente daquele tipo na biblioteca. */
export function currentAsset(assets: readonly MediaAsset[], kind: MediaKind): MediaAsset | null {
  const matching = assets
    .filter((asset) => asset.kind === kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return matching[0] ?? null;
}
