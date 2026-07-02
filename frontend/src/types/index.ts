export interface DBUser {
  is_approved: any;
  id: number;
  supabase_uid: string;
  full_name: string;
  email: string;
  role: "admin" | "user";
  office_id: number | null;
  created_at: string;
}

export interface Office {
  id: number;
  name: string;
  code: string;
  head_name: string | null;
  designation: string | null;
  created_at: string;
}

export interface Item {
  id: number;
  name: string;
  unit: string;
  unit_price: number;
  category: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface PPMPLot {
  id: number;
  lot_no: string;
  quantity_size: string;
  estimated_budget: number;
}

export interface PPMPProject {
  id: number;
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
  id: number;
  office_id: number;
  created_by: number;
  year: number;
  ppmp_no: string | null;
  ppmp_type: "indicative" | "final";
  status: "draft" | "submitted" | "approved" | "rejected";
  remarks: string | null;
  submitted_at: string | null;
  created_at: string;
  projects: PPMPProject[];
}
