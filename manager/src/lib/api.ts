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
  createChild: (data: any) => request<any>('/children', { method: 'POST', body: JSON.stringify(data) }),
  updateChild: (id: string, data: any) => request<any>(`/children/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChild: (id: string) => request<any>(`/children/${id}`, { method: 'DELETE' }),

  getParents: () => request<any[]>('/parents'),
  createParent: (data: any) => request<any>('/parents', { method: 'POST', body: JSON.stringify(data) }),
  updateParent: (id: string, data: any) => request<any>(`/parents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteParent: (id: string) => request<any>(`/parents/${id}`, { method: 'DELETE' }),

  // Documents
  getDocuments: () => request<any[]>('/documents'),
  createDocument: (data: any) => request<any>('/documents', { method: 'POST', body: JSON.stringify(data) }),
  deleteDocument: (id: string) => request<any>(`/documents/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request<any>('/settings'),
  updateSettings: (settings: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Compliance
  getCompliance: () => request<any[]>('/compliance'),
  updateCompliance: (id: string, status: string, notes: string) =>
    request<any>(`/compliance/${id}`, { method: 'PUT', body: JSON.stringify({ status, notes }) }),

  // Staff (extended)
  deleteStaff: (id: string) => request<any>(`/staff/${id}`, { method: 'DELETE' }),

  // Audit
  getAuditLogs: () => request<any[]>('/audit'),

  // Attendance
  getAttendance: (date: string) => request<any[]>(`/attendance?date=${date}`),
  createAttendance: (data: any) => request<any>('/attendance', { method: 'POST', body: JSON.stringify(data) }),
  updateAttendance: (id: string, data: any) => request<any>(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getAttendanceSummary: (month: number, year: number) => request<any[]>(`/attendance/summary?month=${month}&year=${year}`),

  // Fees
  getFeeSchedules: () => request<any[]>('/fees/schedules'),
  createFeeSchedule: (data: any) => request<any>('/fees/schedules', { method: 'POST', body: JSON.stringify(data) }),
  getFeeRecords: (month?: number, year?: number) => {
    const q = new URLSearchParams();
    if (month) q.set('month', String(month));
    if (year) q.set('year', String(year));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<any[]>(`/fees/records${qs}`);
  },
  createFeeRecord: (data: any) => request<any>('/fees/records', { method: 'POST', body: JSON.stringify(data) }),
  updateFeeRecord: (id: string, data: any) => request<any>(`/fees/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Notices
  getNotices: () => request<any[]>('/notices'),
  createNotice: (data: any) => request<any>('/notices', { method: 'POST', body: JSON.stringify(data) }),
  updateNotice: (id: string, data: any) => request<any>(`/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNotice: (id: string) => request<any>(`/notices/${id}`, { method: 'DELETE' }),

  // Milestones
  getMilestones: (childId?: string) => {
    const q = childId ? `?child_id=${childId}` : '';
    return request<any[]>(`/milestones${q}`);
  },
  createMilestone: (data: any) => request<any>('/milestones', { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (id: string, data: any) => request<any>(`/milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Waitlist
  getWaitlist: () => request<any[]>('/waitlist'),
  createWaitlistEntry: (data: any) => request<any>('/waitlist', { method: 'POST', body: JSON.stringify(data) }),
  updateWaitlistEntry: (id: string, data: any) => request<any>(`/waitlist/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWaitlistEntry: (id: string) => request<any>(`/waitlist/${id}`, { method: 'DELETE' }),
};
