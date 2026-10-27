import Link from "next/link";
import { listAllGames } from "@tako/db";
import { publicarJogo } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Lista de jogos do painel, com publicar/ocultar/arquivar por linha (CAT-004). */
export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; filtro?: string }>;
}) {
  const { ok, filtro } = await searchParams;
  const games = await listAllGames();
  const filtered = games.filter((game) => {
    if (filtro === "publicados") return game.published;
    if (filtro === "ocultos") return !game.published;
    if (filtro === "sem-capa") return game.published && game.media.cover === null;
    if (filtro === "sem-descricao") return game.published && (game.description === null || game.description === "");
    return true;
  });

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Jogos</h1>
          <p>{filtered.length} de {games.length} jogos</p>
        </div>
        <div className={styles["actions"]}>
          <Link className={styles["secondary"]} href="/admin/jogos?filtro=publicados" style={{ padding: "9px 14px", textDecoration: "none" }}>
            Publicados
          </Link>
          <Link className={styles["secondary"]} href="/admin/jogos?filtro=ocultos" style={{ padding: "9px 14px", textDecoration: "none" }}>
            Ocultos
          </Link>
          <Link className={styles["secondary"]} href="/admin/jogos" style={{ padding: "9px 14px", textDecoration: "none" }}>
            Todos
          </Link>
        </div>
      </div>
      {ok !== undefined && <div className={styles["ok"]}>Alteração registrada.</div>}

      <section className={styles["card"]}>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Estado</th>
              <th>Gêneros</th>
              <th>Atualizado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((game) => (
              <tr key={game.id}>
                <td>
                  <Link href={`/admin/jogos/${game.id}`}>{game.title}</Link>
                  <div className={styles["muted"]}>{game.slug}</div>
                </td>
                <td>
                  <span className={`${styles["badge"]} ${game.published ? styles["published"] : styles["hidden"]}`}>
                    {game.published ? "publicado" : "oculto"}
                  </span>
                </td>
                <td className={styles["muted"]}>{game.genres.join(", ")}</td>
                <td className={styles["muted"]}>{new Date(game.updatedAt).toLocaleDateString("pt-BR")}</td>
                <td>
                  <form action={publicarJogo} className={styles["actions"]}>
                    <input type="hidden" name="id" value={game.id} />
                    <button
                      type="submit"
                      name="acao"
                      value={game.published ? "ocultar" : "publicar"}
                      className={styles["secondary"]}
                    >
                      {game.published ? "Ocultar" : "Publicar"}
                    </button>
                    <button type="submit" name="acao" value="arquivar" className={styles["danger"]}>
                      Arquivar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className={styles["muted"]}>Nenhum jogo com esse filtro.</p>}
      </section>
    </>
  );
}
