import api from "./api"; // ADAPT path if this file isn't dropped into src/services/

export interface ItemizedItem {
  item_name: string;
  unit: string;
  unit_price: number;
  q1_qty: number;
  q2_qty: number;
  q3_qty: number;
  q4_qty: number;
  total_quantity: number;
  q1_amount: number;
  q2_amount: number;
  q3_amount: number;
  q4_amount: number;
  total_cost: number;
  // Same join as GET /ppmps/{id}/procurement-items — total quantity of
  // this item already covered by any PR, and whether that's > 0.
  requested_quantity: number;
  is_pr_requested: boolean;
  ppmp_id: string;
  ppmp_no: string;
  entry_description?: string | null;
}

export interface ProcurementCodeGroup {
  code: string;
  items: ItemizedItem[];
  subtotal_quantity: number;
  subtotal_cost: number;
  q1_subtotal_qty: number;
  q2_subtotal_qty: number;
  q3_subtotal_qty: number;
  q4_subtotal_qty: number;
  q1_subtotal_amount: number;
  q2_subtotal_amount: number;
  q3_subtotal_amount: number;
  q4_subtotal_amount: number;
}

export interface ItemizedListReport {
  fiscal_year: number;
  office_id?: string | null;
  office?: string | null;
  ppmp_type?: string | null;
  status?: string | null; // null/omitted = every status (no approval step in this system)
  groups: ProcurementCodeGroup[];
  grand_total_quantity: number;
  grand_total_cost: number;
  q1_grand_qty: number;
  q2_grand_qty: number;
  q3_grand_qty: number;
  q4_grand_qty: number;
  q1_grand_amount: number;
  q2_grand_amount: number;
  q3_grand_amount: number;
  q4_grand_amount: number;
}

export interface ItemizedListFilters {
  year: number;
  officeId?: string;
  officeIds?: string[];
  ppmpType?: "indicative" | "final";
  status?: string; // optional — omit to include every status
}

export async function fetchItemizedListReport(
  filters: ItemizedListFilters,
): Promise<ItemizedListReport> {
  const { data } = await api.get<ItemizedListReport>("/reports/itemized-list", {
    params: {
      year: filters.year,
      office_id: filters.officeId || undefined,
      office_ids: filters.officeIds?.length
        ? filters.officeIds.join(",")
        : undefined,
      ppmp_type: filters.ppmpType || undefined,
      status: filters.status || undefined,
    },
  });
  return data;
}
