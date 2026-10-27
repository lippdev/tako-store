import { discountPercent, formatBRL } from "@tako/domain";
import { cx } from "@/lib/cx";
import styles from "./Preco.module.css";

interface PrecoProps {
  priceCents: number;
  referencePriceCents: number | null;
  /** `sm` nos cards; `md` na página do jogo. */
  size?: "sm" | "md";
  /** Mostra "menor preço entre as ofertas acompanhadas" ao lado. */
  withNote?: boolean;
}

/**
 * Preço com referência e desconto. O desconto só aparece quando existe preço de referência confiável e maior que
 * o atual (PRD §10.3) — a mesma regra do domínio, não uma conta feita na tela.
 */
export function Preco({ priceCents, referencePriceCents, size = "sm", withNote = false }: PrecoProps) {
  const discount = discountPercent(priceCents, referencePriceCents);
  return (
    <div className={cx(styles["row"], styles[size])}>
      <span className={styles["price"]}>{formatBRL(priceCents)}</span>
      {discount !== null && (
        <>
          <span className={styles["from"]}>{formatBRL(referencePriceCents ?? 0)}</span>
          <span className={styles["discount"]}>-{String(discount)}%</span>
        </>
      )}
      {withNote && <span className={styles["note"]}>menor preço entre as ofertas acompanhadas</span>}
    </div>
  );
}
