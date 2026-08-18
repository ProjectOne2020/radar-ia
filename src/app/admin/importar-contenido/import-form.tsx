"use client";

import { useState } from "react";

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
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 600 }}>
        <label>
          Client ID
          <br />
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} required style={{ width: "100%" }} />
        </label>
        <label>
          Contenido JSON generado en Antigravity
          <br />
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            required
            rows={12}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Importando..." : "Importar"}
        </button>
        {error && (
          <div style={{ color: "red" }}>
            {Array.isArray(error) ? (
              <ul>
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
        <div style={{ marginTop: 24, border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <p>
            <strong>{result.faqsInserted}</strong> preguntas insertadas en prompt_sets (activas, categoría
            &quot;imported&quot;) — se usarán en la próxima medición (pilar 5).
          </p>

          {result.jsonLd.length > 0 && (
            <>
              <h3>Bloques JSON-LD ({result.jsonLd.length}) — copiar al sitio real del cliente</h3>
              {result.jsonLd.map((block, i) => (
                <pre key={i} style={{ background: "#f5f5f5", padding: 8, overflowX: "auto", fontSize: 12 }}>
                  {JSON.stringify(block, null, 2)}
                </pre>
              ))}
            </>
          )}

          {result.landing && (
            <>
              <h3>Landing mínima — copiar al sitio real del cliente</h3>
              <p>
                <strong>{result.landing.title}</strong>
                <br />
                {result.landing.description}
              </p>
              {result.landing.sections.map((s, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <strong>{s.heading}</strong>
                  <p>{s.body}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
