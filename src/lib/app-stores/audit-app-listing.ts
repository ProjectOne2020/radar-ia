import type { AuditFindingDraft } from "@/lib/audit/types";
import { fetchItunesAppDetails } from "./itunes";
import { fetchPlayStoreAppDetails } from "./play-store";

// M16 — pilar 2 variante "apps" (20%): completitud de la ficha en las tiendas, sustituye
// a Google Business Profile / Google Merchant Center (02-METODOLOGIA-SCORING.md).
// Pilar 7 variante "apps" (8%): rating y numero de resenas de la tienda — a diferencia de
// e-commerce (measured:false por falta de fuente), aqui SI hay un dato publico real en
// ambas tiendas, asi que se mide de verdad.
export async function auditAppListing(
  appName: string,
  iosAppId: string | null,
  androidPackageId: string | null
): Promise<AuditFindingDraft[]> {
  if (!iosAppId && !androidPackageId) {
    return [
      {
        pillar: 2,
        finding: `El catálogo de la app "${appName}" no tiene ios_app_id ni android_package_id configurado — no se puede auditar la ficha de tienda.`,
        severity: "critical",
        detail_locked: false,
      },
    ];
  }

  const findings: AuditFindingDraft[] = [];

  if (iosAppId) {
    const apple = await fetchItunesAppDetails(iosAppId);
    findings.push(...buildAppleFindings(apple, appName));
  }

  if (androidPackageId) {
    const play = await fetchPlayStoreAppDetails(androidPackageId);
    findings.push(...buildPlayFindings(play, appName));
  }

  return findings;
}

function buildAppleFindings(apple: Awaited<ReturnType<typeof fetchItunesAppDetails>>, appName: string): AuditFindingDraft[] {
  if (!apple) {
    return [
      {
        pillar: 2,
        finding: `No se encontró la app "${appName}" en Apple App Store (iTunes Search API) — verifica el ios_app_id.`,
        severity: "warning",
        detail_locked: false,
      },
    ];
  }

  const requiredFields = [
    ["title", Boolean(apple.trackName)],
    ["description", Boolean(apple.description)],
    ["category", Boolean(apple.primaryGenreName)],
    ["screenshots", apple.screenshotUrls.length > 0],
  ] as const;
  const complete = requiredFields.filter(([, ok]) => ok).length;

  const findings: AuditFindingDraft[] = [
    {
      pillar: 2,
      finding: `Ficha de la app en Apple App Store: ${complete}/${requiredFields.length} campos requeridos completos (title, description, category, screenshots).`,
      severity: complete === requiredFields.length ? "info" : complete === 0 ? "critical" : "warning",
      detail_locked: false,
    },
  ];

  if (apple.averageUserRating !== null) {
    const reviewCount = apple.userRatingCount ?? 0;
    findings.push({
      pillar: 7,
      finding: `La app tiene rating ${apple.averageUserRating} en Apple App Store con ${reviewCount} reseñas.`,
      severity: reviewCount > 0 ? "info" : "warning",
      detail_locked: false,
    });
  }

  return findings;
}

function buildPlayFindings(play: Awaited<ReturnType<typeof fetchPlayStoreAppDetails>>, appName: string): AuditFindingDraft[] {
  if (!play) {
    return [
      {
        pillar: 2,
        finding: `No se pudo obtener la ficha de la app "${appName}" en Google Play (sin API pública oficial, scraping best-effort falló) — verifica el android_package_id.`,
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  const requiredFields = [
    ["title", Boolean(play.title)],
    ["description", Boolean(play.description)],
    ["screenshot", play.hasScreenshot],
    ["rating", play.ratingValue !== null],
  ] as const;
  const complete = requiredFields.filter(([, ok]) => ok).length;

  const findings: AuditFindingDraft[] = [
    {
      pillar: 2,
      finding: `Ficha de la app en Google Play: ${complete}/${requiredFields.length} campos requeridos completos (title, description, screenshot, rating) — lectura best-effort, sin API pública oficial de Google Play.`,
      severity: complete === requiredFields.length ? "info" : complete === 0 ? "critical" : "warning",
      detail_locked: false,
    },
  ];

  if (play.ratingValue !== null) {
    const reviewCount = play.ratingCount ?? 0;
    findings.push({
      pillar: 7,
      finding: `La app tiene rating ${play.ratingValue} en Google Play con ${reviewCount} reseñas.`,
      severity: reviewCount > 0 ? "info" : "warning",
      detail_locked: false,
    });
  }

  return findings;
}
