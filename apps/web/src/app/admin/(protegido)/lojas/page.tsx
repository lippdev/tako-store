import { listStores } from "@tako/db";
import { affiliateMode, templateDomain } from "@tako/domain";
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
export default async function LojasPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
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
      {erro === "afiliado" && (
        <div className={styles["error"]}>
          O parâmetro de afiliado só aceita letras, números, ponto, hífen e sublinhado.
        </div>
      )}
      {erro === "molde" && (
        <div className={styles["error"]}>
          O molde do link precisa conter {"{url}"} e apontar para um domínio permitido desta loja — acrescente o
          domínio da rede de afiliados à lista antes de salvar.
        </div>
      )}

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
              <label className={styles["field"]}>
                <span>Parâmetro de afiliado</span>
                <input name="afiliadoParam" defaultValue={store.affiliateParam ?? ""} placeholder="tag" />
              </label>
              <label className={styles["field"]}>
                <span>Valor do afiliado (sua chave)</span>
                <input
                  name="afiliadoValor"
                  type="password"
                  autoComplete="new-password"
                  placeholder={store.affiliateValue === null ? "tako-20" : "cadastrada — deixe em branco para manter"}
                />
              </label>
              <label className={styles["field"]}>
                <span>Molde do link (opcional, com {"{url}"})</span>
                <input
                  name="afiliadoMolde"
                  autoComplete="off"
                  placeholder={
                    store.affiliateTemplate === null
                      ? "https://loja.example/afiliado?url={url}"
                      : "cadastrado — deixe em branco para manter"
                  }
                />
              </label>
            </div>
            <p className={styles["muted"]}>
              Link em uso:{" "}
              {affiliateMode({
                linkKind: store.linkKind,
                affiliateParam: store.affiliateParam,
                affiliateValue: store.affiliateValue,
                affiliateTemplate: store.affiliateTemplate,
                allowedDomains: store.allowedDomains,
              }) === "template"
                ? `molde (domínio ${templateDomain(store.affiliateTemplate) ?? "—"})`
                : affiliateMode({
                      linkKind: store.linkKind,
                      affiliateParam: store.affiliateParam,
                      affiliateValue: store.affiliateValue,
                      affiliateTemplate: store.affiliateTemplate,
                      allowedDomains: store.allowedDomains,
                    }) === "param"
                  ? `parâmetro ${store.affiliateParam}`
                  : "endereço da oferta, sem marcação"}{" "}
              · domínios permitidos: {store.allowedDomains.join(", ") || "nenhum"}
            </p>
            <p className={styles["muted"]}>
              {store.affiliateValue === null ? "Nenhuma chave cadastrada." : "Chave cadastrada. O valor não volta para a tela."}{" "}
              {store.affiliateTemplate === null
                ? "Nenhum molde cadastrado."
                : `Molde cadastrado (domínio ${templateDomain(store.affiliateTemplate) ?? "—"}). O endereço não volta para a tela.`}
            </p>
            <div className={styles["actions"]}>
              {store.affiliateValue !== null && (
                <label className={styles["field"]} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" name="removerChave" />
                  <span>Remover a chave</span>
                </label>
              )}
              {store.affiliateTemplate !== null && (
                <label className={styles["field"]} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" name="removerMolde" />
                  <span>Remover o molde</span>
                </label>
              )}
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
