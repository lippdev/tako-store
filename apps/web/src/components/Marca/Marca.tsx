import styles from "./Marca.module.css";

interface MarcaProps {
  /** `bar` = polvo, palavra e kana como na barra de cima; `horizontal` = as três peças numa imagem só. */
  variant?: "bar" | "horizontal";
}

/** Marca do Tako. Só sobre fundo escuro (`canvas`, `titlebar`); nunca recolorir nem pôr sobre arte de jogo. */
export function Marca({ variant = "bar" }: MarcaProps) {
  if (variant === "horizontal") {
    return <img className={styles["horizontal"]} src="/brand/tako-logo-horizontal.png" alt="TAKO" />;
  }
  return (
    <span className={styles["bar"]} role="img" aria-label="TAKO">
      <img className={styles["mark"]} src="/brand/tako-mark.png" alt="" />
      <span className={styles["text"]}>
        <img className={styles["word"]} src="/brand/tako-wordmark.png" alt="" />
        <img className={styles["kana"]} src="/brand/tako-kana.png" alt="" />
      </span>
    </span>
  );
}
