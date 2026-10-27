import Link from "next/link";
import type { ReactNode } from "react";
import { Marca } from "@/components/Marca/Marca";
import { requireUser } from "@/server/session";
import { sair } from "../actions";
import styles from "../admin.module.css";

const NAV = [
  ["/admin", "Visão geral"],
  ["/admin/jogos", "Jogos"],
  ["/admin/vinculos", "Vínculos"],
  ["/admin/ofertas", "Ofertas"],
  ["/admin/lojas", "Lojas"],
  ["/admin/fontes", "Fontes"],
  ["/admin/home", "Home"],
  ["/admin/qualidade", "Qualidade"],
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
