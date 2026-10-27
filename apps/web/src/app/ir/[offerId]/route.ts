import { NextResponse } from "next/server";
import { getOfferById, listStores, recordOfferClick } from "@tako/db";
import { isAllowedRedirect } from "@tako/domain";

/**
 * Redirecionamento para a loja (STO-004). O id da oferta é o único dado que vem do usuário: a URL de destino é a
 * que está gravada, e só sai se o domínio estiver cadastrado para aquela loja (PRD §11.5).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const offer = await getOfferById(offerId);
  if (offer === null) return new NextResponse("Oferta não encontrada.", { status: 404 });

  const store = (await listStores()).find((candidate) => candidate.id === offer.storeId);
  if (store === undefined || !store.enabled) {
    return new NextResponse("Loja indisponível no momento.", { status: 404 });
  }
  if (!isAllowedRedirect({ url: offer.url, storeAllowedDomains: store.allowedDomains })) {
    return new NextResponse("Destino não permitido para esta loja.", { status: 403 });
  }

  await recordOfferClick(offer.id);
  return NextResponse.redirect(offer.url, 302);
}
