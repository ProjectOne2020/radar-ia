"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SEVERITY_TONE = { critical: "critical", warning: "warning", info: "neutral" } as const;

interface Finding {
  id: string;
  pillar: number;
  finding: string;
  severity: string | null;
  audited_at: string | null;
  detail_locked: boolean | null;
}

interface Business {
  name: string;
  niche: string;
  country: string;
}

export default function FindingsPanel({ findings, business }: { findings: Finding[]; business: Business }) {
  const [solutions, setSolutions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const actionableCount = findings.filter((f) => f.severity === "critical" || f.severity === "warning").length;

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/generate-solutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business,
        findings: findings.map((f) => ({ pillar: f.pillar, finding: f.finding, severity: f.severity })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error generando soluciones");
      return;
    }

    const map: Record<string, string> = {};
    for (const s of data.solutions ?? []) map[s.finding] = s.solution;
    setSolutions(map);
    setGenerated(true);
  }

  return (
    <Panel raised className="mt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Hallazgos recientes ({findings.length})
        </h2>
        {actionableCount > 0 && (
          <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={loading}>
            {loading
              ? "Generando…"
              : generated
                ? "Regenerar soluciones con IA"
                : `Generar soluciones con IA (${actionableCount})`}
          </Button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-critical">{error}</p>}

      {findings.length === 0 ? (
        <p className="text-sm text-text-muted">Sin hallazgos registrados.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {findings.map((f) => {
            const severity = (f.severity ?? "info") as keyof typeof SEVERITY_TONE;
            const solution = solutions[f.finding];
            return (
              <li key={f.id} className="flex items-start gap-3 rounded-xs border border-border bg-paper-raised p-3.5">
                <Badge tone={SEVERITY_TONE[severity] ?? "neutral"} className="mt-0.5 shrink-0">
                  Pilar {f.pillar}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-text">{f.finding}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {f.audited_at ? new Date(f.audited_at).toLocaleString("es") : "—"}
                    {f.detail_locked ? " · detalle bloqueado (free tier)" : ""}
                  </p>
                  {solution && (
                    <div className="mt-2.5 rounded-xs border border-signal/40 bg-signal-soft p-3">
                      <p className="text-xs font-semibold tracking-wide text-signal-ink uppercase">Solución sugerida</p>
                      <p className="mt-1 text-sm leading-relaxed text-text">{solution}</p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
