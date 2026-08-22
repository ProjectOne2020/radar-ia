import { describe, expect, it } from "vitest";
import { computeBrandRecognition, computeTao, computeTaoFromRuns, toTaoObservation, type RunLike } from "./tao";
import { TAO_ELIGIBLE_CLASSES, type PromptClass } from "@/lib/prompt-class/types";

// P0.1 — TESTS 7 a 12 obligatorios + el test de INVARIANTE ARQUITECTONICA (§16).

function run(over: Partial<RunLike> = {}): RunLike {
  return { prompt_id: "p1", mentioned: true, prompt_class: "clean_blind", mention_method: "llm", ...over };
}

describe("TEST 7 — error de motor NO equivale a ausencia", () => {
  // Un motor caido no inserta fila: no aparece ni en numerador ni en denominador.
  it("un run ausente no baja la TAO, solo reduce la muestra", () => {
    const conMotorCaido = computeTaoFromRuns([run({ mentioned: true })]);
    const conTodos = computeTaoFromRuns([run({ mentioned: true }), run({ prompt_id: "p2", mentioned: true })]);
    expect(conMotorCaido.rate).toBe(100);
    expect(conTodos.rate).toBe(100);
    expect(conMotorCaido.sampleRuns).toBe(1);
    expect(conTodos.sampleRuns).toBe(2);
  });

  it("clasificacion degradada por fallback de substring queda FUERA (no cuenta como ausencia)", () => {
    const r = computeTaoFromRuns([
      run({ mentioned: true }),
      run({ prompt_id: "p2", mentioned: false, mention_method: "substring_fallback" }),
    ]);
    expect(r.rate).toBe(100); // el degradado no arrastra la tasa a 50%
    expect(r.sampleRuns).toBe(1);
    expect(r.excludedRuns).toBe(1); // se contabiliza como cobertura perdida
  });
});

describe("TESTS 8-11 — ninguna clase contaminada contribuye a TAO", () => {
  it.each<PromptClass>(["named", "domain_seeded", "product_seeded", "comparative", "weak_blind", "category"])(
    "un run '%s' exitoso y con mencion NO contribuye",
    (cls) => {
      expect(toTaoObservation(run({ prompt_class: cls }))).toBeNull();
      const r = computeTaoFromRuns([run({ prompt_class: cls })]);
      expect(r.rate).toBeNull();
      expect(r.sampleRuns).toBe(0);
      expect(r.excludedRuns).toBe(1);
    },
  );

  it("clase null o desconocida (historico sin clasificar) tampoco contribuye", () => {
    expect(toTaoObservation(run({ prompt_class: null }))).toBeNull();
    expect(toTaoObservation(run({ prompt_class: "loquesea" }))).toBeNull();
  });

  it("caso real de la auditoria: 18 con nombre + 18 ciegas -> TAO refleja SOLO las ciegas", () => {
    const conNombre = Array.from({ length: 18 }, (_, i) =>
      run({ prompt_id: `n${i}`, mentioned: true, prompt_class: "named" }),
    );
    const ciegas = Array.from({ length: 18 }, (_, i) =>
      run({ prompt_id: `b${i}`, mentioned: false, prompt_class: "clean_blind" }),
    );
    const tao = computeTaoFromRuns([...conNombre, ...ciegas]);
    // v1 reportaba 47.22% mezclando ambas. La verdad es 0%.
    expect(tao.rate).toBe(0);
    expect(tao.sampleRuns).toBe(18);
    expect(tao.excludedRuns).toBe(18);
  });
});

describe("TEST 12 — un clean_blind exitoso SI contribuye", () => {
  it("con mencion suma", () => {
    const r = computeTaoFromRuns([run({ mentioned: true })]);
    expect(r.rate).toBe(100);
    expect(r.appearances).toBe(1);
    expect(r.promptsWithAppearance).toBe(1);
  });

  it("sin mencion cuenta como ausencia real (denominador, no numerador)", () => {
    const r = computeTaoFromRuns([run({ mentioned: true }), run({ prompt_id: "p2", mentioned: false })]);
    expect(r.rate).toBe(50);
    expect(r.sampleRuns).toBe(2);
    expect(r.appearances).toBe(1);
  });

  it("agrega por pregunta ademas de por run", () => {
    const r = computeTaoFromRuns([
      run({ prompt_id: "p1", mentioned: false }),
      run({ prompt_id: "p1", mentioned: true }), // otro motor, misma pregunta
      run({ prompt_id: "p2", mentioned: false }),
    ]);
    expect(r.sampleRuns).toBe(3);
    expect(r.samplePrompts).toBe(2);
    expect(r.promptsWithAppearance).toBe(1);
  });
});

describe("§16 — INVARIANTE ARQUITECTONICA", () => {
  // Este test existe para FALLAR si alguien amplia la compuerta en el futuro.
  // La proteccion vive aqui, no en la documentacion.
  it("clean_blind es la UNICA clase elegible para TAO", () => {
    expect([...TAO_ELIGIBLE_CLASSES]).toEqual(["clean_blind"]);
  });

  it("para TODA clase distinta de clean_blind, la contribucion es imposible", () => {
    const todas: PromptClass[] = [
      "clean_blind", "weak_blind", "named", "domain_seeded", "product_seeded", "comparative", "category",
    ];
    for (const cls of todas) {
      const obs = toTaoObservation(run({ prompt_class: cls }));
      if (cls === "clean_blind") expect(obs).not.toBeNull();
      else expect(obs).toBeNull();
    }
  });

  it("computeTao no puede recibir observaciones fabricadas a mano (garantia de tipos)", () => {
    // El objeto de abajo tiene la forma correcta pero le falta la marca privada.
    // @ts-expect-error — TypeScript debe rechazar esto: es la garantia estructural.
    const fabricado: Parameters<typeof computeTao>[0] = [{ promptId: "x", mentioned: true }];
    expect(fabricado).toBeDefined();
  });
});

describe("Reconocimiento de Marca — metrica separada", () => {
  it("usa named/domain_seeded/product_seeded y NUNCA clean_blind", () => {
    const runs = [
      run({ prompt_id: "n1", mentioned: true, prompt_class: "named" }),
      run({ prompt_id: "d1", mentioned: true, prompt_class: "domain_seeded" }),
      run({ prompt_id: "b1", mentioned: false, prompt_class: "clean_blind" }),
    ];
    const br = computeBrandRecognition(runs);
    expect(br.rate).toBe(100);
    expect(br.sampleRuns).toBe(2); // el clean_blind no entra
  });

  it("las dos metricas del mismo dataset son independientes", () => {
    const runs = [
      run({ prompt_id: "n1", mentioned: true, prompt_class: "named" }),
      run({ prompt_id: "b1", mentioned: false, prompt_class: "clean_blind" }),
    ];
    expect(computeBrandRecognition(runs).rate).toBe(100);
    expect(computeTaoFromRuns(runs).rate).toBe(0);
  });
});
