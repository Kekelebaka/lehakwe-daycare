// Types for Lehakwe Daycare Manager Worker
export interface StaffRow {
  staff_id: string;
  full_name: string;
  id_number?: string;
  employee_number?: string;
  job_title: string;
  email?: string;
  phone?: string;
  start_date?: string;
  basic_salary: number;
  uif_enabled: number;
  paye_enabled: number;
  active: number;
  signature: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  gender?: 'male' | 'female';
  race?: 'african' | 'coloured' | 'asian' | 'white' | 'other';
  disability?: 'yes' | 'no';
  disability_description?: string;
  training_received?: string;
  training_type?: string;
  subsidised: number;
  created_at: string;
  updated_at: string;
}

export interface PayslipRow {
  payslip_id: string;
  staff_id: string;
  pay_period_month: number;
  pay_period_year: number;
  payment_date?: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  status: 'draft' | 'generated' | 'emailed' | 'paid';
  prepared_by?: string;
  generated_at?: string;
  emailed_at?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
}

export interface PayslipItemRow {
  item_id: string;
  payslip_id: string;
  item_type: 'earning' | 'deduction';
  item_name: string;
  amount: number;
}

export interface ChildRow {
  child_id: string;
  full_name: string;
  date_of_birth?: string;
  age_group?: string;
  enrolment_date?: string;
  status: 'active' | 'inactive' | 'graduated';
  parent_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_notes?: string;
  allergies?: string;
  pickup_authorisation_notes?: string;
  gender?: 'male' | 'female';
  race?: 'african' | 'coloured' | 'asian' | 'white' | 'other';
  disability?: 'yes' | 'no';
  disability_description?: string;
  income_category?: 'single_parent' | 'dual_parent' | 'other';
  id_number?: string;
  days_attended_current_month?: number;
  created_at: string;
  updated_at: string;
}

export interface ParentRow {
  parent_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  relationship_to_child?: string;
  emergency_contact: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceRow {
  compliance_id: string;
  category: string;
  item_name: string;
  status: 'complete' | 'needs_attention' | 'missing' | 'expired';
  expiry_date?: string;
  notes?: string;
  updated_at: string;
}

export interface AuditLogRow {
  audit_id: string;
  user_id?: string;
  action: string;
  module_name: string;
  record_id?: string;
  timestamp: string;
  metadata?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface DocumentRow {
  document_id: string;
  related_entity_type: string;
  related_entity_id: string;
  document_type: string;
  title: string;
  expiry_date?: string;
  file_url?: string;
  status: 'active' | 'expired' | 'pending';
  uploaded_at: string;
  uploaded_by?: string;
}

export interface SettingRow {
  setting_key: string;
  setting_value: string;
  updated_at: string;
}
