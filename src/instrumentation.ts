import * as Sentry from "@sentry/nextjs";

// Inicializa Sentry (apuntando a GlitchTip via SENTRY_DSN, mismo protocolo que
// Sentry — ver src/instrumentation-client.ts) en el runtime de servidor y edge.
// Next.js llama register() automaticamente al arrancar cada runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
