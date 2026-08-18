// M16 — Apple tiene una API publica oficial y gratuita (iTunes Search/Lookup API, sin
// API key) para datos de una app en el App Store. Fuente oficial, a diferencia de Google
// Play (ver play-store.ts) — decision explicita del fundador: usar lo mejor disponible
// de cada tienda en vez de degradar ambas al nivel de la mas debil.
export interface ItunesAppDetails {
  trackName: string;
  description: string;
  primaryGenreName: string;
  screenshotUrls: string[];
  averageUserRating: number | null;
  userRatingCount: number | null;
}

export async function fetchItunesAppDetails(iosAppId: string): Promise<ItunesAppDetails | null> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(iosAppId)}`);
  if (!res.ok) return null;

  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;

  return {
    trackName: result.trackName ?? "",
    description: result.description ?? "",
    primaryGenreName: result.primaryGenreName ?? "",
    screenshotUrls: Array.isArray(result.screenshotUrls) ? result.screenshotUrls : [],
    averageUserRating: typeof result.averageUserRating === "number" ? result.averageUserRating : null,
    userRatingCount: typeof result.userRatingCount === "number" ? result.userRatingCount : null,
  };
}
