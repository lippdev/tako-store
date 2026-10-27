import { CartaoDeJogo } from "../CartaoDeJogo/CartaoDeJogo";
import type { GameCard } from "@/server/shop";
import styles from "./Fileira.module.css";

/** Fileira de jogos da home: título, subtítulo e a grade. Vazia, não é renderizada (PRD §11.1). */
export function Fileira({ title, subtitle, cards }: { title: string; subtitle?: string | null; cards: GameCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className={styles["row"]} aria-label={title}>
      <header className={styles["head"]}>
        <h2 className="title">{title}</h2>
        {subtitle !== null && subtitle !== undefined && <p className="label-sm">{subtitle}</p>}
      </header>
      <div className={styles["grid"]}>
        {cards.map((card, index) => (
          <CartaoDeJogo key={card.game.id} card={card} priority={index < 4} />
        ))}
      </div>
    </section>
  );
}
