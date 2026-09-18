const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 34;

// Los 18 países del banco de preguntas (BANCO-PREGUNTAS-PROGRESO.md, orden de trabajo).
// Codigos tipograficos, no banderas ni logos — mismo principio que RadarNetwork con los
// motores de IA: representar sin inventar un icono/asset que no tenemos.
const COUNTRIES = [
  "MX", "CO", "AR", "CL", "PE", "PA", "VE", "EC", "HN",
  "GT", "SV", "CR", "BO", "PY", "UY", "DO", "PR", "BR",
];

const NODES = COUNTRIES.map((code, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / COUNTRIES.length;
  return {
    code,
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
});

/**
 * Visual de la seccion de cifras: 18 nodos (uno por pais del banco de preguntas)
 * orbitando el nodo central de Radar IA — mismo lenguaje que RadarNetwork (SVG puro,
 * codigos tipograficos, pulso signal/primary), pero a mayor escala y con mas nodos
 * para que la seccion tenga el peso visual que pidio el fundador.
 */
export function CoverageConstellation({
  className,
  centerLabel,
}: {
  className?: string;
  centerLabel: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      role="img"
      aria-label={`Radar IA conectado a los ${COUNTRIES.length} países de LATAM: ${COUNTRIES.join(", ")}`}
    >
      <defs>
        <radialGradient id="rd-coverage-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
          <stop offset="60%" stopColor="var(--color-accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={110} fill="url(#rd-coverage-glow)" />

      {NODES.map((node, i) => (
        <line
          key={`line-${node.code}`}
          x1={CENTER}
          y1={CENTER}
          x2={node.x}
          y2={node.y}
          stroke="var(--color-signal)"
          strokeWidth={1}
          strokeDasharray="3 5"
          opacity={0.35}
          className="rd-network-line"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}

      {NODES.map((node, i) => (
        <g key={node.code}>
          <circle
            cx={node.x}
            cy={node.y}
            r={15}
            fill="var(--color-paper-raised)"
            stroke="var(--color-signal-strong)"
            strokeWidth={1.5}
            className="rd-network-node"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
          <text
            x={node.x}
            y={node.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono"
            fontSize="9.5"
            fontWeight={600}
            fill="var(--color-signal-ink)"
            letterSpacing="0.02em"
          >
            {node.code}
          </text>
        </g>
      ))}

      {/* Nodo central: Radar IA */}
      <circle cx={CENTER} cy={CENTER} r={30} fill="var(--color-primary)" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={30}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2}
        className="rd-network-pulse"
      />
      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono"
        fontSize="10"
        fontWeight={700}
        fill="var(--color-ink)"
      >
        {centerLabel}
      </text>

      <style>{`
        @keyframes rd-network-line-pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.6; }
        }
        @keyframes rd-network-node-pulse {
          0%, 100% { stroke-opacity: 0.5; }
          50% { stroke-opacity: 1; }
        }
        @keyframes rd-network-ring {
          0% { r: 30; stroke-opacity: 0.55; }
          100% { r: 58; stroke-opacity: 0; }
        }
        .rd-network-line { animation: rd-network-line-pulse 4s ease-in-out infinite; }
        .rd-network-node { animation: rd-network-node-pulse 4s ease-in-out infinite; }
        .rd-network-pulse { animation: rd-network-ring 2.8s ease-out infinite; transform-origin: center; }
      `}</style>
    </svg>
  );
}
