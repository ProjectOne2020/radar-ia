import { createHmac, randomInt, timingSafeEqual } from "crypto";

// Verificacion OTP SIN agregar tablas/columnas nuevas al esquema literal de
// 03-ARQUITECTURA-TECNICA.md (clients no tiene columna para guardar un codigo). En vez de
// persistir el OTP en la base de datos, se firma un token HMAC de vida corta (10 min) con
// el hash del codigo — viaja en una cookie httpOnly, nunca en el cliente en texto plano.
// El codigo en si solo se envia por WhatsApp (o se loguea en servidor si no hay credenciales
// configuradas, ver src/lib/whatsapp/send-message.ts).

const OTP_COOKIE_NAME = "radar_ia_otp";
const OTP_TTL_MS = 10 * 60 * 1000;

function getSigningSecret(): string {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret) throw new Error("Falta OTP_SIGNING_SECRET en las variables de entorno.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export interface OtpCookiePayload {
  clientId: string;
  phone: string;
  codeHash: string;
  expiresAt: number;
}

export function buildOtpCookieValue(clientId: string, phone: string, code: string): string {
  const codeHash = createHmac("sha256", getSigningSecret()).update(code).digest("hex");
  const expiresAt = Date.now() + OTP_TTL_MS;
  const payload: OtpCookiePayload = { clientId, phone, codeHash, expiresAt };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyOtpCookie(
  cookieValue: string | undefined,
  submittedCode: string
): { valid: boolean; clientId?: string; reason?: string } {
  if (!cookieValue) return { valid: false, reason: "No hay un código pendiente de verificación." };

  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return { valid: false, reason: "Token de verificación inválido." };

  const expectedSignature = sign(encoded);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: "Token de verificación inválido." };
  }

  let payload: OtpCookiePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  } catch {
    return { valid: false, reason: "Token de verificación corrupto." };
  }

  if (Date.now() > payload.expiresAt) {
    return { valid: false, reason: "El código expiró, solicita uno nuevo." };
  }

  const submittedHash = createHmac("sha256", getSigningSecret()).update(submittedCode).digest("hex");
  const submittedBuffer = Buffer.from(submittedHash);
  const codeBuffer = Buffer.from(payload.codeHash);
  if (submittedBuffer.length !== codeBuffer.length || !timingSafeEqual(submittedBuffer, codeBuffer)) {
    return { valid: false, reason: "Código incorrecto." };
  }

  return { valid: true, clientId: payload.clientId };
}

export { OTP_COOKIE_NAME, OTP_TTL_MS };
