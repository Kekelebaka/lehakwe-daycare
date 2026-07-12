const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Session (httpOnly cookie) ─────────────────────────────────
// Phase 0b: the JWT now lives in an httpOnly Secure cookie set by the API, so it
// is not readable by JavaScript (XSS-safe). We keep only the non-sensitive user
// object in localStorage for UI state; auth itself rides on the cookie.
const USER_KEY = 'lehakwe-user';

export function getStoredUser(): any {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

// Back-compat shims — the token is no longer stored client-side.
export function getToken(): string | null { return null; }
export function setToken(_token: string): void { /* no-op: session is an httpOnly cookie */ }
export function clearToken(): void { clearStoredUser(); }

// ── API request (cookie-based auth) ───────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });

  // Handle 401 — session expired or invalid
  if (res.status === 401) {
    clearStoredUser();
    window.location.reload();
    throw new Error('Session expired — please log in again');
  }

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

// ── Auth ──────────────────────────────────────────────────────
export async function login(email: string, password: string, turnstileToken?: string): Promise<{ user: any }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, turnstileToken }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Login failed');
  return json.data;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch { /* ignore network errors on logout */ }
  clearStoredUser();
}

// ── Media (photos) ────────────────────────────────────────────
export async function uploadMedia(childId: string, file: File, caption?: string, dailyLogId?: string): Promise<{ media_id: string }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('child_id', childId);
  if (caption) fd.append('caption', caption);
  if (dailyLogId) fd.append('daily_log_id', dailyLogId);
  const res = await fetch(`${API_BASE}/media`, { method: 'POST', credentials: 'include', body: fd });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Upload failed');
  return json.data;
}
// URL for an <img src>; the httpOnly cookie is sent automatically (same-site).
export function mediaUrl(mediaId: string): string {
  return `${API_BASE}/media/${mediaId}`;
}

// ── Parent auth (OTP) + parent app ────────────────────────────
async function parentPost(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}
export const parentApi = {
  requestOtp: (identifier: string) => parentPost('/parent/request-otp', { identifier }),
  verifyOtp: (identifier: string, code: string) => parentPost('/parent/verify-otp', { identifier, code }),
  logout: () => parentPost('/parent/logout', {}),
  me: () => fetch(`${API_BASE}/parent/me`, { credentials: 'include' }).then((r) => r.json()),
  child: (id: string) => fetch(`${API_BASE}/parent/child/${id}`, { credentials: 'include' }).then((r) => r.json()),
  mediaUrl: (id: string) => `${API_BASE}/parent/media/${id}`,
};

// ── API methods ───────────────────────────────────────────────
export const api = {
  getMe: () => request<any>('/me'),
  getDashboard: () => request<any>('/dashboard'),

  // Media (photos)
  getMedia: (childId?: string) => request<any[]>(`/media${childId ? `?child_id=${childId}` : ''}`),
  deleteMedia: (id: string) => request<any>(`/media/${id}`, { method: 'DELETE' }),

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

  // AI Assistant
  getAITemplates: () => request<any[]>('/ai/templates'),
  generateAI: (data: { template_id?: string; variables?: any; custom_prompt?: string; language?: string }) =>
    request<any>('/ai/generate', { method: 'POST', body: JSON.stringify(data) }),
  getAIDocs: () => request<any[]>('/ai/docs'),
  suggestReply: (threadId: string) => request<any>(`/ai/suggest-reply?thread_id=${threadId}`),

  // Leave Requests
  getLeaveRequests: (status?: string, staffId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (staffId) params.set('staff_id', staffId);
    return request<any[]>(`/leave?${params.toString()}`);
  },
  createLeaveRequest: (data: any) => request<any>('/leave', { method: 'POST', body: JSON.stringify(data) }),
  updateLeaveRequest: (id: string, data: any) => request<any>(`/leave/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLeaveRequest: (id: string) => request<any>(`/leave/${id}`, { method: 'DELETE' }),

  // Town
  getTownConfig: () => request<any[]>('/town/config'),
  getTownStats: () => request<any>('/town/stats'),

  // Daily Logs
  getDailyLogs: (date?: string, childId?: string) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (childId) params.set('child_id', childId);
    return request<any[]>(`/daily-logs?${params.toString()}`);
  },
  createDailyLog: (data: any) => request<any>('/daily-logs', { method: 'POST', body: JSON.stringify(data) }),
  deleteDailyLog: (id: string) => request<any>(`/daily-logs/${id}`, { method: 'DELETE' }),
};
