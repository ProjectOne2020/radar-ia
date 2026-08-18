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
    <p style={{ fontSize: 32, fontWeight: "bold" }}>
      {count === null ? "..." : count}
      <span style={{ fontSize: 14, fontWeight: "normal", marginLeft: 8, color: "#666" }}>
        personas en el sitio ahora mismo
      </span>
    </p>
  );
}
