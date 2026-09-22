import * as Sentry from "@sentry/nextjs";

// El DSN no es secreto (esta pensado para vivir en el bundle del navegador),
// asi que va con prefijo NEXT_PUBLIC_ como cualquier otra env var de cliente.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
