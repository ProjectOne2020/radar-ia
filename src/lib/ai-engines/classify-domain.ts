export function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

export function isClientDomain(domain: string, clientDomains: string[]): boolean {
  return clientDomains.some((clientDomain) => domain === clientDomain || domain.endsWith(`.${clientDomain}`));
}

export function isDirectoryDomain(
  domain: string,
  directoryPatterns: Array<{ directory_url_pattern: string | null }>
): boolean {
  return directoryPatterns.some((d) => {
    if (!d.directory_url_pattern) return false;
    const patternDomain = d.directory_url_pattern.split("/")[0].toLowerCase();
    return domain === patternDomain || domain.endsWith(`.${patternDomain}`);
  });
}
