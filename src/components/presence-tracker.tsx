"use client";

import { useEffect } from "react";
import { getSitePresenceChannel } from "@/lib/supabase/site-presence";

// Contador de "online ahora" pedido por el fundador — Vercel Analytics no ofrece
// presencia en tiempo real, asi que se construye aparte con Supabase Realtime Presence.
// Se monta una sola vez en el layout raiz, cubre todo el sitio publico y el dashboard.
// La suscripcion/track real vive en getSitePresenceChannel() (canal compartido) — ver
// src/lib/supabase/site-presence.ts para por que tiene que ser un singleton.
export function PresenceTracker() {
  useEffect(() => {
    getSitePresenceChannel();
  }, []);

  return null;
}
