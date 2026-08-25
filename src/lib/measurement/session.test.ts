import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SESSION_TIMEOUT_MS } from "./session";
import { hashPromptSet, hashPromptText, METHODOLOGY_VERSION } from "./versions";

// P0.2-B — Tests de integridad temporal y de sesion.
//
// Igual que en P0.1 y P0.2-A, muchos de estos tests verifican el CODIGO y el ESQUEMA en vez
// de ejecutar contra una base falsa. Es deliberado: las garantias de P0.2-B no son "en esta
// corrida no paso nada malo", son "esto es IMPOSIBLE" — y donde lo imposible lo garantiza un
// indice unico de Postgres o la ausencia de una arista en el grafo de modulos, comprobarlo
// con un mock probaria el mock, no el producto.
//
// Las migraciones reales aplicadas estan verificadas aparte, con SQL contra produccion.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const read = (...parts: string[]) => codeOnly(readFileSync(join(SRC, ...parts), "utf8"));
const readRaw = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");

describe("TEST 1 — una sola sesion pending/running por cliente", () => {
  it("existe el indice unico parcial que lo impide", () => {
    // La garantia NO es del codigo: es del indice
    // `measurement_sessions_one_open_per_client`, verificado en produccion.
    const source = read("lib", "measurement", "session.ts");
    expect(source).toMatch(/openSession/);
    // openSession traduce el 23505 (unique_violation) a null en vez de crear otra sesion.
    expect(source).toMatch(/23505/);
    expect(source).toMatch(/return null/);
  });
});

