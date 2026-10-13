import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  REPORTS,
  reportDataSchemas,
  type ReportData,
  type ReportPeriod,
  type ReportType,
} from "./schema";

/** Runs one report in Postgres and checks the shape of what came back. */
export async function runReport(
  type: ReportType,
  businessId: string,
  period: ReportPeriod,
): Promise<ReportData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(REPORTS[type].fn, {
    p_business_id: businessId,
    // JSON null reaches the function as SQL null, which means "all dates".
    p_from: period.from as string,
    p_to: period.to as string,
  });
  if (error) throw new Error("Could not load the report.", { cause: error });
  const parsed = reportDataSchemas[type].safeParse(data);
  if (!parsed.success)
    throw new Error(`Unexpected report data for ${type}.`, { cause: parsed.error });
  return { type, data: parsed.data } as ReportData;
}
