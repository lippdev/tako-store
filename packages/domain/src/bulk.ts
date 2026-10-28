// Alteração em lote do catálogo (PRD §12.2): o filtro escolhe o conjunto, a ação diz o que muda, e a prévia mostra
// exatamente quais jogos entram antes de gravar. A mesma função serve a lista e o lote, para as duas telas não
// discordarem sobre quem está "sem capa".

import type { Game } from "./catalog";

export const BULK_FILTERS = ["publicados", "ocultos", "sem-capa", "sem-descricao", "arquivados"] as const;
export type BulkFilter = (typeof BULK_FILTERS)[number];

export const BULK_ACTIONS = ["publicar", "ocultar", "arquivar", "restaurar"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export const BULK_FILTER_LABELS: Record<BulkFilter, string> = {
  publicados: "Publicados",
  ocultos: "Ocultos",
  "sem-capa": "Publicados sem capa",
  "sem-descricao": "Publicados sem descrição",
  arquivados: "Arquivados",
};

export const BULK_ACTION_LABELS: Record<BulkAction, string> = {
  publicar: "Publicar",
  ocultar: "Ocultar",
  arquivar: "Arquivar",
  restaurar: "Desarquivar",
};

export interface BulkChange {
  published?: boolean;
  archived?: boolean;
}

export function isBulkFilter(value: string | undefined): value is BulkFilter {
  return value !== undefined && (BULK_FILTERS as readonly string[]).includes(value);
}

export function isBulkAction(value: string | undefined): value is BulkAction {
  return value !== undefined && (BULK_ACTIONS as readonly string[]).includes(value);
}

export function bulkChange(action: BulkAction): BulkChange {
  switch (action) {
    case "publicar":
      return { published: true, archived: false };
    case "ocultar":
      return { published: false };
    case "arquivar":
      return { published: false, archived: true };
    case "restaurar":
      return { archived: false, published: false };
  }
}

/** O jogo cai no filtro? Arquivado é um balde separado: não conta como publicado nem como oculto. */
export function matchesBulkFilter(game: Game, filter: BulkFilter): boolean {
  switch (filter) {
    case "publicados":
      return game.published && !game.archived;
    case "ocultos":
      return !game.published && !game.archived;
    case "sem-capa":
      return game.published && !game.archived && game.media.cover === null;
    case "sem-descricao":
      return game.published && !game.archived && (game.description === null || game.description === "");
    case "arquivados":
      return game.archived;
  }
}

/** Já está como a ação deixaria? Então não entra na prévia nem na gravação. */
export function bulkWouldChange(game: Game, action: BulkAction): boolean {
  const change = bulkChange(action);
  if (change.published !== undefined && change.published !== game.published) return true;
  if (change.archived !== undefined && change.archived !== game.archived) return true;
  return false;
}

/** Os jogos que a prévia mostra e que a gravação vai tocar. */
export function gamesAffectedByBulk(
  games: readonly Game[],
  filter: BulkFilter,
  action: BulkAction,
): Game[] {
  return games.filter((game) => matchesBulkFilter(game, filter) && bulkWouldChange(game, action));
}