describe("TEST 2 — un retry no crea una segunda sesion", () => {
  it("todos los orquestadores abortan cuando openSession devuelve null", () => {
    const flows = [
      ["lib", "audit", "remeasure-client.ts"],
      ["lib", "audit", "upgrade-audit.ts"],
      ["lib", "cron", "remeasure-due-clients.ts"],
      ["lib", "free-audit", "run-free-audit.ts"],
      ["lib", "dashboard", "add-competitor.ts"],
      ["app", "api", "dashboard", "setup", "route.ts"],
    ];
    for (const file of flows) {
      const source = read(...file);
      expect(source, `${file.join("/")} debe abrir sesion`).toMatch(/openSession\(/);
      expect(source, `${file.join("/")} debe manejar el null`).toMatch(/if \(!session\)/);
    }
  });
});

describe("TEST 3 — una sesion zombi se libera", () => {
  it("el timeout es de 30 minutos (decision del fundador)", () => {
    expect(SESSION_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it("el barrido corre de forma perezosa dentro de openSession", () => {
    const source = read("lib", "measurement", "session.ts");
    const sweepDef = source.indexOf("export async function sweepZombieSessions");
    const openDef = source.indexOf("export async function openSession");
    const sweepCallInOpen = source.indexOf("sweepZombieSessions(admin, input.clientId)");
    expect(sweepDef).toBeGreaterThan(-1);
    // La llamada perezosa vive DENTRO de openSession: el candado se auto-cura sin depender
    // de que el cron llegue a tiempo.
    expect(sweepCallInOpen).toBeGreaterThan(openDef);
  });

  it("el cron tambien barre periodicamente", () => {
    expect(read("lib", "cron", "remeasure-due-clients.ts")).toMatch(/sweepZombieSessions\(admin\)/);
  });

  it("una sesion barrida queda failed, no completed", () => {
    const source = read("lib", "measurement", "session.ts");
    expect(source).toMatch(/execution_status: "failed"/);
    expect(source).toMatch(/timeout_zombie/);
  });
});

describe("TEST 4 y 5 — canonicos: retry failed→success da UNO, y dos success no pueden coexistir", () => {
  it("solo un outcome success marca is_canonical", () => {
    const source = read("lib", "ai-engines", "run-measurement.ts");
    // Las inserciones de fallo y de skip fijan is_canonical: false explicitamente.
    const canonicalTrue = source.match(/is_canonical: true/g) ?? [];
    const canonicalFalse = source.match(/is_canonical: false/g) ?? [];
    expect(canonicalTrue.length).toBe(1);
    expect(canonicalFalse.length).toBe(2);
  });

  it("la unicidad la impone la base, no el codigo", () => {
    // Indice `tracking_runs_one_canonical_per_cell`:
    //   UNIQUE (session_id, prompt_id, engine) WHERE is_canonical
    // Verificado aplicado en produccion. Aqui se comprueba que el codigo DOCUMENTA que la
    // garantia es estructural, para que nadie lo "arregle" con un filtro en JS.
    expect(readRaw("lib", "ai-engines", "run-measurement.ts")).toMatch(
      /indice unico parcial[\s\S]*?impide[\s\S]*?dos canonicos/i,
    );
  });

  it("un motor que ya tiene canonico no se vuelve a llamar (idempotencia + no gastar API)", () => {
    // La decision por celda vive en shouldRetryCell (retry.ts), probada de verdad en
    // retry.test.ts; aqui solo se comprueba que run-measurement la usa en vez de
    // reimplementarla.
    const source = read("lib", "ai-engines", "run-measurement.ts");
    expect(source).toMatch(/buildCellStates/);
    expect(source).toMatch(/shouldRetryCell\(cell\)/);
    expect(source).toMatch(/status: "already_measured"/);
  });

  it("el numero de intento se conserva", () => {
    expect(read("lib", "ai-engines", "run-measurement.ts")).toMatch(/attempt/);
  });
});

describe("TEST 6 — failed/timeout/rate_limited no equivalen a absent", () => {
  it("los errores se persisten con su outcome real y SIN canonico", () => {
    const source = read("lib", "ai-engines", "run-measurement.ts");
    expect(source).toMatch(/outcomeFromError/);
    expect(source).toMatch(/rate_limited/);
    expect(source).toMatch(/timeout/);
    expect(source).toMatch(/invalid_response/);
  });

  it("la UI de citas no muestra intentos fallidos como no-menciones", () => {
    expect(read("app", "dashboard", "citas", "page.tsx")).toMatch(/outcome", "success"/);
  });

  it("mentioned=false en un run fallido queda documentado como no-ausencia", () => {
    expect(readRaw("lib", "ai-engines", "run-measurement.ts")).toMatch(
      /NO significa "no aparecio"/,
    );
  });
});

describe("TEST 7 — skipped no entra al denominador", () => {
  it("closeSession descuenta los skipped del expected", () => {
    const source = read("lib", "measurement", "session.ts");
    expect(source).toMatch(/outcome", "skipped"/);
    expect(source).toMatch(/session\.expected_runs - \(skippedCount \?\? 0\)/);
  });
});

describe("TEST 8 — una sesion failed no publica snapshot", () => {
  it("solo execution_status completed publica", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/execution_status === "completed" \? "published" : "withheld"/);
  });

  it("el CHECK de la base lo impone tambien", () => {
    // constraint publication_requires_completed:
    //   publication_status <> 'published' OR execution_status = 'completed'
    // Verificado aplicado en produccion.
    expect(readRaw("lib", "scoring", "calculate-score.ts")).toMatch(/CHECK de la tabla lo\s*\n?\s*\/\/ impone/);
  });
});

describe("TEST 9 — un snapshot unico por sesion", () => {
  it("el upsert va por session_id", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/onConflict: "session_id"/);
  });
  // La unicidad real la da `ai_visibility_scores.session_id UNIQUE`, aplicado en la
  // migracion p02b_04 y verificado en produccion.
});

describe("TEST 10, 11 y 12 — trial: idempotente, atomico, y sin doble cobro en retry", () => {
  it("el consumo se delega a la RPC atomica, no a JS", () => {
    const source = read("lib", "admin", "trial-policy.ts");
    expect(source).toMatch(/consume_trial_audit_for_session/);
    expect(source).not.toMatch(/consumeTrialAuditIfActive/);
  });

  it("todos los consumos pasan un sessionId", () => {
    const source = read("lib", "admin", "trial-policy.ts");
    expect(source).toMatch(/sessionId: string/);
    expect(source).toMatch(/p_session_id: sessionId/);
  });

  it("la funcion de JS con lost update fue ELIMINADA, no reemplazada", () => {
    // Tenia 0 llamadores tras P0.2-B. Se borro en vez de dejarla como trampa: cualquiera
    // que la encontrara podria reintroducir el lost update y la no-idempotencia.
    expect(readRaw("lib", "admin", "trial-grant.ts")).not.toMatch(/consumeTrialAuditIfActive/);
    // grantTemporaryPlan si se conserva: sigue siendo como se otorga un trial.
    expect(readRaw("lib", "admin", "trial-grant.ts")).toMatch(/export async function grantTemporaryPlan/);
  });
});

describe("TEST 13 — los findings no se duplican dentro de una sesion", () => {
  it("run-audit ya no borra", () => {
    const source = read("lib", "audit", "run-audit.ts");
    expect(source).not.toMatch(/from\("audit_findings"\)\s*\.delete\(\)/);
    expect(source).not.toMatch(/\.delete\(\)\s*\.eq\("client_id"/);
  });

  it("inserta con upsert idempotente por (sesion, pilar, hallazgo)", () => {
    const source = read("lib", "audit", "run-audit.ts");
    expect(source).toMatch(/\.upsert\(/);
    expect(source).toMatch(/onConflict: "session_id,pillar,finding"/);
    expect(source).toMatch(/ignoreDuplicates: true/);
  });
});

describe("TEST 14 — findings de otra sesion no entran al score", () => {
  it("el score lee findings por session_id, nunca por client_id", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/from\("audit_findings"\)[\s\S]{0,120}\.eq\("session_id", sessionId\)/);
    expect(source).not.toMatch(/from\("audit_findings"\)[\s\S]{0,120}\.eq\("client_id"/);
  });

  it("ningun lector de findings de cara al cliente filtra solo por client_id", () => {
    const readers = [
      ["app", "dashboard", "hallazgos", "page.tsx"],
      ["lib", "reports", "send-report.ts"],
      ["app", "api", "free-audit", "report", "route.ts"],
      ["app", "api", "free-audit", "otp", "verify", "route.ts"],
    ];
    for (const file of readers) {
      const source = read(...file);
      expect(source, `${file.join("/")} debe usar el helper de snapshot`).toMatch(
        /findingsQueryForSnapshot/,
      );
    }
  });
});

describe("TEST 15 — Pilar 6 y Pilar 8 usan exactamente la misma poblacion", () => {
  it("ambos reciben el mismo array de canonicos", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/6: scorePillar6ExternalCitations\(runs\)/);
    expect(source).toMatch(/8: scorePillar8Tao\(runs\)/);
  });

  it("`runs` proviene de UNA consulta acotada a la sesion y a los canonicos", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/from\("tracking_runs"\)[\s\S]{0,200}\.eq\("session_id", sessionId\)[\s\S]{0,80}\.eq\("is_canonical", true\)/);
    expect(source).toMatch(/const runs = canonicalRuns \?\? \[\]/);
  });

  it("el pilar 8 sigue pasando por la compuerta de P0.1", () => {
    expect(read("lib", "scoring", "calculate-score.ts")).toMatch(/computeTaoFromRuns/);
  });
});

