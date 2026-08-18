"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { NICHES, SUPPORTED_COUNTRIES } from "@/lib/auth/country";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function RegistroPage() {
  const t = useTranslations("Registro");
  const tNiches = useTranslations("Niches");
  const tCountries = useTranslations("Countries");
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    niche: "dental",
    country: "MX",
    phoneWhatsapp: "",
    taxId: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
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

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        setError(t("loginFailedAfterSignup", { message: signInError.message }));
        setLoading(false);
        return;
      }

      router.push("/verificar");
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
          <Panel raised className="mt-8 max-w-[480px]">
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
                <Label htmlFor="niche">{t("niche")}</Label>
                <Select id="niche" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })}>
                  {NICHES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {tNiches(n.value)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="country">{t("country")}</Label>
                <Select
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                >
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {tCountries(c.code)}
                    </option>
                  ))}
                </Select>
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
                <Label htmlFor="taxId">{t("taxId")}</Label>
                <Input
                  id="taxId"
                  required
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
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
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              {error && <Alert tone="critical">{error}</Alert>}

              <Button type="submit" disabled={loading}>
                {loading ? t("submitting") : t("submit")}
              </Button>
            </form>
          </Panel>
        </Container>
      </main>
    </>
  );
}
