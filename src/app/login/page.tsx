"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

// "next" preserva a donde queria llegar el usuario (ej. un link de /dashboard/algo desde
// un correo) -- lo pone el proxy cuando redirige aqui por falta de sesion. Solo se acepta
// una ruta interna que empiece con "/" (nunca una URL externa completa, para no abrir una
// redireccion abierta).
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

function LoginForm() {
  const t = useTranslations("Login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si ya hay sesion activa (ej. llegaron aqui por el link "Iniciar sesion" del header
  // publico, confundidos porque no sabian que ya estaban logueados), no pedirlo de nuevo.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(next);
  }

  return (
    <Container narrow className="py-10 sm:py-16">
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
      <Panel raised className="mt-8 max-w-[420px]">
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
          <div>
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <Alert tone="critical">{error}</Alert>}
          <Button type="submit" disabled={loading}>
            {loading ? t("submitting") : t("submit")}
          </Button>
        </form>
        <p className="mt-3 text-sm text-text-secondary">
          <Link href="/olvide-password" className="text-ink underline underline-offset-2">
            {t("forgotPassword")}
          </Link>
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          {t("noAccount")}{" "}
          <Link href="/auditoria-gratis" className="text-ink underline underline-offset-2">
            {t("createAccount")}
          </Link>
        </p>
      </Panel>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
