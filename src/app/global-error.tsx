"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Unico lugar que puede capturar un error lanzado por el propio root layout
// (App Router exige que global-error.tsx reemplace <html>/<body> completos).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
          <h1>Algo salió mal</h1>
          <p>Ya nos enteramos del error. Intenta recargar la página.</p>
        </div>
      </body>
    </html>
  );
}
