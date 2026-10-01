"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

// Mismo patron que /activar-cuenta (clientes): destino del link de invitacion que manda
// /api/admin/partner-applications o /api/admin/partners al aprobar una agencia. El cliente
// Supabase del navegador detecta la sesion del fragmento de la URL (#access_token=...) al
// cargar -- aqui solo se pide la contraseña nueva con esa sesion ya activa.
export default function PartnerActivarCuentaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) setError("Este link ya no es válido. Pide uno nuevo desde /partners/login.");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
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
    router.push("/partners/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">Activa tu panel de agencia</h1>
          <p className="mt-2 text-text-secondary">Define tu contraseña para entrar a tu panel de partner.</p>

          <Panel raised className="mt-8 max-w-[420px]">
            {!ready ? (
              error ? <Alert tone="critical">{error}</Alert> : <p className="text-text-secondary">Cargando…</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="password">Contraseña</Label>
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
                  {loading ? "Guardando..." : "Activar mi panel"}
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
