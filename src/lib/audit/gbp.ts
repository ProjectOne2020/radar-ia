import type { AuditFindingDraft } from "./types";

// Pilar 2 (20%, el de mayor peso) — diseño de dos niveles, decidido explicitamente por
// el fundador para no dejar el peso mas alto del score sin medir ni aproximado:
//
// NIVEL 1 (esta funcion) — auditoria gratis, competidores, cualquier negocio ajeno:
// usa Google Places API (Text Search + Place Details), que es publica y no requiere ser
// dueño del listado. Da una APROXIMACION basada en datos publicos (categoria, horario,
// fotos, rating, si hay sitio web enlazado) — nunca la completitud real que ve el dueño
// (atributos internos, preguntas y respuestas, actividad de publicaciones, estado de
// verificacion). Cada finding lo deja explicito en el texto ("según datos públicos") y
// nunca se reporta con la misma certeza que un hallazgo 100% verificable como robots.txt
// o schema.org — misma disciplina que 02-METODOLOGIA-SCORING.md exige para no repetir el
// error de mezclar proxies con medicion directa.
//
// NIVEL 2 (pendiente, fuera de alcance de M3) — clientes pagados: el cliente conecta su
// Google Business Profile real via OAuth (durante onboarding o desde el dashboard) y ahi
// se obtiene la completitud real. Esto requiere sesion de usuario (M5) y una superficie en
// el dashboard para iniciar el flujo OAuth (M7), ademas de un client_id/secret de OAuth de
// Google Cloud (credencial nueva, distinta de GOOGLE_PLACES_API_KEY) — se construye cuando
// esos modulos existan, no aqui. Es tambien el argumento de venta explicito para pasar de
// gratis a pagado en este pilar especifico.
//
// GOOGLE_PLACES_API_KEY es una API key DISTINTA de GOOGLE_AI_API_KEY (esa es Generative
// Language / Gemini) — debe crearse restringida solo a Places API en Google Cloud Console,
// y requiere facturacion activa en el proyecto (aunque el uso se mantenga en el credito
// gratuito mensual de Google Maps Platform).

interface GbpAuditParams {
  businessName: string;
  city: string | null;
}

interface PlaceSearchResult {
  place_id: string;
  name: string;
}

interface PlaceDetails {
  name?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
  photos?: unknown[];
  types?: string[];
}

export async function auditGoogleBusinessProfile({
  businessName,
  city,
}: GbpAuditParams): Promise<AuditFindingDraft[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return [
      {
        pillar: 2,
        finding:
          "Chequeo de Google Business Profile no disponible: falta GOOGLE_PLACES_API_KEY (API key distinta de GOOGLE_AI_API_KEY, requiere facturacion activa en Google Cloud).",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  const query = city ? `${businessName} ${city}` : businessName;
  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
  );
  const searchData = await searchRes.json();

  if (searchData.status === "REQUEST_DENIED" || searchData.status === "INVALID_REQUEST") {
    return [
      {
        pillar: 2,
        finding: `Error consultando Google Places API: ${searchData.status} — ${searchData.error_message ?? "sin detalle"}.`,
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  const results: PlaceSearchResult[] = searchData.results ?? [];
  if (results.length === 0) {
    return [
      {
        pillar: 2,
        finding: `No se encontró una ficha de Google Business Profile pública para "${businessName}"${city ? ` en ${city}` : ""} (según búsqueda pública de Google Places).`,
        severity: "warning",
        detail_locked: false,
      },
    ];
  }

  const placeId = results[0].place_id;
  const fields = "name,formatted_phone_number,website,rating,user_ratings_total,business_status,opening_hours,photos,types";
  const detailsRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
  );
  const detailsData = await detailsRes.json();
  const place: PlaceDetails = detailsData.result ?? {};

  const findings: AuditFindingDraft[] = [];

  const missing: string[] = [];
  if (!place.opening_hours?.weekday_text) missing.push("horario");
  if (!place.website) missing.push("sitio web enlazado");
  if (!place.photos || place.photos.length === 0) missing.push("fotos");
  if (!place.formatted_phone_number) missing.push("teléfono");

  findings.push({
    pillar: 2,
    finding:
      missing.length === 0
        ? `Según datos públicos de Google Places, la ficha de "${place.name ?? businessName}" tiene los campos básicos completos (horario, sitio, fotos, teléfono). No se puede verificar completitud interna real (preguntas y respuestas, publicaciones, verificación) sin que el cliente conecte su cuenta.`
        : `Según datos públicos de Google Places, a la ficha de "${place.name ?? businessName}" le falta: ${missing.join(", ")}. Esta es una aproximación pública, no la completitud real que ve el dueño del perfil.`,
    severity: missing.length === 0 ? "info" : "warning",
    detail_locked: false,
  });

  // Pilar 7 (reputación/reseñas) es distinto del pilar 2 (completitud de perfil) —
  // 02-METODOLOGIA-SCORING.md los trata como pilares separados con pesos propios.
  if (place.rating !== undefined) {
    const reviewCount = place.user_ratings_total ?? 0;
    findings.push({
      pillar: 7,
      finding:
        reviewCount > 0
          ? `Según datos públicos, el negocio tiene reseñas públicas en Google (rating ${place.rating}).`
          : "Según datos públicos, el negocio no tiene reseñas públicas en Google.",
      severity: reviewCount > 0 ? "info" : "warning",
      detail_locked: false,
    });
    findings.push({
      pillar: 7,
      finding: `Según datos públicos: rating ${place.rating} con ${reviewCount} reseñas en Google.`,
      severity: "info",
      detail_locked: true,
    });
  }

  findings.push({
    pillar: 2,
    finding:
      "Este chequeo usa datos públicos aproximados. Conectar tu Google Business Profile real (plan pagado) da la completitud exacta que ve el dueño del perfil, incluyendo atributos internos y estado de verificación.",
    severity: "info",
    detail_locked: false,
  });

  return findings;
}
