// Types for Lehakwe Daycare Email Worker

export interface Envelope {
  from: string;
  to: string;
}

export interface EmailMessage {
  from: string;
  from_name: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  raw?: ReadableStream;
  rawSize?: number;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string;
  raw_email_ref: string;
  status: 'new' | 'in_progress' | 'replied' | 'closed';
  assigned_to: string | null;
  created_at: string;
}

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  signature: string;
  role: 'admin' | 'staff';
  active: number;
}

export interface NoteRow {
  id: string;
  thread_id: string;
  staff_id: string;
  note: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  thread_id: string;
  staff_id: string;
  action: 'received' | 'forwarded' | 'opened' | 'assigned' | 'replied' | 'noted' | 'closed';
  metadata: string;
  created_at: string;
}

export interface TemplateRow {
  id: string;
  title: string;
  body: string;
  sort_order: number;
}

export interface ForwardPayload {
  to: string;
  subject: string;
  body: string;
}

export interface SendRequest {
  thread_id: string;
  staff_id: string;
  body: string;
  template_id?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}
