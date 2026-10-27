"use client";

import { useEffect, useState } from "react";
import { setAppearance, THEMES, useAppearance } from "@/appearance/appearance";
import { demoModules } from "./demos.generated";
import styles from "./Gallery.module.css";

interface DemoModule {
  title: string;
  preview: string;
  Demo: React.ComponentType;
}

/**
 * Galeria de componentes (`/dev/componentes`) para validar cada peça contra a especificação do design system. Cada
 * componente traz a própria demo em `src/components/<Nome>/<Nome>.demo.tsx`, que exporta `title`, o nome da
 * especificação em `design/desktop/components/` (`preview`) e o componente `Demo`.
 */
export function Gallery() {
  const { theme } = useAppearance();
  const [demos, setDemos] = useState<DemoModule[]>([]);

  // As demos chegam sob demanda: a galeria é ferramenta de desenvolvimento e não pesa no aplicativo de verdade.
  useEffect(() => {
    let alive = true;
    void Promise.all(demoModules.map((load) => load())).then((modules) => {
      if (!alive) return;
      setDemos(
        (modules as DemoModule[]).slice().sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className={styles["page"]}>
      <header className={styles["header"]}>
        <h1 className="page-title">Componentes</h1>
        <select
          aria-label="Tema"
          value={theme}
          onChange={(e) => {
            setAppearance({ theme: e.target.value as (typeof THEMES)[number] });
          }}
        >
          {THEMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </header>
      <nav className={styles["index"]}>
        {demos.map((d) => (
          <button
            key={d.title}
            type="button"
            onClick={() => document.getElementById(d.title)?.scrollIntoView()}
          >
            {d.title}
          </button>
        ))}
      </nav>
      {demos.map(({ title, preview, Demo }) => (
        <section key={title} id={title} className={styles["section"]}>
          <h2 className="title">{title}</h2>
          <p className="label-sm">Especificação: design/desktop/components/{preview}/README.md</p>
          <div className={styles["stage"]}>
            <Demo />
          </div>
        </section>
      ))}
      {demos.length === 0 && <p className="body">Carregando as demos…</p>}
    </main>
  );
}
