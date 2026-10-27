import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/Marca/Marca";
import { entrar, entrarComCodigo } from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

/** Login do painel (CAT-002). Formulário sem JavaScript: funciona com o servidor sozinho. */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; destino?: string; mfa?: string; bloqueado?: string }>;
}) {
  const { erro, destino, mfa, bloqueado } = await searchParams;
  const codeStep = mfa === "1";
  return (
    <div className={styles["login"]}>
      <div className={styles["loginCard"]}>
        <Marca />
        <h1>Painel da Tako Store</h1>
        <p>Entre com a conta administrativa.</p>
        {bloqueado !== undefined && (
          <div className={styles["error"]}>
            Tentativas demais em pouco tempo. Aguarde cerca de {bloqueado} minutos antes de tentar de novo.
          </div>
        )}
        {erro !== undefined && (
          <div className={styles["error"]}>
            {codeStep ? "Código incorreto ou vencido. Tente o código atual do aplicativo." : "E-mail ou senha inválidos."}
          </div>
        )}
        {codeStep && erro === undefined && (
          <p className={styles["muted"]}>Esta conta tem segundo fator: informe o código de 6 dígitos do aplicativo.</p>
        )}
        <form action={codeStep ? entrarComCodigo : entrar} className={styles["form"]}>
          <input type="hidden" name="destino" value={destino ?? "/admin"} />
          {codeStep ? (
            <label className={styles["field"]}>
              <span>Código do aplicativo</span>
              <input
                name="codigo"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                autoFocus
              />
            </label>
          ) : (
            <>
              <label className={styles["field"]}>
                <span>E-mail</span>
                <input type="email" name="email" required autoComplete="username" autoFocus />
              </label>
              <label className={styles["field"]}>
                <span>Senha</span>
                <input type="password" name="senha" required autoComplete="current-password" />
              </label>
            </>
          )}
          <button type="submit" className={styles["primary"]}>
            Entrar
          </button>
        </form>
        <p className={styles["muted"]} style={{ marginTop: 20 }}>
          {process.env["DEMO_CATALOG"] !== "0" && <>Demonstração: admin@tako.dev / tako-demo-2026. </>}
          <Link href="/">Voltar à loja</Link>
        </p>
      </div>
    </div>
  );
}
