import { describe, expect, it } from "vitest";
import {
  assertHttpUrlFormat,
  isBlockedIpv4,
  isBlockedIpv6,
  resolvePublicHttpUrl,
  type AddressResolver,
} from "./public-url";

const PUBLIC_V4 = "93.184.216.34";

const publicResolver: AddressResolver = async (host) => {
  if (host === "example.com" || host === "a.com" || host === "b.com") {
    return [{ address: PUBLIC_V4, family: 4 }];
  }
  throw new Error("NXDOMAIN");
};

describe("isBlockedIpv4", () => {
  it("bloquea la metadata de cloud, loopback y rangos privados", () => {
    expect(isBlockedIpv4("169.254.169.254")).toBe(true); // metadata de cloud
    expect(isBlockedIpv4("169.254.0.1")).toBe(true);
    expect(isBlockedIpv4("127.0.0.1")).toBe(true);
    expect(isBlockedIpv4("10.0.0.5")).toBe(true);
    expect(isBlockedIpv4("192.168.1.1")).toBe(true);
    expect(isBlockedIpv4("172.16.0.1")).toBe(true);
    expect(isBlockedIpv4("172.31.255.255")).toBe(true);
  });

  it("bloquea CGNAT, reservados y multicast", () => {
    expect(isBlockedIpv4("100.64.0.1")).toBe(true); // CGNAT 100.64/10
    expect(isBlockedIpv4("100.127.255.255")).toBe(true);
    expect(isBlockedIpv4("0.1.2.3")).toBe(true);
    expect(isBlockedIpv4("224.0.0.1")).toBe(true);
    expect(isBlockedIpv4("240.0.0.1")).toBe(true);
    expect(isBlockedIpv4("255.255.255.255")).toBe(true);
    expect(isBlockedIpv4("192.0.2.1")).toBe(true); // TEST-NET-1
    expect(isBlockedIpv4("198.51.100.7")).toBe(true); // TEST-NET-2
    expect(isBlockedIpv4("203.0.113.5")).toBe(true); // TEST-NET-3
    expect(isBlockedIpv4("198.18.0.1")).toBe(true); // benchmarking
  });

  it("permite IPs publicas y el borde exacto de cada rango", () => {
    expect(isBlockedIpv4("8.8.8.8")).toBe(false);
    expect(isBlockedIpv4("1.1.1.1")).toBe(false);
    expect(isBlockedIpv4("52.1.2.3")).toBe(false);
    expect(isBlockedIpv4("172.32.0.1")).toBe(false); // justo fuera de 172.16/12
    expect(isBlockedIpv4("100.128.0.1")).toBe(false); // justo fuera de 100.64/10
    expect(isBlockedIpv4("11.0.0.1")).toBe(false); // justo fuera de 10/8
  });

  it("bloquea IPs no parseables (fail-closed)", () => {
    expect(isBlockedIpv4("999.1.1.1")).toBe(true);
    expect(isBlockedIpv4("1.2.3")).toBe(true);
    expect(isBlockedIpv4("no-es-ip")).toBe(true);
  });
});

describe("isBlockedIpv6", () => {
  it("bloquea loopback, unspecified, link-local, ULA y multicast", () => {
    expect(isBlockedIpv6("::1")).toBe(true);
    expect(isBlockedIpv6("::")).toBe(true);
    expect(isBlockedIpv6("fe80::1")).toBe(true);
    expect(isBlockedIpv6("febf::1")).toBe(true);
    expect(isBlockedIpv6("fc00::1")).toBe(true);
    expect(isBlockedIpv6("fd12:3456::1")).toBe(true);
    expect(isBlockedIpv6("ff02::1")).toBe(true);
    expect(isBlockedIpv6("2001:db8::1")).toBe(true); // documentacion
  });

  it("valida la IPv4 embebida en ::ffff:0:0/96", () => {
    expect(isBlockedIpv6("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIpv6("::ffff:10.0.0.1")).toBe(true);
    expect(isBlockedIpv6("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedIpv6("::ffff:8.8.8.8")).toBe(false); // publica en forma v6
  });

  it("permite IPv6 publicas", () => {
    expect(isBlockedIpv6("2606:4700::1111")).toBe(false);
    expect(isBlockedIpv6("2001:4860:4860::8888")).toBe(false);
    expect(isBlockedIpv6("1:2:3:4:5:6:7:8")).toBe(false);
    expect(isBlockedIpv6("0:0:0:0:0:0:0:1")).toBe(true); // ::1 expandido
  });

  it("bloquea IPv6 no parseables (fail-closed)", () => {
    expect(isBlockedIpv6("1:2:3")).toBe(true); // sin "::" y con menos de 8 grupos
    expect(isBlockedIpv6("1::2::3")).toBe(true); // doble "::"
    expect(isBlockedIpv6("zzzz::1")).toBe(true);
  });
});

describe("assertHttpUrlFormat", () => {
  it("acepta http(s) normal", () => {
    expect(assertHttpUrlFormat("https://example.com/path?q=1").hostname).toBe("example.com");
    expect(assertHttpUrlFormat("http://example.com").protocol).toBe("http:");
  });

  it("rechaza lo no parseable y los protocolos no http", () => {
    expect(() => assertHttpUrlFormat("no-es-url")).toThrow();
    expect(() => assertHttpUrlFormat("ftp://example.com")).toThrow(/http/);
    expect(() => assertHttpUrlFormat("file:///etc/passwd")).toThrow(/http/);
  });

  it("rechaza credenciales embebidas", () => {
    expect(() => assertHttpUrlFormat("http://user:pass@example.com")).toThrow(/credenciales/);
  });
});

describe("resolvePublicHttpUrl", () => {
  it("devuelve la URL cuando el host resuelve a una IP publica", async () => {
    const url = await resolvePublicHttpUrl("https://example.com/x", publicResolver);
    expect(url.hostname).toBe("example.com");
  });

  it("rechaza cuando el host resuelve a una IP no publica", async () => {
    const metadataResolver: AddressResolver = async () => [{ address: "169.254.169.254", family: 4 }];
    await expect(resolvePublicHttpUrl("http://example.com", metadataResolver)).rejects.toThrow(
      /no publica/
    );
  });

  it("rechaza cuando el host no resuelve (fail-closed)", async () => {
    await expect(resolvePublicHttpUrl("http://desconocido.com", publicResolver)).rejects.toThrow(
      /no se pudo resolver/
    );
  });

  it("pasa el hostname sin corchetes al resolver para IPv6 literal", async () => {
    const seen: string[] = [];
    const resolver: AddressResolver = async (host) => {
      seen.push(host);
      return [{ address: "::1", family: 6 }];
    };
    await expect(resolvePublicHttpUrl("http://[::1]:8080/", resolver)).rejects.toThrow(/no publica/);
    expect(seen).toEqual(["::1"]);
  });

  it("aplica las mismas reglas de formato que assertHttpUrlFormat", async () => {
    await expect(resolvePublicHttpUrl("ftp://example.com", publicResolver)).rejects.toThrow(/http/);
  });
});
