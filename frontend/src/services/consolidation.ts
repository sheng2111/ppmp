import api from "./api";

export interface ConsolidatedItem {
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
}

export interface ConsolidatedEntry {
  entry_id: string;
  category_description: string; // entry-level code, e.g. "Spare Parts" — unrelated to Fee Category
  description: string; // the entry's own specific description
  project_type: string;
  procurement_mode: string;
  pre_proc_conference: string;
  start_activity: string;
  end_activity: string;
  delivery_period: string;
  source_of_funds: string;
  items: ConsolidatedItem[];
  entry_subtotal: number;
}

export interface ConsolidatedProject {
  project_id: string; // synthesized as `${ppmp_id}-${order_no}` — PPMPProject has no id of its own
  project_label: string; // "Project N", or the project's remarks if set — PPMPProject has no title field
  remarks?: string | null;
  attached_document_title: string;
  entries: ConsolidatedEntry[];
  project_subtotal: number;
}

export interface ConsolidatedSignatory {
  sign_off: string;
  name: string;
  position: string;
  order_no: number;
}

export interface ConsolidatedOffice {
  office_id: string;
  office_name: string;
  ppmp_id: string;
  ppmp_no?: string;
  ppmp_type: string;
  fiscal_year: number;
  description: string;
  additional_description: string;
  signatories: ConsolidatedSignatory[];
  projects: ConsolidatedProject[];
  office_total: number;
}

export interface ConsolidatedPPMPResponse {
  fee_category: string;
  fiscal_year: number;
  ppmp_type: string;
  offices: ConsolidatedOffice[];
  grand_total: number;
  office_count: number;
  generated_at: string;
}

// ── API calls ───────────────────────────────────────────────────────────

export interface ConsolidationFilters {
  feeCategory: string;
  fiscalYear: number;
  ppmpType: string;
}

// Returns the real Fee Category list (same names shown in the Fee
// Categories admin tab — STF, OJT Fees, Laboratory Fees, etc.), not
// anything derived from PPMP entry text.
export async function fetchFeeCategories(
  requesterUid: string,
): Promise<string[]> {
  const { data } = await api.get("/admin/ppmp-consolidation/categories", {
    params: { requester_uid: requesterUid },
  });
  return data;
}

export async function fetchConsolidatedPPMP(
  filters: ConsolidationFilters,
  requesterUid: string,
): Promise<ConsolidatedPPMPResponse> {
  const { data } = await api.get("/admin/ppmp-consolidation", {
    params: {
      requester_uid: requesterUid,
      fee_category: filters.feeCategory,
      fiscal_year: filters.fiscalYear,
      ppmp_type: filters.ppmpType,
    },
  });
  return data;
}

function buildExportUrl(
  kind: "excel" | "pdf",
  filters: ConsolidationFilters,
  requesterUid: string,
): string {
  const params = new URLSearchParams({
    requester_uid: requesterUid,
    fee_category: filters.feeCategory,
    fiscal_year: String(filters.fiscalYear),
    ppmp_type: filters.ppmpType,
  });
  return `/admin/ppmp-consolidation/export/${kind}?${params.toString()}`;
}

export async function downloadConsolidatedExport(
  kind: "excel" | "pdf",
  filters: ConsolidationFilters,
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
    `PPMP_Consolidation_${filters.feeCategory}_${filters.fiscalYear}_${filters.ppmpType}.${ext}`.replace(
      /\s+/g,
      "_",
    );
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
