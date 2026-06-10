const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

export interface ThreadSummary {
  thread_id: string;
  subject: string;
  from_name: string;
  from_email: string;
  status: string;
  last_message_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  body_text: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  thread_id: string;
  staff_id: string;
  note: string;
  staff_name?: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  thread_id: string;
  staff_id: string;
  action: string;
  metadata: string;
  staff_name?: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  signature: string;
  role: 'admin' | 'staff';
  active: number;
}

export interface Template {
  id: string;
  title: string;
  body: string;
  sort_order: number;
}

export interface ThreadDetail {
  thread_id: string;
  messages: Message[];
  notes: Note[];
  audit_logs: AuditEntry[];
}

export const api = {
  getThreads: () => request<ThreadSummary[]>('/threads'),
  getThread: (id: string) => request<ThreadDetail>(`/threads/${id}`),
  updateStatus: (threadId: string, status: string, staffId: string) =>
    request<void>(`/threads/${threadId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, staff_id: staffId }),
    }),
  assignThread: (threadId: string, staffId: string, assignerId: string) =>
    request<void>(`/threads/${threadId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ staff_id: staffId, assigner_id: assignerId }),
    }),
  sendReply: (threadId: string, staffId: string, body: string, templateId?: string) =>
    request<{ message_id: string; sent: boolean }>('/send', {
      method: 'POST',
      body: JSON.stringify({ thread_id: threadId, staff_id: staffId, body, template_id: templateId }),
    }),
  addNote: (threadId: string, staffId: string, note: string) =>
    request<{ id: string }>('/notes', {
      method: 'POST',
      body: JSON.stringify({ thread_id: threadId, staff_id: staffId, note }),
    }),
  getTemplates: () => request<Template[]>('/templates'),
  getStaff: () => request<StaffMember[]>('/staff'),
  getMe: () => request<StaffMember>('/me'),
};
