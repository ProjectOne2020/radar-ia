"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";

interface JsonLdBlock {
  "@type"?: string;
  [key: string]: unknown;
}

interface LandingSection {
  heading: string;
  body: string;
}

interface Landing {
  title: string;
  description: string;
  sections: LandingSection[];
}

interface ImportResult {
  faqsInserted: number;
  jsonLd: JsonLdBlock[];
  landing: Landing | null;
}

export default function ImportForm() {
  const [clientId, setClientId] = useState("");
  const [importJson, setImportJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | string[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/content-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, importJson }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.details ?? data.error ?? "Error");
      return;
    }

    setResult(data);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex max-w-[600px] flex-col gap-4">
        <div>
          <Label htmlFor="clientId">Client ID</Label>
          <Input id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="importJson">Contenido JSON generado en Antigravity</Label>
          <Textarea
            id="importJson"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            required
            rows={12}
            className="font-mono text-xs"
          />
        </div>
        <Button type="submit" size="sm" disabled={loading} className="self-start">
          {loading ? "Importando..." : "Importar"}
        </Button>
        {error && (
          <div className="text-sm text-critical">
            {Array.isArray(error) ? (
              <ul className="list-disc pl-5">
                {error.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : (
              error
            )}
          </div>
        )}
      </form>

      {result && (
        <Panel raised className="mt-6">
          <p className="text-sm text-text">
            <strong className="text-ink">{result.faqsInserted}</strong> preguntas insertadas en prompt_sets (activas,
            categoría &quot;imported&quot;) — se usarán en la próxima medición (pilar 5).
          </p>

          {result.jsonLd.length > 0 && (
            <>
              <h3 className="mt-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
                Bloques JSON-LD ({result.jsonLd.length}) — copiar al sitio real del cliente
              </h3>
              {result.jsonLd.map((block, i) => (
                <pre
                  key={i}
                  className="mt-2 overflow-x-auto rounded-xs bg-surface-sunken p-3 font-mono text-xs text-text-secondary"
                >
                  {JSON.stringify(block, null, 2)}
                </pre>
              ))}
            </>
          )}

          {result.landing && (
            <>
              <h3 className="mt-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
                Landing mínima — copiar al sitio real del cliente
              </h3>
              <p className="mt-2 text-sm text-text">
                <strong className="text-ink">{result.landing.title}</strong>
                <br />
                {result.landing.description}
              </p>
              {result.landing.sections.map((s, i) => (
                <div key={i} className="mt-2">
                  <strong className="text-sm text-ink">{s.heading}</strong>
                  <p className="text-sm text-text-secondary">{s.body}</p>
                </div>
              ))}
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
