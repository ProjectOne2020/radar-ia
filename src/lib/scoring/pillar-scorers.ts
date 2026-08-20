interface FindingRow {
  finding: string;
  severity: string | null;
}

export interface PillarScore {
  subscore: number; // 0-100
  measured: boolean; // false = sin datos suficientes, subscore se trata como 0 en el total
}

function aggregate(values: Array<number | null>): PillarScore {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return { subscore: 0, measured: false };
  const avg = known.reduce((a, b) => a + b, 0) / known.length;
  return { subscore: avg, measured: true };
}

// Los textos de finding que se parsean aqui son escritos por nuestro propio codigo en
// src/lib/audit/*.ts — el matching por substring es deterministico, no fragil ante datos
// de terceros, porque no depende de texto que no controlamos.

// Pilar 1 — NAP (12%)
export function scorePillar1Nap(findings: FindingRow[]): PillarScore {
  const values = findings.map((f) => {
    if (f.finding.includes("no coincide con el registrado")) return 20;
    if (f.finding.includes("coincide con el registrado")) return 100;
    if (f.finding.includes("no declara telefono") || f.finding.includes("no declara teléfono")) return 60;
    return null; // "No se encontro un schema de negocio..." — sin dato suficiente
  });
  return aggregate(values);
}

// Pilar 2 — GBP / presencia local (20%, nivel 1: aproximacion publica via Places API)
export function scorePillar2Gbp(findings: FindingRow[]): PillarScore {
  const values = findings.map((f) => {
    if (f.finding.includes("No se encontró una ficha")) return 0;
    if (f.finding.includes("campos básicos completos")) return 100;
    if (f.finding.includes("le falta:")) return 50;
    return null; // no disponible / error / el disclaimer de "conecta tu perfil real"
  });
  return aggregate(values);
}

// Pilar 3 — Crawlability (~70%) + schema (~30%), sub-ponderacion de
// 02-METODOLOGIA-SCORING.md. Las findings de indexacion de Bing (pillar 3 en DB, pero no
// parte de esta formula segun el documento) se excluyen explicitamente.
export function scorePillar3Crawlability(findings: FindingRow[]): PillarScore {
  const nonBing = findings.filter((f) => !f.finding.toLowerCase().includes("bing"));

  const crawlabilityValues = nonBing.map((f) => {
    if (f.finding.includes("bloquea el acceso de uno o mas motores") || f.finding.includes("bloquea el acceso de uno o más motores")) return 0;
    if (f.finding.includes("permite el acceso de los motores")) return 100;
    if (f.finding.includes("no tiene robots.txt")) return 100;
    return null; // "No se pudo obtener robots.txt", detalle por-bot, sin sitio, etc.
  });

  const schemaValues = nonBing.map((f) => {
    if (f.finding.includes("tiene datos estructurados de Organization/LocalBusiness")) return 100;
    if (f.finding.includes("tiene JSON-LD pero no declara Organization")) return 50;
    if (f.finding.includes("no tiene datos estructurados (JSON-LD)")) return 0;
    return null;
  });

  const crawlability = aggregate(crawlabilityValues);
  const schema = aggregate(schemaValues);

  if (!crawlability.measured && !schema.measured) return { subscore: 0, measured: false };
  if (!crawlability.measured) return schema; // renormaliza al unico sub-factor medido
  if (!schema.measured) return crawlability;

  return { subscore: 0.7 * crawlability.subscore + 0.3 * schema.subscore, measured: true };
}

// Pilar 4 — Estructura semantica (8%)
export function scorePillar4Semantic(findings: FindingRow[]): PillarScore {
  const values = findings.map((f) => {
    if (f.finding.includes("declara servicios/productos")) return 100;
    if (f.finding.includes("no declara servicios ni productos")) return 0;
    return null;
  });
  return aggregate(values);
}

// Pilar 2 — variante e-commerce (20%): completitud del feed de Google Merchant Center,
// en vez de Google Business Profile (02-METODOLOGIA-SCORING.md, M14).
export function scorePillar2Merchant(findings: FindingRow[]): PillarScore {
  for (const f of findings) {
    const match = f.finding.match(/Feed de Merchant Center: (\d+)\/(\d+) productos con campos requeridos completos/);
    if (match) {
      const complete = Number(match[1]);
      const total = Number(match[2]);
      if (total === 0) return { subscore: 0, measured: false };
      return { subscore: (complete / total) * 100, measured: true };
    }
  }
  return { subscore: 0, measured: false };
}

