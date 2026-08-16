import api from "./api";

export interface ConsolidatedAPPRow {
  row_key: string;
  category: string;
  project_title: string;
  general_description: string;
  procurement_mode: string;
  early_procurement: string;
  bid_evaluation: string;
  start_activity: string;
  end_activity: string;
  source_of_funds: string;
  estimated_budget: number;
  procurement_strategy: string[];
  remarks: string;
}

export interface ConsolidatedAPPCategory {
  name: string;
  label: string;
  rows: ConsolidatedAPPRow[];
  subtotal: number;
}

export interface ConsolidatedAPPResponse {
  fee_category: string;
  fiscal_year: number;
  app_version_type: string;
  categories: ConsolidatedAPPCategory[];
  grand_total: number;
  ppmp_count: number;
  generated_at: string;
}

export interface ConsolidatedAPPFilters {
  feeCategory: string;
  fiscalYear: number;
  appVersionType: string;
}

// ── API calls ───────────────────────────────────────────────────────────

export async function fetchConsolidatedAPPCategories(
  requesterUid: string,
): Promise<string[]> {
  const { data } = await api.get("/admin/app-consolidation/categories", {
    params: { requester_uid: requesterUid },
  });
  return data;
}

export async function fetchConsolidatedAPP(
  filters: ConsolidatedAPPFilters,
  requesterUid: string,
): Promise<ConsolidatedAPPResponse> {
  const { data } = await api.get("/admin/app-consolidation", {
    params: {
      requester_uid: requesterUid,
      fee_category: filters.feeCategory,
      fiscal_year: filters.fiscalYear,
      app_version_type: filters.appVersionType,
    },
  });
  return data;
}

function buildExportUrl(
  kind: "excel" | "pdf",
  filters: ConsolidatedAPPFilters,
  requesterUid: string,
): string {
  const params = new URLSearchParams({
    requester_uid: requesterUid,
    fee_category: filters.feeCategory,
    fiscal_year: String(filters.fiscalYear),
    app_version_type: filters.appVersionType,
  });
  return `/admin/app-consolidation/export/${kind}?${params.toString()}`;
}

export async function downloadConsolidatedAPPExport(
  kind: "excel" | "pdf",
  filters: ConsolidatedAPPFilters,
  requesterUid: string,
): Promise<void> {
  const response = await api.get(buildExportUrl(kind, filters, requesterUid), {
    responseType: "blob",
  });
  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext = kind === "excel" ? "xlsx" : "pdf";
  a.download =
    `Consolidated_APP_${filters.feeCategory}_${filters.fiscalYear}_${filters.appVersionType}.${ext}`.replace(
      /\s+/g,
      "_",
    );
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
