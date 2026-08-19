export interface OfficeBasic {
  id: string;
  name: string;
  code: string;
}

export interface OfficeAssignment {
  office_id: string;
  office_name: string;
  office_code: string;
  designation: string | null;
}

export interface DBUser {
  is_admin: any;
  id: string;
  supabase_uid: string;
  full_name: string;
  email: string;
  role: "admin" | "user";
  designation: string | null;
  is_approved: boolean;
  offices: OfficeBasic[];
  office_assignments: OfficeAssignment[];
  created_at: string;
}

export interface Office {
  id: string;
  name: string;
  head_name?: string | null;
  designation?: string | null;
  fund_source?: string | null;
  parent_office_id?: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  category: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface PPMPLotItem {
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
}

export interface PPMPLot {
  lot_no: string;
  quantity_size: string;
  estimated_budget: number;
  items: PPMPLotItem[];
}

export interface PPMPProject {
  entries: never[];
  order_no: number;
  description: string;
  project_type: string;
  procurement_mode: string | null;
  pre_proc_conference: string;
  start_activity: string | null;
  end_activity: string | null;
  delivery_period: string | null;
  source_of_funds: string;
  supporting_docs: string | null;
  remarks: string | null;
  total_budget: number;
  lots: PPMPLot[];
}

export interface PPMP {
  id: string;
  office_id: string;
  office_name?: string;
  created_by: string;
  year: number;
  ppmp_no: string | null;
  ppmp_type: "indicative" | "final";
  status: "draft" | "submitted" | "approved" | "rejected" | "archived";
  remarks: string | null;
  submitted_at: string | null;
  created_at: string;
  projects: PPMPProject[];
}

export interface PRItem {
  lot_label: string | null;
  stock_property_no: string | null;
  unit: string | null;
  item_description: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
}

export interface PR {
  id: string;
  office_id: string;
  created_by: string;
  pr_number: string | null;
  fund_cluster: string | null;
  responsibility_center_code: string | null;
  purpose: string | null;
  requested_date: string | null;
  requested_by_name: string | null;
  requested_by_designation: string | null;
  approved_by_name: string | null;
  approved_by_designation: string | null;
  status: string;
  created_at: string;
  items: PRItem[];
}
