// Mapa país → moneda para las 5 monedas manuales de 01-CONTEXTO-NEGOCIO.md /
// 03-ARQUITECTURA-TECNICA.md. Cualquier otro país cae a USD y Adaptive Pricing de Stripe
// resuelve la conversión en el Checkout (mismo fallback que M8 usará en el middleware de
// geolocalización).
export const COUNTRY_CURRENCY: Record<string, string> = {
  MX: "MXN",
  CO: "COP",
  CL: "CLP",
  PE: "PEN",
  AR: "ARS",
};

export const SUPPORTED_COUNTRIES = [
  { code: "MX", name: "México" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "AR", name: "Argentina" },
] as const;

export function currencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode] ?? "USD";
}

export const NICHES = [
  { value: "dental", label: "Clínica dental" },
  { value: "estetica", label: "Clínica de estética" },
  { value: "inmobiliaria", label: "Inmobiliaria" },
  { value: "ecommerce", label: "Tienda online (e-commerce)" },
] as const;
