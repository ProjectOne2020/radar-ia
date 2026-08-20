"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Panel, Alert } from "@/components/ui/panel";

type AccessMethod = "invite_us" | "we_apply_changes";

export function IntakeForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("OnboardingIntake");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [websitePlatform, setWebsitePlatform] = useState("");
  const [accessMethod, setAccessMethod] = useState<AccessMethod | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [hasGbp, setHasGbp] = useState<boolean | null>(null);
  const [gbpNotes, setGbpNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/onboarding-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName,
        contactEmail,
        contactPhone: contactPhone.trim() || null,
        websitePlatform: websitePlatform.trim() || null,
        websiteAccessMethod: accessMethod,
        inviteEmail: accessMethod === "invite_us" ? inviteEmail.trim() : null,
        hasGbp,
        gbpNotes: gbpNotes.trim() || null,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("genericError"));
      return;
    }

    onDone();
  }

  return (
    <Panel raised>
      <h2 className="text-xl font-semibold text-ink">{t("title")}</h2>
      <p className="mt-1.5 text-sm text-text-secondary">{t("subtitle")}</p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <div>
          <Label htmlFor="contactName">{t("contactName")}</Label>
          <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
          <Input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="contactPhone">{t("contactPhone")}</Label>
          <Input
            id="contactPhone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder={t("contactPhonePlaceholder")}
          />
        </div>

        <div>
          <Label htmlFor="websitePlatform">{t("websitePlatform")}</Label>
          <Input
            id="websitePlatform"
            value={websitePlatform}
            onChange={(e) => setWebsitePlatform(e.target.value)}
            placeholder={t("websitePlatformPlaceholder")}
          />
        </div>

        <div>
          <Label>{t("accessMethodLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={accessMethod === "invite_us" ? "primary" : "secondary"}
              onClick={() => setAccessMethod("invite_us")}
            >
              {t("accessMethodInvite")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={accessMethod === "we_apply_changes" ? "primary" : "secondary"}
              onClick={() => setAccessMethod("we_apply_changes")}
            >
              {t("accessMethodWeApply")}
            </Button>
          </div>
        </div>

        {accessMethod === "invite_us" && (
          <div>
            <Label htmlFor="inviteEmail">{t("inviteEmail")}</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("inviteEmailPlaceholder")}
              required
            />
          </div>
        )}

        <div>
          <Label>{t("hasGbpLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={hasGbp === true ? "primary" : "secondary"}
              onClick={() => setHasGbp(true)}
            >
              {t("hasGbpYes")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={hasGbp === false ? "primary" : "secondary"}
              onClick={() => setHasGbp(false)}
            >
              {t("hasGbpNo")}
            </Button>
          </div>
        </div>

        {hasGbp === true && (
          <div>
            <Label htmlFor="gbpNotes">{t("gbpNotes")}</Label>
            <Textarea
              id="gbpNotes"
              value={gbpNotes}
              onChange={(e) => setGbpNotes(e.target.value)}
              placeholder={t("gbpNotesPlaceholder")}
            />
          </div>
        )}

        {error && <Alert tone="critical">{error}</Alert>}

        <Button type="submit" disabled={loading} className="mt-1">
          {loading ? t("saving") : t("submit")}
        </Button>
        <button type="button" onClick={onDone} className="text-center text-sm text-text-secondary hover:text-ink">
          {t("skip")}
        </button>
      </form>
    </Panel>
  );
}
