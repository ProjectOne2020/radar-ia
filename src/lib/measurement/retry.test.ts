import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_ATTEMPTS_PER_CELL,
  buildCellStates,
  cellsNeedingRetry,
  shouldRetryCell,
  type CellState,
} from "./retry";

// P0.2-B — Tests del reintento de celdas incompletas.
//
// A diferencia de la mayoria de los tests de P0.2-B, estos SI ejecutan la logica: la regla
// de reintento es una funcion pura y determinista, asi que se puede probar de verdad sin
// base de datos ni llamadas a motores de pago.

const SRC = join(process.cwd(), "src");
const codeOnly = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
const read = (...p: string[]) => codeOnly(readFileSync(join(SRC, ...p), "utf8"));

const cell = (over: Partial<CellState> = {}): CellState => ({
  engine: "openai",
  hasCanonical: false,
  lastOutcome: null,
  attempts: 0,
  ...over,
});

/** Simula pasadas de medicion sobre una celda hasta que deje de reintentarse. */
function simulate(outcomes: Array<"success" | "failed" | "timeout" | "rate_limited" | "skipped">) {
  let state = cell();
  let calls = 0;
  let canonicals = 0;

  for (const outcome of outcomes) {
    if (!shouldRetryCell(state)) break;
    calls += 1;
    const attempts = state.attempts + 1;
    if (outcome === "success") {
      canonicals += 1;
      state = { ...state, hasCanonical: true, lastOutcome: "success", attempts };
    } else {
      state = { ...state, lastOutcome: outcome, attempts };
    }
  }

  return { calls, canonicals, state, complete: state.hasCanonical };
}

describe("1 fallo temporal → retry success → celda completa", () => {
  it("un failed seguido de success deja la celda resuelta", () => {
    const r = simulate(["failed", "success"]);
    expect(r.calls).toBe(2);
    expect(r.complete).toBe(true);
    expect(r.canonicals).toBe(1);
  });
});

describe("1 timeout → retry success → un solo canonical", () => {
  it("nunca se produce mas de un canonico", () => {
    const r = simulate(["timeout", "success"]);
    expect(r.canonicals).toBe(1);
    expect(r.complete).toBe(true);
  });
});

describe("1 rate limit → retry success → un solo canonical", () => {
  it("rate_limited es reintentable y resuelve en un canonico", () => {
    expect(shouldRetryCell(cell({ lastOutcome: "rate_limited", attempts: 1 }))).toBe(true);
    const r = simulate(["rate_limited", "success"]);
    expect(r.canonicals).toBe(1);
  });

  it("invalid_response tambien es reintentable", () => {
    expect(shouldRetryCell(cell({ lastOutcome: "invalid_response", attempts: 1 }))).toBe(true);
  });
});

describe("3 fallos consecutivos → se detiene y NO se completa", () => {
  it("el tope es 1 original + 2 reintentos", () => {
    expect(MAX_ATTEMPTS_PER_CELL).toBe(3);
  });

  it("tras 3 intentos fallidos no se vuelve a llamar al motor", () => {
    const r = simulate(["failed", "timeout", "rate_limited", "failed", "failed"]);
    expect(r.calls).toBe(3);
    expect(r.complete).toBe(false);
    expect(r.canonicals).toBe(0);
  });

  it("una celda agotada deja de ser candidata", () => {
    expect(shouldRetryCell(cell({ lastOutcome: "failed", attempts: 3 }))).toBe(false);
  });
});

describe("success original → NUNCA se repite", () => {
  it("una celda con canonico no se reintenta jamas", () => {
    expect(shouldRetryCell(cell({ hasCanonical: true, lastOutcome: "success", attempts: 1 }))).toBe(false);
  });

  it("simular mas pasadas sobre un exito no gasta ninguna llamada", () => {
    const r = simulate(["success", "success", "success"]);
    expect(r.calls).toBe(1);
    expect(r.canonicals).toBe(1);
  });
});

