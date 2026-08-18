// Mapa país → moneda para las 6 monedas manuales de 01-CONTEXTO-NEGOCIO.md /
// 03-ARQUITECTURA-TECNICA.md (BRL agregado en M8, agosto 2026). Cualquier otro país cae a
// USD y Adaptive Pricing de Stripe resuelve la conversión en el Checkout.
export const COUNTRY_CURRENCY: Record<string, string> = {
  MX: "MXN",
  CO: "COP",
  CL: "CLP",
  PE: "PEN",
  AR: "ARS",
  BR: "BRL",
};

export const SUPPORTED_COUNTRIES = [
  { code: "MX", name: "México" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brasil" },
] as const;

export function currencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode] ?? "USD";
}

export const NICHES = [
  { value: "dental", label: "Clínica dental" },
  { value: "estetica", label: "Clínica de estética" },
  { value: "inmobiliaria", label: "Inmobiliaria" },
  { value: "ecommerce", label: "Tienda online (e-commerce)" },
  { value: "app", label: "App móvil o digital" },
] as const;
