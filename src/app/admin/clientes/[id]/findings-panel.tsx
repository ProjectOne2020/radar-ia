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
  session_id: string | null;
}

interface Business {
  name: string;
  niche: string;
  country: string;
}

// Agrupa por sesion de auditoria (session_id) en vez de una lista plana — sin esto, correr
// "Auditoria completa" dos veces mostraba los mismos hallazgos duplicados uno tras otro,
// leyendo como si el sistema repitiera resultados en vez de ser dos corridas distintas en
// el tiempo (reportado por el fundador probando "Contracta Facil").
function groupBySession(findings: Finding[]) {
  const bySession = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = f.session_id ?? "sin-sesion";
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key)!.push(f);
  }
  return [...bySession.entries()]
    .map(([sessionId, items]) => ({
      sessionId,
      items,
      latestAt: items.reduce((max, f) => (f.audited_at && f.audited_at > max ? f.audited_at : max), ""),
    }))
    .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));
}

export default function FindingsPanel({ findings, business }: { findings: Finding[]; business: Business }) {
  const [solutions, setSolutions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const sessions = groupBySession(findings);
  const latest = sessions[0];
  const olderSessions = sessions.slice(1);

  const latestActionable = (latest?.items ?? []).filter((f) => f.severity === "critical" || f.severity === "warning");

  async function handleGenerate() {
    if (!latest) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/generate-solutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business,
        findings: latest.items.map((f) => ({ pillar: f.pillar, finding: f.finding, severity: f.severity })),
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

  function renderFinding(f: Finding) {
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
  }

  return (
    <Panel raised className="mt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Hallazgos ({findings.length})
        </h2>
        {latestActionable.length > 0 && (
          <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={loading}>
            {loading
              ? "Generando…"
              : generated
                ? "Regenerar soluciones con IA"
                : `Generar soluciones con IA (${latestActionable.length})`}
          </Button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-critical">{error}</p>}

      {findings.length === 0 || !latest ? (
        <p className="text-sm text-text-muted">Sin hallazgos registrados.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-text-muted">
            Última auditoría — {latest.items[0]?.audited_at ? new Date(latest.items[0].audited_at).toLocaleString("es") : "—"} (
            {latest.items.length} hallazgos)
          </p>
          <ul className="flex flex-col gap-2.5">{latest.items.map(renderFinding)}</ul>

          {olderSessions.length > 0 && (
            <details className="mt-5 border-t border-border pt-4">
              <summary className="cursor-pointer text-xs font-medium tracking-wide text-text-secondary uppercase">
                Auditorías anteriores ({olderSessions.length})
              </summary>
              <div className="mt-3 flex flex-col gap-4">
                {olderSessions.map((s) => (
                  <div key={s.sessionId}>
                    <p className="mb-2 text-xs text-text-muted">
                      {s.items[0]?.audited_at ? new Date(s.items[0].audited_at).toLocaleString("es") : "—"} ({s.items.length}{" "}
                      hallazgos)
                    </p>
                    <ul className="flex flex-col gap-2.5 opacity-70">{s.items.map(renderFinding)}</ul>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}
