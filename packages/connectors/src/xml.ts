// Leitor de XML simples para feeds de parceiro (OFR-008). Não é um parser de propósito geral: lê o que feed de
// oferta costuma ter — elementos aninhados, atributos ignorados, CDATA, comentários e entidades básicas.

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  // Latin-1 nomeado: feed de parceiro brasileiro usa muito.
  aacute: "á",
  agrave: "à",
  acirc: "â",
  atilde: "ã",
  auml: "ä",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  iacute: "í",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  uacute: "ú",
  uuml: "ü",
  ccedil: "ç",
  ntilde: "ñ",
  Aacute: "Á",
  Agrave: "À",
  Acirc: "Â",
  Atilde: "Ã",
  Eacute: "É",
  Ecirc: "Ê",
  Iacute: "Í",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Uacute: "Ú",
  Ccedil: "Ç",
  Ntilde: "Ñ",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return ENTITIES[entity] ?? ENTITIES[entity.toLowerCase()] ?? match;
  });
}

interface XmlNode {
  name: string;
  text: string;
  children: XmlNode[];
}

function tagName(raw: string): string {
  const name = raw.trim().split(/\s+/)[0] ?? "";
  return name.includes(":") ? (name.split(":").pop() ?? name) : name;
}

/** Monta a árvore de elementos. Texto fora de elemento (banner, lixo) é ignorado. */
export function parseXml(text: string): XmlNode | null {
  const clean = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  const root: XmlNode = { name: "#root", text: "", children: [] };
  const stack: XmlNode[] = [root];
  const pattern = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([^>]+?)(\/?)>|([^<]+)/g;

  for (const match of clean.matchAll(pattern)) {
    const [, cdata, closing, rawTag, selfClosing, textNode] = match;
    const current = stack[stack.length - 1];
    if (current === undefined) break;

    if (cdata !== undefined) {
      current.text += cdata;
      continue;
    }
    if (textNode !== undefined) {
      current.text += decodeEntities(textNode);
      continue;
    }
    if (rawTag === undefined) continue;

    if (closing === "/") {
      const name = tagName(rawTag);
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index]?.name === name) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    const node: XmlNode = { name: tagName(rawTag), text: "", children: [] };
    current.children.push(node);
    if (selfClosing !== "/") stack.push(node);
  }

  return root.children[0] ?? null;
}

/**
 * Registros do feed: os filhos do elemento raiz que têm filhos próprios. Devolve também o nome do elemento de
 * registro, para a mensagem de erro dizer o que se esperava.
 */
export function xmlRecords(text: string): { element: string | null; records: Record<string, string>[] } {
  const root = parseXml(text);
  if (root === null) return { element: null, records: [] };

  const children = root.children;
  if (children.length === 0) return { element: root.name, records: [] };

  const withChildren = children.filter((child) => child.children.length > 0);
  const records = withChildren.map((child) => {
    const record: Record<string, string> = {};
    for (const field of child.children) {
      const value = field.text.trim();
      if (value !== "") record[field.name] = value;
    }
    return record;
  });
  return { element: withChildren[0]?.name ?? children[0]?.name ?? null, records };
}
