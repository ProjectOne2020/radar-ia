"use client";

import { useEffect, useState } from "react";
import { getSitePresenceChannel, onSitePresenceSync } from "@/lib/supabase/site-presence";

// Lee el mismo canal compartido que PresenceTracker (src/components/presence-tracker.tsx)
// via onSitePresenceSync() — nunca llama channel.on() directamente, ver
// src/lib/supabase/site-presence.ts para el motivo (Supabase no permite registrar
// callbacks de presence en un canal que ya llamo subscribe()).
export default function LiveOnline() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const channel = getSitePresenceChannel();
    const updateCount = () => setCount(Object.keys(channel.presenceState()).length);

    const unsubscribe = onSitePresenceSync(updateCount);
    if (channel.state === "joined") updateCount();

    return unsubscribe;
  }, []);

  return (
    <p className="flex items-baseline gap-2">
      <span className="font-display text-4xl font-semibold text-signal-strong">{count === null ? "…" : count}</span>
      <span className="text-sm text-text-secondary">personas en el sitio ahora mismo</span>
    </p>
  );
}
