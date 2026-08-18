"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

// Formulario publico del programa de partners/agencias (seccion 8.3 de
// 01-CONTEXTO-NEGOCIO.md). Llega a partner_applications (RLS sin policies, insert via
// service role en /api/partners/apply) y se revisa en /admin/partners — aceptar crea el
// partner_accounts real con su API key, el mismo mecanismo que ya existia para altas
// manuales.
export default function AgenciasPage() {
  const t = useTranslations("Agencias");
  const [form, setForm] = useState({
    agencyName: "",
    contactName: "",
    email: "",
    phoneWhatsapp: "",
    websiteUrl: "",
    clientCount: "",
    message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("genericError"));
        setLoading(false);
        return;
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-text-secondary">{t("hook")}</p>

          <Panel raised className="mt-8">
            {sent ? (
              <Alert tone="good">
                <p className="font-medium">{t("successTitle")}</p>
                <p className="mt-1">{t("successBody")}</p>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="agencyName">{t("agencyName")}</Label>
                  <Input
                    id="agencyName"
                    required
                    autoFocus
                    value={form.agencyName}
                    onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contactName">{t("contactName")}</Label>
                  <Input
                    id="contactName"
                    required
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phoneWhatsapp">{t("whatsapp")}</Label>
                  <Input
                    id="phoneWhatsapp"
                    required
                    placeholder={t("whatsappPlaceholder")}
                    value={form.phoneWhatsapp}
                    onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="websiteUrl">{t("websiteUrl")}</Label>
                  <Input
                    id="websiteUrl"
                    type="url"
                    placeholder={t("websiteUrlPlaceholder")}
                    value={form.websiteUrl}
                    onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="clientCount">{t("clientCount")}</Label>
                  <Input
                    id="clientCount"
                    placeholder={t("clientCountPlaceholder")}
                    value={form.clientCount}
                    onChange={(e) => setForm({ ...form, clientCount: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="message">{t("message")}</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </div>

                {error && <Alert tone="critical">{error}</Alert>}

                <Button type="submit" disabled={loading}>
                  {loading ? t("submitting") : t("submit")}
                </Button>
              </form>
            )}
          </Panel>
        </Container>
      </main>
    </>
  );
}
