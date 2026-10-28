// Render da home compartilhado entre a loja pública e a prévia do painel (STO-001, §12.4).
// O que muda é só a fonte dos dados: aqui entram as seções e banners já escolhidos por quem chamou.

import Link from "next/link";
import type { HomeBanner, HomeSection } from "@tako/db";
import { Fileira } from "@/components/loja/Fileira/Fileira";
import { Preco } from "@/components/loja/Preco/Preco";
import { Vazio } from "@/components/loja/Vazio/Vazio";
import { cardFor, homeSections, type ShopData } from "@/server/shop";
import styles from "@/app/(loja)/page.module.css";

export interface HomeViewProps {
  shop: ShopData;
  banners: HomeBanner[];
  sections: HomeSection[];
}

export function HomeView({ shop, banners, sections }: HomeViewProps) {
  const rows = homeSections(shop, sections);
  const heroes = banners.map((banner, index) => {
    const game = banner.gameId === null ? null : (shop.games.find((candidate) => candidate.id === banner.gameId) ?? null);
    return { banner, game, card: game === null ? null : cardFor(shop, game), index };
  });

  return (
    <>
      {heroes.length > 0 && (
        <section className={styles["heroCarousel"]} aria-label="Destaques">
          <ul className={styles["heroTrack"]}>
            {heroes.map(({ banner, game, card, index }) => (
              <li key={banner.id} id={`destaque-${String(index + 1)}`} className={styles["hero"]}>
                {game?.media.hero != null && (
                  <img className={styles["heroArt"]} src={game.media.hero} alt="" aria-hidden="true" />
                )}
                <div className={styles["heroBody"]}>
                  {banner.eyebrow !== null && <p className="overline">{banner.eyebrow}</p>}
                  {index === 0 ? (
                    <h1 className="page-title">{banner.title}</h1>
                  ) : (
                    <h2 className="page-title">{banner.title}</h2>
                  )}
                  {banner.subtitle !== null && <p className={styles["heroText"]}>{banner.subtitle}</p>}
                  <div className={styles["heroActions"]}>
                    {card !== null && (
                      <Link className={styles["cta"]} href={`/jogo/${card.game.slug}`}>
                        {banner.ctaLabel ?? "Ver o jogo"}
                      </Link>
                    )}
                    <Link className={styles["ghost"]} href="/jogos">
                      Ver o catálogo
                    </Link>
                  </div>
                  {card?.best != null && (
                    <Preco
                      priceCents={card.best.offer.priceCents}
                      referencePriceCents={card.best.offer.referencePriceCents}
                      withNote
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {heroes.length > 1 && (
            <nav className={styles["heroDots"]} aria-label="Escolher destaque">
              {heroes.map(({ banner, index }) => (
                <a key={banner.id} href={`#destaque-${String(index + 1)}`} aria-label={`Destaque ${String(index + 1)}: ${banner.title}`} />
              ))}
            </nav>
          )}
        </section>
      )}

      {rows.map(({ section, cards }) => (
        <Fileira key={section.id} title={section.title} subtitle={section.subtitle} cards={cards} />
      ))}

      {rows.length === 0 && (
        <Vazio title="Nada publicado por aqui ainda">
          Assim que houver jogo publicado com oferta acompanhada, ele aparece nesta página.
        </Vazio>
      )}
    </>
  );
}
