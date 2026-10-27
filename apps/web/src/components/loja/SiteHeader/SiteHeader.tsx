import Link from "next/link";
import { Marca } from "@/components/Marca/Marca";
import { SearchBox } from "../SearchBox/SearchBox";
import styles from "./SiteHeader.module.css";

/** Barra de cima da loja: marca, navegação e busca em toda página (PRD §11.1). */
export function SiteHeader() {
  return (
    <header className={styles["header"]}>
      <div className={styles["inner"]}>
        <Link href="/" className={styles["brand"]} aria-label="Tako Store, início">
          <Marca />
        </Link>
        <nav className={styles["nav"]} aria-label="Navegação principal">
          <Link href="/jogos">Catálogo</Link>
          <Link href="/jogos?promo=1&ordem=discount">Ofertas</Link>
          <Link href="/jogos?ordem=release">Lançamentos</Link>
        </nav>
        <SearchBox />
      </div>
    </header>
  );
}
