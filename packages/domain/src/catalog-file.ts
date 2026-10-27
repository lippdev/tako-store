// Arquivo de catálogo (PRD §12.2): um JSON documentado para exportar, editar em massa e reimportar.
// As chaves do arquivo são em português porque o arquivo é lido por quem opera a loja; no código, inglês.

import { ACTIVATION_PLATFORMS, OPERATING_SYSTEMS, type ActivationPlatform, type Game, type OperatingSystem } from "./catalog";
import { slugify } from "./affiliate";

export const CATALOG_FILE_FORMAT = "tako-catalogo";
export const CATALOG_FILE_VERSION = 1;

/** Um jogo como ele aparece no arquivo. `null` em descrição e lançamento significa "manter o que existe". */
export interface CatalogEntry {
  slug: string;
  title: string;
  originalTitle: string | null;
  alternativeTitles: string[];
  description: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: ActivationPlatform[];
  operatingSystems: OperatingSystem[];
  published: boolean;
}

export interface CatalogPlan {
  created: CatalogEntry[];
  updated: CatalogEntry[];
  unchanged: CatalogEntry[];
}

export interface CatalogIssue {
  /** Índice do jogo no array `jogos`; -1 quando o problema é do arquivo inteiro. */
  index: number;
  code: string;
  message: string;
}

export interface ParsedCatalog {
  entries: CatalogEntry[];
  issues: CatalogIssue[];
}

