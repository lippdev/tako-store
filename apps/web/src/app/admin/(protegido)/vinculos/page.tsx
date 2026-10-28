import { listAllGames, listMappingQueue, listProducts } from "@tako/db";
import { ACTIVATION_PLATFORMS } from "@tako/domain";
import { decidirVinculo, vinculosEmLote } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Fila de revisão de vínculos: produto da fonte ao lado do que a Tako sugere (PRD §12.3). */
export default async function VinculosPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const [suggested, pending, games, products] = await Promise.all([
    listMappingQueue("suggested"),
    listMappingQueue("pending"),
    listAllGames(),
    listProducts(),
  ]);
  const rows = [...suggested, ...pending];
  const gameTitle = new Map(games.map((game) => [game.id, game.title]));

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Vínculos</h1>
          <p>{rows.length} produto(s) da fonte aguardando decisão. Nome parecido sozinho não confirma vínculo.</p>
        </div>
      </div>
      {ok !== undefined && <div className={styles["ok"]}>Vínculo atualizado.</div>}

      {rows.length === 0 ? (
        <section className={styles["card"]}>
          <p className={styles["muted"]}>Nenhum vínculo pendente. A importação traz a fila quando houver ambiguidade.</p>
        </section>
      ) : (
        rows.map((row) => (
          <section key={row.id} className={styles["card"]}>
            <div className={styles["grid2"]}>
              <div>
                <h2>Da fonte</h2>
                <p className={styles["muted"]}>
                  {row.externalTitle}
                  {row.edition !== null && ` · edição ${row.edition}`} · {row.platform} · {row.region}
                </p>
                <p className={styles["muted"]}>
                  {row.sourceName} · id {row.externalId}
                </p>
              </div>
              <div>
                <h2>Sugestão da Tako</h2>
                <p>{row.suggestedGameTitle ?? "sem sugestão"}</p>
                <p className={styles["muted"]}>
                  confiança {row.confidence ?? "—"} · {row.reason ?? "sem motivo registrado"}
                </p>
              </div>
            </div>
            <form action={decidirVinculo} className={styles["form"]} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={row.id} />
              <div className={styles["grid2"]}>
                <label className={styles["field"]}>
                  <span>Vincular ao produto</span>
                  <select name="produtoId" defaultValue={row.suggestedProductId ?? ""}>
                    <option value="">Não vincular</option>
                    {products
                      .filter((product) => product.published)
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {gameTitle.get(product.gameId) ?? "jogo"} · {product.kind}
                          {product.editionName === null ? "" : ` ${product.editionName}`} · {product.platform}
                        </option>
                      ))}
                  </select>
                </label>
                <label className={styles["field"]}>
                  <span>Marcar para o lote</span>
                  <input type="checkbox" name="marcado" value={row.id} />
                </label>
              </div>
              <p className={styles["muted"]}>
                Sem produto na lista? Escolha o jogo e o produto é criado já vinculado, oculto até você publicar.
              </p>
              <div className={styles["grid2"]}>
                <label className={styles["field"]}>
                  <span>Novo produto do jogo</span>
                  <select name="novoJogoId" defaultValue="">
                    <option value="">—</option>
                    {games.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles["field"]}>
                  <span>Tipo</span>
                  <select name="novoTipo" defaultValue="base">
                    <option value="base">Jogo base</option>
                    <option value="edition">Edição</option>
                    <option value="dlc">DLC</option>
                    <option value="bundle">Pacote</option>
                  </select>
                </label>
                <label className={styles["field"]}>
                  <span>Nome da edição</span>
                  <input name="novoEdicao" placeholder="Deluxe" />
                </label>
                <label className={styles["field"]}>
                  <span>Plataforma</span>
                  <select name="novoPlataforma" defaultValue={row.platform in ACTIVATION_PLATFORMS ? row.platform : "other"}>
                    {ACTIVATION_PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles["actions"]}>
                <button type="submit" name="decisao" value="aprovar" className={styles["primary"]}>
                  Aprovar vínculo
                </button>
                <button type="submit" name="decisao" value="rejeitar" className={styles["danger"]}>
                  Rejeitar
                </button>
                <button type="submit" name="decisao" value="pendente" className={styles["secondary"]}>
                  Deixar para depois
                </button>
              </div>
            </form>
          </section>
        ))
      )}

      {rows.length > 0 && (
        <section className={styles["card"]}>
          <h2>Lote dos marcados</h2>
          <p className={styles["muted"]}>
            Aplica a decisão a todo vínculo marcado com "Marcar para o lote". A ação repete a mesma escolha de produto
            sugerido — confira a coluna antes de aplicar.
          </p>
          <form action={vinculosEmLote} className={styles["form"]}>
            <div className={styles["actions"]}>
              <button type="submit" name="decisao" value="aprovar" className={styles["primary"]}>
                Aprovar marcados
              </button>
              <button type="submit" name="decisao" value="rejeitar" className={styles["danger"]}>
                Rejeitar marcados
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