describe("TEST 16 — el score no puede leer legacy cuando recibe un session_id", () => {
  it("no queda ninguna consulta de scoring por client_id", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    // Las unicas lecturas por client_id que quedan son de EJE (sku_catalogs/app_listings),
    // que no aportan evidencia al score, solo deciden que variante de pilar aplicar.
    expect(source).not.toMatch(/from\("tracking_runs"\)[\s\S]{0,160}\.eq\("client_id"/);
    expect(source).not.toMatch(/from\("audit_findings"\)[\s\S]{0,160}\.eq\("client_id"/);
  });

  it("los datos legacy son inalcanzables por construccion", () => {
    // session_id de los 51 runs y 24 findings historicos es NULL; `where session_id = $1`
    // no puede devolver un NULL. No es un filtro que alguien deba recordar.
    expect(readRaw("lib", "scoring", "calculate-score.ts")).toMatch(/INALCANZABLES por construccion/);
  });

  it("ya no existe una funcion de score por cliente", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/export async function calculateScoreForSession/);
    expect(source).not.toMatch(/export async function calculateScoreForClient/);
  });
});

describe("TEST 17 — el score legacy permanece intacto y separado", () => {
  it("la metodologia vigente es 2.0.0", () => {
    expect(METHODOLOGY_VERSION).toBe("2.0.0");
  });

  it("el snapshot actual distingue legacy por methodology_version", () => {
    expect(read("lib", "measurement", "current-snapshot.ts")).toMatch(
      /isLegacy: row\.methodology_version !== METHODOLOGY_VERSION/,
    );
  });

  it("las alertas no comparan a traves de metodologias", () => {
    expect(read("lib", "reports", "check-alerts.ts")).toMatch(/METHODOLOGY_VERSION/);
  });

  it("el listado publico separa legacy de v2 en vez de mezclarlos", () => {
    const source = read("app", "listado", "page.tsx");
    expect(source).toMatch(/METHODOLOGY_VERSION/);
    // Los legacy siguen VISIBLES (no desaparece un negocio ya medido)...
    expect(source).toMatch(/legacyByClient/);
    expect(source).toMatch(/isLegacy/);
    // ...pero nunca compiten en el mismo orden que los v2.
    expect(source).toMatch(/rows\.filter\(\(r\) => !r\.isLegacy\)/);
    expect(source).toMatch(/rows\.filter\(\(r\) => r\.isLegacy\)/);
    expect(source).toMatch(/\[\.\.\.current, \.\.\.legacy\]/);
  });

  it("un score legacy no muestra tendencia (implicaria continuidad inexistente)", () => {
    expect(read("app", "listado", "page.tsx")).toMatch(/if \(previous && !isLegacy\)/);
  });

  it("el listado etiqueta el score legacy en los tres idiomas", () => {
    const source = read("app", "listado", "page.tsx");
    expect(source).toMatch(/legacyBadge/);
    for (const locale of ["es", "en", "pt"]) {
      const catalog = JSON.parse(readFileSync(join(ROOT, "messages", `${locale}.json`), "utf8"));
      expect(catalog.Listado.legacyBadge, locale).toBeTruthy();
    }
  });

  it("el delta queda en null cuando no es comparable", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/deltaTotal: null, comparability: "not_comparable"/);
  });
});

