import Link from "next/link";
import type { ReactNode } from "react";
import { can } from "@tako/db";
import { Marca } from "@/components/Marca/Marca";
import { requireUser } from "@/server/session";
import { sair } from "../actions";
import styles from "../admin.module.css";

const NAV = [
  ["/admin", "Visão geral"],
  ["/admin/jogos", "Jogos"],
  ["/admin/duplicatas", "Duplicatas"],
  ["/admin/vinculos", "Vínculos"],
  ["/admin/ofertas", "Ofertas"],
  ["/admin/lojas", "Lojas"],
  ["/admin/fontes", "Fontes"],
  ["/admin/home", "Home"],
  ["/admin/qualidade", "Qualidade"],
  ["/admin/auditoria", "Auditoria"],
] as const;

/** Casca do painel: só entra quem tem sessão; o papel é verificado em cada ação. */
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className={styles["shell"]}>
      <aside className={styles["side"]}>
        <Link href="/" className={styles["brand"]} aria-label="Tako Store">
          <Marca />
        </Link>
        <nav className={styles["nav"]} aria-label="Seções do painel">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          {can(user.role, "users:write") && <Link href="/admin/usuarios">Usuários</Link>}
          <Link href="/admin/seguranca">Segurança</Link>
        </nav>
        <div className={styles["sideFoot"]}>
          <span>
            {user.name} · {user.role}
          </span>
          <form action={sair}>
            <button type="submit">Sair</button>
          </form>
        </div>
      </aside>
      <main className={styles["main"]}>{children}</main>
    </div>
  );
}
