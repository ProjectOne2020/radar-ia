import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { consumesTrialAudit, type MeasurementTrigger } from "./trial-policy";

// P0.2-A — Tests de seguridad del trial.
//
// Buena parte de estos tests leen CODIGO FUENTE en vez de ejecutar la funcion. Es
// deliberado: el invariante que P0.2-A establece no es "en esta corrida no se descuento",
// es "el calculo del score NO TIENE forma de descontar". Eso es una propiedad del grafo de
// dependencias, y la unica manera honesta de verificarla sin una base de datos falsa —que
// probaria el mock, no el producto— es comprobar el grafo.
//
// Es el mismo criterio de P0.1: la garantia vive en la estructura, no en la disciplina.

const SRC = join(process.cwd(), "src");

/**
 * Quita comentarios de bloque y lineas que son SOLO comentario.
 *
 * Importa: el invariante que se verifica es sobre el CODIGO, no sobre la prosa. Los
 * modulos que ya no consumen llevan un comentario explicando por que — y ese comentario
 * necesariamente nombra `consumeTrialAuditIfActive`. Sin este filtro, documentar bien la
 * decision haria fallar el test, que es exactamente el incentivo equivocado.
 *
 * Solo se eliminan lineas cuyo contenido EMPIEZA por `//`, nunca comentarios al final de
 * una linea de codigo: asi una URL con `//` dentro de un string no puede truncar codigo
 * real y esconder una llamada.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const read = (...parts: string[]) => codeOnly(readFileSync(join(SRC, ...parts), "utf8"));
/** Fuente sin filtrar, para los tests que si verifican que la documentacion existe. */
const readRaw = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");

const all = (ts: MeasurementTrigger[]) => ts.every(consumesTrialAudit);
const none = (ts: MeasurementTrigger[]) => ts.every((t) => !consumesTrialAudit(t));

/** Cualquier via por la que un modulo podria descontar del trial. */
const TRIAL_REFERENCE = /trial-grant|trial-policy|consumeTrialAudit|trial_grants|audits_remaining/;

const SCORING_MODULES = [
  ["lib", "scoring", "calculate-score.ts"],
  ["lib", "scoring", "pillar-scorers.ts"],
  ["lib", "scoring", "weights.ts"],
  ["lib", "metrics", "tao.ts"],
];

// Flujos que SI deben consumir: el producto entrega al cliente una medicion nueva por su
// propia cadencia.
const CONSUMING_FLOWS: Array<{ file: string[]; trigger: MeasurementTrigger }> = [
  { file: ["lib", "cron", "remeasure-due-clients.ts"], trigger: "cron_scheduled" },
  { file: ["app", "api", "dashboard", "setup", "route.ts"], trigger: "dashboard_setup" },
];

// Flujos que declaran su trigger pero NO consumen (decision del fundador al cerrar
// P0.2-A). Declaran igual para que el "por que" viva en el sitio donde se mide y la
// politica siga centralizada: si mañana la decision cambia, cambia en un solo archivo.
const DECLARED_NON_CONSUMING_FLOWS: Array<{ file: string[]; trigger: MeasurementTrigger }> = [
  { file: ["lib", "audit", "remeasure-client.ts"], trigger: "admin_manual_remeasure" },
  { file: ["lib", "audit", "upgrade-audit.ts"], trigger: "upgrade_after_payment" },
];

/** Todo flujo que llama al consumo, consuma o no: para el test de orden (TEST 6). */
const FLOWS_WITH_CONSUME_CALL = [...CONSUMING_FLOWS, ...DECLARED_NON_CONSUMING_FLOWS];

// Flujos sin ninguna arista al trial.
const NON_CONSUMING_FLOWS = [
  ["lib", "free-audit", "run-free-audit.ts"],
  ["lib", "dashboard", "add-competitor.ts"],
];

describe("TEST 1 — calcular un score no puede consumir trial", () => {
  it("calculate-score.ts no referencia el trial por ninguna via", () => {
    expect(read("lib", "scoring", "calculate-score.ts")).not.toMatch(TRIAL_REFERENCE);
  });

  it("ningun modulo del subsistema de scoring referencia el trial", () => {
    for (const mod of SCORING_MODULES) {
      expect(read(...mod), `${mod.join("/")} no debe tocar el trial`).not.toMatch(TRIAL_REFERENCE);
    }
  });
});

describe("TEST 2 — llamadas repetidas al calculo no consumen", () => {
  it("no existe ruta de consumo desde el calculo, luego N llamadas consumen 0", () => {
    // Si el modulo no puede consumir una vez, tampoco puede consumir dos. La invariante
    // se sostiene por ausencia de la arista en el grafo, no por un contador.
    expect(read("lib", "scoring", "calculate-score.ts")).not.toMatch(TRIAL_REFERENCE);
    // Y la decision queda documentada en el archivo para quien lea despues.
    expect(readRaw("lib", "scoring", "calculate-score.ts")).toMatch(/NO reintroducir la llamada aqui/);
  });
});

