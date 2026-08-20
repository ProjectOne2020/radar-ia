"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

// M31 — destino del link de invitacion que /api/webhooks/stripe manda por correo cuando
// se confirma un pago Enterprise (generateLink type "invite"). El cliente Supabase del
// navegador detecta la sesion automaticamente desde el fragmento de la URL (#access_token=...)
// al cargar — aqui solo se pide la contraseña nueva con esa sesion ya activa.
export default function ActivarCuentaPage() {
  const t = useTranslations("ActivarCuenta");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) setError(t("invalidLink"));
    });
  }, [t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
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
            {!ready ? (
              error ? <Alert tone="critical">{error}</Alert> : <p className="text-text-secondary">{t("loading")}</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    required
                    type="password"
                    minLength={8}
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <Alert tone="critical">{error}</Alert>}
                <Button type="submit" disabled={loading}>
                  {loading ? t("saving") : t("submit")}
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
