"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/panel";
import { RUBROS, QUESTION_BANK_COUNTRIES } from "@/lib/question-bank/taxonomy";

type Axis = "local" | "ecommerce" | "app";

interface Result {
  clientId: string;
  scoreTotal: number;
}

export default function AuditForm() {
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState("");
  const [axis, setAxis] = useState<Axis>("local");
  const [appType, setAppType] = useState<"web" | "native">("web");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("MX");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phoneWhatsapp, setPhoneWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [iosAppId, setIosAppId] = useState("");
  const [androidPackageId, setAndroidPackageId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const isApp = axis === "app";
  const isNativeApp = isApp && appType === "native";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/audit-any", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        niche,
        axis,
        appType: isApp ? appType : undefined,
        city,
        country,
        websiteUrl: websiteUrl || undefined,
        phoneWhatsapp: phoneWhatsapp || undefined,
        email: email || undefined,
        iosAppId: isNativeApp ? iosAppId || undefined : undefined,
        androidPackageId: isNativeApp ? androidPackageId || undefined : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    setResult({ clientId: data.clientId, scoreTotal: data.scoreTotal });
  }

  if (result) {
    return (
      <Alert tone="good" className="max-w-[560px]">
        <p>
          Auditoría completa — score total: <strong>{Math.round(result.scoreTotal)}</strong>
        </p>
        <div className="mt-3 flex gap-3">
          <Link href={`/admin/clientes/${result.clientId}`} className="text-sm text-signal-strong hover:underline">
            Ver ficha completa →
          </Link>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-sm text-text-secondary hover:text-ink"
          >
            Auditar otro negocio
          </button>
        </div>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[560px] flex-col gap-4">
      <div>
        <Label htmlFor="businessName">Nombre del negocio</Label>
        <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required minLength={2} />
      </div>

      <div>
        <Label htmlFor="niche">Rubro</Label>
        <Input
          id="niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          required
          minLength={2}
          list="rubro-suggestions"
          placeholder="ej. Clínicas dentales"
        />
        <datalist id="rubro-suggestions">
          {RUBROS.map((r) => (
            <option key={r.slug} value={r.label} />
          ))}
        </datalist>
      </div>

      <div>
        <Label>Eje del negocio</Label>
        <div className="flex gap-4 text-sm text-text-secondary">
          {(["local", "ecommerce", "app"] as Axis[]).map((a) => (
            <label key={a} className="flex items-center gap-1.5">
              <input type="radio" name="axis" checked={axis === a} onChange={() => setAxis(a)} />
              {a === "local" ? "Negocio local" : a === "ecommerce" ? "Tienda online" : "App"}
            </label>
          ))}
        </div>
      </div>

      {isApp && (
        <div>
          <Label>Tipo de app</Label>
          <div className="flex gap-4 text-sm text-text-secondary">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="appType" checked={appType === "web"} onChange={() => setAppType("web")} />
              Web (solo landing)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="appType" checked={appType === "native"} onChange={() => setAppType("native")} />
              Nativa (App Store / Google Play)
            </label>
          </div>
        </div>
      )}

      {isNativeApp && (
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="iosAppId">App Store ID</Label>
            <Input id="iosAppId" value={iosAppId} onChange={(e) => setIosAppId(e.target.value)} placeholder="opcional" />
          </div>
          <div className="flex-1">
            <Label htmlFor="androidPackageId">Google Play package</Label>
            <Input
              id="androidPackageId"
              value={androidPackageId}
              onChange={(e) => setAndroidPackageId(e.target.value)}
              placeholder="opcional"
            />
          </div>
        </div>
      )}

      {!isNativeApp && (
        <div>
          <Label htmlFor="websiteUrl">Sitio web</Label>
          <Input
            id="websiteUrl"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            required
            placeholder="https://..."
          />
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="city">Ciudad</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} />
        </div>
        <div className="flex-1">
          <Label htmlFor="country">País</Label>
          <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {QUESTION_BANK_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="phoneWhatsapp">WhatsApp (opcional)</Label>
          <Input id="phoneWhatsapp" value={phoneWhatsapp} onChange={(e) => setPhoneWhatsapp(e.target.value)} placeholder="+52..." />
        </div>
        <div className="flex-1">
          <Label htmlFor="email">Correo (opcional)</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="self-start">
        {loading ? "Corriendo auditoría… (puede tardar un minuto)" : "Correr auditoría completa"}
      </Button>

      {error && <p className="text-sm text-critical">{error}</p>}
    </form>
  );
}