describe("skipped → NUNCA se repite", () => {
  it("un motor sin credencial no se reintenta (daria skipped otra vez)", () => {
    expect(shouldRetryCell(cell({ lastOutcome: "skipped", attempts: 1 }))).toBe(false);
  });

  it("skipped no cuenta como celda pendiente", () => {
    const cells = [
      cell({ engine: "openai", hasCanonical: true, lastOutcome: "success", attempts: 1 }),
      cell({ engine: "anthropic", lastOutcome: "skipped", attempts: 1 }),
      cell({ engine: "gemini", lastOutcome: "timeout", attempts: 1 }),
    ];
    expect(cellsNeedingRetry(cells)).toEqual(["gemini"]);
  });
});

describe("buildCellStates — colapsa los intentos correctamente", () => {
  it("un canonico posterior gana sobre un fallo previo", () => {
    const states = buildCellStates([
      { prompt_id: "p1", engine: "openai", outcome: "timeout", is_canonical: false, attempt: 1 },
      { prompt_id: "p1", engine: "openai", outcome: "success", is_canonical: true, attempt: 2 },
    ]);
    const [c] = states.get("p1")!;
    expect(c.hasCanonical).toBe(true);
    expect(c.attempts).toBe(2);
    expect(shouldRetryCell(c)).toBe(false);
  });

  it("el outcome relevante es el del intento mas alto", () => {
    const states = buildCellStates([
      { prompt_id: "p1", engine: "gemini", outcome: "failed", is_canonical: false, attempt: 1 },
      { prompt_id: "p1", engine: "gemini", outcome: "rate_limited", is_canonical: false, attempt: 2 },
    ]);
    const [c] = states.get("p1")!;
    expect(c.lastOutcome).toBe("rate_limited");
    expect(c.attempts).toBe(2);
  });

  it("separa por prompt", () => {
    const states = buildCellStates([
      { prompt_id: "p1", engine: "openai", outcome: "success", is_canonical: true, attempt: 1 },
      { prompt_id: "p2", engine: "openai", outcome: "failed", is_canonical: false, attempt: 1 },
    ]);
    expect(cellsNeedingRetry(states.get("p1")!)).toEqual([]);
    expect(cellsNeedingRetry(states.get("p2")!)).toEqual(["openai"]);
  });
});

describe("el retry NO relaja la politica de publicacion", () => {
  it("retry.ts no toca publication_status ni umbrales", () => {
    const source = read("lib", "measurement", "retry.ts");
    expect(source).not.toMatch(/publication_status/);
    expect(source).not.toMatch(/published|withheld/);
    expect(source).not.toMatch(/expected_runs/);
  });

  it("closeSession y calculateScoreForSession conservan su criterio", () => {
    expect(read("lib", "measurement", "session.ts")).toMatch(
      /successful === 0 \? "failed" : successful >= expected \? "completed" : "partial"/,
    );
    expect(read("lib", "scoring", "calculate-score.ts")).toMatch(
      /execution_status === "completed" \? "published" : "withheld"/,
    );
  });

  it("el retry ocurre ANTES de closeSession", () => {
    const source = read("lib", "free-audit", "run-free-audit.ts");
    const retryAt = source.indexOf("retryIncompleteRuns(");
    const closeAt = source.indexOf("closeSession(");
    expect(retryAt).toBeGreaterThan(-1);
    expect(closeAt).toBeGreaterThan(retryAt);
  });
});

