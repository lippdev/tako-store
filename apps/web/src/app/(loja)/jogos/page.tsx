import Link from "next/link";
import type { Metadata } from "next";
import { CartaoDeJogo } from "@/components/loja/CartaoDeJogo/CartaoDeJogo";
import { Vazio } from "@/components/loja/Vazio/Vazio";
import { catalog, facets, loadShop, type CatalogParams } from "@/server/shop";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Todos os jogos acompanhados pela Tako Store, com o menor preço elegível para o Brasil.",
  alternates: { canonical: "/jogos" },
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toParams(searchParams: SearchParams): CatalogParams {
  const price = one(searchParams["preco"]);
  const params: CatalogParams = {};
  const q = one(searchParams["q"]);
  if (q !== undefined) params.q = q;
  const genre = one(searchParams["genero"]);
  if (genre !== undefined) params.genero = genre;
  const platform = one(searchParams["plataforma"]);
  if (platform !== undefined) params.plataforma = platform;
  const system = one(searchParams["sistema"]);
  if (system !== undefined) params.sistema = system;
  const store = one(searchParams["loja"]);
  if (store !== undefined) params.loja = store;
  if (price !== undefined && price !== "") params.precoMax = Number(price) * 100;
  if (one(searchParams["promo"]) === "1") params.promo = true;
  const kind = one(searchParams["tipo"]);
  if (kind !== undefined) params.tipo = kind;
  const order = one(searchParams["ordem"]);
  if (order !== undefined) params.ordem = order;
  return params;
}

const TIPOS = [
  ["", "Tudo"],
  ["base", "Jogo base"],
  ["edition", "Edição especial"],
  ["dlc", "DLC"],
  ["bundle", "Pacote"],
] as const;

const ORDENS = [
  ["relevance", "Relevância"],
  ["price", "Menor preço"],
  ["discount", "Maior desconto"],
  ["name", "Nome"],
  ["release", "Lançamento"],
] as const;

const PLATAFORMAS = [
  ["steam", "Steam"],
  ["epic", "Epic Games"],
  ["gog", "GOG"],
  ["xbox", "Xbox"],
  ["other", "Outra"],
] as const;

const SISTEMAS = [
  ["windows", "Windows"],
  ["linux", "Linux"],
  ["macos", "macOS"],
] as const;

/** Catálogo com filtros e ordenação na URL, para o link ser compartilhável (STO-002). */
export default async function JogosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolved = await searchParams;
  const params = toParams(resolved);
  const shop = await loadShop();
  const cards = catalog(shop, params);
  const options = facets(shop);

  return (
    <div className={styles["layout"]}>
      <aside className={styles["filters"]} aria-label="Filtros">
        <h1 className="title">Catálogo</h1>
        <form method="get" action="/jogos" className={styles["form"]}>
          <label>
            <span className="label-sm">Buscar</span>
            <input type="search" name="q" defaultValue={params.q ?? ""} placeholder="Nome do jogo" />
          </label>
          <label>
            <span className="label-sm">Gênero</span>
            <select name="genero" defaultValue={params.genero ?? ""}>
              <option value="">Todos</option>
              {options.genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label-sm">Plataforma de ativação</span>
            <select name="plataforma" defaultValue={params.plataforma ?? ""}>
              <option value="">Todas</option>
              {options.platforms.map((platform) => (
                <option key={platform} value={platform}>
                  {PLATAFORMAS.find(([value]) => value === platform)?.[1] ?? platform}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label-sm">Sistema</span>
            <select name="sistema" defaultValue={params.sistema ?? ""}>
              <option value="">Todos</option>
              {SISTEMAS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label-sm">Loja</span>
            <select name="loja" defaultValue={params.loja ?? ""}>
              <option value="">Todas</option>
              {options.stores.map((store) => (
                <option key={store.slug} value={store.slug}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label-sm">Preço até (R$)</span>
            <input
              type="number"
              name="preco"
              min={1}
              step={1}
              defaultValue={params.precoMax === undefined ? "" : String(Math.round(params.precoMax / 100))}
              placeholder="sem limite"
            />
          </label>
          <label className={styles["check"]}>
            <input type="checkbox" name="promo" value="1" defaultChecked={params.promo === true} />
            <span className="label-sm">Só com desconto</span>
          </label>
          <label>
            <span className="label-sm">Tipo</span>
            <select name="tipo" defaultValue={params.tipo ?? ""}>
              {TIPOS.map(([value, label]) => (
                <option key={value || "tudo"} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label-sm">Ordenar por</span>
            <select name="ordem" defaultValue={params.ordem ?? "relevance"}>
              {ORDENS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["apply"]}>
              Aplicar
            </button>
            <Link href="/jogos" className={styles["clear"]}>
              Limpar
            </Link>
          </div>
        </form>
      </aside>

      <section className={styles["results"]} aria-live="polite">
        <p className="label-sm">
          {cards.length} {cards.length === 1 ? "jogo" : "jogos"}
          {params.q !== undefined && params.q !== "" ? ` para “${params.q}”` : ""}
        </p>
        {cards.length === 0 ? (
          <Vazio title="Nenhum jogo com esses filtros">
            Tente tirar um filtro ou buscar por outro nome. Os preços mostrados são das ofertas acompanhadas hoje.
          </Vazio>
        ) : (
          <div className={styles["grid"]}>
            {cards.map((card) => (
              <CartaoDeJogo key={card.game.id} card={card} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
