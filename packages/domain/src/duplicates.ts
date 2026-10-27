// Duplicatas de jogo (CAT-008): candidatos a união, nunca união automática. Nome parecido sozinho não decide —
// o painel mostra os candidatos e a decisão fica registrada na auditoria.

import { foldText } from "./search";

export interface DuplicateGame {
  id: string;
  title: string;
  originalTitle: string | null;
  alternativeTitles: string[];
  releaseDate: string | null;
  slug: string;
}

export interface DuplicateGroup {
  /** Título normalizado que aproximou os jogos. */
  key: string;
  games: DuplicateGame[];
  /** Por que estão no mesmo grupo, para a tela não só mostrar a lista. */
  reason: string;
}

/**
 * Agrupa jogos pelo título normalizado (principal, original ou alternativo). É heurística de candidato: dois jogos
 * com o mesmo título e anos diferentes ainda são candidatos, e quem decide é a pessoa no painel.
 */
export function groupDuplicates(games: readonly DuplicateGame[]): DuplicateGroup[] {
  const byKey = new Map<string, DuplicateGame[]>();
  for (const game of games) {
    const titles = [game.title, game.originalTitle ?? "", ...game.alternativeTitles]
      .map(foldText)
      .filter((title) => title !== "");
    const keys = new Set(titles);
    for (const key of keys) {
      const list = byKey.get(key) ?? [];
      list.push(game);
      byKey.set(key, list);
    }
  }

  return [...byKey.entries()]
    .filter(([, list]) => new Set(list.map((game) => game.id)).size > 1)
    .map(([key, list]) => ({
      key,
      games: [...new Map(list.map((game) => [game.id, game])).values()],
      reason: "Mesmo título (ou título alternativo) normalizado, sem acento e sem caixa",
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "pt-BR"));
}

/** Quantos produtos e ofertas o jogo duplicado leva junto quando é unido ao principal. */
export interface MergeImpact {
  products: number;
  offers: number;
  externalIdentifiers: number;
}

export function mergeImpactLabel(impact: MergeImpact): string {
  const parts = [
    `${String(impact.products)} produto(s)`,
    `${String(impact.offers)} oferta(s)`,
    `${String(impact.externalIdentifiers)} identificador(es) externo(s)`,
  ];
  return parts.join(" · ");
}
