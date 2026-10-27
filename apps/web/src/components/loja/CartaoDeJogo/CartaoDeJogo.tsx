import Link from "next/link";
import type { GameCard } from "@/server/shop";
import { Preco } from "../Preco/Preco";
import styles from "./CartaoDeJogo.module.css";

/** Card de jogo: capa, título, loja do menor preço e preço. Sem oferta, o card diz — não inventa valor. */
export function CartaoDeJogo({ card, priority = false }: { card: GameCard; priority?: boolean }) {
  const { game, best } = card;
  return (
    <Link href={`/jogo/${game.slug}`} className={styles["card"]}>
      <span className={styles["cover"]}>
        {game.media.cover === null ? (
          <span className={styles["placeholder"]} aria-hidden="true">
            {game.title.slice(0, 1)}
          </span>
        ) : (
          <img
            src={game.media.cover}
            alt={`Capa de ${game.title}`}
            width={300}
            height={450}
            loading={priority ? "eager" : "lazy"}
          />
        )}
      </span>
      <span className={styles["body"]}>
        <span className={styles["title"]}>{game.title}</span>
        {best === null ? (
          <span className={styles["noOffer"]}>Sem oferta acompanhada</span>
        ) : (
          <>
            <Preco priceCents={best.offer.priceCents} referencePriceCents={best.offer.referencePriceCents} />
            <span className={styles["store"]}>{best.store.name}</span>
          </>
        )}
      </span>
    </Link>
  );
}
