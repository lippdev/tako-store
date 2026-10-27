import Link from "next/link";
import { listAllGames } from "@tako/db";
import { criarJogo, publicarJogo } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Lista de jogos do painel, com publicar/ocultar/arquivar por linha (CAT-004). */
export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; filtro?: string; erro?: string; slug?: string }>;
}) {
  const { ok, filtro, erro, slug } = await searchParams;
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
      {erro === "slug" && (
        <div className={styles["error"]}>
          Já existe um jogo com o endereço <code>{slug ?? ""}</code>. Troque o slug ou edite o jogo existente.
        </div>
      )}
      {erro === "jogo" && <div className={styles["error"]}>Informe o título do jogo.</div>}

      <section className={styles["card"]}>
        <h2>Novo jogo</h2>
        <p className={styles["muted"]}>
          O jogo nasce oculto; publique depois de completar os dados, as imagens e os produtos. O endereço (slug) sai do
          título e não pode repetir.
        </p>
        <form action={criarJogo} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Título</span>
              <input name="titulo" required placeholder="Nome do jogo" />
            </label>
            <label className={styles["field"]}>
              <span>Slug (opcional)</span>
              <input name="slug" placeholder="vem do título" />
            </label>
            <label className={styles["field"]}>
              <span>Título original (opcional)</span>
              <input name="tituloOriginal" />
            </label>
            <label className={styles["field"]}>
              <span>Lançamento (opcional)</span>
              <input type="date" name="lancamento" />
            </label>
            <label className={styles["field"]}>
              <span>Gêneros (vírgula)</span>
              <input name="generos" placeholder="Aventura, RPG" />
            </label>
          </div>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Criar jogo
            </button>
          </div>
        </form>
      </section>

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