/** Exporta o catálogo no formato que `parseCatalogFile` aceita de volta. */
export function serializeCatalogFile(games: readonly Game[], now: Date): string {
  return JSON.stringify(
    {
      formato: CATALOG_FILE_FORMAT,
      versao: CATALOG_FILE_VERSION,
      geradoEm: now.toISOString(),
      jogos: games.map((game) => ({
        slug: game.slug,
        titulo: game.title,
        tituloOriginal: game.originalTitle,
        titulosAlternativos: game.alternativeTitles,
        descricao: game.description,
        lancamento: game.releaseDate,
        desenvolvedoras: game.developers,
        distribuidoras: game.publishers,
        generos: game.genres,
        plataformas: game.platforms,
        sistemas: game.operatingSystems,
        publicado: game.published,
      })),
    },
    null,
    2,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Lista de textos; ausente vira lista vazia, e qualquer item que não seja texto invalida a lista. */
function textList(record: Record<string, unknown>, key: string): string[] | null {
  const value = record[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed !== "" && !items.includes(trimmed)) items.push(trimmed);
  }
  return items;
}

function enumList<T extends string>(record: Record<string, unknown>, key: string, allowed: readonly T[]): T[] | null {
  const values = textList(record, key);
  if (values === null) return null;
  const picked: T[] = [];
  for (const value of values) {
    const match = allowed.find((candidate) => candidate === value.toLowerCase());
    if (match === undefined) return null;
    if (!picked.includes(match)) picked.push(match);
  }
  return picked;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateField(record: Record<string, unknown>, key: string): { ok: boolean; value: string | null } {
  const raw = record[key];
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, value: null };
  const trimmed = raw.trim();
  if (!DATE.test(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) return { ok: false, value: null };
  return { ok: true, value: trimmed };
}

function parseEntry(raw: unknown, index: number, issues: CatalogIssue[]): CatalogEntry | null {
  const issue = (code: string, message: string): null => {
    issues.push({ index, code, message });
    return null;
  };
  const record = asRecord(raw);
  if (record === null) return issue("formato", "cada jogo precisa ser um objeto");

  const slug = textField(record, "slug");
  if (slug === null) return issue("slug", 'informe o "slug" do jogo');
  const normalizado = slugify(slug);
  if (normalizado === "") return issue("slug", `slug sem letras nem números: "${slug}"`);
  if (normalizado !== slug) return issue("slug", `slug precisa ser minúsculo e com hífen: "${slug}" → "${normalizado}"`);

  const title = textField(record, "titulo");
  if (title === null) return issue("titulo", 'informe o "titulo" do jogo');

  const alternativeTitles = textList(record, "titulosAlternativos");
  if (alternativeTitles === null) return issue("titulosAlternativos", '"titulosAlternativos" precisa ser uma lista de textos');
  const developers = textList(record, "desenvolvedoras");
  if (developers === null) return issue("desenvolvedoras", '"desenvolvedoras" precisa ser uma lista de textos');
  const publishers = textList(record, "distribuidoras");
  if (publishers === null) return issue("distribuidoras", '"distribuidoras" precisa ser uma lista de textos');
  const genres = textList(record, "generos");
  if (genres === null) return issue("generos", '"generos" precisa ser uma lista de textos');
  const platforms = enumList(record, "plataformas", ACTIVATION_PLATFORMS);
  if (platforms === null) return issue("plataformas", `"plataformas" aceita: ${ACTIVATION_PLATFORMS.join(", ")}`);
  const operatingSystems = enumList(record, "sistemas", OPERATING_SYSTEMS);
  if (operatingSystems === null) return issue("sistemas", `"sistemas" aceita: ${OPERATING_SYSTEMS.join(", ")}`);
  const release = dateField(record, "lancamento");
  if (!release.ok) return issue("lancamento", '"lancamento" precisa ser uma data aaaa-mm-dd');

  const publishedRaw = record["publicado"];
  if (publishedRaw !== undefined && publishedRaw !== null && typeof publishedRaw !== "boolean") {
    return issue("publicado", '"publicado" precisa ser verdadeiro ou falso');
  }

  return {
    slug,
    title,
    originalTitle: textField(record, "tituloOriginal"),
    alternativeTitles,
    description: textField(record, "descricao"),
    releaseDate: release.value,
    developers,
    publishers,
    genres,
    platforms,
    operatingSystems,
    published: publishedRaw === true,
  };
}

/** Lê o arquivo. Jogo com problema vira issue com índice e código; os válidos seguem para a prévia. */
export function parseCatalogFile(text: string): ParsedCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { entries: [], issues: [{ index: -1, code: "json", message: "o arquivo não é JSON válido" }] };
  }
  const root = asRecord(parsed);
  if (root === null) return { entries: [], issues: [{ index: -1, code: "formato", message: "o arquivo precisa ser um objeto" }] };
  if (root["formato"] !== CATALOG_FILE_FORMAT) {
    return {
      entries: [],
      issues: [{ index: -1, code: "formato", message: `"formato" precisa ser "${CATALOG_FILE_FORMAT}"` }],
    };
  }
  if (root["versao"] !== CATALOG_FILE_VERSION) {
    return {
      entries: [],
      issues: [{ index: -1, code: "versao", message: `"versao" precisa ser ${String(CATALOG_FILE_VERSION)}` }],
    };
  }
  const games = root["jogos"];
  if (!Array.isArray(games)) {
    return { entries: [], issues: [{ index: -1, code: "jogos", message: '"jogos" precisa ser uma lista' }] };
  }

  const issues: CatalogIssue[] = [];
  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();
  games.forEach((raw, index) => {
    const entry = parseEntry(raw, index, issues);
    if (entry === null) return;
    if (seen.has(entry.slug)) {
      issues.push({ index, code: "duplicado", message: `slug repetido no arquivo: "${entry.slug}"` });
      return;
    }
    seen.add(entry.slug);
    entries.push(entry);
  });
  return { entries, issues };
}

function signature(entry: {
  title: string;
  originalTitle: string | null;
  alternativeTitles: string[];
  description: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: readonly string[];
  operatingSystems: readonly string[];
  published: boolean;
}): string {
  return JSON.stringify([
    entry.title,
    entry.originalTitle,
    entry.alternativeTitles,
    entry.description,
    entry.releaseDate,
    entry.developers,
    entry.publishers,
    entry.genres,
    entry.platforms,
    entry.operatingSystems,
    entry.published,
  ]);
}

/** O que o arquivo faria: jogo novo, jogo alterado e jogo que não muda. */
export function planCatalogImport(existing: readonly Game[], entries: readonly CatalogEntry[]): CatalogPlan {
  const bySlug = new Map(existing.map((game) => [game.slug, game]));
  const plan: CatalogPlan = { created: [], updated: [], unchanged: [] };
  for (const entry of entries) {
    const current = bySlug.get(entry.slug);
    if (current === undefined) {
      plan.created.push(entry);
    } else if (signature(current) === signature(entry)) {
      plan.unchanged.push(entry);
    } else {
      plan.updated.push(entry);
    }
  }
  return plan;
}
