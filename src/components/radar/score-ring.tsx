"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Score visualization principal — anillo circular (instrumento de radar, no
 * un numero suelto en una card). El arco crece de 0 al score real al montar,
 * respetando prefers-reduced-motion (la transicion se desactiva globalmente
 * via CSS en ese caso).
 */
export function ScoreRing({
  score,
  noiseLabel,
  signalLabel,
  size = "lg",
  className,
}: {
  score: number;
  noiseLabel?: string;
  signalLabel?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const gradientId = useId();
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setProgress(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const offset = CIRCUMFERENCE * (1 - progress / 100);
  const dimension = size === "lg" ? 220 : 160;

  return (
    <div className={cn("flex flex-col items-center", className)} ref={ref}>
      <div className="relative" style={{ width: dimension, height: dimension }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={dimension}
          height={dimension}
          className="-rotate-90"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-signal)" />
            </linearGradient>
          </defs>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-1000 ease-[var(--ease-signal)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-mono font-semibold tabular-nums text-ink",
              size === "lg" ? "text-5xl" : "text-3xl",
            )}
          >
            {Math.round(clamped)}
          </span>
          <span className="font-mono text-xs text-text-muted">/100</span>
        </div>
      </div>

      {(noiseLabel || signalLabel) && (
        <div className="mt-4 flex w-full max-w-[220px] justify-between font-mono text-[0.7rem] uppercase tracking-wider text-text-muted">
          <span>{noiseLabel}</span>
          <span>{signalLabel}</span>
        </div>
      )}
    </div>
  );
}
