import { AI_ENGINES } from "./engine-badge";

const SIZE = 320;
const CENTER = SIZE / 2;
// Cruz (arriba/derecha/abajo/izquierda), no un circulo militar literal —
// el negocio es el nodo central, cada motor de IA es un nodo conectado.
const NODES: Array<{ engine: string; x: number; y: number; labelDx: number; labelDy: number }> = [
  { engine: AI_ENGINES[2], x: CENTER, y: 46, labelDx: 0, labelDy: -18 }, // Gemini, arriba
  { engine: AI_ENGINES[0], x: SIZE - 46, y: CENTER, labelDx: 0, labelDy: 24 }, // ChatGPT, derecha
  { engine: AI_ENGINES[3], x: CENTER, y: SIZE - 46, labelDx: 0, labelDy: 24 }, // Perplexity, abajo
  { engine: AI_ENGINES[1], x: 46, y: CENTER, labelDx: 0, labelDy: 24 }, // Claude, izquierda
];

/**
 * Visual de hero: el negocio (nodo central) conectado a los 4 motores de IA
 * que Radar consulta de verdad. SVG puro + CSS keyframes (sin canvas/WebGL),
 * respeta prefers-reduced-motion via la media query global.
 */
export function RadarNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      role="img"
      aria-label="Radar conectando tu negocio con ChatGPT, Claude, Gemini y Perplexity"
    >
      <defs>
        <radialGradient id="rd-center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={70} fill="url(#rd-center-glow)" />

      {NODES.map((node, i) => (
        <line
          key={`line-${node.engine}`}
          x1={CENTER}
          y1={CENTER}
          x2={node.x}
          y2={node.y}
          stroke="var(--color-signal)"
          strokeWidth={1.5}
          strokeDasharray="4 5"
          opacity={0.5}
          className="rd-network-line"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}

      {NODES.map((node, i) => (
        <g key={node.engine}>
          <circle
            cx={node.x}
            cy={node.y}
            r={9}
            fill="var(--color-paper-raised)"
            stroke="var(--color-signal)"
            strokeWidth={1.5}
            className="rd-network-node"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
          <text
            x={node.x + node.labelDx}
            y={node.y + node.labelDy}
            textAnchor="middle"
            className="font-mono"
            fontSize="10"
            fill="var(--color-text-secondary)"
            letterSpacing="0.02em"
          >
            {node.engine}
          </text>
        </g>
      ))}

      {/* Nodo central: el negocio */}
      <circle cx={CENTER} cy={CENTER} r={16} fill="var(--color-primary)" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={16}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={1.5}
        className="rd-network-pulse"
      />

      <style>{`
        @keyframes rd-network-line-pulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.75; }
        }
        @keyframes rd-network-node-pulse {
          0%, 100% { stroke-opacity: 0.5; }
          50% { stroke-opacity: 1; }
        }
        @keyframes rd-network-ring {
          0% { r: 16; stroke-opacity: 0.6; }
          100% { r: 34; stroke-opacity: 0; }
        }
        .rd-network-line { animation: rd-network-line-pulse 3.6s ease-in-out infinite; }
        .rd-network-node { animation: rd-network-node-pulse 3.6s ease-in-out infinite; }
        .rd-network-pulse { animation: rd-network-ring 2.4s ease-out infinite; transform-origin: center; }
      `}</style>
    </svg>
  );
}
