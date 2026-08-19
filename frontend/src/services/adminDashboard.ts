import api from "./api";

// ── Admin Dashboard summary (GET /admin/dashboard/summary) ────────────────

export interface DashboardCards {
  total_offices: number;
  offices_with_submissions: number;
  total_ppmps: number;
  submitted_ppmps: number;
  final_ppmps: number;
  pending_ppmps: number;
  total_items: number;
}

export interface RecentSubmission {
  id: string;
  ppmp_no: string | null;
  year: number;
  ppmp_type: string;
  status: string;
  office_id: string;
  office_name: string;
  prepared_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
}

export interface OfficeOverviewRow {
  office_id: string;
  office_name: string;
  total_ppmps: number;
  submitted: number;
  draft: number;
  final: number;
  items: number;
}

export interface ConsolidationSummary {
  fiscal_year: number;
  total_ppmps: number;
  submitted_ppmps: number;
  indicative_ppmps: number;
  final_ppmps: number;
}

export interface AppOverview {
  fiscal_year: number;
  submitted_ppmps: number;
  app_settings_count: number;
  last_submission: string | null;
}

export interface RecentlyAddedItem {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  category: string | null;
  updated_at: string;
}

export interface ItemManagementSummary {
  catalog_items: number;
  recently_added: RecentlyAddedItem[];
}

export interface ItemizedSummary {
  fiscal_year: number;
  total_items: number;
  offices: { office_id: string; office_name: string; items: number }[];
}

export interface DashboardSummary {
  fiscal_years: number[];
  current_fiscal_year: number;
  generated_at: string;
  cards: DashboardCards;
  recent_submissions: RecentSubmission[];
  office_overview: OfficeOverviewRow[];
  consolidation: ConsolidationSummary;
  app_overview: AppOverview;
  item_management: ItemManagementSummary;
  itemized: ItemizedSummary;
}

export async function fetchDashboardSummary(
  requesterUid: string,
  fiscalYear?: number,
  officeId?: string,
): Promise<DashboardSummary> {
  const { data } = await api.get("/admin/dashboard/summary", {
    params: {
      requester_uid: requesterUid,
      fiscal_year: fiscalYear ?? undefined,
      office_id: officeId || undefined,
    },
  });
  return data;
}

// ── Notifications (admin-only) ────────────────────────────────────────────

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  ppmp_id: string;
  office_id: string | null;
  office_name: string | null;
  ppmp_no: string | null;
  year: number | null;
  ppmp_type: string | null;
  prepared_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  status: string | null;
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(
  requesterUid: string,
  limit = 50,
  unreadOnly = true,
): Promise<AdminNotification[]> {
  const { data } = await api.get("/notifications/", {
    params: { requester_uid: requesterUid, limit, unread_only: unreadOnly },
  });
  return data;
}

export async function fetchUnreadNotificationCount(
  requesterUid: string,
): Promise<number> {
  const { data } = await api.get("/notifications/unread-count", {
    params: { requester_uid: requesterUid },
  });
  return data.count ?? 0;
}

export async function markNotificationRead(
  notificationId: string,
  requesterUid: string,
): Promise<AdminNotification> {
  const { data } = await api.put(
    `/notifications/${notificationId}/read`,
    null,
    { params: { requester_uid: requesterUid } },
  );
  return data;
}

export async function markAllNotificationsRead(
  requesterUid: string,
): Promise<void> {
  await api.put("/notifications/read-all", null, {
    params: { requester_uid: requesterUid },
  });
}

// ── Office tree for the Office filter dropdown ─────────────────────────────

export interface FeeCategoryOfficeNode {
  id: string;
  name: string;
  fee_category_id: string;
  parent_office_id: string | null;
  children: FeeCategoryOfficeNode[];
}

export interface FeeCategoryNode {
  id: string;
  name: string;
  offices: FeeCategoryOfficeNode[];
}

export interface FlatOfficeOption {
  id: string;
  label: string;
}

export async function fetchOfficeOptions(): Promise<FlatOfficeOption[]> {
  const { data } = await api.get("/fee-categories/tree");
  const options: FlatOfficeOption[] = [];
  for (const cat of data as FeeCategoryNode[]) {
    for (const office of cat.offices) {
      options.push({ id: office.id, label: office.name });
      for (const child of office.children) {
        options.push({
          id: child.id,
          label: `${office.name} / ${child.name}`,
        });
      }
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}
