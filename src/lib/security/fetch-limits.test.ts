import { describe, expect, it } from "vitest";
import { fetchWithLimits, readBodyWithCap, BodyTooLargeError, type FetchDeps } from "./fetch-limits";
import type { AddressResolver } from "./public-url";

const PUBLIC_V4 = "93.184.216.34";

const publicResolver: AddressResolver = async (host) => {
  if (host === "a.com" || host === "b.com" || host === "example.com") {
    return [{ address: PUBLIC_V4, family: 4 }];
  }
  throw new Error("NXDOMAIN");
};

function makeStream(chunks: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel() {
      onCancel?.();
    },
  });
}

const encoder = new TextEncoder();

function responseWith(body: string | ReadableStream<Uint8Array>, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body as BodyInit, { status, headers });
}

describe("readBodyWithCap", () => {
  it("devuelve el texto completo cuando esta dentro del cap (incluyendo acentos)", async () => {
    const res = responseWith(makeStream([encoder.encode("El sitio tiene reseñas públicas")]));
    expect(await readBodyWithCap(res, 1024)).toBe("El sitio tiene reseñas públicas");
  });

  it("acepta una respuesta exactamente en el limite", async () => {
    const res = responseWith(makeStream([encoder.encode("0123456789")]));
    expect(await readBodyWithCap(res, 10)).toBe("0123456789");
  });

  it("rechaza de antemano si Content-Length ya supera el cap", async () => {
    let cancelCalled = false;
    const res = responseWith(makeStream([encoder.encode("hola")], () => { cancelCalled = true; }));
    res.headers.set("content-length", String(99_999_999));
    await expect(readBodyWithCap(res, 1024)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelCalled).toBe(false); // no hizo falta leer nada
  });

  it("corta la lectura y cancela el stream cuando el body supera el cap en curso", async () => {
    let cancelCalled = false;
    const chunks = [
      encoder.encode("0123456789"),
      encoder.encode("0123456789"),
      encoder.encode("0123456789"),
    ];
    const res = responseWith(makeStream(chunks, () => { cancelCalled = true; }));
    await expect(readBodyWithCap(res, 15)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelCalled).toBe(true);
  });
});

describe("fetchWithLimits", () => {
  const baseLimits = { timeoutMs: 5_000, maxBytes: 1024 };

  it("hace el fetch directo de una URL publica", async () => {
    const calls: string[] = [];
    const deps: FetchDeps = {
      resolver: publicResolver,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return responseWith("ok");
      },
    };
    const res = await fetchWithLimits("https://example.com/", baseLimits, deps);
    expect(res.status).toBe(200);
    expect(calls).toEqual(["https://example.com/"]);
  });

  it("sigue redirects re-validando cada hop", async () => {
    const calls: string[] = [];
    const deps: FetchDeps = {
      resolver: publicResolver,
      fetchImpl: async (input) => {
        calls.push(String(input));
        if (calls.length === 1) {
          return new Response(null, { status: 302, headers: { location: "https://b.com/final" } });
        }
        return responseWith("final");
      },
    };
    const res = await fetchWithLimits("https://a.com/", baseLimits, deps);
    expect(res.status).toBe(200);
    expect(calls).toEqual(["https://a.com/", "https://b.com/final"]);
  });

  it("rechaza un redirect hacia un host no publico", async () => {
    const resolver: AddressResolver = async (host) => {
      if (host === "a.com") return [{ address: PUBLIC_V4, family: 4 }];
      if (host === "169.254.169.254") return [{ address: "169.254.169.254", family: 4 }];
      throw new Error("NXDOMAIN");
    };
    const deps: FetchDeps = {
      resolver,
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        }),
    };
    await expect(fetchWithLimits("https://a.com/", baseLimits, deps)).rejects.toThrow(/no publica/);
  });

  it("rechaza cuando se excede el maximo de redirects", async () => {
    const deps: FetchDeps = {
      resolver: publicResolver,
      fetchImpl: async () =>
        new Response(null, { status: 302, headers: { location: "https://a.com/loop" } }),
    };
    await expect(
      fetchWithLimits("https://a.com/", { ...baseLimits, maxRedirects: 2 }, deps)
    ).rejects.toThrow(/redirect/);
  });

  it("devuelve un 3xx sin Location tal cual, sin seguirlo", async () => {
    const deps: FetchDeps = {
      resolver: publicResolver,
      fetchImpl: async () => new Response(null, { status: 304 }),
    };
    const res = await fetchWithLimits("https://a.com/", baseLimits, deps);
    expect(res.status).toBe(304);
  });

  it("reenvia los headers al fetch", async () => {
    let seenInit: RequestInit | undefined;
    const headers = { "User-Agent": "RadarIA-Audit/1.0" };
    const deps: FetchDeps = {
      resolver: publicResolver,
      fetchImpl: async (_input, init) => {
        seenInit = init;
        return responseWith("ok");
      },
    };
    await fetchWithLimits("https://a.com/", { ...baseLimits, headers }, deps);
    expect(seenInit?.headers).toEqual(headers);
    expect(seenInit?.redirect).toBe("manual");
  });
});
