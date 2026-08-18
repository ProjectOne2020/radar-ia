// M16 — Google Play NO tiene una API publica oficial (a diferencia de iTunes, ver
// itunes.ts) — decision explicita del fundador: leer el HTML publico de la ficha
// (misma tecnica de "fetch crudo" que ya usa src/lib/audit/schema.ts), best-effort. Si
// Google cambia el HTML y esto deja de encontrar un campo, se reporta measured:false para
// ese campo — nunca se inventa un valor. Mas fragil que iTunes por diseño, aceptado así.
export interface PlayStoreAppDetails {
  title: string | null;
  description: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  hasScreenshot: boolean;
}

export async function fetchPlayStoreAppDetails(packageId: string): Promise<PlayStoreAppDetails | null> {
  const res = await fetch(
    `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=es`,
    { headers: { "User-Agent": "RadarIA-Audit/1.0" } }
  );
  if (!res.ok) return null;

  const html = await res.text();

  return {
    title: extractMeta(html, "og:title"),
    description: extractMeta(html, "og:description"),
    ratingValue: extractRatingValue(html),
    ratingCount: extractRatingCount(html),
    hasScreenshot: extractMeta(html, "og:image") !== null,
  };
}

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']*)["']`, "i");
  const match = html.match(regex);
  return match ? match[1] : null;
}

// Google Play no expone microdata itemprop (se intentó y no coincide con el HTML real,
// verificado en vivo agosto 2026) — el rating vive en un aria-label en español (se pide
// la pagina con hl=es), formato "Valoración: 4,7 estrellas de cinco". Si Google cambia
// el wording, esto deja de matchear y ratingValue/ratingCount vuelven null — measured:false
// para ese campo en el scorer, nunca un valor inventado.
function extractRatingValue(html: string): number | null {
  const match = html.match(/aria-label="Valoración:\s*([\d,]+)\s*estrellas de cinco"/);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

function extractRatingCount(html: string): number | null {
  const match = html.match(/aria-label="([\d.,]+)\s*reseñas de la valoración por estrellas/);
  if (!match) return null;
  return Number(match[1].replace(/\./g, "").replace(",", "."));
}
