import Link from "next/link";
import { parseCatalogFile, planCatalogImport, type CatalogIssue } from "@tako/domain";
import { listAllGames } from "@tako/db";
import { confirmarImportacaoCatalogo } from "../../../actions";
import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

const ROTULO: Record<string, string> = {
  json: "o arquivo não é JSON válido",
  formato: "o arquivo não é do formato tako-catalogo",
  versao: "a versão do arquivo não é a desta Tako Store",
  jogos: '"jogos" precisa ser uma lista',
  slug: "slug inválido",
  titulo: "título faltando",
  titulosAlternativos: "títulos alternativos não são uma lista de textos",
  desenvolvedoras: "desenvolvedoras não é uma lista de textos",
  distribuidoras: "distribuidoras não é uma lista de textos",
  generos: "gêneros não é uma lista de textos",
  plataformas: "plataforma fora da lista conhecida",
  sistemas: "sistema fora da lista conhecida",
  lancamento: "data de lançamento não é aaaa-mm-dd",
  publicado: '"publicado" precisa ser verdadeiro ou falso',
  duplicado: "slug repetido no arquivo",
};

function motivo(issue: CatalogIssue): string {
  const base = ROTULO[issue.code] ?? issue.code;
  return `jogo ${issue.index + 1}: ${base}${issue.message.startsWith('"') || issue.message.startsWith("slug") ? ` — ${issue.message}` : ""}`;
}

/** Prévia da importação (PRD §12.2): nada gravou ainda. Confere, mostra e só aplica com o botão. */
export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivo?: string; conteudo?: string }>;
}) {
  const { arquivo, conteudo } = await searchParams;
  const games = await listAllGames();
  const parsed = conteudo === undefined ? null : parseCatalogFile(conteudo);
  const plan = parsed === null || parsed.entries.length === 0 ? null : planCatalogImport(games, parsed.entries);

  if (conteudo === undefined || parsed === null) {
    return (
      <div className={styles["head"]}>
        <h1 className="page-title">Importar catálogo</h1>
        <p className={styles["muted"]}>Nada chegou. Volte e escolha um arquivo.</p>
        <Link href="/admin/jogos" className={styles["secondary"]}>
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Prévia da importação</h1>
          <p>
            Arquivo <code>{arquivo ?? "sem nome"}</code>. Nada foi gravado ainda — confira antes de aplicar.
          </p>
        </div>
      </div>

      {parsed.issues.length > 0 && (
        <section className={styles["card"]}>
          <h2>{String(parsed.issues.length)} problema(s) que impedem a importação</h2>
          <p className={styles["muted"]}>
            Corrija no arquivo e importe de novo. Os jogos sem problema não entram enquanto houver erro na lista.
          </p>
          <ul>
            {parsed.issues.slice(0, 20).map((issue, position) => (
              <li key={`${String(issue.index)}-${String(position)}`} className={styles["muted"]}>
                {motivo(issue)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan !== null && (
        <section className={styles["card"]}>
          <h2>O que o arquivo faz</h2>
          <p className={styles["muted"]}>
            {plan.created.length} novo(s) · {plan.updated.length} a alterar · {plan.unchanged.length} sem mudança
          </p>
          {plan.created.length > 0 && (
            <>
              <h3>Novos</h3>
              <ul>
                {plan.created.slice(0, 10).map((entry) => (
                  <li key={entry.slug} className={styles["muted"]}>
                    {entry.title} <code>({entry.slug})</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {plan.updated.length > 0 && (
            <>
              <h3>Alterados</h3>
              <ul>
                {plan.updated.slice(0, 10).map((entry) => (
                  <li key={entry.slug} className={styles["muted"]}>
                    {entry.title} <code>({entry.slug})</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {parsed.issues.length === 0 && plan !== null && (
        <section className={styles["card"]}>
          <form action={confirmarImportacaoCatalogo} className={styles["form"]}>
            <input type="hidden" name="conteudo" value={conteudo} />
            <div className={styles["actions"]}>
              <button type="submit" className={styles["primary"]}>
                Aplicar {String(plan.created.length + plan.updated.length)} jogo(s)
              </button>
              <Link href="/admin/jogos" className={styles["secondary"]}>
                Cancelar
              </Link>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
