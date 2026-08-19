"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

// M24 — formulario publico de cotizacion Enterprise, pedido explicitamente por el
// fundador "parecido al de las agencias" (mismo patron de /agencias: llega a una tabla
// con RLS deny-by-default via /api/enterprise/apply, se revisa y cotiza en
// /admin/empresas). El plan Enterprise no tiene checkout automatico (sin precio fijo:
// 01-CONTEXTO-NEGOCIO.md), asi que este es el unico camino de entrada.
export default function EmpresasPage() {
  const t = useTranslations("Empresas");
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phoneWhatsapp: "",
    websiteUrl: "",
    city: "",
    country: "",
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
      const res = await fetch("/api/enterprise/apply", {
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
                  <Label htmlFor="businessName">{t("businessName")}</Label>
                  <Input
                    id="businessName"
                    required
                    autoFocus
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
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
                  <Label htmlFor="city">{t("city")}</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="country">{t("country")}</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="message">{t("message")}</Label>
                  <Textarea
                    id="message"
                    placeholder={t("messagePlaceholder")}
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
      <SiteFooter />
    </>
  );
}
