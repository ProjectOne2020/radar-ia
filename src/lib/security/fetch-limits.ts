import { resolvePublicHttpUrl, type AddressResolver } from "./public-url";

// fetch con limites duros para URLs de entrada de usuario: valida que el host sea
// publico en CADA salto (redirect: "manual" — undici los seguiria por defecto hacia
// hosts internos, reabriendo el SSRF que se cerro en el primer salto), aborta por
// timeout con AbortSignal.timeout y corta la lectura del body al superar maxBytes
// (antes res.text() cargaba la respuesta completa en memoria sin cap).

const DEFAULT_MAX_REDIRECTS = 3;

export interface FetchLimits {
  timeoutMs: number;
  maxBytes: number;
  headers?: Record<string, string>;
  maxRedirects?: number;
}

export interface FetchDeps {
  resolver?: AddressResolver;
  fetchImpl?: typeof fetch;
}

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`La respuesta supera el limite de ${maxBytes} bytes.`);
    this.name = "BodyTooLargeError";
  }
}

export async function fetchWithLimits(
  rawUrl: string,
  limits: FetchLimits,
  deps: FetchDeps = {}
): Promise<Response> {
  const doFetch = deps.fetchImpl ?? fetch;
  const maxRedirects = limits.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await resolvePublicHttpUrl(currentUrl, deps.resolver);
    const res = await doFetch(url, {
      headers: limits.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(limits.timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res; // 3xx sin Location — el caller decide que hacer
      currentUrl = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new Error(`La URL excede el maximo de ${maxRedirects} redirects.`);
}

// Lee el body acotado por maxBytes. Mismo contrato que Response.text() para el texto:
// decode UTF-8 siempre (el spec de fetch ignora el charset del Content-Type), asi que
// el texto que ya se parseaba no cambia. Corta la conexion en cuanto se supera el cap.
export async function readBodyWithCap(res: Response, maxBytes: number): Promise<string> {
  const declared = res.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new BodyTooLargeError(maxBytes);
  }
  if (!res.body) return res.text();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // la conexion ya abortada no siempre permite cancelar — el error real es el de abajo
      }
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