describe("TEST 3 — recalcular o visualizar no consume", () => {
  it('el trigger "score_recalculation" no consume', () => {
    expect(consumesTrialAudit("score_recalculation")).toBe(false);
  });

  it("/api/score no tiene ninguna via de consumo", () => {
    expect(read("app", "api", "score", "route.ts")).not.toMatch(/trial-grant|trial-policy|consumeTrialAudit/);
  });

  it("el dashboard no consume al mostrar metricas", () => {
    expect(read("app", "dashboard", "page.tsx")).not.toMatch(TRIAL_REFERENCE);
  });
});

describe("TEST 4 — los flujos facturables siguen consumiendo", () => {
  for (const { file, trigger } of CONSUMING_FLOWS) {
    it(`${file.join("/")} consume con trigger "${trigger}"`, () => {
      const source = read(...file);
      expect(source).toMatch(/consumeTrialAuditForMeasurement/);
      expect(source).toContain(`"${trigger}"`);
      expect(consumesTrialAudit(trigger)).toBe(true);
    });
  }
});

describe("TEST 5 — los flujos no facturables siguen sin consumir", () => {
  for (const file of NON_CONSUMING_FLOWS) {
    it(`${file.join("/")} no tiene ninguna arista al trial`, () => {
      expect(read(...file)).not.toMatch(TRIAL_REFERENCE);
    });
  }

  it("free_audit y competitor_snapshot estan declarados como no consumidores", () => {
    expect(consumesTrialAudit("free_audit")).toBe(false);
    expect(consumesTrialAudit("competitor_snapshot")).toBe(false);
  });

  // Cierre de P0.2-A: el trabajo interno de admin y la activacion tras un pago dejan de
  // gastar auditorias del trial.
  for (const { file, trigger } of DECLARED_NON_CONSUMING_FLOWS) {
    it(`${file.join("/")} declara "${trigger}" pero NO consume`, () => {
      const source = read(...file);
      expect(source).toMatch(/consumeTrialAuditForMeasurement/);
      expect(source).toContain(`"${trigger}"`);
      expect(consumesTrialAudit(trigger)).toBe(false);
    });
  }

  it("depurar un cliente desde /admin no le agota el trial", () => {
    expect(consumesTrialAudit("admin_manual_remeasure")).toBe(false);
  });

  it("pagar no cuesta ademas una auditoria del trial", () => {
    expect(consumesTrialAudit("upgrade_after_payment")).toBe(false);
  });
});

describe("TEST 6 — un fallo del calculo no produce consumo accidental", () => {
  for (const { file } of FLOWS_WITH_CONSUME_CALL) {
    it(`${file.join("/")} consume DESPUES de calcular, no antes`, () => {
      const source = read(...file);
      const calcAt = source.indexOf("calculateScoreForClient(");
      const consumeAt = source.indexOf("consumeTrialAuditForMeasurement(");
      expect(calcAt).toBeGreaterThan(-1);
      expect(consumeAt).toBeGreaterThan(-1);
      // Si el await del calculo lanza, la linea de consumo nunca se alcanza.
      expect(consumeAt).toBeGreaterThan(calcAt);
    });
  }
});

describe("TEST 7 — reintento (alcance real de P0.2-A)", () => {
  it("reintentar SOLO el calculo del score no consume nada, cuantas veces sea", () => {
    // Esto es lo que P0.2-A si garantiza: el calculo es puro respecto del trial.
    expect(read("lib", "scoring", "calculate-score.ts")).not.toMatch(TRIAL_REFERENCE);
  });

  it("LIMITACION CONOCIDA: reintentar el FLUJO COMPLETO si consume de nuevo", () => {
    // No hay identidad durable de "esta medicion concreta" hasta measurement_sessions,
    // asi que dos ejecuciones completas del mismo flujo son indistinguibles de dos
    // auditorias legitimas. Ya era cierto antes de P0.2-A; no empeora aqui.
    // Este test documenta el hueco a proposito — se cierra en P0.2-B.
    const policy = readRaw("lib", "admin", "trial-policy.ts");
    expect(policy).toMatch(/NO ES IDEMPOTENTE TODAVIA/);
    expect(policy).toMatch(/P0\.2-B/);
  });
});

describe("politica de consumo — cobertura exhaustiva", () => {
  it("todos los triggers tienen una politica declarada", () => {
    const all: MeasurementTrigger[] = [
      "cron_scheduled",
      "admin_manual_remeasure",
      "upgrade_after_payment",
      "dashboard_setup",
      "free_audit",
      "competitor_snapshot",
      "score_recalculation",
    ];
    for (const t of all) {
      expect(typeof consumesTrialAudit(t)).toBe("boolean");
    }
  });

  it("solo consumen los dos triggers de cadencia del producto", () => {
    expect(all(["cron_scheduled", "dashboard_setup"])).toBe(true);
    expect(
      none([
        "admin_manual_remeasure",
        "upgrade_after_payment",
        "free_audit",
        "competitor_snapshot",
        "score_recalculation",
      ]),
    ).toBe(true);
  });
});
