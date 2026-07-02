export interface OfficeBasic {
  id: number;
  name: string;
  code: string;
}

export interface DBUser {
  id: number;
  supabase_uid: string;
  full_name: string;
  email: string;
  role: "admin" | "user";
  designation: string | null;
  is_approved: boolean;
  offices: OfficeBasic[];
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
  description: string;
  project_type: string;
  procurement_mode: string;
  source_of_funds: string;
  total_budget?: number;
  lots: PPMPLot[];
}

export interface PPMP {
  id: number;
  office_id: number;
  created_by: number;
  year: number;
  ppmp_no: string | null;
  ppmp_type: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  remarks: string | null;
  submitted_at: string | null;
  created_at: string;
  projects: PPMPProject[];
}
