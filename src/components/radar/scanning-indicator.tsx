import { AI_ENGINES } from "./engine-badge";

/**
 * Estado de escaneo honesto: los 4 motores se muestran "activos" en
 * conjunto (pulso compartido), NUNCA como una lista de ticks secuenciales
 * falsos — el backend corre la medicion como una sola llamada sincrona, no
 * hay señal real de progreso por motor. Mostrar "✓ ChatGPT / ◉ Gemini
 * escaneando..." individual seria inventar actividad que no existe.
 */
export function ScanningIndicator({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute h-full w-full rounded-full border-2 border-signal/40 rd-scan-ring" />
        <span className="absolute h-10 w-10 rounded-full border-2 border-signal/60 rd-scan-ring" style={{ animationDelay: "0.6s" }} />
        <span className="h-4 w-4 rounded-full bg-signal rd-scan-dot" />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {AI_ENGINES.map((engine, i) => (
          <span
            key={engine}
            className="rounded-xs border border-signal/30 bg-signal-soft px-2.5 py-1 font-mono text-xs text-signal-ink rd-scan-chip"
            style={{ animationDelay: `${i * 0.25}s` }}
          >
            {engine}
          </span>
        ))}
      </div>

      <p className="max-w-[38ch] text-sm text-text-secondary">{label}</p>

      <div className="relative h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-sunken">
        <div className="absolute inset-y-0 w-1/3 rd-scan-bar rounded-full bg-signal" />
      </div>

      <style>{`
        @keyframes rd-scan-bar-move {
          0% { left: -33%; }
          100% { left: 100%; }
        }
        @keyframes rd-scan-ring-pulse {
          0% { transform: scale(0.85); opacity: 0.8; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes rd-scan-dot-pulse {
          0%, 100% { opacity: 0.7; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes rd-scan-chip-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .rd-scan-bar { animation: rd-scan-bar-move 1.1s ease-in-out infinite; }
        .rd-scan-ring { animation: rd-scan-ring-pulse 2s ease-out infinite; }
        .rd-scan-dot { animation: rd-scan-dot-pulse 2s ease-in-out infinite; }
        .rd-scan-chip { animation: rd-scan-chip-pulse 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
