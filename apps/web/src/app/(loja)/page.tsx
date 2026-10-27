import Link from "next/link";
import { listLiveBanners, listLiveSections } from "@tako/db";
import { Fileira } from "@/components/loja/Fileira/Fileira";
import { Preco } from "@/components/loja/Preco/Preco";
import { Vazio } from "@/components/loja/Vazio/Vazio";
import { cardFor, homeSections, loadShop } from "@/server/shop";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** Home: banner principal e seções configuradas no painel (STO-001). Seção vazia não aparece. */
export default async function HomePage() {
  const [shop, banners, sections] = await Promise.all([loadShop(), listLiveBanners(), listLiveSections()]);
  const rows = homeSections(shop, sections);
  const hero = banners[0];
  const heroGame = hero?.gameId === null || hero?.gameId === undefined
    ? null
    : (shop.games.find((game) => game.id === hero.gameId) ?? null);
  const heroCard = heroGame === null ? null : cardFor(shop, heroGame);

  return (
    <>
      {hero !== undefined && (
        <section className={styles["hero"]} aria-label="Destaque">
          {heroGame?.media.hero != null && (
            <img className={styles["heroArt"]} src={heroGame.media.hero} alt="" aria-hidden="true" />
          )}
          <div className={styles["heroBody"]}>
            {hero.eyebrow !== null && <p className="overline">{hero.eyebrow}</p>}
            <h1 className="page-title">{hero.title}</h1>
            {hero.subtitle !== null && <p className={styles["heroText"]}>{hero.subtitle}</p>}
            <div className={styles["heroActions"]}>
              {heroCard !== null && (
                <Link className={styles["cta"]} href={`/jogo/${heroCard.game.slug}`}>
                  {hero.ctaLabel ?? "Ver o jogo"}
                </Link>
              )}
              <Link className={styles["ghost"]} href="/jogos">
                Ver o catálogo
              </Link>
            </div>
            {heroCard?.best != null && (
              <Preco priceCents={heroCard.best.offer.priceCents} referencePriceCents={heroCard.best.offer.referencePriceCents} withNote />
            )}
          </div>
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
