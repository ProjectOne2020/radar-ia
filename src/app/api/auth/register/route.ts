import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTaxId } from "@/lib/auth/tax-id";
import { currencyForCountry, COUNTRY_CURRENCY, NICHES } from "@/lib/auth/country";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

const VALID_NICHES = new Set(NICHES.map((n) => n.value));
const VALID_COUNTRIES = new Set(Object.keys(COUNTRY_CURRENCY));

// M5 — registro self-serve. Crea el usuario de Supabase Auth y la fila en `clients` en el
// mismo request (usando service_role, porque al momento de crear el cliente todavia no
// existe el JWT con el custom claim client_id que exige la RLS de M1). El navegador hace
// login por separado despues (signInWithPassword) para establecer la sesion con cookies.
export async function POST(request: Request) {
  // Sin limite, este endpoint permitia crear cuentas de Supabase Auth y filas de
  // `clients` de forma ilimitada desde una sola maquina (spam de DB + de auth).
  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    bucket: "auth_register_ip",
    identifier: ip,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!ipLimit.allowed) {
    return tooManyRequests("Demasiados registros desde esta conexión. Intenta más tarde.", ipLimit.retryAfterSeconds);
  }

  const body = await request.json().catch(() => null);
  const { businessName, niche, country, phoneWhatsapp, taxId, email, password } = body ?? {};

  if (!businessName || typeof businessName !== "string" || businessName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre del negocio inválido." }, { status: 400 });
  }
  if (!VALID_NICHES.has(niche)) {
    return NextResponse.json({ error: "Rubro inválido." }, { status: 400 });
  }
  if (!VALID_COUNTRIES.has(country)) {
    return NextResponse.json({ error: "País no soportado todavía." }, { status: 400 });
  }
  if (!phoneWhatsapp || !/^\+\d{8,15}$/.test(phoneWhatsapp)) {
    return NextResponse.json({ error: "Teléfono de WhatsApp inválido (usa formato +52...)." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const taxIdCheck = validateTaxId(country, taxId ?? "");
  if (!taxIdCheck.valid) {
    return NextResponse.json({ error: taxIdCheck.reason ?? "Identificador fiscal inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // la verificacion real de negocio es el OTP de WhatsApp, no el email
  });

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? "No se pudo crear la cuenta." }, { status: 400 });
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      business_name: businessName.trim(),
      niche,
      plan: "lite", // default de un registro self-serve sin plan pagado todavia (M9)
      country,
      currency: currencyForCountry(country),
      phone_whatsapp: phoneWhatsapp,
      email,
      tax_id: taxId,
      verification_status: "pending",
      onboarding_type: "self_serve",
    })
    .select("id")
    .single();

  if (clientError || !client) {
    // Rollback manual: si la fila de clients falla, no dejar un auth.users huerfano.
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: clientError?.message ?? "No se pudo crear el negocio." }, { status: 500 });
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(authUser.user.id, {
    app_metadata: { client_id: client.id },
  });

  if (metadataError) {
    return NextResponse.json(
      { error: `Cuenta creada pero no se pudo enlazar la sesión: ${metadataError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ clientId: client.id, email });
}
