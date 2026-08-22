import { AI_ENGINES } from "./engine-badge";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 46;

// P0.1 — Los nodos se GENERAN desde AI_ENGINES (que a su vez deriva de ACTIVE_ENGINES),
// en vez de estar cableados a mano. Antes eran 4 posiciones fijas, una de ellas
// Perplexity — un motor que nunca corrio. Ahora el hero no puede prometer un motor que el
// backend no consulta: si la lista activa cambia, el visual se reacomoda solo.
const NODES = AI_ENGINES.map((engine, i) => {
  // Se reparten en circulo empezando arriba, para que cualquier cantidad quede equilibrada.
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AI_ENGINES.length;
  const y = CENTER + RADIUS * Math.sin(angle);
  return {
    engine,
    x: CENTER + RADIUS * Math.cos(angle),
    y,
    labelDx: 0,
    // La etiqueta va arriba del nodo solo cuando el nodo esta en la mitad superior.
    labelDy: y < CENTER ? -18 : 24,
  };
});

const ENGINE_LIST = AI_ENGINES.join(", ");

/**
 * Visual de hero: el negocio (nodo central) conectado a los motores de IA que Radar
 * consulta de verdad. SVG puro + CSS keyframes (sin canvas/WebGL), respeta
 * prefers-reduced-motion via la media query global.
 */
export function RadarNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      role="img"
      aria-label={`Radar conectando tu negocio con ${ENGINE_LIST}`}
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
