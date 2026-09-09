import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRawHtml } from "./schema";

afterEach(() => {
  vi.unstubAllGlobals();
});

// fetchRawHtml es el punto de fetch de superficie anonima: la URL la introduce un
// usuario en la auditoria gratis. Con la capa SSRF, un host no publico debe cortarse
// ANTES de tocar la red — ni un solo fetch.
describe("fetchRawHtml (limites SSRF + tamano)", () => {
  it("no hace fetch y devuelve fetched:false para un host literal no publico", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchRawHtml("http://169.254.169.254/latest/meta-data/");

    expect(result.fetched).toBe(false);
    expect(result.html).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no hace fetch para loopback literal", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchRawHtml("http://127.0.0.1:8080/admin");

    expect(result.fetched).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no hace fetch para protocolos que no son http(s)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchRawHtml("file:///etc/passwd");

    expect(result.fetched).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
