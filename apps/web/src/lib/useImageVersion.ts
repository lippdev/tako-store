import { useSyncExternalStore } from "react";
import { artRevision, imageVersion, subscribeArt } from "./imageVersions";

// No launcher, uma assinatura por página avisa quando a arte de um jogo é publicada (`art.changed`). A loja ainda
// não tem esse canal: quando tiver, ele chama `artChanged(id)` e as imagens montadas se atualizam sozinhas.

export function useImageVersion(id: string | undefined): number {
  return useSyncExternalStore(subscribeArt, () => imageVersion(id ?? ""));
}

export function useArtRevision(): number {
  return useSyncExternalStore(subscribeArt, artRevision);
}
