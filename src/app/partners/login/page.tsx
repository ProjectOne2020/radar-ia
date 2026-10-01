"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function PartnerLoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/partners/auth/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">Panel de agencias</h1>
          <p className="mt-2 text-text-secondary">
            Entra con el correo que registramos cuando te aprobamos como partner de Radar IA.
          </p>

          <Panel raised className="mt-8 max-w-[420px]">
            {sent ? (
              <Alert tone="good">
                Si ese correo tiene una cuenta de agencia activa, te mandamos un link para entrar. Revisa tu bandeja
                (y spam).
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Enviando..." : "Enviarme el link de acceso"}
                </Button>
              </form>
            )}
          </Panel>

          <p className="mt-6 text-sm text-text-muted">
            ¿Todavía no eres partner?{" "}
            <Link href="/agencias" className="text-text underline underline-offset-2">
              Solicítalo aquí
            </Link>
            .
          </p>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
