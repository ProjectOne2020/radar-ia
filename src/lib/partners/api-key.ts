import { randomBytes, createHash } from "crypto";

// La columna partner_accounts.api_key guarda el HASH, nunca el texto plano — mismo
// principio que un token de API real (GitHub, Stripe): el texto plano solo se muestra
// una vez, al crear el partner, y no se puede recuperar despues.
const API_KEY_PREFIX = "radarpk_";

export function generatePartnerApiKey(): { plaintext: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const plaintext = `${API_KEY_PREFIX}${raw}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
