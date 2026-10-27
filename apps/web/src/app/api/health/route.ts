import { NextResponse } from "next/server";
import { integrationHealth } from "@tako/db";

export const dynamic = "force-dynamic";

/** Sinais vitais para o monitor externo e para o painel (OPS-001). */
export async function GET(): Promise<NextResponse> {
  try {
    const health = await integrationHealth();
    const degraded = health.failingSources > 0 || health.openErrors > 0;
    return NextResponse.json(
      {
        status: degraded ? "degraded" : "ok",
        checkedAt: new Date().toISOString(),
        ...health,
      },
      { status: degraded ? 503 : 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "down",
        checkedAt: new Date().toISOString(),
        database: "down",
        reason: error instanceof Error ? error.message : "erro desconhecido",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
