import { redirect } from "next/navigation";

// El registro se unifico con la auditoria gratis (pedido explicito del fundador: una sola
// cuenta por persona, sin un formulario de alta separado) — /auditoria-gratis ahora crea
// la cuenta real (correo+contraseña) al final del flujo, en /auditoria-gratis/verificar.
// Se deja este redirect (en vez de borrar la ruta) para no romper enlaces viejos ya
// compartidos o indexados.
export default function RegistroPage() {
  redirect("/auditoria-gratis");
}
