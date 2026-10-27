// Busca: maiúsculas, acentos e espaços extras não podem esconder um jogo (PRD §11.2).

/** Dobra o texto para comparação: minúsculas, sem acento, espaços normalizados. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface SearchableGame {
  title: string;
  originalTitle: string | null;
  alternativeTitles: string[];
}

/** Tudo por onde um jogo pode ser encontrado: título, original e alternativos. */
export function searchableTitles(game: SearchableGame): string[] {
  return [game.title, game.originalTitle ?? "", ...game.alternativeTitles].filter((title) => title.trim() !== "");
}

/**
 * O jogo casa com a busca? Todos os termos precisam aparecer em algum dos títulos — "god war" acha
 * "God of War", e "ragnarok" acha "Ragnarök" sem acento.
 */
export function matchesSearch(game: SearchableGame, query: string): boolean {
  const terms = foldText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const titles = searchableTitles(game).map(foldText).join(" ");
  return terms.every((term) => titles.includes(term));
}

/** Quanto o jogo casa: título principal vale mais que alternativo, e prefixo vale mais que meio. */
export function searchScore(game: SearchableGame, query: string): number {
  const terms = foldText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return 0;
  const primary = foldText(game.title);
  const all = searchableTitles(game).map(foldText);
  let score = 0;
  for (const term of terms) {
    if (primary === term) score += 100;
    else if (primary.startsWith(term)) score += 50;
    else if (primary.includes(term)) score += 30;
    else if (all.some((title) => title.startsWith(term))) score += 15;
    else if (all.some((title) => title.includes(term))) score += 5;
  }
  return score;
}
