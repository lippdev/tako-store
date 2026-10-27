import { listStores } from "@tako/db";
import { salvarLoja } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const PARCERIAS = [
  ["active", "Parceira ativa"],
  ["pending", "Parceria pendente"],
  ["none", "Sem parceria"],
  ["disabled", "Desativada"],
] as const;

/** Lojas e parcerias: cadastro antes da integração existir (PAR-001, PAR-002, PRD §12.5). */
export default async function LojasPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const stores = await listStores();

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Lojas</h1>
          <p>O estado da parceria é administrativo e não muda a ordem da comparação por preço.</p>
        </div>
      </div>
      {ok !== undefined && <div className={styles["ok"]}>Loja salva.</div>}

      {stores.map((store) => (
        <section key={store.id} className={styles["card"]}>
          <h2>
            {store.name} {store.enabled ? "" : "(desativada)"}
          </h2>
          <form action={salvarLoja} className={styles["form"]}>
            <div className={styles["grid2"]}>
              <label className={styles["field"]}>
                <span>Nome</span>
                <input name="nome" defaultValue={store.name} required />
              </label>
              <label className={styles["field"]}>
                <span>Slug</span>
                <input name="slug" defaultValue={store.slug} required />
              </label>
              <label className={styles["field"]}>
                <span>Parceria</span>
                <select name="parceria" defaultValue={store.partnerStatus}>
                  {PARCERIAS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles["field"]}>
                <span>Tipo de link</span>
                <select name="link" defaultValue={store.linkKind}>
                  <option value="direct">Link direto</option>
                  <option value="affiliate">Afiliado próprio</option>
                  <option value="source">Fornecido pela fonte</option>
                </select>
              </label>
              <label className={styles["field"]}>
                <span>Domínios permitidos (vírgula)</span>
                <input name="dominios" defaultValue={store.allowedDomains.join(", ")} placeholder="loja.com.br" />
              </label>
              <label className={styles["field"]}>
                <span>Atribuição exigida</span>
                <input name="atribuicao" defaultValue={store.attribution ?? ""} placeholder="texto que acompanha o preço" />
              </label>
            </div>
            <label className={styles["field"]} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="ativa" defaultChecked={store.enabled} />
              <span>Loja ativa na loja pública</span>
            </label>
            <div className={styles["actions"]}>
              <button type="submit" className={styles["primary"]}>
                Salvar
              </button>
            </div>
          </form>
        </section>
      ))}

      <section className={styles["card"]}>
        <h2>Nova loja</h2>
        <form action={salvarLoja} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Nome</span>
              <input name="nome" required />
            </label>
            <label className={styles["field"]}>
              <span>Slug</span>
              <input name="slug" required placeholder="nome-da-loja" />
            </label>
            <label className={styles["field"]}>
              <span>Domínios permitidos</span>
              <input name="dominios" placeholder="loja.com.br" />
            </label>
            <label className={styles["field"]}>
              <span>Parceria</span>
              <select name="parceria" defaultValue="none">
                {PARCERIAS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Cadastrar loja
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
