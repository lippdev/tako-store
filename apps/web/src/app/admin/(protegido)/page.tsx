import Link from "next/link";
import { listAllGames, listIngestionRuns, listMappingQueue, listProducts, listSources, listStores, qualityIssues } from "@tako/db";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/** Visão geral do painel: números do catálogo e o que a qualidade está apontando (PRD §12.7). */
export default async function PainelPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const [games, products, stores, sources, suggested, pending, issues, runs] = await Promise.all([
    listAllGames(),
    listProducts(),
    listStores(),
    listSources(),
    listMappingQueue("suggested"),
    listMappingQueue("pending"),
    qualityIssues(),
    listIngestionRuns(5),
  ]);

  const active = games.filter((game) => !game.archived);
  const published = active.filter((game) => game.published).length;
  const failing = sources.filter((source) => !source.enabled).length;

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Visão geral</h1>
          <p>Catálogo, integrações e o que precisa de atenção.</p>
        </div>
      </div>
      {erro === "permissao" && <div className={styles["error"]}>Seu perfil não tem permissão para essa ação.</div>}

      <div className={styles["stats"]}>
        <div className={styles["stat"]}>
          <span>Jogos publicados</span>
          <strong>{published}</strong>
        </div>
        <div className={styles["stat"]}>
          <span>Jogos no catálogo</span>
          <strong>{active.length}</strong>
        </div>
        <div className={styles["stat"]}>
          <span>Produtos</span>
          <strong>{products.length}</strong>
        </div>
        <div className={styles["stat"]}>
          <span>Lojas</span>
          <strong>{stores.length}</strong>
        </div>
        <div className={styles["stat"]}>
          <span>Vínculos a revisar</span>
          <strong>{suggested.length + pending.length}</strong>
        </div>
        <div className={styles["stat"]}>
          <span>Fontes pausadas</span>
          <strong>{failing}</strong>
        </div>
      </div>

      <section className={styles["card"]}>
        <h2>Precisa de atenção</h2>
        {issues.length === 0 ? (
          <p className={styles["muted"]}>Nada apontado agora. A conferência roda a cada abertura do painel.</p>
        ) : (
          issues.map((issue) => (
            <div key={issue.kind} className={styles["issue"]}>
              <div>
                <Link href={issue.href}>{issue.label}</Link>
                <p>{issue.detail}</p>
              </div>
              <strong>{issue.count}</strong>
            </div>
          ))
        )}
      </section>

      <section className={styles["card"]}>
        <h2>Últimas importações</h2>
        {runs.length === 0 ? (
          <p className={styles["muted"]}>Nenhuma execução registrada.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Quando</th>
                <th>Recebidas</th>
                <th>Aceitas</th>
                <th>Rejeitadas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.sourceName}</td>
                  <td>{new Date(run.startedAt).toLocaleString("pt-BR")}</td>
                  <td>{run.received}</td>
                  <td>{run.accepted}</td>
                  <td>{run.rejected}</td>
                  <td>
                    <span className={`${styles["badge"]} ${run.status === "success" ? styles["published"] : styles["warn"]}`}>
                      {run.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles["muted"]} style={{ marginTop: 12 }}>
          <Link href="/admin/fontes">Ver fontes e executar importação</Link>
        </p>
      </section>
    </>
  );
}
