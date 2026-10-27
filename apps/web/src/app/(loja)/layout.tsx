import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/loja/SiteHeader/SiteHeader";
import styles from "./layout.module.css";

/** Casca da loja: barra de cima em toda página e o aviso de que a compra acontece na loja (PRD §8.4). */
export default function LojaLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles["shell"]}>
      <a className={styles["skip"]} href="#conteudo">
        Ir para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" className={styles["main"]} tabIndex={-1}>
        {children}
      </main>
      <footer className={styles["footer"]}>
        <div className={styles["footerInner"]}>
          <p>
            A compra é concluída no site da loja escolhida. A Tako Store compara ofertas acompanhadas e não processa
            pagamento.
          </p>
          <p className={styles["dim"]}>
            Alguns links podem ser de afiliado. A comissão não altera a ordem da comparação por preço.
          </p>
          {process.env["DEMO_CATALOG"] !== "0" && (
            <p className={styles["demo"]}>
              Ambiente de demonstração: jogos, lojas e preços são fictícios.
            </p>
          )}
          <nav className={styles["links"]}>
            <Link href="/jogos">Catálogo</Link>
            <Link href="/privacidade">Privacidade</Link>
            <a href="https://github.com/lippdev/tako-store">Código</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
