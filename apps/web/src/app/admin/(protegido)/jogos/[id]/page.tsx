import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameById, listOffersForProduct, listProducts } from "@tako/db";
import { formatBRL } from "@tako/domain";
import { publicarJogo, salvarJogo } from "../../../actions";
import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

/** Cadastro do jogo: campos, imagens, publicação e os produtos (CAT-004, CAT-005). */
export default async function JogoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const game = await getGameById(id);
  if (game === null) notFound();

  const products = (await listProducts()).filter((product) => product.gameId === game.id);
  const offersByProduct = await Promise.all(
    products.map(async (product) => ({ product, offers: await listOffersForProduct(product.id) })),
  );

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">{game.title}</h1>
          <p>
            {game.published ? "Publicado" : "Oculto"} · atualizado em {new Date(game.updatedAt).toLocaleString("pt-BR")} ·{" "}
            <Link href={`/jogo/${game.slug}`}>ver na loja</Link>
          </p>
        </div>
        <form action={publicarJogo} className={styles["actions"]}>
          <input type="hidden" name="id" value={game.id} />
          <button type="submit" name="acao" value={game.published ? "ocultar" : "publicar"} className={styles["secondary"]}>
            {game.published ? "Ocultar" : "Publicar"}
          </button>
          <button type="submit" name="acao" value="arquivar" className={styles["danger"]}>
            Arquivar
          </button>
        </form>
      </div>
      {ok !== undefined && <div className={styles["ok"]}>Jogo salvo.</div>}

      <section className={styles["card"]}>
        <h2>Dados do jogo</h2>
        <form action={salvarJogo} className={styles["form"]}>
          <input type="hidden" name="id" value={game.id} />
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Título</span>
              <input name="titulo" defaultValue={game.title} required />
            </label>
            <label className={styles["field"]}>
              <span>Slug (URL)</span>
              <input name="slug" defaultValue={game.slug} required />
            </label>
            <label className={styles["field"]}>
              <span>Título original</span>
              <input name="tituloOriginal" defaultValue={game.originalTitle ?? ""} />
            </label>
            <label className={styles["field"]}>
              <span>Títulos alternativos (separados por vírgula)</span>
              <input name="titulosAlternativos" defaultValue={game.alternativeTitles.join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Lançamento</span>
              <input type="date" name="lancamento" defaultValue={game.releaseDate ?? ""} />
            </label>
            <label className={styles["field"]}>
              <span>Gêneros (separados por vírgula)</span>
              <input name="generos" defaultValue={game.genres.join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Desenvolvedoras</span>
              <input name="desenvolvedoras" defaultValue={game.developers.join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Distribuidoras</span>
              <input name="distribuidoras" defaultValue={game.publishers.join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Capa (URL)</span>
              <input name="capa" defaultValue={game.media.cover ?? ""} />
            </label>
            <label className={styles["field"]}>
              <span>Fundo (URL)</span>
              <input name="fundo" defaultValue={game.media.hero ?? ""} />
            </label>
          </div>
          <label className={styles["field"]}>
            <span>Descrição</span>
            <textarea name="descricao" defaultValue={game.description ?? ""} />
          </label>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Salvar
            </button>
          </div>
        </form>
      </section>

      <section className={styles["card"]}>
        <h2>Produtos e ofertas</h2>
        {products.length === 0 ? (
          <p className={styles["muted"]}>Nenhum produto cadastrado para este jogo.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Plataforma</th>
                <th>Ofertas</th>
                <th>Menor preço</th>
              </tr>
            </thead>
            <tbody>
              {offersByProduct.map(({ product, offers }) => {
                const cheapest = [...offers].sort((a, b) => a.priceCents - b.priceCents)[0];
                return (
                  <tr key={product.id}>
                    <td>
                      {product.kind === "edition" ? `Edição ${product.editionName ?? ""}` : product.kind}
                      {product.requiresProductId !== null && <div className={styles["muted"]}>requer o jogo base</div>}
                    </td>
                    <td className={styles["muted"]}>{product.platform}</td>
                    <td className={styles["muted"]}>{offers.length}</td>
                    <td>{cheapest === undefined ? "—" : formatBRL(cheapest.priceCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
