import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Stripe from "stripe";
import { getCurrentPeriodEnd, mapStripeStatus } from "./route";

// El webhook de Stripe mueve dinero real y no tenia NINGUN test (hallazgo de la
// auditoria de produccion). Igual que retry.test.ts: mapStripeStatus y
// getCurrentPeriodEnd son puras y deterministas, se prueban de verdad. El resto del
// handler (side effects sobre Stripe/Supabase) se verifica por invariante
// estructural, como el resto de la suite de P0.2-B.

const SRC = join(process.cwd(), "src");
const codeOnly = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
const read = (...p: string[]) => codeOnly(readFileSync(join(SRC, ...p), "utf8"));

describe("mapStripeStatus", () => {
  it("active y trialing cuentan como active", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("active");
  });

  it("past_due, unpaid e incomplete cuentan como past_due", () => {
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("incomplete")).toBe("past_due");
  });

  it("cualquier otro estado de Stripe cae a canceled (nunca un valor inventado)", () => {
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
    expect(mapStripeStatus("paused" as Stripe.Subscription.Status)).toBe("canceled");
  });
});

describe("getCurrentPeriodEnd", () => {
  const subWithItem = (current_period_end: number | undefined): Stripe.Subscription =>
    ({
      items: { data: [{ current_period_end } as Stripe.SubscriptionItem] },
    }) as unknown as Stripe.Subscription;

  it("convierte el timestamp unix (segundos) de Stripe a ISO string", () => {
    const iso = getCurrentPeriodEnd(subWithItem(1_700_000_000));
    expect(iso).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("devuelve null si el item no trae current_period_end", () => {
    expect(getCurrentPeriodEnd(subWithItem(undefined))).toBeNull();
  });

  it("devuelve null si la suscripcion no tiene ningun item (no revienta)", () => {
    const sub = { items: { data: [] } } as unknown as Stripe.Subscription;
    expect(getCurrentPeriodEnd(sub)).toBeNull();
  });
});

describe("invariantes de seguridad del webhook", () => {
  it("nunca procesa un evento sin verificar la firma primero", () => {
    const source = read("app", "api", "webhooks", "stripe", "route.ts");
    // constructEvent lanza si la firma es invalida; el switch de eventos esta
    // DESPUES de ese try/catch, nunca antes.
    const verifyAt = source.indexOf("stripe.webhooks.constructEvent");
    const switchAt = source.indexOf("switch (event.type)");
    expect(verifyAt).toBeGreaterThan(-1);
    expect(switchAt).toBeGreaterThan(verifyAt);
  });

  it("una firma invalida responde 400, no 200 (Stripe debe reintentar, no darlo por recibido)", () => {
    const source = read("app", "api", "webhooks", "stripe", "route.ts");
    expect(source).toMatch(/status: 400\s*\}\s*\)\s*;[\s\S]{0,20}\}\s*\n\s*const admin/);
  });

  it("checkout.session.completed nunca actua sin client_id y plan en la metadata", () => {
    const source = read("app", "api", "webhooks", "stripe", "route.ts");
    const caseAt = source.indexOf('case "checkout.session.completed"');
    const guardAt = source.indexOf("if (!clientId || !plan) break;");
    expect(guardAt).toBeGreaterThan(caseAt);
  });

  it("la cuenta Enterprise solo se crea tras confirmar el pago (dentro del case, no antes)", () => {
    const source = read("app", "api", "webhooks", "stripe", "route.ts");
    const caseAt = source.indexOf('case "checkout.session.completed"');
    const createAccountAt = source.indexOf("await createEnterpriseAccount(admin, clientId);");
    expect(createAccountAt).toBeGreaterThan(caseAt);
  });

  it("upgradeAuditForClient corre despues de responder a Stripe (after), nunca bloquea la respuesta del webhook", () => {
    const source = read("app", "api", "webhooks", "stripe", "route.ts");
    expect(source).toMatch(/after\(\(\) => upgradeAuditForClient/);
  });

  it("un evento no manejado responde 200 recibido (Stripe no debe reintentar tipos que ignoramos a proposito)", () => {
    const source = read("app", "api", "webhooks", "stripe", "route.ts");
    const defaultAt = source.indexOf("default:\n      break;");
    const responseAt = source.indexOf('return NextResponse.json({ received: true });');
    expect(defaultAt).toBeGreaterThan(-1);
    expect(responseAt).toBeGreaterThan(defaultAt);
  });
});
