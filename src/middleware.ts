import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { currencyForCountry } from "@/lib/auth/country";

// Refresca la sesion de Supabase Auth en cada request (patron estandar de @supabase/ssr)
// para que las Server Components/Route Handlers siempre lean cookies vigentes. Tambien
// resuelve pais->moneda (M8) y lo inyecta como header para que Server Components lean el
// precio localizado sin repetir esta logica.
export async function middleware(request: NextRequest) {
  // x-vercel-ip-country: header que Vercel inyecta automaticamente en el edge (la API
  // request.geo de Next.js quedo deprecada). x-test-country tiene prioridad para pruebas
  // locales/automatizadas — exactamente lo que pide el criterio de "terminado" de M8.
  const country =
    request.headers.get("x-test-country") ?? request.headers.get("x-vercel-ip-country") ?? "";
  const currency = currencyForCountry(country);

  request.headers.set("x-radar-country", country);
  request.headers.set("x-radar-currency", currency);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
