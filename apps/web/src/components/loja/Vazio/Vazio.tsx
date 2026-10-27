import type { ReactNode } from "react";
import styles from "./Vazio.module.css";

/** Estado vazio com a marca: sem arte, sem oferta, sem resultado (PRD §11.2 e §11.4). */
export function Vazio({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles["empty"]}>
      <img src="/brand/tako-mark.png" alt="" width={72} height={58} />
      <p className="title">{title}</p>
      {children !== undefined && <p className="body">{children}</p>}
    </div>
  );
}
