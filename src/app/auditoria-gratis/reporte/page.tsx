"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

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

const PILLAR_KEYS: Record<string, string> = {
  "1": "1",
  "2": "2_local",
  "3": "3",
  "4": "4_local",
  "5": "5",
  "6": "6",
  "7": "7_local",
  "8": "8",
};

function ReporteContent() {
  const t = useTranslations("AuditoriaGratisReporte");
  const tPillars = useTranslations("Pillars");
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
        if (!res.ok) throw new Error(json.error ?? t("loadError"));
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeAuditId, clientId]);

  if (error) return <p style={{ color: "crimson", padding: 60 }}>{error}</p>;
  if (!data) return <p style={{ padding: 60 }}>{t("loading")}</p>;

  return (
    <main style={{ padding: 60, maxWidth: 640, fontFamily: "sans-serif" }}>
      <h1>{t("title", { businessName: data.businessName })}</h1>
      <h2>{t("overallScore", { score: Math.round(data.scoreTotal) })}</h2>

      <h3>{t("breakdownTitle")}</h3>
      <ul>
        {Object.entries(data.scoreByPillar).map(([pillar, info]) => (
          <li key={pillar}>
            {tPillars(PILLAR_KEYS[pillar] ?? "fallback", { n: pillar })}: {info.measured ? Math.round(info.subscore) : t("notMeasured")}
            {info.measured ? "/100" : ""}
          </li>
        ))}
      </ul>

      <h3>{t("diagnosisTitle")}</h3>
      <ul>
        {data.findings.map((f, i) => (
          <li key={i}>{f.finding}</li>
        ))}
      </ul>

      <p style={{ marginTop: 24, color: "#666" }}>{t("detailNote")}</p>
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