describe("TEST 18 y 19 — dashboard: legacy con disclaimer, v2 con snapshot publicado", () => {
  it("sin snapshot v2 se cae al legacy marcado", () => {
    const source = read("lib", "measurement", "current-snapshot.ts");
    // Primero busca publicado + metodologia vigente; si no hay, el ultimo score existente.
    expect(source).toMatch(/publication_status", "published"/);
    expect(source).toMatch(/methodology_version", METHODOLOGY_VERSION/);
    expect(source).toMatch(/if \(current\) return toSnapshot/);
  });

  it("un snapshot v2 withheld NUNCA se presenta como score actual", () => {
    // Una sesion partial/failed no publica. Si el fallback lo recogiera, se mostraria como
    // "tu score" sin marca alguna — dando por verificado justo lo que el sistema decidio
    // no verificar. El fallback esta restringido a metodologias anteriores.
    const source = read("lib", "measurement", "current-snapshot.ts");
    expect(source).toMatch(/\.neq\("methodology_version", METHODOLOGY_VERSION\)/);
  });

  it("el reporte y las alertas solo salen si ESTA medicion se publico", () => {
    // Si no, sendReportForClient describiria el score publicado ANTERIOR y se le enviaria
    // al cliente como si fuera el resultado de la medicion de hoy.
    const source = read("lib", "cron", "remeasure-due-clients.ts");
    expect(source).toMatch(/if \(score\.publicationStatus === "published"\)/);
    // Se comparan las LLAMADAS, no los imports (que estan arriba del archivo).
    const guard = source.indexOf('score.publicationStatus === "published"');
    expect(source.indexOf("sendReportForClient(sub.client_id)")).toBeGreaterThan(guard);
    expect(source.indexOf("checkAndSendAlerts(sub.client_id)")).toBeGreaterThan(guard);
  });

  it("el dashboard muestra el aviso legacy", () => {
    const source = read("app", "dashboard", "page.tsx");
    expect(source).toMatch(/snapshot\?\.isLegacy/);
    expect(source).toMatch(/legacyNotice/);
  });

  it("el aviso existe en los tres idiomas", () => {
    for (const locale of ["es", "en", "pt"]) {
      const catalog = JSON.parse(readFileSync(join(ROOT, "messages", `${locale}.json`), "utf8"));
      expect(catalog.Dashboard.legacyNotice, locale).toBeTruthy();
      expect(catalog.Dashboard.coverageNote, locale).toBeTruthy();
    }
  });

  it("la evidencia mostrada es la de la sesion del snapshot, no el historico", () => {
    const source = read("app", "dashboard", "page.tsx");
    expect(source).toMatch(/snapshot\?\.sessionId/);
    expect(source).toMatch(/\.eq\("session_id", snapshot\.sessionId\)/);
    expect(source).toMatch(/\.eq\("is_canonical", true\)/);
    // Y ya NO existe la lectura global que promediaba toda la historia.
    expect(source).not.toMatch(/from\("tracking_runs"\)\.select\([^)]*\),?\s*\]/);
  });
});

