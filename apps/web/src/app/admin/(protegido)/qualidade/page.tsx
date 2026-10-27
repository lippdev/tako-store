import Link from "next/link";
import { qualityIssues } from "@tako/db";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Painel de qualidade (PRD §12.7): cada item leva para a tela que resolve. */
export default async function QualidadePage() {
  const issues = await qualityIssues();

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
        <h2>Como ler isto</h2>
        <p className={styles["muted"]}>
          Ofertas vencidas continuam no banco e no histórico, mas não disputam o selo de menor preço nem aparecem como
          preço atual. Jogo publicado sem arte ou sem descrição existe, mas não vende.
        </p>
      </section>
    </>
  );
}
