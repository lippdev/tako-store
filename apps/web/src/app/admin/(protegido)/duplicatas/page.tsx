import Link from "next/link";
import { archivedGamesForMerge, duplicateCandidates, listGameMerges } from "@tako/db";
import { mergeImpactLabel } from "@tako/domain";
import { unirJogos } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Revisão de duplicatas (CAT-008): candidatos, impacto da união e o histórico do que já foi unido. */
export default async function DuplicatasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const [groups, merges, archived] = await Promise.all([
    duplicateCandidates(),
    listGameMerges(25),
    archivedGamesForMerge(10),
  ]);

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Duplicatas</h1>
          <p>
            O candidato sai do título normalizado — sem acento e sem caixa. A decisão é sua: nada é unido
            automaticamente, e a união fica no histórico.
          </p>
        </div>
      </div>
      {ok === "uniao" && <div className={styles["ok"]}>Jogos unidos; o duplicado está arquivado.</div>}
      {erro !== undefined && <div className={styles["error"]}>{erro}</div>}

      <section className={styles["card"]}>
        <h2>Candidatos</h2>
        {groups.length === 0 ? (
          <p className={styles["muted"]}>
            Nenhum par de jogos com o mesmo título. Quando dois registros aparecerem com o título parecido, eles
            aparecem aqui para revisão.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className={styles["group"]}>
              <strong>{group.games.map((game) => game.title).join(" · ")}</strong>
              <p className={styles["muted"]}>{group.reason}</p>
              <ul className={styles["groupList"]}>
                {group.games.map((game, index) => (
                  <li key={game.id}>
                    <Link href={`/admin/jogos/${game.id}`}>{game.title}</Link> — /{game.slug} ·{" "}
                    {mergeImpactLabel(group.impact[index] ?? { products: 0, offers: 0, externalIdentifiers: 0 })}
                  </li>
                ))}
              </ul>
              <form action={unirJogos} className={styles["form"]}>
                <div className={styles["grid2"]}>
                  <label className={styles["field"]}>
                    <span>Jogo principal (fica)</span>
                    <select name="principalId" required>
                      {group.games.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.title} — /{game.slug}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles["field"]}>
                    <span>Jogo duplicado (é arquivado)</span>
                    <select name="duplicadoId" required defaultValue={group.games[1]?.id ?? ""}>
                      {group.games.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.title} — /{game.slug}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={styles["actions"]}>
                  <button type="submit" className={styles["danger"]}>
                    Unir e arquivar o duplicado
                  </button>
                </div>
              </form>
            </div>
          ))
        )}
      </section>

      <section className={styles["card"]}>
        <h2>Histórico de uniões</h2>
        {merges.length === 0 ? (
          <p className={styles["muted"]}>Nenhuma união registrada.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Duplicado</th>
                <th>Principal</th>
                <th>Impacto</th>
                <th>Quem</th>
              </tr>
            </thead>
            <tbody>
              {merges.map((merge) => (
                <tr key={merge.id}>
                  <td className={styles["muted"]}>{new Date(merge.createdAt).toLocaleString("pt-BR")}</td>
                  <td>
                    {merge.duplicateTitle}
                    <div className={styles["muted"]}>/{merge.duplicateSlug}</div>
                  </td>
                  <td>
                    <Link href={`/admin/jogos/${merge.survivorId}`}>{merge.survivorTitle}</Link>
                  </td>
                  <td className={styles["muted"]}>
                    {merge.impact.productsMoved} produto(s) movido(s) · {merge.impact.productsKept} mantido(s) no
                    arquivado · {merge.impact.identifiersMoved} identificador(es) · {merge.impact.mediaMoved} imagem(ns)
                  </td>
                  <td className={styles["muted"]}>{merge.actorEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles["card"]}>
        <h2>Jogos arquivados</h2>
        <p className={styles["muted"]}>
          A união não apaga: o duplicado fica arquivado com o que não pôde ser movido, para o histórico de preço
          continuar existindo.
        </p>
        {archived.length === 0 ? (
          <p className={styles["muted"]}>Nenhum jogo arquivado.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Jogo</th>
                <th>Produtos</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((game) => (
                <tr key={game.id}>
                  <td>
                    {game.title}
                    <div className={styles["muted"]}>/{game.slug}</div>
                  </td>
                  <td className={styles["muted"]}>{game.products}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
