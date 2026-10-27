import { mfaState, otpauthUrl } from "@tako/db";
import { confirmarMfa, desativarMfaAction, gerarSegredoMfa } from "../../actions";
import { requireUser } from "@/server/session";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Segundo fator da própria conta (PRD §12.1): inscrever, confirmar e desligar. */
export default async function SegurancaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const user = await requireUser("/admin/seguranca");
  const state = await mfaState(user.id);

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Segurança</h1>
          <p>
            Segundo fator por aplicativo autenticador (TOTP, 30 segundos). Com ele ativo, entrar exige a senha e o
            código do aplicativo.
          </p>
        </div>
      </div>
      {ok === "ativo" && <div className={styles["ok"]}>Segundo fator ativo nesta conta.</div>}
      {ok === "desligado" && <div className={styles["ok"]}>Segundo fator desligado.</div>}
      {ok === "gerado" && <div className={styles["ok"]}>Segredo gerado. Confirme com o código do aplicativo.</div>}
      {erro === "codigo" && <div className={styles["error"]}>Código incorreto ou vencido. Tente o código atual.</div>}
      {erro === "sem-segredo" && <div className={styles["error"]}>Gere um segredo antes de confirmar.</div>}

      <section className={styles["card"]}>
        <h2>Estado</h2>
        <p className={styles["muted"]}>
          Conta: {user.email} · segundo fator {state?.enabled === true ? "ativo" : "inativo"}
        </p>
      </section>

      {state?.enabled === true ? (
        <section className={styles["card"]}>
          <h2>Desligar o segundo fator</h2>
          <p className={styles["muted"]}>
            Desligar exige o código atual: quem tem a sessão aberta e não tem o aplicativo não consegue reduzir a
            proteção da conta sozinho.
          </p>
          <form action={desativarMfaAction} className={styles["form"]}>
            <label className={styles["field"]}>
              <span>Código do aplicativo</span>
              <input name="codigo" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
            </label>
            <div className={styles["actions"]}>
              <button type="submit" className={styles["danger"]}>
                Desligar
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          <section className={styles["card"]}>
            <h2>1. Gerar o segredo</h2>
            <p className={styles["muted"]}>
              O segredo aparece uma vez para você cadastrar no aplicativo. Ele não é exibido novamente depois de
              ativado.
            </p>
            <form action={gerarSegredoMfa}>
              <button type="submit" className={styles["primary"]}>
                {state?.secret === null || state?.secret === undefined ? "Gerar segredo" : "Gerar outro segredo"}
              </button>
            </form>
          </section>

          {state?.secret !== null && state?.secret !== undefined && (
            <section className={styles["card"]}>
              <h2>2. Cadastrar no aplicativo</h2>
              <p className={styles["muted"]}>Chave para digitar no aplicativo (base32):</p>
              <p>
                <code>{state.secret}</code>
              </p>
              <p className={styles["muted"]}>Ou o endereço de configuração:</p>
              <p>
                <code>{otpauthUrl({ secret: state.secret, account: user.email })}</code>
              </p>
              <form action={confirmarMfa} className={styles["form"]}>
                <label className={styles["field"]}>
                  <span>3. Código de 6 dígitos do aplicativo</span>
                  <input name="codigo" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
                </label>
                <div className={styles["actions"]}>
                  <button type="submit" className={styles["primary"]}>
                    Ativar segundo fator
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}
