"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteNav.module.css";

const LINKS = [
  { href: "/jogos", label: "Catálogo", match: (path: string) => path === "/jogos" || path.startsWith("/jogo/") },
  { href: "/jogos?promo=1&ordem=discount", label: "Ofertas", match: () => false },
  { href: "/jogos?ordem=release", label: "Lançamentos", match: () => false },
] as const;

/** Navegação principal com `aria-current`: quem usa leitor de tela sabe em que seção está (STO-006). */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className={styles["nav"]} aria-label="Navegação principal">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={link.match(pathname) ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
