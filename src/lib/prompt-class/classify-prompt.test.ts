import { describe, expect, it } from "vitest";
import { classifyPrompt } from "./classify-prompt";
import type { ClientIdentity } from "@/lib/identity/types";

// P0.1 — Los 12 casos obligatorios definidos por el fundador (§15), mas casos de borde
// que salieron al implementar. Cada test nombra el riesgo real que cubre; si alguno falla,
// significa que un prompt contaminado podria estar entrando a la TAO.

function identity(over: Partial<ClientIdentity> = {}): ClientIdentity {
  return {
    clientId: "c1",
    tradeName: "Negocio Prueba",
    legalName: null,
    city: null,
    niche: null,
    variants: [],
    competitorNames: [],
    ...over,
  };
}

describe("TEST 1 — colision semantica nombre+categoria+geografia", () => {
  // El caso que rompio el diseño binario blind/named: el nombre del negocio ES la
  // categoria + la ciudad, asi que una pregunta generica del rubro lo nombra sin querer.
  const farmacia = identity({ tradeName: "Farmacia Guadalajara", niche: "farmacia", city: "Guadalajara" });

  it("NO es clean_blind", () => {
    const r = classifyPrompt("¿Qué farmacia recomiendan en Guadalajara?", farmacia);
    expect(r.promptClass).not.toBe("clean_blind");
  });

  it("se marca como weak_blind por colision semantica", () => {
    const r = classifyPrompt("¿Qué farmacia recomiendan en Guadalajara?", farmacia);
    expect(r.promptClass).toBe("weak_blind");
    expect(r.signals.some((s) => s.kind === "semantic_collision")).toBe(true);
  });

  it("una pregunta del mismo rubro en OTRA ciudad si es clean_blind", () => {
    const r = classifyPrompt("¿Qué farmacia recomiendan en Monterrey?", farmacia);
    expect(r.promptClass).toBe("clean_blind");
  });
});

describe("TEST 2 — dominio del cliente", () => {
  const alfa = identity({
    tradeName: "Grupo Alfa",
    variants: [{ value: "alfacare.mx", kind: "domain", source: "explicit" }],
  });

  it("¿Es confiable alfacare.mx? -> domain_seeded", () => {
    expect(classifyPrompt("¿Es confiable alfacare.mx?", alfa).promptClass).toBe("domain_seeded");
  });

  it.each([
    "alfacare.mx",
    "www.alfacare.mx",
    "https://alfacare.mx",
    "https://www.alfacare.mx/servicios",
    "sub.alfacare.mx",
    "alfacare.com",
  ])("detecta la variante de dominio: %s", (dom) => {
    expect(classifyPrompt(`¿Qué opinan de ${dom}?`, alfa).promptClass).toBe("domain_seeded");
  });

  it("un dominio ajeno NO contamina", () => {
    expect(classifyPrompt("¿Qué opinan de otrositio.com?", alfa).promptClass).toBe("clean_blind");
  });
});

describe("TEST 3 — marca/producto propio", () => {
  const alfa = identity({
    tradeName: "Grupo Alfa",
    variants: [{ value: "AlfaCare", kind: "product_brand", source: "explicit" }],
  });

  it("¿Cuál es el mejor tratamiento con AlfaCare? -> product_seeded", () => {
    expect(classifyPrompt("¿Cuál es el mejor tratamiento con AlfaCare?", alfa).promptClass).toBe(
      "product_seeded",
    );
  });
});

describe("TEST 4 — pregunta de categoria sin señales del cliente", () => {
  it("-> clean_blind (y con intencion de categoria)", () => {
    const r = classifyPrompt(
      "¿Cuál es la mejor clínica veterinaria en Monterrey?",
      identity({ tradeName: "Empresa X", niche: "veterinaria" }),
    );
    expect(r.promptClass).toBe("clean_blind");
    expect(r.intent).toBe("category");
    expect(r.signals).toHaveLength(0);
  });
});

describe("TEST 5 — nombres cortos: sin falsos positivos por substring", () => {
  // El bug original: `texto.includes("sol")` matchea dentro de "solucion".
  const sol = identity({ tradeName: "Sol", niche: "restaurante" });

  it("'Sol' NO matchea dentro de 'solución'", () => {
    const r = classifyPrompt("¿Cuál es una solución ideal?", sol);
    expect(r.promptClass).toBe("clean_blind");
    expect(r.signals).toHaveLength(0);
  });

  it.each(["solamente", "soledad", "consola", "girasol"])("'Sol' NO matchea dentro de '%s'", (w) => {
    expect(classifyPrompt(`Necesito ${w} para mi negocio`, sol).promptClass).toBe("clean_blind");
  });

  it("nombre generico sin corroborar NO se marca named", () => {
    const r = classifyPrompt("¿Cuál es la solución ideal?", identity({ tradeName: "Ideal", niche: "farmacia" }));
    expect(r.promptClass).not.toBe("named");
    expect(r.promptClass).not.toBe("clean_blind"); // contamina, pero como baja confianza
  });

  it("nombre generico SI se marca named cuando el rubro lo corrobora", () => {
    const r = classifyPrompt("¿Está buena la farmacia Ideal?", identity({ tradeName: "Ideal", niche: "farmacia" }));
    expect(r.promptClass).toBe("named");
  });
});

describe("TEST 6 — comparativa cliente vs competidor", () => {
  it("-> comparative", () => {
    const r = classifyPrompt(
      "¿Qué es mejor, Snakesun o Viborana?",
      identity({ tradeName: "Snakesun", niche: "app", competitorNames: ["Viborana"] }),
    );
    expect(r.promptClass).toBe("comparative");
  });

  it("competidor solo, sin el cliente, NO es comparative", () => {
    const r = classifyPrompt(
      "¿Qué opinan de Viborana?",
      identity({ tradeName: "Snakesun", niche: "app", competitorNames: ["Viborana"] }),
    );
    expect(r.promptClass).not.toBe("comparative");
  });
});

describe("Variantes explicitas vs derivadas", () => {
  it("una variante explicita detecta y queda registrada como explicit", () => {
    const r = classifyPrompt(
      "¿Cómo es la atención en Clinica Sonrrisa?",
      identity({
        tradeName: "Clínica Sonrisa",
        niche: "dental",
        variants: [{ value: "Clinica Sonrrisa", kind: "misspelling", source: "explicit" }],
      }),
    );
    expect(r.promptClass).toBe("named");
    expect(r.signals.some((s) => s.source === "explicit")).toBe(true);
  });

  it("acronimo conocido contamina", () => {
    const r = classifyPrompt(
      "¿Qué tal es la UANL?",
      identity({
        tradeName: "Universidad Autónoma de Nuevo León",
        variants: [{ value: "UANL", kind: "acronym", source: "explicit" }],
      }),
    );
    expect(r.promptClass).toBe("named");
  });
});

describe("Determinismo", () => {
  it("mismo input produce siempre el mismo output", () => {
    const id = identity({ tradeName: "Farmacia Guadalajara", niche: "farmacia" });
    const p = "¿Qué farmacia recomiendan en Guadalajara?";
    const runs = Array.from({ length: 20 }, () => classifyPrompt(p, id).promptClass);
    expect(new Set(runs).size).toBe(1);
  });
});
