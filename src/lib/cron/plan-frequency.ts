import type { PlanId } from "@/lib/pricing/plans";

// Frecuencia de re-medicion por plan — literal de 01-CONTEXTO-NEGOCIO.md seccion 4
// (columna "Medición"): Lite mensual, Plus quincenal, Pro semanal, Enterprise diaria.
// "founder" (acceso de por vida del fundador, ver plans.ts) queda deliberadamente FUERA
// de este mapa: no tiene ningun eje de auditoria real detras (no es un negocio siendo
// medido), asi que nunca debe entrar al cron — cae al `!days` de abajo y no corre nunca,
// sin gastar APIs de IA en una auditoria que no tiene sentido.
export const PLAN_FREQUENCY_DAYS: Partial<Record<PlanId, number>> = {
  lite: 30,
  plus: 14,
  pro: 7,
  enterprise: 1,
};

export function isDueForRemeasurement(plan: string, lastRunAt: string | null): boolean {
  const days = PLAN_FREQUENCY_DAYS[plan as PlanId];
  if (!days) return false; // plan desconocido/enterprise-sin-checkout mal configurado/founder: no correr por defecto

  if (!lastRunAt) return true; // nunca se ha medido — siempre due

  const elapsedMs = Date.now() - new Date(lastRunAt).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return elapsedDays >= days;
}
