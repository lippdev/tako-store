import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGameById,
  listExternalIdentifiersDetailed,
  listMediaAssets,
  listOffersForProduct,
  listProducts,
  listSources,
} from "@tako/db";
import { formatBRL, MEDIA_KINDS, MEDIA_KIND_LABELS } from "@tako/domain";
import {
  publicarJogo,
  removerIdentificador,
  removerImagem,
  salvarIdentificador,
  salvarImagem,
  salvarJogo,
} from "../../../actions";
import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

/** Cadastro do jogo: campos, biblioteca de imagens, identificadores externos e os produtos (CAT-004/005/007). */
export default async function JogoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { ok, erro } = await searchParams;
  const game = await getGameById(id);
  if (game === null) notFound();

  const [products, assets, identifiers, sources] = await Promise.all([
    listProducts(),
    listMediaAssets(game.id),
    listExternalIdentifiersDetailed(game.id),
    listSources(),
  ]);
  const ownProducts = products.filter((product) => product.gameId === game.id);
  const offersByProduct = await Promise.all(
    ownProducts.map(async (product) => ({ product, offers: await listOffersForProduct(product.id) })),
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
      {ok !== undefined && <div className={styles["ok"]}>Alteração registrada.</div>}
      {erro !== undefined && <div className={styles["error"]}>Não foi possível salvar: confira o endereço e a origem.</div>}

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
        <h2>Imagens</h2>
        <p className={styles["muted"]}>
          Toda imagem entra com a origem registrada. Capa, fundo e logo substituem a anterior; capturas entram na
          galeria da página do jogo, na ordem em que foram cadastradas.
        </p>
        {assets.length === 0 ? (
          <p className={styles["muted"]}>Nenhuma imagem na biblioteca deste jogo.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Imagem</th>
                <th>Tipo</th>
                <th>Origem</th>
                <th>Atribuição</th>
                <th>Endereço</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <img src={asset.url} alt="" width={96} height={54} className={styles["thumb"]} />
                  </td>
                  <td>{MEDIA_KIND_LABELS[asset.kind]}</td>
                  <td className={styles["muted"]}>{asset.origin}</td>
                  <td className={styles["muted"]}>{asset.attribution ?? "—"}</td>
                  <td className={styles["muted"]}>
                    <code>{asset.url}</code>
                  </td>
                  <td>
                    <form action={removerImagem}>
                      <input type="hidden" name="id" value={asset.id} />
                      <button type="submit" className={styles["danger"]}>
                        Remover
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={salvarImagem} className={styles["form"]}>
          <input type="hidden" name="jogoId" value={game.id} />
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Tipo</span>
              <select name="tipo" defaultValue="screenshot">
                {MEDIA_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {MEDIA_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Endereço (https ou caminho interno)</span>
              <input name="endereco" required placeholder="https://…" />
            </label>
            <label className={styles["field"]}>
              <span>Origem (de onde veio a imagem)</span>
              <input name="origem" required placeholder="Imprensa da distribuidora" />
            </label>
            <label className={styles["field"]}>
              <span>Atribuição (quando exigida)</span>
              <input name="atribuicao" placeholder="© Estúdio…" />
            </label>
          </div>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Adicionar imagem
            </button>
          </div>
        </form>
      </section>

      <section className={styles["card"]}>
        <h2>Identificadores externos</h2>
        <p className={styles["muted"]}>
          O mesmo jogo costuma ter um identificador por fonte. É por ele que a importação reconhece o título.
        </p>
        {identifiers.length === 0 ? (
          <p className={styles["muted"]}>Nenhum identificador registrado.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Identificador</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {identifiers.map((identifier) => (
                <tr key={`${identifier.sourceId}-${identifier.externalId}`}>
                  <td>
                    {identifier.sourceName}
                    <div className={styles["muted"]}>{identifier.sourceSlug}</div>
                  </td>
                  <td>
                    <code>{identifier.externalId}</code>
                  </td>
                  <td>
                    <form action={removerIdentificador}>
                      <input type="hidden" name="jogoId" value={game.id} />
                      <input type="hidden" name="fonteId" value={identifier.sourceId} />
                      <button type="submit" className={styles["danger"]}>
                        Remover
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={salvarIdentificador} className={styles["form"]}>
          <input type="hidden" name="jogoId" value={game.id} />
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Fonte</span>
              <select name="fonteId" required>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Identificador na fonte</span>
              <input name="identificador" required />
            </label>
          </div>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Associar identificador
            </button>
          </div>
        </form>
      </section>

      <section className={styles["card"]}>
        <h2>Produtos e ofertas</h2>
        {ownProducts.length === 0 ? (
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