describe("TEST 20 — reproducibilidad: mismo session_id + mismo contenido = mismo score", () => {
  it("recalcular una sesion es idempotente (upsert, no insert)", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    expect(source).toMatch(/\.upsert\(/);
    expect(source).toMatch(/onConflict: "session_id"/);
    expect(source).not.toMatch(/from\("ai_visibility_scores"\)\s*\.insert\(/);
  });

  it("los hashes son deterministas y estables ante el orden", () => {
    expect(hashPromptText("¿Cuál es el mejor dentista en Monterrey?")).toBe(
      hashPromptText("  ¿Cuál es el mejor dentista en Monterrey?  "),
    );
    expect(hashPromptSet(["b", "a", "c"])).toBe(hashPromptSet(["a", "b", "c"]));
    expect(hashPromptSet(["a", "b"])).not.toBe(hashPromptSet(["a", "b", "c"]));
  });

  it("las versiones quedan congeladas en el snapshot", () => {
    const source = read("lib", "scoring", "calculate-score.ts");
    for (const field of ["methodology_version", "scoring_version", "classifier_version", "code_sha"]) {
      expect(source, field).toMatch(new RegExp(`${field}:`));
    }
    expect(source).toMatch(/coverage_expected/);
    expect(source).toMatch(/coverage_successful/);
  });

  it("cada run congela lo necesario para reconstruirlo", () => {
    const source = read("lib", "ai-engines", "run-measurement.ts");
    for (const field of [
      "prompt_text_executed",
      "prompt_hash",
      "classifier_version",
      "provider",
      "model_requested",
      "model_resolved",
      "request_config",
      "request_config_hash",
      "response_raw",
    ]) {
      expect(source, field).toMatch(new RegExp(`${field}:`));
    }
  });

  it("los tres motores reportan el modelo que realmente respondio", () => {
    for (const engine of ["openai", "anthropic", "gemini"]) {
      expect(read("lib", "ai-engines", `${engine}.ts`), engine).toMatch(/modelResolved:/);
      expect(read("lib", "ai-engines", `${engine}.ts`), engine).toMatch(/requestConfig/);
    }
  });
});

describe("invariante de arquitectura — el calculo del score sigue sin tocar el trial", () => {
  it("calculate-score.ts no tiene ninguna arista al trial (P0.2-A, sostenido)", () => {
    expect(read("lib", "scoring", "calculate-score.ts")).not.toMatch(
      /trial-grant|trial-policy|consumeTrialAudit|trial_grants|audits_remaining/,
    );
  });
});
