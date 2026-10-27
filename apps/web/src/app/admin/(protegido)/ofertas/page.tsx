import { clicksByOffer, listAllGames, listOffersForProducts, listProducts, listSources, listStores } from "@tako/db";
import { evaluateOffer, formatBRL } from "@tako/domain";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const MOTIVOS: Record<string, string> = {
  "invalid-price": "preço inválido",
  "inactive-store": "loja desativada",
  "inactive-source": "fonte desativada",
  "wrong-region": "fora da região",
  "wrong-currency": "outra moeda",
  unavailable: "indisponível",
  "unknown-availability": "disponibilidade desconhecida",
  stale: "preço vencido",
  "wrong-platform": "plataforma diferente",
};

/** Todas as ofertas com o veredito da mesma regra que a loja usa — nada de explicação paralela. */
export default async function OfertasPage() {
  const [games, products, stores, sources] = await Promise.all([
    listAllGames(),
    listProducts(),
    listStores(),
    listSources(),
  ]);
  const offers = await listOffersForProducts(products.map((product) => product.id));
  const clicks = await clicksByOffer(30);

  const storeById = new Map(stores.map((store) => [store.id, store]));
  const context = {
    region: "BR",
    currency: "BRL",
    now: new Date(),
    stores: storeById,
    sources: new Map(sources.map((source) => [source.id, source])),
  };
  const gameOfProduct = new Map(products.map((product) => [product.id, product.gameId]));
  const gameTitle = new Map(games.map((game) => [game.id, game.title]));

  const evaluated = offers
    .map((offer) => ({
      offer,
      verdict: evaluateOffer(offer, context),
      store: storeById.get(offer.storeId)?.name ?? "loja removida",
      game: gameTitle.get(gameOfProduct.get(offer.productId) ?? "") ?? "produto sem jogo",
    }))
    .sort((a, b) => a.offer.observedAt.localeCompare(b.offer.observedAt));

  const elegiveis = evaluated.filter((row) => row.verdict.eligible).length;

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Ofertas</h1>
          <p>
            {offers.length} ofertas, {elegiveis} elegíveis hoje (Brasil, BRL, dentro do prazo da fonte).
          </p>
        </div>
      </div>

      <section className={styles["card"]}>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Jogo</th>
              <th>Loja</th>
              <th>Preço</th>
              <th>Observada</th>
              <th>Cliques (30 d)</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {evaluated.map(({ offer, verdict, store, game }) => (
              <tr key={offer.id}>
                <td>{game}</td>
                <td className={styles["muted"]}>{store}</td>
                <td>{formatBRL(offer.priceCents)}</td>
                <td className={styles["muted"]}>{new Date(offer.observedAt).toLocaleString("pt-BR")}</td>
                <td className={styles["muted"]}>{clicks.get(offer.id) ?? 0}</td>
                <td>
                  {verdict.eligible ? (
                    <span className={`${styles["badge"]} ${styles["published"]}`}>elegível</span>
                  ) : (
                    <span className={`${styles["badge"]} ${styles["warn"]}`}>
                      {verdict.reasons.map((reason) => MOTIVOS[reason] ?? reason).join(", ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {offers.length === 0 && <p className={styles["muted"]}>Nenhuma oferta importada ainda.</p>}
      </section>
    </>
  );
}
