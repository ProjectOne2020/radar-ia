import { defineConfig } from "vitest/config";

// P0.1 — configuracion minima de tests. Solo cubre logica pura (clasificador de
// contaminacion y compuerta de TAO); no monta Next.js ni toca la base de datos.
// Extension .mts para que Vite la cargue como ESM sin warnings.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