describe("el retry no altera findings, trial ni auditorias pagadas", () => {
  it("no duplica findings: run-audit sigue siendo idempotente por sesion", () => {
    const source = read("lib", "audit", "run-audit.ts");
    expect(source).toMatch(/onConflict: "session_id,pillar,finding"/);
    expect(source).toMatch(/ignoreDuplicates: true/);
    // Y el retry no vuelve a correr la auditoria tecnica: solo remide prompts.
    expect(read("lib", "measurement", "retry.ts")).not.toMatch(/runAuditForClient/);
  });

  it("no consume trial adicional: el retry no toca el trial", () => {
    expect(read("lib", "measurement", "retry.ts")).not.toMatch(
      /trial|consumeTrialAudit|audits_remaining/i,
    );
    // free_audit ademas nunca consumio (trial-policy.ts).
    expect(read("lib", "free-audit", "run-free-audit.ts")).not.toMatch(/consumeTrialAudit/);
  });

  it("las auditorias pagadas NO reintentan: el mecanismo esta limitado a free_audit", () => {
    const paidFlows = [
      ["lib", "audit", "remeasure-client.ts"],
      ["lib", "audit", "upgrade-audit.ts"],
      ["lib", "cron", "remeasure-due-clients.ts"],
      ["lib", "dashboard", "add-competitor.ts"],
      ["app", "api", "dashboard", "setup", "route.ts"],
    ];
    for (const file of paidFlows) {
      expect(read(...file), `${file.join("/")}`).not.toMatch(/retryIncompleteRuns/);
    }
    expect(read("lib", "free-audit", "run-free-audit.ts")).toMatch(/retryIncompleteRuns/);
  });

  it("la primera pasada de cualquier flujo llama a los 3 motores, como antes", () => {
    // Sin runs previos, todas las celdas tienen lastOutcome null y 0 intentos => se llaman
    // los tres. Por eso el comportamiento de las auditorias pagadas no cambia.
    const fresh = ["openai", "anthropic", "gemini"].map((engine) => cell({ engine }));
    expect(cellsNeedingRetry(fresh)).toEqual(["openai", "anthropic", "gemini"]);
  });
});

describe("una auditoria gratis con un fallo transitorio SI genera snapshot", () => {
  it("las 15 celdas quedan resueltas si el reintento tiene exito", () => {
    // 5 preguntas x 3 motores. Una celda falla en la primera pasada y resuelve en la segunda.
    const prompts = ["p1", "p2", "p3", "p4", "p5"];
    const engines = ["openai", "anthropic", "gemini"];

    const runs = prompts.flatMap((p) =>
      engines.map((e) => ({
        prompt_id: p,
        engine: e,
        outcome: p === "p3" && e === "gemini" ? "rate_limited" : "success",
        is_canonical: !(p === "p3" && e === "gemini"),
        attempt: 1,
      })),
    );

    const before = buildCellStates(runs);
    const pendientes = prompts.flatMap((p) => cellsNeedingRetry(before.get(p)!));
    expect(pendientes).toEqual(["gemini"]); // solo la celda que fallo

    // El reintento tiene exito.
    runs.push({ prompt_id: "p3", engine: "gemini", outcome: "success", is_canonical: true, attempt: 2 });

    const after = buildCellStates(runs);
    const canonicos = prompts.flatMap((p) => after.get(p)!).filter((c) => c.hasCanonical).length;
    expect(canonicos).toBe(15); // cobertura completa => completed => published
    expect(prompts.flatMap((p) => cellsNeedingRetry(after.get(p)!))).toEqual([]);
  });

  it("si el reintento tambien falla, la sesion sigue incompleta y NO se inventa nada", () => {
    const runs = [
      { prompt_id: "p1", engine: "gemini", outcome: "failed", is_canonical: false, attempt: 1 },
      { prompt_id: "p1", engine: "gemini", outcome: "failed", is_canonical: false, attempt: 2 },
      { prompt_id: "p1", engine: "gemini", outcome: "failed", is_canonical: false, attempt: 3 },
    ];
    const [c] = buildCellStates(runs).get("p1")!;
    expect(c.hasCanonical).toBe(false);
    expect(shouldRetryCell(c)).toBe(false); // agotado
    // Sin canonico => menos cobertura => partial => withheld. Nadie publica un score parcial.
  });
});
