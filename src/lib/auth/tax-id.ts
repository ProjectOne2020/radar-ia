// Validacion de FORMATO del identificador fiscal por pais (RFC/NIT/RUT/RUC/CUIT) — no es
// verificacion oficial contra el registro tributario del gobierno (ninguna API de ese tipo
// esta documentada en 03-ARQUITECTURA-TECNICA.md), es un chequeo de forma/checksum basico
// para atrapar errores de tipeo antes de guardar clients.tax_id (usado tambien para
// anti-abuso, ver 01-CONTEXTO-NEGOCIO.md).

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// RFC persona moral: 3 letras + 6 digitos (fecha AAMMDD) + 3 alfanumericos (homoclave).
// RFC persona fisica: 4 letras + 6 digitos + 3 alfanumericos. Se acepta cualquiera de los dos.
function validateRfcMx(taxId: string): ValidationResult {
  const clean = taxId.toUpperCase().trim();
  const pattern = /^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})([A-Z0-9]{3})$/;
  const match = clean.match(pattern);
  if (!match) return { valid: false, reason: "Formato de RFC inválido." };

  const month = Number(match[3]);
  const day = Number(match[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, reason: "El RFC no tiene una fecha válida." };
  }
  return { valid: true };
}

// NIT Colombia: 9-10 digitos + digito de verificacion (algoritmo modulo 11 oficial de la DIAN).
function validateNitCo(taxId: string): ValidationResult {
  const clean = taxId.replace(/[^0-9]/g, "");
  if (clean.length < 9 || clean.length > 10) {
    return { valid: false, reason: "El NIT debe tener 9-10 dígitos." };
  }

  const base = clean.slice(0, -1);
  const providedCheckDigit = Number(clean.slice(-1));
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const padded = base.padStart(15, "0").split("").map(Number);
  const sum = padded.reduce((acc, digit, i) => acc + digit * weights[i], 0);
  const remainder = sum % 11;
  const checkDigit = remainder > 1 ? 11 - remainder : remainder;

  if (checkDigit !== providedCheckDigit) {
    return { valid: false, reason: "El dígito de verificación del NIT no coincide." };
  }
  return { valid: true };
}

// RUT Chile: 7-8 digitos + digito verificador (modulo 11).
function validateRutCl(taxId: string): ValidationResult {
  const clean = taxId.replace(/[.\s]/g, "").toUpperCase();
  const match = clean.match(/^(\d{7,8})-?([0-9K])$/);
  if (!match) return { valid: false, reason: "Formato de RUT inválido (ej. 12345678-9)." };

  const body = match[1];
  const providedDv = match[2];

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);

  if (expectedDv !== providedDv) {
    return { valid: false, reason: "El dígito verificador del RUT no coincide." };
  }
  return { valid: true };
}

// RUC Peru: 11 digitos, empieza con 10 (persona natural) o 20 (persona juridica).
function validateRucPe(taxId: string): ValidationResult {
  const clean = taxId.replace(/[^0-9]/g, "");
  if (!/^(10|15|17|20)\d{9}$/.test(clean)) {
    return { valid: false, reason: "El RUC debe tener 11 dígitos y un prefijo válido." };
  }
  return { valid: true };
}

// CUIT Argentina: 11 digitos (2 prefijo + 8 + 1 verificador, modulo 11).
function validateCuitAr(taxId: string): ValidationResult {
  const clean = taxId.replace(/[^0-9]/g, "");
  if (clean.length !== 11) return { valid: false, reason: "El CUIT debe tener 11 dígitos." };

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = clean.split("").map(Number);
  const sum = digits.slice(0, 10).reduce((acc, d, i) => acc + d * weights[i], 0);
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;

  if (checkDigit !== digits[10]) {
    return { valid: false, reason: "El dígito verificador del CUIT no coincide." };
  }
  return { valid: true };
}

const VALIDATORS: Record<string, (taxId: string) => ValidationResult> = {
  MX: validateRfcMx,
  CO: validateNitCo,
  CL: validateRutCl,
  PE: validateRucPe,
  AR: validateCuitAr,
};

export function validateTaxId(countryCode: string, taxId: string): ValidationResult {
  const validator = VALIDATORS[countryCode];
  if (!validator) {
    // Pais sin validador especifico: solo se exige que no este vacio.
    return taxId.trim().length > 0
      ? { valid: true }
      : { valid: false, reason: "El identificador fiscal no puede estar vacío." };
  }
  return validator(taxId);
}
