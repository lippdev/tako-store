import { listAllBanners, listAllGames, listAllSections, listDiscountedGames, listHomeVersions, listStores } from "@tako/db";
import {
  alternarBanner,
  alternarSecao,
  removerBanner,
  removerSecao,
  restaurarHome,
  salvarBanner,
  salvarRascunhoHome,
  salvarSecao,
} from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

function descreveRegra(rule: { kind: string } & Record<string, unknown>): string {
  switch (rule.kind) {
    case "manual":
      return `escolha manual (${String((rule["gameIds"] as string[] | undefined)?.length ?? 0)} jogos)`;
    case "discount":
      return `desconto de ${String(rule["minPercent"])}% ou mais`;
    case "below-price":
      return `abaixo de ${String(rule["maxCents"])} centavos`;
    case "genre":
      return `gênero ${String(rule["genre"])}`;
    case "recent":
      return `publicados nos últimos ${String(rule["days"])} dias`;
    case "store":
      return `lojas ${(rule["storeSlugs"] as string[] | undefined)?.join(", ") ?? ""}`;
    default:
      return rule.kind;
  }
}

/** Gestão da home: seções, regra, ordem, janela e publicação (PRD §12.4). */
export default async function HomeAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const [sections, banners, games, stores, versions, promos] = await Promise.all([
    listAllSections(),
    listAllBanners(),
    listAllGames(),
    listStores(),
    listHomeVersions(8),
    listDiscountedGames(),
  ]);

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Home</h1>
          <p>Seção vazia não aparece na loja. A ordem é a posição, do menor para o maior.</p>
        </div>
      </div>
      {(ok !== undefined || erro !== undefined) && (
        <div className={erro === undefined ? styles["ok"] : styles["error"]}>
          {erro === "banner"
            ? "Informe o título do banner."
            : erro === "versao"
              ? "A versão não existe mais."
              : ok === "rascunho"
                ? "Rascunho salvo. A home pública só muda quando você publica."
                : ok === "restaurada"
                  ? "Home restaurada para a versão escolhida."
                  : "Home atualizada."}
        </div>
      )}

      <section className={styles["card"]}>
        <h2>Banner principal</h2>
        <p className={styles["muted"]}>
          <a href="/admin/home/previa">Pré-visualizar a home</a> — mostra tudo, inclusive o oculto, sem publicar nada.
        </p>
        <p className={styles["muted"]}>
          A home mostra até três banners publicados, na ordem da posição. Banner sem jogo leva ao catálogo.
        </p>
        {banners.length === 0 ? (
          <p className={styles["muted"]}>Nenhum banner cadastrado.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Título</th>
                <th>Jogo</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id}>
                  <td className={styles["muted"]}>{banner.position}</td>
                  <td>
                    {banner.title}
                    {banner.eyebrow !== null && <div className={styles["muted"]}>{banner.eyebrow}</div>}
                  </td>
                  <td className={styles["muted"]}>{banner.gameTitle ?? "—"}</td>
                  <td>
                    <span className={`${styles["badge"]} ${banner.published ? styles["published"] : styles["hidden"]}`}>
                      {banner.published ? "publicado" : "oculto"}
                    </span>
                  </td>
                  <td>
                    <div className={styles["actions"]}>
                      <form action={alternarBanner}>
                        <input type="hidden" name="id" value={banner.id} />
                        <input type="hidden" name="publicado" value={banner.published ? "0" : "1"} />
                        <button type="submit" className={styles["secondary"]}>
                          {banner.published ? "Ocultar" : "Publicar"}
                        </button>
                      </form>
                      <form action={removerBanner}>
                        <input type="hidden" name="id" value={banner.id} />
                        <button type="submit" className={styles["danger"]}>
                          Remover
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={salvarBanner} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Título</span>
              <input name="titulo" required />
            </label>
            <label className={styles["field"]}>
              <span>Sobretítulo</span>
              <input name="sobretitulo" placeholder="Em destaque" />
            </label>
            <label className={styles["field"]}>
              <span>Jogo (opcional)</span>
              <select name="jogoId" defaultValue="">
                <option value="">Nenhum (leva ao catálogo)</option>
                {promos.length > 0 && (
                  <optgroup label={`Em promoção agora (${String(promos.length)})`}>
                    {promos.map((promo) => (
                      <option key={promo.id} value={promo.id}>
                        {promo.title} (-{String(promo.discount)}%)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Todos os jogos">
                  {games
                    .filter((game) => game.published && !game.archived && !promos.some((promo) => promo.id === game.id))
                    .map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.title}
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Texto do botão</span>
              <input name="cta" placeholder="Ver o jogo" />
            </label>
            <label className={styles["field"]}>
              <span>Subtítulo</span>
              <input name="subtitulo" />
            </label>
            <label className={styles["field"]}>
              <span>Posição</span>
              <input name="posicao" type="number" defaultValue={banners.length} min={0} />
            </label>
          </div>
          <label className={styles["field"]} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="publicado" defaultChecked />
            <span>Publicar agora</span>
          </label>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Adicionar banner
            </button>
          </div>
        </form>
      </section>

      <section className={styles["card"]}>
        <h2>Seções</h2>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Título</th>
              <th>Regra</th>
              <th>Estado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id}>
                <td className={styles["muted"]}>{section.position}</td>
                <td>
                  {section.title}
                  <div className={styles["muted"]}>{section.slug}</div>
                </td>
                <td className={styles["muted"]}>{descreveRegra(section.rule as { kind: string } & Record<string, unknown>)}</td>
                <td>
                  <span className={`${styles["badge"]} ${section.published ? styles["published"] : styles["hidden"]}`}>
                    {section.published ? "publicada" : "oculta"}
                  </span>
                  {section.endsAt !== null && (
                    <div className={styles["muted"]}>até {new Date(section.endsAt).toLocaleDateString("pt-BR")}</div>
                  )}
                </td>
                <td>
                  <div className={styles["actions"]}>
                    <form action={alternarSecao}>
                      <input type="hidden" name="slug" value={section.slug} />
                      <input type="hidden" name="publicada" value={section.published ? "0" : "1"} />
                      <button type="submit" className={styles["secondary"]}>
                        {section.published ? "Ocultar" : "Publicar"}
                      </button>
                    </form>
                    <form action={removerSecao}>
                      <input type="hidden" name="slug" value={section.slug} />
                      <button type="submit" className={styles["danger"]}>
                        Remover
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sections.length === 0 && <p className={styles["muted"]}>Nenhuma seção cadastrada.</p>}
      </section>

      <section className={styles["card"]}>
        <h2>Nova seção</h2>
        <form action={salvarSecao} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Título</span>
              <input name="titulo" required />
            </label>
            <label className={styles["field"]}>
              <span>Slug</span>
              <input name="slug" required placeholder="em-promocao" />
            </label>
            <label className={styles["field"]}>
              <span>Subtítulo</span>
              <input name="subtitulo" />
            </label>
            <label className={styles["field"]}>
              <span>Posição</span>
              <input type="number" name="posicao" defaultValue={sections.length} min={0} />
            </label>
            <label className={styles["field"]}>
              <span>Regra</span>
              <select name="regra" defaultValue="discount">
                <option value="discount">Desconto mínimo</option>
                <option value="below-price">Preço abaixo de</option>
                <option value="genre">Gênero</option>
                <option value="recent">Publicados recentemente</option>
                <option value="store">De lojas escolhidas</option>
                <option value="manual">Escolha manual</option>
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Desconto mínimo (%)</span>
              <input type="number" name="minPercent" defaultValue={25} min={1} max={90} />
            </label>
            <label className={styles["field"]}>
              <span>Preço abaixo de (R$)</span>
              <input type="number" name="maxReais" defaultValue={50} min={1} />
            </label>
            <label className={styles["field"]}>
              <span>Gênero</span>
              <input name="genero" placeholder="Aventura" />
            </label>
            <label className={styles["field"]}>
              <span>Últimos (dias)</span>
              <input type="number" name="dias" defaultValue={30} min={1} />
            </label>
            <label className={styles["field"]}>
              <span>Lojas (slugs, vírgula)</span>
              <input name="lojas" placeholder={stores.map((store) => store.slug).join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Jogos (ids, vírgula) — para escolha manual</span>
              <input name="jogos" placeholder={games.slice(0, 2).map((game) => game.id).join(", ")} />
            </label>
            <label className={styles["field"]}>
              <span>Termina em (opcional)</span>
              <input type="datetime-local" name="termina" />
            </label>
          </div>
          <label className={styles["field"]} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="publicada" defaultChecked />
            <span>Publicar já</span>
          </label>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Criar seção
            </button>
          </div>
        </form>
      </section>

      <section className={styles["card"]}>
        <h2>Rascunho e histórico</h2>
        <p className={styles["muted"]}>
          Salvar um rascunho guarda a home como está agora, sem mudar o que o público vê. Restaurar devolve o estado
          da versão escolhida e cria uma versão nova com esse estado — o histórico nunca é apagado.
        </p>
        <form action={salvarRascunhoHome} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Nota do rascunho (opcional)</span>
              <input name="nota" placeholder="campanha de julho" />
            </label>
          </div>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["secondary"]}>
              Salvar rascunho
            </button>
          </div>
        </form>
        {versions.length === 0 ? (
          <p className={styles["muted"]}>Nenhuma versão guardada ainda.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Nota</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className={styles["muted"]}>{new Date(version.createdAt).toLocaleString("pt-BR")}</td>
                  <td className={styles["muted"]}>{version.savedBy}</td>
                  <td className={styles["muted"]}>{version.note ?? "—"}</td>
                  <td className={styles["muted"]}>
                    {String(version.state.sections.length)} seção(ões) · {String(version.state.banners.length)} banner(s)
                  </td>
                  <td>
                    <form action={restaurarHome}>
                      <input type="hidden" name="id" value={version.id} />
                      <button type="submit" className={styles["secondary"]}>
                        Restaurar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

    </>
  );
}
