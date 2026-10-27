import Link from "next/link";
import { Marca } from "@/components/Marca/Marca";
import { SearchBox } from "../SearchBox/SearchBox";
import { SiteNav } from "../SiteNav/SiteNav";
import styles from "./SiteHeader.module.css";

/** Barra de cima da loja: marca, navegação e busca em toda página (PRD §11.1). */
export function SiteHeader() {
  return (
    <header className={styles["header"]}>
      <div className={styles["inner"]}>
        <Link href="/" className={styles["brand"]} aria-label="Tako Store, início">
          <Marca />
        </Link>
        <SiteNav />
        <SearchBox />
      </div>
    </header>
  );
}
