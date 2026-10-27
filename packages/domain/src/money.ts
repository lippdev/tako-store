// Dinheiro em inteiro: centavos, nunca ponto flutuante (PRD §10.3). Toda formatação para a tela passa por aqui.

/** Valor na menor unidade da moeda: centavos de real, quando a moeda é BRL. */
export type Cents = number;

export const BRL = "BRL" as const;

/** Formata para a tela em pt-BR: `12990` → `R$ 129,90`. */
export function formatBRL(cents: Cents): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: BRL }).format(cents / 100);
}

/**
 * Desconto em relação ao preço de referência, arredondado para baixo. Devolve `null` quando não há referência
 * confiável ou quando ela não é maior que o preço — desconto inventado é pior que desconto nenhum (PRD §10.3).
 */
export function discountPercent(priceCents: Cents, referenceCents: Cents | null): number | null {
  if (referenceCents === null || referenceCents <= 0 || priceCents >= referenceCents) return null;
  return Math.floor(((referenceCents - priceCents) * 100) / referenceCents);
}

/** Preço válido é inteiro, positivo e dentro do que cabe em reais (R$ 1 bilhão). */
export function isValidPrice(cents: unknown): cents is Cents {
  return typeof cents === "number" && Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000_000;
}
