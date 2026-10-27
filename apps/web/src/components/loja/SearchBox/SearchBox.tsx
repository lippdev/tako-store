"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CampoDeBusca } from "@/components/CampoDeBusca/CampoDeBusca";
import styles from "./SearchBox.module.css";

interface Suggestion {
  slug: string;
  title: string;
  price: string | null;
  cover: string | null;
}

/** Busca com sugestões durante a digitação (PRD §11.2): teclado, leitor de tela e Enter para a lista completa. */
export function SearchBox() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (term.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/busca?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => (response.ok ? (response.json() as Promise<{ items: Suggestion[] }>) : { items: [] }))
        .then((data) => {
          setSuggestions(data.items);
          setOpen(true);
        })
        .catch(() => {
          /* busca é opcional: falhou, a pessoa aperta Enter e vai para a lista */
        });
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  const go = (slug?: string) => {
    setOpen(false);
    router.push(slug === undefined ? `/jogos?q=${encodeURIComponent(term)}` : `/jogo/${slug}`);
  };

  return (
    <div className={styles["wrapper"]} ref={container}>
      <CampoDeBusca
        variant="loja"
        value={term}
        onChange={(value) => {
          setTerm(value);
          setActive(-1);
          if (value.trim().length < 2) {
            setSuggestions([]);
            setOpen(false);
          }
        }}
        placeholder="Buscar jogos"
        label="Buscar jogos"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const chosen = suggestions[active];
            go(chosen?.slug);
            return;
          }
          if (event.key === "ArrowDown" && suggestions.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActive((index) => (index + 1) % suggestions.length);
            return;
          }
          if (event.key === "ArrowUp" && suggestions.length > 0) {
            event.preventDefault();
            setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
          }
          if (event.key === "Escape") setOpen(false);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className={styles["list"]} id={listId} role="listbox" aria-label="Sugestões">
          {suggestions.map((item, index) => (
            <li key={item.slug} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={index === active ? styles["active"] : undefined}
                onClick={() => {
                  go(item.slug);
                }}
                onMouseEnter={() => {
                  setActive(index);
                }}
              >
                {item.cover !== null && <img src={item.cover} alt="" width={28} height={38} />}
                <span>{item.title}</span>
                <span className={styles["price"]}>{item.price ?? "sem oferta"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
