"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ScoreRing } from "@/components/radar/score-ring";
import { PillarSignal, type PillarStatus } from "@/components/radar/pillar-signal";

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

function pillarStatus(measured: boolean, subscore: number): PillarStatus {
  if (!measured) return "unmeasured";
  if (subscore >= 70) return "good";
  if (subscore >= 40) return "warning";
  return "critical";
}

const SEVERITY_TONE = {
  critical: "critical",
  warning: "warning",
  info: "neutral",
} as const;

function ReporteContent() {
  const t = useTranslations("AuditoriaGratisReporte");
  const tPillars = useTranslations("Pillars");
  const tCommon = useTranslations("Common");
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

  if (error) {
    return (
      <Container narrow className="py-16">
        <Alert tone="critical">{error}</Alert>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container narrow className="py-16">
        <p className="text-text-secondary">{t("loading")}</p>
      </Container>
    );
  }

  const severityLabel = {
    critical: tCommon("severityCritical"),
    warning: tCommon("severityWarning"),
    info: tCommon("severityInfo"),
  } as const;

  return (
    <Container narrow className="py-10 sm:py-16">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl">{t("title", { businessName: data.businessName })}</h1>
        <Badge tone="warning">{t("partialBadge")}</Badge>
      </div>

      <Panel
        raised
        className="mt-5 flex flex-col items-start gap-4 border-warning bg-warning-soft ring-1 ring-warning sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-display text-lg font-semibold text-warning">{t("partialTitle")}</p>
          <p className="mt-1.5 text-sm text-warning/90">{t("partialBody")}</p>
        </div>
        <ButtonLink href="/precios" size="md" className="shrink-0">
          {t("ctaSeePlans")}
        </ButtonLink>
      </Panel>

      <Panel raised className="mt-6">
        <ScoreRing
          score={data.scoreTotal}
          noiseLabel={tCommon("noise")}
          signalLabel={tCommon("signal")}
        />

        <h2 className="mt-8 text-lg font-semibold text-ink">{t("breakdownTitle")}</h2>
        <div className="mt-2 divide-y divide-border border-t border-border">
          {Object.entries(data.scoreByPillar).map(([pillar, info]) => (
            <PillarSignal
              key={pillar}
              name={tPillars(PILLAR_KEYS[pillar] ?? "fallback", { n: pillar })}
              weight={info.weight_pct}
              status={pillarStatus(info.measured, info.subscore)}
              value={info.measured ? info.subscore : undefined}
              notMeasuredLabel={t("notMeasured")}
            />
          ))}
        </div>
      </Panel>

      <h2 className="mt-10 text-lg font-semibold text-ink">{t("diagnosisTitle")}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {data.findings.map((f, i) => {
          const tone = SEVERITY_TONE[f.severity as keyof typeof SEVERITY_TONE] ?? "neutral";
          const label = severityLabel[f.severity as keyof typeof severityLabel] ?? f.severity;
          return (
            <li key={i} className="flex items-start gap-3 rounded-xs border border-border bg-paper-raised p-3.5">
              <Badge tone={tone} className="mt-0.5 shrink-0">
                {label}
              </Badge>
              <span className="text-sm leading-relaxed text-text">{f.finding}</span>
            </li>
          );
        })}
      </ul>

      <Panel
        raised
        className="mt-8 flex flex-col items-start gap-4 border-signal bg-signal-soft ring-1 ring-signal sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-display text-lg font-semibold text-signal-ink">{t("ctaTitle")}</p>
          <p className="mt-1.5 text-sm text-signal-ink/90">{t("detailNote")}</p>
        </div>
        <ButtonLink href="/precios" size="lg" className="shrink-0">
          {t("ctaSeePlansBottom")}
        </ButtonLink>
      </Panel>
    </Container>
  );
}

export default function ReporteFreeAuditPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense>
          <ReporteContent />
        </Suspense>
      </main>
    </>
  );
}
