import Link from "next/link";
import { listAllGames } from "@tako/db";
import {
  BULK_ACTION_LABELS,
  BULK_FILTER_LABELS,
  gamesAffectedByBulk,
  isBulkFilter,
  matchesBulkFilter,
} from "@tako/domain";
import { aplicarLote, criarJogo, exportarCatalogo, preverImportacaoCatalogo, publicarJogo } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Lista de jogos do painel, com publicar/ocultar/arquivar por linha (CAT-004). */
export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; filtro?: string; erro?: string; slug?: string; jogos?: string; acao?: string }>;
}) {
  const { ok, filtro, erro, slug, jogos, acao } = await searchParams;
  const games = await listAllGames();
  const filtroAtivo = isBulkFilter(filtro) ? filtro : undefined;
  const filtered = filtroAtivo === undefined ? games : games.filter((game) => matchesBulkFilter(game, filtroAtivo));

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Jogos</h1>
          <p>{filtered.length} de {games.length} jogos</p>
        </div>
        <div className={styles["actions"]}>
          {Object.entries(BULK_FILTER_LABELS).map(([value, label]) => (
            <Link
              key={value}
              className={styles["secondary"]}
              href={`/admin/jogos?filtro=${value}`}
              style={{ padding: "9px 14px", textDecoration: "none" }}
            >
              {label}
            </Link>
          ))}
          <Link className={styles["secondary"]} href="/admin/jogos" style={{ padding: "9px 14px", textDecoration: "none" }}>
            Todos
          </Link>
        </div>
      </div>
      {ok === "importado" && (
        <div className={styles["ok"]}>Importados {jogos ?? "0"} jogo(s). Imagens e ofertas não mudaram.</div>
      )}
      {ok === "lote" && (
        <div className={styles["ok"]}>
          Em lote ({acao ?? "ação"}): {jogos ?? "0"} jogo(s) atualizado(s).
        </div>
      )}
      {ok === "lote-vazio" && (
        <div className={styles["ok"]}>Nenhum jogo mudou: o conjunto já estava como a ação deixaria.</div>
      )}
      {ok !== undefined && ok !== "importado" && ok !== "lote" && ok !== "lote-vazio" && (
        <div className={styles["ok"]}>Alteração registrada.</div>
      )}
      {erro === "lote" && <div className={styles["error"]}>Ação de lote desconhecida.</div>}
      {erro === "arquivo" && <div className={styles["error"]}>Escolha um arquivo de catálogo.</div>}
      {erro === "arquivo-grande" && <div className={styles["error"]}>O arquivo passa de 5 MB. Divida o catálogo.</div>}
      {erro === "arquivo-invalido" && (
        <div className={styles["error"]}>O arquivo tem erro e não foi aplicado. Veja a prévia para o detalhe.</div>
      )}
      {erro === "slug" && (
        <div className={styles["error"]}>
          Já existe um jogo com o endereço <code>{slug ?? ""}</code>. Troque o slug ou edite o jogo existente.
        </div>
      )}
      {erro === "jogo" && <div className={styles["error"]}>Informe o título do jogo.</div>}

      <section className={styles["card"]}>
        <h2>Catálogo em arquivo</h2>
        <p className={styles["muted"]}>
          Exporta tudo em JSON para editar em massa, e importa de volta com prévia: nada grava antes de você conferir
          o que entra, o que muda e o que está errado.
        </p>
        <form action={exportarCatalogo} className={styles["form"]}>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["secondary"]}>
              Exportar catálogo
            </button>
          </div>
        </form>
        <form action={preverImportacaoCatalogo} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Arquivo para importar</span>
              <input type="file" name="arquivo" accept="application/json,.json" required />
            </label>
          </div>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["secondary"]}>
              Ver prévia
            </button>
          </div>
        </form>
      </section>

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

      <section className={styles["card"]}>
        <h2>Alteração em lote</h2>
        <p className={styles["muted"]}>
          Aplica uma ação em tudo que o filtro escolheu. A prévia mostra exatamente quais jogos mudam antes de gravar —
          jogo que já está como a ação deixaria não entra.
        </p>
        {filtroAtivo === undefined ? (
          <p className={styles["muted"]}>Escolha um filtro em cima para definir o conjunto do lote.</p>
        ) : (
          <>
            <p className={styles["muted"]}>
              Conjunto: <strong>{BULK_FILTER_LABELS[filtroAtivo]}</strong> — {filtered.length} jogo(s).
            </p>
            <div className={styles["actions"]}>
              {(["publicar", "ocultar", "arquivar", "restaurar"] as const).map((acao) => {
                const alvo = gamesAffectedByBulk(games, filtroAtivo, acao);
                return (
                  <form action={aplicarLote} key={acao}>
                    <input type="hidden" name="filtro" value={filtroAtivo} />
                    <input type="hidden" name="acao" value={acao} />
                    <button
                      type="submit"
                      className={styles["secondary"]}
                      disabled={alvo.length === 0}
                      title={alvo.length === 0 ? "Nenhum jogo muda com esta ação" : undefined}
                    >
                      {BULK_ACTION_LABELS[acao]} ({String(alvo.length)})
                    </button>
                  </form>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
