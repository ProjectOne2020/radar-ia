// M12 — el fundador no es un "cliente" del sistema (no tiene fila en `clients`), asi que
// no hay una columna/claim existente que lo marque como admin. En vez de agregar una
// columna nueva al esquema literal, se usa una lista de correos por variable de entorno
// — razonable para un negocio operado por una sola persona; si mas adelante hay varios
// administradores, esto es lo primero que habria que revisar.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}
