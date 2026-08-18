"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Competitor {
  linkId: string;
  competitorClientId: string | null;
  businessName: string;
  scoreTotal: number | null;
  calculatedAt: string | null;
}

export default function CompetidoresPage() {
  const t = useTranslations("DashboardCompetidores");
  const [competitors, setCompetitors] = useState<Competitor[] | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ competitorName: "", city: "", websiteUrl: "" });
  const [adding, setAdding] = useState(false);

  async function loadCompetitors() {
    const res = await fetch("/api/dashboard/competitors");
    const data = await res.json();
    if (res.ok) {
      setCompetitors(data.competitors);
      setMyScore(data.myScore ?? null);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/dashboard/competitors")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ignore && ok) {
          setCompetitors(data.competitors);
          setMyScore(data.myScore ?? null);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);

    const res = await fetch("/api/dashboard/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setAdding(false);

    if (!res.ok) {
      setError(data.error ?? t("genericError"));
      return;
    }

    setForm({ competitorName: "", city: "", websiteUrl: "" });
    await loadCompetitors();
  }

  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mt-2 text-text-secondary">{t("subtitle")}</p>

      <div className="mt-6 flex flex-col gap-2.5">
        {(competitors ?? []).map((c) => {
          const delta = myScore !== null && c.scoreTotal !== null ? Math.round(myScore - c.scoreTotal) : null;
          return (
            <div
              key={c.linkId}
              className="flex items-center justify-between gap-3 rounded-xs border border-border bg-paper-raised p-3.5"
            >
              <span className="text-sm text-text">{c.businessName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-sm text-text-secondary">
                  {c.scoreTotal !== null ? `${Math.round(c.scoreTotal)}/100` : t("scorePending")}
                </span>
                {delta !== null && (
                  <Badge tone={delta > 0 ? "good" : delta < 0 ? "critical" : "neutral"}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {competitors && competitors.length === 0 && (
        <Panel raised className="mt-4">
          <p className="text-text-secondary">{t("empty")}</p>
        </Panel>
      )}

      <h2 className="mt-10 text-lg font-semibold text-ink">{t("addTitle")}</h2>
      <p className="mt-1 text-sm text-text-muted">{t("addNote")}</p>

      <Panel raised className="mt-4 max-w-[420px]">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="competitorName">{t("competitorName")}</Label>
            <Input
              id="competitorName"
              required
              value={form.competitorName}
              onChange={(e) => setForm({ ...form, competitorName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="city">{t("city")}</Label>
            <Input
              id="city"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="websiteUrl">{t("websiteUrl")}</Label>
            <Input
              id="websiteUrl"
              required
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
            />
          </div>
          {error && <Alert tone="critical">{error}</Alert>}
          <Button type="submit" disabled={adding}>
            {adding ? t("auditing") : t("addAndCompare")}
          </Button>
        </form>
      </Panel>
    </>
  );
}
