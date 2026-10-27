import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatBRL, productLabel, type Game } from "@tako/domain";
import { Fileira } from "@/components/loja/Fileira/Fileira";
import { Preco } from "@/components/loja/Preco/Preco";
import { Vazio } from "@/components/loja/Vazio/Vazio";
import { gameDetail, loadShop, type ShopData } from "@/server/shop";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function findGame(slug: string): Promise<{ shop: ShopData; game: Game | null }> {
  const shop = await loadShop();
  return { shop, game: shop.games.find((candidate) => candidate.slug === slug) ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { game } = await findGame(slug);
  if (game === null) return { title: "Jogo não encontrado" };
  const description = game.description ?? `Ofertas de ${game.title} no Brasil, comparadas pela Tako Store.`;
  return {
    title: game.title,
    description,
    alternates: { canonical: `/jogo/${game.slug}` },
    openGraph: {
      title: game.title,
      description,
      images: game.media.hero === null ? [] : [{ url: game.media.hero }],
      type: "website",
    },
  };
}

function idade(iso: string): string {
  const hours = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return "agora";
  if (hours === 1) return "há 1 hora";
  if (hours < 24) return `há ${String(hours)} horas`;
  const days = Math.round(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${String(days)} dias`;
}

/** Página do jogo: metadados, produtos e ofertas elegíveis (STO-003). */
export default async function JogoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { shop, game } = await findGame(slug);
  if (game === null) notFound();

  const detail = gameDetail(shop, game);
  const bestOverall = detail.products
    .flatMap((product) => (product.best === null ? [] : [product.best]))
    .sort((a, b) => a.offer.priceCents - b.offer.priceCents)[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.description ?? undefined,
    datePublished: game.releaseDate ?? undefined,
    genre: game.genres,
    image: game.media.cover ?? undefined,
    publisher: game.publishers.map((name) => ({ "@type": "Organization", name })),
    author: game.developers.map((name) => ({ "@type": "Organization", name })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className={styles["game"]}>
        <div className={styles["hero"]}>
          {game.media.cover !== null && (
            <img className={styles["cover"]} src={game.media.cover} alt={`Capa de ${game.title}`} width={300} height={450} />
          )}
          <div className={styles["info"]}>
            <p className="overline">{game.genres.join(" · ")}</p>
            <h1 className="page-title">{game.title}</h1>
            {bestOverall !== undefined && bestOverall !== null && (
              <div className={styles["bestPrice"]}>
                <Preco
                  priceCents={bestOverall.offer.priceCents}
                  referencePriceCents={bestOverall.offer.referencePriceCents}
                  size="md"
                  withNote
                />
                <span className={styles["bestStore"]}>
                  {bestOverall.store.name} · atualizado {idade(bestOverall.offer.observedAt)}
                </span>
              </div>
            )}
            {game.description !== null && <p className={styles["description"]}>{game.description}</p>}
            <dl className={styles["meta"]}>
              {game.developers.length > 0 && (
                <div>
                  <dt>Desenvolvedora</dt>
                  <dd>{game.developers.join(", ")}</dd>
                </div>
              )}
              {game.publishers.length > 0 && (
                <div>
                  <dt>Distribuidora</dt>
                  <dd>{game.publishers.join(", ")}</dd>
                </div>
              )}
              {game.releaseDate !== null && (
                <div>
                  <dt>Lançamento</dt>
                  <dd>{new Date(game.releaseDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</dd>
                </div>
              )}
              <div>
                <dt>Ativação</dt>
                <dd>{game.platforms.join(", ")}</dd>
              </div>
              {game.operatingSystems.length > 0 && (
                <div>
                  <dt>Sistemas</dt>
                  <dd>{game.operatingSystems.join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <section className={styles["offers"]} aria-label="Ofertas">
          <h2 className="title">Ofertas acompanhadas</h2>
          {detail.products.length === 0 && (
            <Vazio title="Nenhum produto cadastrado">Este jogo ainda não tem produto comparável publicado.</Vazio>
          )}
          {detail.products.map(({ product, offers }) => (
            <div key={product.id} className={styles["product"]}>
              <header className={styles["productHead"]}>
                <h3 className="label-lg">{productLabel(game, product)}</h3>
                <span className="label-sm">Ativação {product.platform}</span>
              </header>
              {offers.length === 0 ? (
                <p className={styles["noOffers"]}>
                  Sem oferta atualizada para este produto. O último preço conhecido não é mostrado como atual.
                </p>
              ) : (
                <ul className={styles["list"]}>
                  {offers.map(({ offer, store, discount }) => (
                    <li key={offer.id} className={styles["offer"]}>
                      <div className={styles["store"]}>
                        <span className="label">{store.name}</span>
                        <span className={styles["age"]}>atualizado {idade(offer.observedAt)}</span>
                      </div>
                      <div className={styles["price"]}>
                        <span className={styles["value"]}>{formatBRL(offer.priceCents)}</span>
                        {discount !== null && (
                          <>
                            <span className={styles["from"]}>{formatBRL(offer.referencePriceCents ?? 0)}</span>
                            <span className={styles["badge"]}>-{String(discount)}%</span>
                          </>
                        )}
                        {offer.conditions.coupon !== null && (
                          <span className={styles["condition"]}>com cupom {offer.conditions.coupon}</span>
                        )}
                        {offer.conditions.subscription !== null && (
                          <span className={styles["condition"]}>para assinantes</span>
                        )}
                      </div>
                      <a
                        className={styles["go"]}
                        href={`/ir/${offer.id}`}
                        target="_blank"
                        rel="nofollow sponsored noopener"
                      >
                        Ir para a loja
                      </a>
                      {store.attribution !== null && <p className={styles["attribution"]}>{store.attribution}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <p className={styles["note"]}>
            “Menor preço entre as ofertas acompanhadas”: a Tako Store não afirma ser o menor preço da internet. A compra
            é concluída no site da loja.
          </p>
        </section>
      </article>

      {detail.related.length > 0 && (
        <div className={styles["related"]}>
          <Fileira title="Parecidos com este" cards={detail.related} />
        </div>
      )}

      <p className={styles["back"]}>
        <Link href="/jogos">Voltar ao catálogo</Link>
      </p>
    </>
  );
}
