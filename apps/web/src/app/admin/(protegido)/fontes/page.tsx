import { listIngestionRuns, listSources } from "@tako/db";
import { alternarFonte, executarImportacao } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Fontes e integrações: pausar, executar, ver execuções e falhas (PRD §12.6). */
export default async function FontesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const [sources, runs] = await Promise.all([listSources(), listIngestionRuns(20)]);

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Fontes</h1>
          <p>Cada fonte tem o seu prazo de validade; preço mais velho que o prazo não aparece como atual.</p>
        </div>
      </div>
      {ok !== undefined && <div className={styles["ok"]}>Fonte atualizada.</div>}

      <section className={styles["card"]}>
        <h2>Fontes cadastradas</h2>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Tipo</th>
              <th>Validade</th>
              <th>Última execução</th>
              <th>Falhas seguidas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  {source.name}
                  <div className={styles["muted"]}>{source.slug}</div>
                </td>
                <td className={styles["muted"]}>{source.kind}</td>
                <td className={styles["muted"]}>{source.maxAgeHours} h</td>
                <td className={styles["muted"]}>
                  {runs.find((run) => run.sourceId === source.id)?.startedAt !== undefined
                    ? new Date(runs.find((run) => run.sourceId === source.id)?.startedAt ?? "").toLocaleString("pt-BR")
                    : "nunca"}
                </td>
                <td>
                  <span className={`${styles["badge"]} ${source.enabled ? styles["published"] : styles["warn"]}`}>
                    {source.enabled ? "ativa" : "pausada"}
                  </span>
                </td>
                <td>
                  <div className={styles["actions"]}>
                    <form action={alternarFonte}>
                      <input type="hidden" name="id" value={source.id} />
                      <input type="hidden" name="ativa" value={source.enabled ? "0" : "1"} />
                      <button type="submit" className={styles["secondary"]}>
                        {source.enabled ? "Pausar" : "Retomar"}
                      </button>
                    </form>
                    <form action={executarImportacao}>
                      <input type="hidden" name="id" value={source.id} />
                      <button type="submit" className={styles["secondary"]}>
                        Executar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sources.length === 0 && <p className={styles["muted"]}>Nenhuma fonte cadastrada.</p>}
      </section>

      <section className={styles["card"]}>
        <h2>Execuções</h2>
        {runs.length === 0 ? (
          <p className={styles["muted"]}>Nenhuma execução registrada.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Início</th>
                <th>Por</th>
                <th>Recebidas</th>
                <th>Aceitas</th>
                <th>Rejeitadas</th>
                <th>Erros</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.sourceName}</td>
                  <td className={styles["muted"]}>{new Date(run.startedAt).toLocaleString("pt-BR")}</td>
                  <td className={styles["muted"]}>{run.triggeredBy}</td>
                  <td>{run.received}</td>
                  <td>{run.accepted}</td>
                  <td>{run.rejected}</td>
                  <td className={styles["muted"]}>{run.errors > 0 ? `${String(run.errors)} (ver worker)` : "0"}</td>
                  <td>
                    <span
                      className={`${styles["badge"]} ${
                        run.status === "success" ? styles["published"] : run.status === "failed" ? styles["warn"] : styles["hidden"]
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles["muted"]} style={{ marginTop: 12 }}>
          O conector de demonstração roda pelo worker: <code>npm run worker</code>. A execução manual registra a
          tentativa e o resultado.
        </p>
      </section>
    </>
  );
}
