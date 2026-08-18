import { createSign } from "crypto";

// Intercambio JWT-bearer para cuenta de servicio de Google (RFC 7523), implementado a
// mano con crypto nativo — mismo estilo "fetch crudo, sin SDK" que el resto de
// integraciones externas de este proyecto (ver src/lib/audit/gbp.ts). No se agrega la
// dependencia googleapis solo para esto.
export async function getMerchantCenterAccessToken(): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_MERCHANT_CENTER_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_MERCHANT_CENTER_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) return null;

  // En Vercel/`.env` los saltos de linea de una clave PEM llegan escapados como "\n".
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/content",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(claims)}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.access_token === "string" ? data.access_token : null;
}
