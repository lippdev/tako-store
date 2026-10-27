import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Download do arquivo de catálogo. O conteúdo vem na query porque a exportação é um link e não um form; o arquivo
 * nunca sai do servidor sem a sessão conferida.
 */
export async function GET(request: Request): Promise<NextResponse> {
  await requireUser("/admin/jogos");
  const url = new URL(request.url);
  const conteudo = url.searchParams.get("conteudo") ?? "";
  const name = (url.searchParams.get("arquivo") ?? "catalogo.json").replace(/[^a-zA-Z0-9._-]/g, "") || "catalogo.json";
  return new NextResponse(conteudo, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
