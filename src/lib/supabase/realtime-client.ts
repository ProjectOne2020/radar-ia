import { createClient } from "./client";

// Instancia unica compartida para uso de Realtime (Presence) en el navegador. Crear un
// createClient() nuevo por componente generaba multiples RealtimeClient/GoTrueClient
// independientes en la misma pestaña — dos canales con el mismo topic ("site-presence")
// desde instancias distintas terminaban en conflicto (uno de los dos nunca resolvia
// "SUBSCRIBED", verificado en vivo). Un singleton evita el problema de raiz.
let client: ReturnType<typeof createClient> | null = null;

export function getRealtimeClient() {
  if (!client) client = createClient();
  return client;
}
