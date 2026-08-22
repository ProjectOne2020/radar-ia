import { requireAdmin } from "@/lib/admin/require-admin";
import { AdminShell } from "@/components/admin/admin-shell";
import AuditForm from "./audit-form";

// Pedido explicito del fundador: poder correr una auditoria completa real sobre cualquier
// negocio desde /admin, sin que ese negocio se haya registrado ni pasado por el OTP publico
// de /auditoria-gratis. Reusa el mismo motor real (M2+M3+M4) via runFreeAudit() — ver
// /api/admin/audit-any.
export default async function AdminAuditarPage() {
  await requireAdmin();

  return (
    <AdminShell title="Auditar cualquier negocio">
      <p className="mb-6 max-w-[560px] text-sm text-text-secondary">
        Corre una auditoría completa real (medición en los motores de IA activos + auditoría técnica + score) sobre
        cualquier negocio, esté registrado o no. Crea una ficha interna marcada como <code>admin</code> para poder
        verla después en /admin/clientes — no aparece como prospecto real ni se le puede enviar acceso de login.
      </p>
      <AuditForm />
    </AdminShell>
  );
}
