import Link from "next/link";
import { listAudit } from "@tako/db";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Registro de ações administrativas (PRD §12.1): quem fez, o quê, em qual registro e quando. */
export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ entidade?: string }> }) {
  const { entidade } = await searchParams;
  const records = await listAudit(200);
  const filtered = entidade === undefined ? records : records.filter((record) => record.entity === entidade);
  const entities = [...new Set(records.map((record) => record.entity))].sort();

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Auditoria</h1>
          <p>As ações do painel ficam registradas com autor, registro afetado e detalhe. Não se apagam pela interface.</p>
        </div>
      </div>

      <section className={styles["card"]}>
        <nav className={styles["actions"]} aria-label="Filtrar por tipo de registro">
          <Link className={styles["secondary"]} href="/admin/auditoria">
            Tudo
          </Link>
          {entities.map((entity) => (
            <Link key={entity} className={styles["secondary"]} href={`/admin/auditoria?entidade=${encodeURIComponent(entity)}`}>
              {entity}
            </Link>
          ))}
        </nav>
        {filtered.length === 0 ? (
          <p className={styles["muted"]}>Nenhuma ação registrada para este filtro.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Registro</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id}>
                  <td className={styles["muted"]}>{new Date(record.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{record.actorEmail}</td>
                  <td>{record.action}</td>
                  <td className={styles["muted"]}>
                    {record.entity}
                    {record.entityId === null ? "" : ` · ${record.entityId.slice(0, 8)}`}
                  </td>
                  <td className={styles["muted"]}>
                    <code>{record.detail === null ? "—" : JSON.stringify(record.detail).slice(0, 120)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
