import { createAdminClient } from "@/lib/supabase/admin";
import { auditRobotsTxt } from "./robots";
import { fetchRawHtml, extractJsonLd, auditSchema } from "./schema";
import { auditNapConsistency } from "./nap";
import { auditGoogleBusinessProfile } from "./gbp";
import { auditBingIndexation } from "./bing-indexation";
import type { AuditFindingDraft } from "./types";

export interface AuditSummary {
  clientId: string;
  locationsAudited: number;
  findingsInserted: number;
  errors: string[];
}

// M3 — audita la huella digital publica de un cliente (todas sus sedes con sitio propio)
// e inserta los hallazgos en audit_findings.
export async function runAuditForClient(clientId: string): Promise<AuditSummary> {
  const admin = createAdminClient();

  const [{ data: client, error: clientError }, { data: locations, error: locationsError }] = await Promise.all([
    admin.from("clients").select("business_name").eq("id", clientId).single(),
    admin.from("locations").select("name, website_url, phone, address, city").eq("client_id", clientId),
  ]);

  if (clientError || !client) {
    throw new Error(`No se encontro el cliente ${clientId}: ${clientError?.message ?? "not found"}`);
  }
  if (locationsError) {
    throw new Error(`No se pudieron leer las sedes del cliente ${clientId}: ${locationsError.message}`);
  }

  const summary: AuditSummary = { clientId, locationsAudited: 0, findingsInserted: 0, errors: [] };
  const allFindings: AuditFindingDraft[] = [];

  const sitesWithUrl = (locations ?? []).filter((l) => l.website_url);

  if (sitesWithUrl.length === 0) {
    allFindings.push({
      pillar: 3,
      finding: "El cliente no tiene ninguna sede con sitio web registrado — no se puede auditar crawlability ni schema.",
      severity: "critical",
      detail_locked: false,
    });
  }

  for (const location of sitesWithUrl) {
    const websiteUrl = location.website_url as string;
    summary.locationsAudited += 1;

    try {
      const robotsResult = await auditRobotsTxt(websiteUrl);
      allFindings.push(...robotsResult.findings);
    } catch (err) {
      summary.errors.push(`robots.txt (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const { fetched, html } = await fetchRawHtml(websiteUrl);
      allFindings.push(...auditSchema(html, fetched));

      if (fetched) {
        const entities = extractJsonLd(html);
        allFindings.push(...auditNapConsistency(entities, location));
      }
    } catch (err) {
      summary.errors.push(`schema/NAP (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      allFindings.push(...(await auditBingIndexation(websiteUrl)));
    } catch (err) {
      summary.errors.push(`Bing (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const location of locations ?? []) {
    try {
      allFindings.push(
        ...(await auditGoogleBusinessProfile({
          businessName: client.business_name,
          city: location.city,
        }))
      );
    } catch (err) {
      summary.errors.push(`GBP (${location.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allFindings.length > 0) {
    const { error: insertError, count } = await admin
      .from("audit_findings")
      .insert(
        allFindings.map((f) => ({
          client_id: clientId,
          pillar: f.pillar,
          finding: f.finding,
          severity: f.severity,
          detail_locked: f.detail_locked,
        })),
        { count: "exact" }
      );

    if (insertError) {
      summary.errors.push(`Insercion de audit_findings: ${insertError.message}`);
    } else {
      summary.findingsInserted = count ?? allFindings.length;
    }
  }

  return summary;
}
