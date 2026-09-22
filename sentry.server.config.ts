import * as Sentry from "@sentry/nextjs";

// Endpoint de GlitchTip (protocolo compatible con el SDK de Sentry — free tier,
// sin costo). Si SENTRY_DSN no esta seteada (ej. en dev local sin .env) el SDK
// simplemente no reporta nada, no rompe el build.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
