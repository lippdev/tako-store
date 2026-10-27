import { Marca } from "../../components/Marca/Marca";
import { cx } from "../../lib/cx";
import styles from "./Inicio.module.css";

const FASES = [
  {
    rotulo: "Design",
    titulo: "O sistema do Tako Launcher",
    texto:
      "Tokens, ícones, marca, fontes e a especificação de 90 peças vieram do launcher e moram em design/desktop. O app usa os mesmos componentes React que a galeria mostra.",
    href: "#/componentes",
    acao: "Abrir a galeria",
  },
  {
    rotulo: "Método",
    titulo: "Os skills do lippstack",
    texto:
      "investigate, qa e ship para o trabalho de engenharia; apple-design, break-ui e os outros para o visual. Os arquivos estão em .claude/skills, e o AGENTS.md diz quando abrir cada um.",
    href: "#/dev",
    acao: "Ver a base visual",
  },
  {
    rotulo: "Processo",
    titulo: "Git Flow, commits pequenos",
    texto:
      "main para o que saiu, develop para o que está pronto, feature para o trabalho novo. O CONTRIBUTING.md tem o ciclo inteiro, do branch à release.",
    href: "https://github.com/lippdev/tako-store/blob/develop/CONTRIBUTING.md",
    acao: "Ler o processo",
  },
];

/** Início: o que este repositório é e onde estão as peças que ele adota. */
export function Inicio() {
  return (
    <div className={styles["page"]}>
      <header className={styles["topo"]}>
        <Marca />
        <nav className={styles["acoes"]}>
          <a className="label-sm" href="#/componentes">
            Componentes
          </a>
          <a className="label-sm" href="#/dev">
            Base visual
          </a>
        </nav>
      </header>

      <main className={styles["conteudo"]}>
        <section className={styles["abertura"]}>
          <p className="overline">Tako Store</p>
          <h1 className="page-title">Descobrir jogos e comparar preços, no ecossistema Tako.</h1>
          <p className={cx("body", styles["linha"])}>
            A loja reúne ofertas válidas para o Brasil e mostra o menor preço elegível, sem favorecer loja parceira. A
            compra acontece no site da loja escolhida. Este é o começo do repositório: a fundação com o design system
            do launcher, o método do lippstack e o Git Flow.
          </p>
        </section>

        <section className={styles["cartoes"]}>
          {FASES.map((fase) => (
            <article key={fase.rotulo} className={styles["cartao"]}>
              <p className="label">{fase.rotulo}</p>
              <h2 className={cx("title", styles["titulo"])}>{fase.titulo}</h2>
              <p className={cx("body", styles["texto"])}>{fase.texto}</p>
              <a className="label-lg" href={fase.href}>
                {fase.acao}
              </a>
            </article>
          ))}
        </section>
      </main>

      <footer className={styles["rodape"]}>
        <span className="label-sm">design/desktop · .claude/skills · CONTRIBUTING.md</span>
        <span className="label-sm">1600×900 é a medida do design</span>
      </footer>
    </div>
  );
}
