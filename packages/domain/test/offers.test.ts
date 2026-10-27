import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cheapestByProduct,
  cheapestOffer,
  evaluateOffer,
  rankOffers,
  type IneligibilityReason,
} from "../src/index";
import { context, offer, source, store } from "./fixtures";

function reasons(overrides: Parameters<typeof offer>[0], ctx = context()): IneligibilityReason[] {
  return evaluateOffer(offer(overrides), ctx).reasons;
}

describe("elegibilidade da oferta", () => {
  it("aceita a oferta dentro das regras", () => {
    assert.deepEqual(reasons({}), []);
  });

  it("recusa preço inválido", () => {
    assert.deepEqual(reasons({ priceCents: 0 }), ["invalid-price"]);
    assert.deepEqual(reasons({ priceCents: 12.5 }), ["invalid-price"]);
  });

  it("recusa loja e fonte desativadas", () => {
    assert.deepEqual(reasons({}, context({ stores: [store({ enabled: false })] })), ["inactive-store"]);
    assert.deepEqual(reasons({}, context({ sources: [source({ enabled: false })] })), ["inactive-source"]);
  });

  it("recusa região e moeda diferentes das do usuário", () => {
    assert.deepEqual(reasons({ region: "US" }), ["wrong-region"]);
    assert.deepEqual(reasons({ currency: "USD" }), ["wrong-currency"]);
  });

  it("recusa oferta indisponível ou de disponibilidade desconhecida", () => {
    assert.deepEqual(reasons({ availability: "unavailable" }), ["unavailable"]);
    assert.deepEqual(reasons({ availability: "unknown" }), ["unknown-availability"]);
  });

  it("recusa preço vencido pelo prazo da fonte", () => {
    // A oferta foi observada às 11h e o prazo é 24 h: às 12h do dia seguinte já venceu.
    const late = context();
    late.now = new Date("2026-10-28T11:30:00.000Z");
    assert.deepEqual(evaluateOffer(offer({}), late).reasons, ["stale"]);
  });

  it("usa o prazo da fonte, não o padrão, quando ela configura", () => {
    const ctx = context({ sources: [source({ maxAgeHours: 2 })] });
    ctx.now = new Date("2026-10-27T14:00:00.000Z"); // 3 h depois da observação
    assert.deepEqual(evaluateOffer(offer({}), ctx).reasons, ["stale"]);
  });

  it("respeita a plataforma escolhida pelo usuário", () => {
    const ctx = context({ platform: "xbox" });
    assert.deepEqual(evaluateOffer(offer({ platform: "steam" }), ctx).reasons, ["wrong-platform"]);
  });

  it("junta todos os motivos, não só o primeiro", () => {
    const ctx = context({ stores: [store({ enabled: false })] });
    assert.deepEqual(evaluateOffer(offer({ priceCents: -5, region: "US" }), ctx).reasons, [
      "invalid-price",
      "inactive-store",
      "wrong-region",
    ]);
  });
});

describe("menor preço elegível", () => {
  it("escolhe o menor preço entre as ofertas válidas", () => {
    const ctx = context();
    const best = cheapestOffer(
      [offer({ id: "a", priceCents: 15_000 }), offer({ id: "b", priceCents: 9_990 }), offer({ id: "c", priceCents: 12_000 })],
      ctx,
    );
    assert.equal(best?.id, "b");
  });

  it("não deixa oferta vencida disputar o selo", () => {
    const ctx = context();
    ctx.now = new Date("2026-10-29T00:00:00.000Z");
    assert.equal(cheapestOffer([offer({ priceCents: 9_990 })], ctx), null);
  });

  it("não favorece loja parceira: parceria não entra na ordenação", () => {
    const partner = store({ id: "store-parceira", slug: "parceira", name: "Parceira", partnerStatus: "active" });
    const other = store({ id: "store-outra", slug: "outra", name: "Outra", partnerStatus: "none" });
    const ctx = context({ stores: [partner, other] });
    const best = cheapestOffer(
      [
        offer({ id: "parceira", storeId: "store-parceira", priceCents: 14_990 }),
        offer({ id: "outra", storeId: "store-outra", priceCents: 13_990 }),
      ],
      ctx,
    );
    assert.equal(best?.id, "outra");
  });

  it("desempata por observação mais recente, depois por nome da loja", () => {
    const ctx = context();
    const velha = offer({ id: "velha", priceCents: 10_000, observedAt: "2026-10-27T09:00:00.000Z" });
    const nova = offer({ id: "nova", priceCents: 10_000, observedAt: "2026-10-27T11:00:00.000Z" });
    assert.deepEqual(rankOffers([velha, nova], ctx).map((o) => o.id), ["nova", "velha"]);

    const a = store({ id: "store-b", slug: "b", name: "Beta" });
    const b = store({ id: "store-a", slug: "a", name: "Alfa" });
    const ctx2 = context({ stores: [a, b] });
    const empateA = offer({ id: "o1", storeId: "store-b", priceCents: 10_000 });
    const empateB = offer({ id: "o2", storeId: "store-a", priceCents: 10_000 });
    assert.deepEqual(rankOffers([empateA, empateB], ctx2).map((o) => o.id), ["o2", "o1"]);
  });

  it("devolve null quando nenhuma oferta se qualifica", () => {
    assert.equal(cheapestOffer([offer({ availability: "unavailable" })], context()), null);
  });
});

describe("preço por produto", () => {
  it("não mistura jogo base, edição e DLC", () => {
    const ctx = context();
    const best = cheapestByProduct(
      [
        offer({ id: "base", productId: "produto-base", priceCents: 9_990 }),
        offer({ id: "deluxe", productId: "produto-deluxe", priceCents: 19_990 }),
        offer({ id: "dlc", productId: "produto-dlc", priceCents: 4_990 }),
      ],
      ctx,
    );
    assert.equal(best.get("produto-base")?.id, "base");
    assert.equal(best.get("produto-deluxe")?.id, "deluxe");
    assert.equal(best.get("produto-dlc")?.id, "dlc");
  });
});
