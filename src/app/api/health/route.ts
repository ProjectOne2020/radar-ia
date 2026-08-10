import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Verifica que el deployment está conectado al proyecto Supabase correcto de Radar IA
// (no el de MaskotIA) haciendo un SELECT 1 real contra la base. Usa la anon key
// (no requiere service_role) porque select_1() no depende de RLS.
export async function GET() {
  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.rpc("select_1");

    if (error) throw error;

    return NextResponse.json({
      status: "ok",
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
