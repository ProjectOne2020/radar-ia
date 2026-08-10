import type { AuditFindingDraft } from "./types";

// Pendiente de decision/acceso, igual que bing_copilot en M2 — no se implementa a medias
// en silencio. 03-ARQUITECTURA-TECNICA.md dice "via scraping ligero o API si esta
// disponible", pero:
// - La Google Business Profile API real requiere OAuth del DUEÑO de cada ficha (no hay
//   forma de consultar la ficha de un negocio ajeno con una sola API key de servicio).
// - La alternativa es la Places API (Text Search / Place Details) con una API key de
//   Google Maps Platform — API DISTINTA a GOOGLE_AI_API_KEY (esa es Generative Language,
//   no tiene Places habilitado). Da datos publicos: categoria, horarios, fotos, rating,
//   pero no "completitud" real del perfil tal como la ve el dueño.
// - Scraping directo del HTML de Google Maps esta contra los Terminos de Servicio de
//   Google y es fragil (rompe con cualquier cambio de layout) — no se implementa.
//
// Falta que el fundador decida: ¿conseguir una API key de Places (Google Maps Platform,
// tiene tier gratuito con limite mensual) y aceptar que el "chequeo de completitud" sea
// una aproximacion basada en datos publicos (categoria/horario/fotos/rating presentes o
// no), o dejar el pilar 2 sin automatizar por ahora y que el auditor humano lo revise a
// mano en la fase asistida (onboarding_type = 'assisted')?
export async function auditGoogleBusinessProfile(): Promise<AuditFindingDraft[]> {
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!placesApiKey) {
    return [
      {
        pillar: 2,
        finding:
          "Chequeo de Google Business Profile no disponible: falta GOOGLE_PLACES_API_KEY y decision de producto sobre que tan aproximado puede ser el chequeo de completitud.",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  // TODO: implementar contra Places API (Text Search + Place Details) una vez decidido.
  return [
    {
      pillar: 2,
      finding: "GOOGLE_PLACES_API_KEY presente pero el chequeo de completitud aun no esta implementado.",
      severity: "info",
      detail_locked: true,
    },
  ];
}
