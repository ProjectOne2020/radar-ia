"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Panel, Alert } from "@/components/ui/panel";

// M27 — toggle de opt-in al listado publico, disponible para clientes con sesion (el
// checkbox de la auditoria gratis solo se ve una vez, al pedirla; esto le da a un
// cliente pagado la misma decision despues, en cualquier momento). La lectura usa el
// cliente de sesion (RLS `clients_select_own` sigue permitiendo SELECT); la escritura
// pasa por /api/dashboard/public-listing porque UPDATE sobre `clients` esta revocado
// para `authenticated` desde M22.
export function PublicListingToggle() {
  const t = useTranslations("DashboardPlan");
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clients")
      .select("public_listing_opt_in")
      .single()
      .then(({ data }) => setOptIn(data?.public_listing_opt_in ?? false));
  }, []);

  async function toggle() {
    if (optIn === null || saving) return;
    const next = !optIn;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/dashboard/public-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optIn: next }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error");
      return;
    }
    setOptIn(next);
  }

  if (optIn === null) return null;

  return (
    <Panel className="mt-6 max-w-[560px]">
      <h2 className="text-lg font-semibold text-ink">{t("publicListingTitle")}</h2>
      <p className="mt-1.5 text-sm text-text-secondary">{t("publicListingBody")}</p>
      <label className="mt-4 flex items-center gap-2.5 text-sm text-text">
        <input
          type="checkbox"
          className="h-4 w-4 rounded-[3px] border-border-strong accent-signal"
          checked={optIn}
          disabled={saving}
          onChange={toggle}
        />
        {optIn ? t("publicListingOn") : t("publicListingOff")}
      </label>
      {error && (
        <Alert tone="critical" className="mt-3">
          {error}
        </Alert>
      )}
    </Panel>
  );
}
