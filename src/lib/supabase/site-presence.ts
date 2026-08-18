import type { RealtimeChannel } from "@supabase/supabase-js";
import { getRealtimeClient } from "./realtime-client";

// Canal de presencia compartido para "cuantos online hay ahora". Dos bugs reales
// encontrados en vivo antes de esta version:
// 1. Crear DOS objetos de canal distintos para el mismo topic "site-presence" (uno que
//    trackea, otro que solo escucha) hace que Phoenix/Realtime confirme el join del
//    primero y nunca responda al segundo — se queda "joining" para siempre.
// 2. Supabase prohibe registrar un callback `.on("presence", ...)` DESPUES de llamar
//    `.subscribe()` en el mismo canal (lanza "cannot add `presence` callbacks ... after
//    `subscribe()`") — por eso el listener de sync se registra aqui, una sola vez, antes
//    de subscribe(), y los demas componentes se enganchan via onSitePresenceSync() en vez
//    de tocar el canal directamente.
let channel: RealtimeChannel | null = null;
const syncListeners = new Set<() => void>();

function ensureChannel(): RealtimeChannel {
  if (channel) return channel;

  const supabase = getRealtimeClient();
  const key = crypto.randomUUID();
  const ch = supabase.channel("site-presence", { config: { presence: { key } } });

  ch.on("presence", { event: "sync" }, () => {
    for (const listener of syncListeners) listener();
  });

  ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await ch.track({ online_at: new Date().toISOString() });
    }
  });

  channel = ch;
  return ch;
}

export function getSitePresenceChannel(): RealtimeChannel {
  return ensureChannel();
}

// Devuelve una funcion para des-suscribirse.
export function onSitePresenceSync(listener: () => void): () => void {
  ensureChannel();
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
