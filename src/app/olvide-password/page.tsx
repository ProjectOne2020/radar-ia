"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

// Antes /login no tenia ninguna forma de recuperar la contraseña -- un usuario que la
// olvidaba quedaba bloqueado sin salida (hueco real reportado por el fundador probando su
// propia cuenta). Usa el flujo nativo de Supabase Auth (resetPasswordForEmail), mismo
// mecanismo de sesion-por-fragmento-de-URL que /activar-cuenta.
export default function OlvidePasswordPage() {
  const t = useTranslations("OlvidePassword");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const appUrl = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/restablecer-password`,
    });
    setLoading(false);

    // Siempre se muestra el mismo mensaje de exito, exista o no una cuenta con ese correo
    // -- no confirmarle a quien llena el formulario si un correo especifico esta
    // registrado o no (mismo criterio de no filtrar informacion que ya se sigue en el
    // resto del proyecto, ej. /api/free-audit/otp/verify).
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-text-secondary">{t("subtitle")}</p>

          <Panel raised className="mt-8 max-w-[420px]">
            {sent ? (
              <Alert tone="good">{t("sentBody")}</Alert>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    required
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && <Alert tone="critical">{error}</Alert>}
                <Button type="submit" disabled={loading}>
                  {loading ? t("sending") : t("submit")}
                </Button>
              </form>
            )}
            <p className="mt-5 text-sm text-text-secondary">
              <Link href="/login" className="text-ink underline underline-offset-2">
                {t("backToLogin")}
              </Link>
            </p>
          </Panel>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
