"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function VerificarPage() {
  const t = useTranslations("Verificar");
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/otp/send", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("sendError"));
      return;
    }

    setSent(true);
    setInfo(data.whatsappConfigured ? t("whatsappSent") : t("whatsappNotConfigured"));
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("invalidCode"));
      return;
    }

    router.push("/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-text-secondary">{t("subtitle")}</p>

          <Panel raised className="mt-8 max-w-[420px]">
            {!sent && (
              <Button onClick={handleSend} disabled={loading}>
                {loading ? t("sending") : t("sendCode")}
              </Button>
            )}

            {info && (
              <Alert tone="signal" className="mt-4">
                {info}
              </Alert>
            )}

            {sent && (
              <form onSubmit={handleVerify} className="mt-5 flex flex-col gap-4">
                <div>
                  <Label htmlFor="code">{t("code")}</Label>
                  <Input
                    id="code"
                    required
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="text-center font-mono text-lg tracking-[0.4em]"
                  />
                </div>
                {error && <Alert tone="critical">{error}</Alert>}
                <Button type="submit" disabled={loading}>
                  {loading ? t("verifying") : t("verify")}
                </Button>
                <Button type="button" variant="ghost" onClick={handleSend} disabled={loading}>
                  {t("resend")}
                </Button>
              </form>
            )}
          </Panel>
        </Container>
      </main>
    </>
  );
}
