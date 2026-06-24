const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

export const api = {
  getMe: () => request<any>('/me'),
  getDashboard: () => request<any>('/dashboard'),
  
  // Staff
  getStaff: () => request<any[]>('/staff'),
  createStaff: (data: any) => request<any>('/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id: string, data: any) => request<any>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Payslips
  getPayslips: (month?: number, year?: number) => {
    const q = new URLSearchParams();
    if (month) q.set('month', String(month));
    if (year) q.set('year', String(year));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<any[]>(`/payslips${qs}`);
  },
  createPayslip: (data: any) => request<any>('/payslips', { method: 'POST', body: JSON.stringify(data) }),
  emailPayslip: (id: string) => request<any>(`/payslips/${id}/email`, { method: 'POST' }),
  markPaid: (id: string) => request<any>(`/payslips/${id}/paid`, { method: 'POST' }),

  // Inbox
  getThreads: () => request<any[]>('/threads'),
  getThread: (id: string) => request<any>(`/threads/${id}`),
  sendReply: (threadId: string, staffId: string, body: string) =>
    request<any>(`/threads/${threadId}/reply`, { method: 'POST', body: JSON.stringify({ staff_id: staffId, body }) }),

  // Children & Parents
  getChildren: () => request<any[]>('/children'),
  getParents: () => request<any[]>('/parents'),
  
  // Compliance
  getCompliance: () => request<any[]>('/compliance'),
  
  // Audit
  getAuditLogs: () => request<any[]>('/audit'),
};
