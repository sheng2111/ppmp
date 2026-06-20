export interface PPMPHeader {
  end_user_unit: string;
  charged_to: string;
  pap: string;
  date: string;
  revision: string;
}

export interface MonthlySchedule {
  qty: number | null;
  amount: number | null;
}

export type MonthKey = 'jan'|'feb'|'mar'|'apr'|'may'|'jun'|'jul'|'aug'|'sep'|'oct'|'nov'|'dec';

export interface PPMPItem {
  id?: number;
  ppmp_id?: number;
  code: string;
  general_description: string;
  unit_of_issue: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  mode_of_procurement: string;
  category?: string;
  schedule: Record<MonthKey, MonthlySchedule>;
}

export interface PPMP {
  id?: number;
  header: PPMPHeader;
  items: PPMPItem[];
  created_at?: string;
  updated_at?: string;
}

export const MONTHS: MonthKey[] = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export const MONTH_LABELS: Record<MonthKey, string> = {
  jan:'Jan', feb:'Feb', mar:'Mar', apr:'Apr', may:'May', jun:'Jun',
  jul:'Jul', aug:'Aug', sep:'Sep', oct:'Oct', nov:'Nov', dec:'Dec'
};

export const PROCUREMENT_MODES = [
  'Direct Acquisition',
  'Public Bidding',
  'Shopping',
  'Negotiated Procurement',
  'Small Value Procurement',
];

export const emptySchedule = (): Record<MonthKey, MonthlySchedule> => {
  const s: any = {};
  MONTHS.forEach(m => { s[m] = { qty: null, amount: null }; });
  return s;
};
