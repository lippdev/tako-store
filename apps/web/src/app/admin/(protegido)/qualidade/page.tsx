import Link from "next/link";
import { integrationHealth, qualityIssues } from "@tako/db";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Painel de qualidade (PRD §12.7): cada item leva para a tela que resolve. */
export default async function QualidadePage() {
  const [issues, health] = await Promise.all([qualityIssues(), integrationHealth()]);

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Qualidade</h1>
          <p>O que está publicado pela metade, vencido ou fora de regra.</p>
        </div>
      </div>

      <section className={styles["card"]}>
        {issues.length === 0 ? (
          <p className={styles["muted"]}>Nada apontado agora.</p>
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
        <h2>Integrações</h2>
        <p className={styles["muted"]}>
          Saúde publicada em <code>/api/health</code> — é o que o monitor externo consulta (OPS-001). Ofertas vencidas
          continuam contadas no banco; falha de fonte aparece aqui com nome e número.
        </p>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Ativa</th>
              <th>Última execução</th>
              <th>Falhas seguidas</th>
              <th>Erros abertos</th>
            </tr>
          </thead>
          <tbody>
            {health.sources.map((source) => (
              <tr key={source.slug}>
                <td>{source.name}</td>
                <td className={styles["muted"]}>{source.enabled ? "sim" : "não"}</td>
                <td className={styles["muted"]}>
                  {source.lastRunAt === null ? "nunca" : new Date(source.lastRunAt).toLocaleString("pt-BR")}
                </td>
                <td className={source.consecutiveFailures > 0 ? styles["warnText"] : styles["muted"]}>
                  {source.consecutiveFailures}
                </td>
                <td className={styles["muted"]}>{source.openErrors}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles["muted"]}>
          {health.staleOffers} oferta(s) vencida(s) · {health.openErrors} erro(s) aberto(s) ·{" "}
          {health.failingSources} fonte(s) falhando · última execução bem-sucedida:{" "}
          {health.lastSuccessfulRun === null ? "nenhuma" : new Date(health.lastSuccessfulRun).toLocaleString("pt-BR")}
        </p>
      </section>

      <section className={styles["card"]}>
        <h2>Como ler isto</h2>
        <p className={styles["muted"]}>
          Ofertas vencidas continuam no banco e no histórico, mas não disputam o selo de menor preço nem aparecem como
          preço atual. Jogo publicado sem arte ou sem descrição existe, mas não vende.
        </p>
      </section>
    </>
  );
}
