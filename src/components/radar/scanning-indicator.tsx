export function ScanningIndicator({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="relative h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-sunken">
        <div className="absolute inset-y-0 w-1/3 animate-[rd-scan_1.1s_ease-in-out_infinite] rounded-full bg-signal" />
      </div>
      <p className="max-w-[36ch] text-sm text-text-secondary">{label}</p>
      <style>{`
        @keyframes rd-scan {
          0% { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
