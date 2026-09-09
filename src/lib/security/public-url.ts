import { lookup } from "node:dns/promises";

// Defensa SSRF para URLs que introduce un usuario (auditoria gratis, competidores,
// setup) y que el server fetcha despues: sin esta capa, el crawler del producto se
// puede usar como proxy hacia IPs privadas, loopback o la metadata de cloud
// (169.254.169.254). La validacion de red vive en el punto de fetch (fetch-limits.ts)
// para cubrir todos los puntos de entrada de una sola vez; aca tambien vive la parte
// sincrona de formato (assertHttpUrlFormat) para rechazar URLs invalidas al ingestar.

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type AddressResolver = (host: string) => Promise<ResolvedAddress[]>;

const defaultResolver: AddressResolver = (host) => lookup(host, { all: true, verbatim: true });

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

// Bloqueos IPv4: red "this" (0/8), privadas (10/8, 172.16/12, 192.168/16), CGNAT
// (100.64/10), loopback (127/8), link-local (169.254/16 — incluye la metadata de cloud),
// rangos reservados/de documentacion (TEST-NETs, 6to4 relay, benchmarking), multicast
// (224/4) y reservado+broadcast (240/4).
const BLOCKED_V4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true; // no parseable = no permitir
  return BLOCKED_V4_RANGES.some(([base, bits]) => {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (baseInt & mask);
  });
}

// Descompone una IPv6 (con o sin "::", con o sin IPv4 embebida al final) en sus 8
// grupos de 16 bits. Devuelve null si es invalida.
function parseIpv6Groups(ip: string): number[] | null {
  const lower = ip.toLowerCase();
  const halves = lower.split("::");
  if (halves.length > 2) return null;

  function parseGroups(part: string): number[] | null {
    if (!part) return [];
    const segments = part.split(":");
    const groups: number[] = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.includes(".")) {
        // IPv4 embebida (ej. ::ffff:1.2.3.4) — solo puede ocupar el tramo final.
        if (i !== segments.length - 1) return null;
        const v4 = ipv4ToInt(segment);
        if (v4 === null) return null;
        groups.push(v4 >>> 16, v4 & 0xffff);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(segment)) return null;
      groups.push(parseInt(segment, 16));
    }
    return groups;
  }

  const left = parseGroups(halves[0]);
  const right = parseGroups(halves.length === 2 ? halves[1] : "");
  if (left === null || right === null) return null;
  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }
  const fill = 8 - left.length - right.length;
  if (fill < 1) return null;
  return [...left, ...new Array<number>(fill).fill(0), ...right];
}

export function isBlockedIpv6(ip: string): boolean {
  const groups = parseIpv6Groups(ip);
  if (groups === null) return true; // invalida = no permitir

  // IPv4-mapped ::ffff:0:0/96 — la direccion real es la IPv4 embebida.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const v4 = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return isBlockedIpv4(v4);
  }
  if (groups.every((g) => g === 0)) return true; // :: (unspecified)
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1
  if (groups[0] >= 0xfc00 && groups[0] <= 0xfdff) return true; // ULA fc00::/7
  if (groups[0] >= 0xfe80 && groups[0] <= 0xfebf) return true; // link-local fe80::/10
  if (groups[0] >= 0xff00) return true; // multicast ff00::/8
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // documentacion 2001:db8::/32
  return false;
}

// Parte sincrona: solo formato. Rechaza URLs no parseables, con protocolo distinto de
// http(s) o con credenciales embebidas (http://user:pass@host). Se usa al ingestar la
// URL en la DB; la validacion de red va en resolvePublicHttpUrl.
export function assertHttpUrlFormat(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL invalida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http(s).");
  }
  if (parsed.username || parsed.password) {
    throw new Error("La URL no puede incluir credenciales embebidas.");
  }
  return parsed;
}

// Parte de red: resuelve el host y rechaza si ALGUNA de las direcciones devueltas
// apunta a un rango no publico (`some`, no `every`: si una de ellas es interna, el
// fetch podria caer en ella). Funciona tambien con IPs literales (getaddrinfo las
// resuelve sin consulta DNS).
export async function resolvePublicHttpUrl(
  rawUrl: string,
  resolver: AddressResolver = defaultResolver
): Promise<URL> {
  const parsed = assertHttpUrlFormat(rawUrl);
  const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new Error("El host no se pudo resolver.");
  }
  if (!addresses || addresses.length === 0) {
    throw new Error("El host no resolvio a ninguna direccion.");
  }

  const blocked = addresses.some((a) =>
    a.family === 6 ? isBlockedIpv6(a.address) : isBlockedIpv4(a.address)
  );
  if (blocked) {
    throw new Error("El host apunta a una direccion no publica.");
  }
  return parsed;
}
