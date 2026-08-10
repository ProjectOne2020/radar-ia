"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Finding {
  pillar: number;
  finding: string;
  severity: string;
}

interface ReportData {
  businessName: string;
  niche: string;
  scoreTotal: number;
  scoreByPillar: Record<string, { subscore: number; measured: boolean; weight_pct: number }>;
  findings: Finding[];
}

const PILLAR_NAMES: Record<string, string> = {
  "1": "Identidad/consistencia (NAP)",
  "2": "Google Business Profile",
  "3": "Crawlability + schema técnico",
  "4": "Estructura semántica",
  "5": "Cobertura de preguntas",
  "6": "Citas y autoridad externa",
  "7": "Reputación (reseñas)",
  "8": "Medición directa en motores de IA",
};

function ReporteContent() {
  const searchParams = useSearchParams();
  const freeAuditId = searchParams.get("freeAuditId");
  const clientId = searchParams.get("clientId");

  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!freeAuditId || !clientId) return;
    fetch(`/api/free-audit/report?freeAuditId=${freeAuditId}&clientId=${clientId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el reporte.");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [freeAuditId, clientId]);

  if (error) return <p style={{ color: "crimson", padding: 60 }}>{error}</p>;
  if (!data) return <p style={{ padding: 60 }}>Cargando reporte...</p>;

  return (
    <main style={{ padding: 60, maxWidth: 640, fontFamily: "sans-serif" }}>
      <h1>Reporte de visibilidad en IA — {data.businessName}</h1>
      <h2>Score general: {Math.round(data.scoreTotal)}/100</h2>

      <h3>Desglose por pilar</h3>
      <ul>
        {Object.entries(data.scoreByPillar).map(([pillar, info]) => (
          <li key={pillar}>
            {PILLAR_NAMES[pillar] ?? `Pilar ${pillar}`}: {info.measured ? Math.round(info.subscore) : "sin datos suficientes"}
            {info.measured ? "/100" : ""}
          </li>
        ))}
      </ul>

      <h3>Diagnóstico</h3>
      <ul>
        {data.findings.map((f, i) => (
          <li key={i}>{f.finding}</li>
        ))}
      </ul>

      <p style={{ marginTop: 24, color: "#666" }}>
        Este es el diagnóstico de alto nivel. El detalle accionable completo (qué corregir
        exactamente) está disponible en los planes pagados.
      </p>
    </main>
  );
}

export default function ReporteFreeAuditPage() {
  return (
    <Suspense>
      <ReporteContent />
    </Suspense>
  );
}
