import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Radar IA — Visibilidad en IA para negocios LATAM";

// Mismos 4 motores activos que muestra radar-network.tsx en el hero (ChatGPT,
// Claude, Gemini, Perplexity) — hardcoded aqui porque ImageResponse (satori) no
// puede resolver imports que dependan de CSS custom properties ni del arbol de
// componentes React normal, asi que replicamos el mismo diagrama "4 puntos
// cardinales" con valores planos en vez de reusar el componente SVG del hero.
const ENGINES = ["ChatGPT", "Claude", "Gemini", "Perplexity"];

const COLOR = {
  surfaceSunken: "#05080f",
  paperRaised: "#0d1426",
  ink: "#f3f5fb",
  textSecondary: "#9ba3c4",
  primary: "#635bff",
  signal: "#00d4ff",
  signalStrong: "#34e0ff",
};

// Layout centrado (no lado-a-lado): WhatsApp/Facebook/Telegram recortan la
// miniatura a un cuadrado centrado sobre esta imagen de 1200x630 — un diseno
// con texto a la izquierda y diagrama a la derecha pierde la mitad de cada
// lado en ese recorte. Todo el contenido importante va centrado horizontal
// y verticalmente, dentro del cuadrado central ~630x630 que sobrevive el recorte.
const DIAGRAM_SIZE = 380;
const CENTER = DIAGRAM_SIZE / 2;
const RADIUS = 145;

// Mismo calculo de angulos que NODES en radar-network.tsx: empieza arriba y
// reparte en circulo — con 4 motores caen exactamente en los 4 puntos
// cardinales (arriba/derecha/abajo/izquierda).
const NODES = ENGINES.map((engine, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ENGINES.length;
  return {
    engine,
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
    angleDeg: (angle * 180) / Math.PI,
  };
});

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLOR.surfaceSunken,
          backgroundImage: `radial-gradient(ellipse 800px 600px at 50% 0%, rgba(99, 91, 255, 0.28), transparent 60%), radial-gradient(ellipse 800px 500px at 50% 100%, rgba(0, 212, 255, 0.16), transparent 55%)`,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: COLOR.ink,
            marginBottom: 28,
          }}
        >
          Radar IA
        </div>

        {/* Diagrama: negocio en el centro conectado a los 4 motores de IA */}
        <div
          style={{
            position: "relative",
            width: DIAGRAM_SIZE,
            height: DIAGRAM_SIZE,
            display: "flex",
            flexShrink: 0,
          }}
        >
          {NODES.map((node) => {
            const dx = node.x - CENTER;
            const dy = node.y - CENTER;
            const length = Math.sqrt(dx * dx + dy * dy);
            return (
              <div
                key={`line-${node.engine}`}
                style={{
                  position: "absolute",
                  left: CENTER,
                  top: CENTER,
                  width: length,
                  height: 2,
                  backgroundColor: COLOR.signal,
                  opacity: 0.45,
                  transform: `rotate(${node.angleDeg}deg)`,
                  transformOrigin: "0 0",
                }}
              />
            );
          })}

          {NODES.map((node) => (
            <div
              key={node.engine}
              style={{
                position: "absolute",
                left: node.x - 55,
                top: node.y - 22,
                width: 110,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: COLOR.paperRaised,
                  border: `2px solid ${COLOR.signalStrong}`,
                }}
              />
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLOR.ink,
                }}
              >
                {node.engine}
              </div>
            </div>
          ))}

          {/* Nodo central: el negocio */}
          <div
            style={{
              position: "absolute",
              left: CENTER - 38,
              top: CENTER - 38,
              width: 76,
              height: 76,
              borderRadius: 999,
              backgroundColor: COLOR.primary,
              display: "flex",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            color: COLOR.ink,
            textAlign: "center",
          }}
        >
          Visibilidad en IA para negocios LATAM
        </div>
      </div>
    ),
    { ...size },
  );
}
