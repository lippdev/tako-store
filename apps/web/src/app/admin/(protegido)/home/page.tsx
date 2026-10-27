import { listAllGames, listAllSections, listStores } from "@tako/db";
import { alternarSecao, removerSecao, salvarSecao } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

function descreveRegra(rule: { kind: string } & Record<string, unknown>): string {
  switch (rule.kind) {
    case "manual":
      return `escolha manual (${String((rule["gameIds"] as string[] | undefined)?.length ?? 0)} jogos)`;
    case "discount":
      return `desconto de ${String(rule["minPercent"])}% ou mais`;
    case "below-price":
      return `abaixo de ${String(rule["maxCents"])} centavos`;
    case "genre":
      return `gênero ${String(rule["genre"])}`;
    case "recent":
      return `publicados nos últimos ${String(rule["days"])} dias`;
    case "store":
      return `lojas ${(rule["storeSlugs"] as string[] | undefined)?.join(", ") ?? ""}`;
    default:
      return rule.kind;
  }
}

/** Gestão da home: seções, regra, ordem, janela e publicação (PRD §12.4). */
export default async function HomeAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const [sections, games, stores] = await Promise.all([listAllSections(), listAllGames(), listStores()]);

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Home</h1>
          <p>Seção vazia não aparece na loja. A ordem é a posição, do menor para o maior.</p>
        </div>
      </div>
      {ok !== undefined && <div className={styles["ok"]}>Home atualizada.</div>}

      <section className={styles["card"]}>
        <h2>Seções</h2>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Título</th>
              <th>Regra</th>
              <th>Estado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id}>
                <td className={styles["muted"]}>{section.position}</td>
                <td>
                  {section.title}
                  <div className={styles["muted"]}>{section.slug}</div>
                </td>
                <td className={styles["muted"]}>{descreveRegra(section.rule as { kind: string } & Record<string, unknown>)}</td>
                <td>
                  <span className={`${styles["badge"]} ${section.published ? styles["published"] : styles["hidden"]}`}>
                    {section.published ? "publicada" : "oculta"}
                  </span>
                  {section.endsAt !== null && (
                    <div className={styles["muted"]}>até {new Date(section.endsAt).toLocaleDateString("pt-BR")}</div>
                  )}
                </td>
                <td>
                  <div className={styles["actions"]}>
                    <form action={alternarSecao}>
                      <input type="hidden" name="slug" value={section.slug} />
                      <input type="hidden" name="publicada" value={section.published ? "0" : "1"} />
                      <button type="submit" className={styles["secondary"]}>
                        {section.published ? "Ocultar" : "Publicar"}
                      </button>
                    </form>
                    <form action={removerSecao}>
                      <input type="hidden" name="slug" value={section.slug} />
                      <button type="submit" className={styles["danger"]}>
                        Remover
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sections.length === 0 && <p className={styles["muted"]}>Nenhuma seção cadastrada.</p>}
      </section>

      <section className={styles["card"]}>
        <h2>Nova seção</h2>
        <form action={salvarSecao} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Título</span>
              <input name="titulo" required />
            </label>
            <label className={styles["field"]}>
              <span>Slug</span>
              <input name="slug" required placeholder="em-promocao" />
            </label>
            <label className={styles["field"]}>
              <span>Subtítulo</span>
              <input name="subtitulo" />
            </label>
            <label className={styles["field"]}>
              <span>Posição</span>
              <input type="number" name="posicao" defaultValue={sections.length} min={0} />
            </label>
            <label className={styles["field"]}>
              <span>Regra</span>
              <select name="regra" defaultValue="discount">
                <option value="discount">Desconto mínimo</option>
                <option value="below-price">Preço abaixo de</option>
                <option value="genre">Gênero</option>
                <option value="recent">Publicados recentemente</option>
                <option value="store">De lojas escolhidas</option>
                <option value="manual">Escolha manual</option>
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Desconto mínimo (%)</span>
              <input type="number" name="minPercent" defaultValue={25} min={1} max={90} />
            </label>
            <label className={styles["field"]}>
              <span>Preço abaixo de (R$)</span>
              <input type="number" name="maxReais" defaultValue={50} min={1} />
            </label>
            <label className={styles["field"]}>
              <span>Gênero</span>
              <input name="genero" placeholder="Aventura" />
            </label>
            <label className={styles["field"]}>
              <span>Últimos (dias)</span>
              <input type="number" name="dias" defaultValue={30} min={1} />
            </label>
            <label className={styles["field"]}>
              <span>Lojas (slugs, vírgula)</span>
              <input name="lojas" placeholder={stores.map((store) => store.slug).join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Jogos (ids, vírgula) — para escolha manual</span>
              <input name="jogos" placeholder={games.slice(0, 2).map((game) => game.id).join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Termina em (opcional)</span>
              <input type="datetime-local" name="termina" />
            </label>
          </div>
          <label className={styles["field"]} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="publicada" defaultChecked />
            <span>Publicar já</span>
          </label>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Criar seção
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