// Pilar 4 — variante e-commerce (8%): GTIN + consistencia feed-vs-sitio, en vez de
// jerarquia Organization->LocalBusiness->Servicios (02-METODOLOGIA-SCORING.md, M14).
export function scorePillar4Ecommerce(findings: FindingRow[]): PillarScore {
  const values: Array<number | null> = [];

  for (const f of findings) {
    const crossCheckMatch = f.finding.match(/Cross-check feed vs sitio: (\d+)\/(\d+) productos revisados coinciden/);
    if (crossCheckMatch) {
      const total = Number(crossCheckMatch[2]);
      values.push(total === 0 ? null : (Number(crossCheckMatch[1]) / total) * 100);
    }

    const gtinMatch = f.finding.match(/(\d+)\/(\d+) productos del feed declaran GTIN/);
    if (gtinMatch) {
      const total = Number(gtinMatch[2]);
      values.push(total === 0 ? null : (Number(gtinMatch[1]) / total) * 100);
    }
  }

  return aggregate(values);
}

// Pilar 2 — variante apps (20%): completitud de la ficha en App Store / Google Play, en
// vez de GBP o Merchant Center (02-METODOLOGIA-SCORING.md, M16). Aggregate() promedia
// entre las tiendas configuradas (una o ambas).
export function scorePillar2AppStore(findings: FindingRow[]): PillarScore {
  const values: Array<number | null> = [];

  for (const f of findings) {
    const appleMatch = f.finding.match(/Ficha de la app en Apple App Store: (\d+)\/(\d+) campos requeridos completos/);
    if (appleMatch) {
      const total = Number(appleMatch[2]);
      values.push(total === 0 ? null : (Number(appleMatch[1]) / total) * 100);
    }

    const playMatch = f.finding.match(/Ficha de la app en Google Play: (\d+)\/(\d+) campos requeridos completos/);
    if (playMatch) {
      const total = Number(playMatch[2]);
      values.push(total === 0 ? null : (Number(playMatch[1]) / total) * 100);
    }
  }

  return aggregate(values);
}

// Pilar 4 — variante apps (8%): schema.org SoftwareApplication en la landing page, en vez
// de Organization->LocalBusiness o Product->Offer (02-METODOLOGIA-SCORING.md, M16).
export function scorePillar4App(findings: FindingRow[]): PillarScore {
  const values = findings.map((f) => {
    if (f.finding.includes("declara SoftwareApplication con operatingSystem y applicationCategory")) return 100;
    if (f.finding.includes("declara SoftwareApplication pero le falta")) return 50;
    if (f.finding.includes("no declara schema SoftwareApplication, MobileApplication ni WebApplication")) return 0;
    return null;
  });
  return aggregate(values);
}

// Pilar 7 — variante apps (8%): rating y numero de resenas de la tienda — a diferencia de
// e-commerce (measured:false por falta de fuente), aqui SI hay un dato publico real
// (02-METODOLOGIA-SCORING.md, M16).
export function scorePillar7AppRating(findings: FindingRow[]): PillarScore {
  const values: Array<number | null> = [];

  for (const f of findings) {
    const match = f.finding.match(/La app tiene rating ([\d.]+) en (?:Apple App Store|Google Play) con/);
    if (match) {
      values.push(Math.min(100, (Number(match[1]) / 5) * 100));
    }
  }

  return aggregate(values);
}

// Pilar 5 — Cobertura de preguntas (12%). Parsea el formato "N/M respondidas" que
// src/lib/audit/question-coverage.ts escribe deliberadamente para esto.
export function scorePillar5QuestionCoverage(findings: FindingRow[]): PillarScore {
  for (const f of findings) {
    const match = f.finding.match(/Cobertura de preguntas: (\d+)\/(\d+) respondidas/);
    if (match) {
      const answered = Number(match[1]);
      const total = Number(match[2]);
      if (total === 0) return { subscore: 0, measured: false };
      return { subscore: (answered / total) * 100, measured: true };
    }
  }
  return { subscore: 0, measured: false };
}

// Pilar 7 — Reputacion/resenas (8%). Parsea el rating del finding de resumen (no el
// detalle locked, que es texto redundante para evitar contarlo doble).
export function scorePillar7Reputation(findings: FindingRow[]): PillarScore {
  for (const f of findings) {
    if (f.finding.includes("no tiene reseñas públicas")) return { subscore: 0, measured: true };
    const match = f.finding.match(/tiene reseñas públicas en Google \(rating ([\d.]+)\)/);
    if (match) {
      const rating = Number(match[1]);
      return { subscore: Math.min(100, (rating / 5) * 100), measured: true };
    }
  }
  return { subscore: 0, measured: false };
}
