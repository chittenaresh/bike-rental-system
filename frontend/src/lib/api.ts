import { handleApiError, isAuthError, logError, AppApiError } from './errorHandler';

// Get API base URL - normalize to always include "/api"
const getApiBase = () => {
  // In production, we strongly prefer the relative /api path to use Vercel's proxy.
  // This avoids all CORS issues and mixed content problems.
  if (import.meta.env.PROD) {
    return '/api';
  }

  // In development or if explicitly overridden, use the env var
  if (import.meta.env.VITE_API_URL) {
    const raw = String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '');
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  }
  if (import.meta.env.VITE_API_BASE) {
    const raw = String(import.meta.env.VITE_API_BASE).trim().replace(/\/+$/, '');
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  }
  return '/api';
};

const API_BASE = getApiBase();

let authToken: string | null = null;

// Initialize auth token from localStorage
if (typeof window !== 'undefined') {
  authToken = localStorage.getItem('authToken');
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('authToken', token);
    else localStorage.removeItem('authToken');
  }
}

// Clear auth on 401/403 errors
function handleAuthError() {
  if (typeof window !== 'undefined') {
    setAuthToken(null);
    localStorage.removeItem('currentUser');
    // Don't redirect automatically - let components handle it
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('authToken');
  const isPublic =
    path.includes('/bikes') || path.includes('/locations') || path.includes('/auth/login');

  console.log(
    `[API] ${init.method || 'GET'} ${path} - Token present: ${!!token}, isPublic: ${isPublic}`
  );

  const headers = {
    'Content-Type': 'application/json',
    ...init.headers,
  } as Record<string, string>;

  if (token) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      console.error(`[API ERROR] ${response.status} ${response.statusText} for ${url}`);

      if (response.status === 401 && !isPublic) {
        if (token) {
          console.warn('[API Auth] 401 Unauthorized - Clearing token');
          setAuthToken(null);
          localStorage.removeItem('currentUser');
        }
        // Do not throw a generic 401 error here, let the general error handling below catch the specific message
      }

      if (response.status === 403) {
        console.error('[API Auth] 403 Forbidden - Possible role issue or invalid token');
      }

      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new AppApiError(
        errorData.message || `Request failed with status ${response.status}`,
        response.status
      );
    }

    if (response.headers.get('Content-Length') === '0' || response.status === 204) {
      return null as T;
    }

    return response.json();
  } catch (error) {
    console.error(`[API FETCH ERROR] ${url}:`, error);
    throw error;
  }
}

export const authAPI = {
  login: (credentials: any) =>
    apiRequest<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data: any) =>
    apiRequest<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email: string) =>
    apiRequest<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    apiRequest<any>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),
  logout: () => {
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
    }
  },
  getCurrentUser: () => apiRequest<any>('/auth/me'),
  sendEmailOTP: (email: string) =>
    apiRequest<any>('/auth/send-email-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmailOTP: (email: string, otp: string) =>
    apiRequest<any>('/auth/verify-email-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),
  sendMobileOTP: (mobile: string) =>
    apiRequest<any>('/auth/send-mobile-otp', { method: 'POST', body: JSON.stringify({ mobile }) }),
  verifyMobileOTP: (mobile: string, otp: string) =>
    apiRequest<any>('/auth/verify-mobile-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp }),
    }),
};

export const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const bikesAPI = {
  getAll: (locationId?: string, q?: string) => {
    const params = new URLSearchParams();
    params.set('_t', String(Date.now()));
    if (locationId) params.set('locationId', locationId);
    if (q && q.trim() !== '') params.set('q', q.trim());
    return apiRequest<any[]>(`/bikes?${params.toString()}`);
  },
  getAvailable: (start: Date, end: Date, locationId?: string) => {
    const query = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      ...(locationId ? { locationId } : {}),
    });
    return apiRequest<any[]>(`/bikes/available?${query.toString()}`);
  },
  getSpecs: () => apiRequest<any[]>('/bikes/specs'),
  getById: (id: string) => apiRequest<any>(`/bikes/${id}?_t=${Date.now()}`),
  create: (data: any) => apiRequest<any>('/bikes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiRequest<any>(`/bikes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<void>(`/bikes/${id}`, { method: 'DELETE' }),
};

export const rentalsAPI = {
  create: (data: any) =>
    apiRequest<any>('/rentals', { method: 'POST', body: JSON.stringify(data) }),
  getAll: async () => {
    const data = await apiRequest<any[]>('/rentals');
    return data || [];
  },
  getUserRentals: () => apiRequest<any[]>('/rentals'),
  update: (id: string, updates: any) =>
    apiRequest<any>(`/rentals/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  updateStatus: (id: string, status: string) =>
    apiRequest<any>(`/rentals/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  startRide: (id: string) => apiRequest<any>(`/rentals/${id}/start`, { method: 'POST' }),
  completeRide: (
    id: string,
    data?: { startKm?: number; endKm?: number; delay?: number; totalCost?: number }
  ) =>
    apiRequest<any>(`/rentals/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', ...data }),
    }),
  end: (id: string) => apiRequest<any>(`/rentals/${id}/complete`, { method: 'POST' }),
  cancel: (id: string) => apiRequest<any>(`/rentals/${id}/cancel`, { method: 'POST' }),
  delete: (id: string) => apiRequest<void>(`/rentals/${id}`, { method: 'DELETE' }),
  submitReview: (id: string, data: { rating: number; comment: string }) =>
    apiRequest<any>(`/rentals/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
  updateImages: (id: string, images: string[]) =>
    apiRequest<any>(`/rentals/${id}/images`, { method: 'POST', body: JSON.stringify({ images }) }),
};

export const usersAPI = {
  getAll: (q?: string) => {
    const params = new URLSearchParams();
    params.set('_t', String(Date.now()));
    if (q) params.set('q', q);
    return apiRequest<any[]>(`/users?${params.toString()}`);
  },
  getById: (id: string) => apiRequest<any>(`/users/${id}?_t=${Date.now()}`),
  update: (id: string, updates: any) =>
    apiRequest<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  createAdmin: (payload: { name: string; email: string; password: string; locationId: string }) =>
    apiRequest<any>('/users/create-admin', { method: 'POST', body: JSON.stringify(payload) }),
  delete: (id: string) => apiRequest<any>(`/users/${id}`, { method: 'DELETE' }),
  topUpWallet: (id: string, amount: number) =>
    apiRequest<any>(`/users/${id}/wallet/topup`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
};

export const documentsAPI = {
  getAll: () => apiRequest<any[]>(`/documents?_t=${Date.now()}`),
  upload: (name: string, type: string, fileUrl: string | undefined) =>
    apiRequest<any>('/documents', {
      method: 'POST',
      body: JSON.stringify({ name, type, url: fileUrl }),
    }),
  getUploadUrl: (name: string, type: string, contentType: string) =>
    apiRequest<any>('/documents/upload-url', {
      method: 'POST',
      body: JSON.stringify({ name, type, contentType }),
    }),
  uploadFile: async (file: File, name: string, type: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    fd.append('type', type);
    try {
      const url = `${API_BASE}/documents/upload`;
      const res = await fetch(url, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: fd,
        // Removed credentials: 'include' to avoid CORS issues
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          handleAuthError();
        }
        const errData = await res.json().catch(() => ({}));
        throw new AppApiError(errData.message || 'Upload failed', res.status);
      }
      return await res.json();
    } catch (err: any) {
      console.error('[uploadFile] error:', err);
      throw err;
    }
  },
  updateStatus: (id: string, status: 'pending' | 'approved' | 'rejected', reason?: string) =>
    apiRequest<any>(`/documents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    }),
};

export const paymentsAPI = {
  getKey: () => apiRequest<{ keyId: string }>('/payments/key'),
  createOrder: (amount: number) =>
    apiRequest<any>('/payments/order', { method: 'POST', body: JSON.stringify({ amount }) }),
  verifyPayment: (payload: any) =>
    apiRequest<any>('/payments/verify', { method: 'POST', body: JSON.stringify(payload) }),
};

export const locationsAPI = {
  getAll: (all: boolean = false) => apiRequest<any[]>(`/locations${all ? '?all=true' : ''}`),
  getById: (id: string) => apiRequest<any>(`/locations/${id}`),
  create: (location: any) =>
    apiRequest<any>('/locations', { method: 'POST', body: JSON.stringify(location) }),
  update: (id: string, location: any) =>
    apiRequest<any>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(location) }),
  delete: (id: string) => apiRequest<any>(`/locations/${id}`, { method: 'DELETE' }),
};

export const settingsAPI = {
  getHomeHero: () => apiRequest<{ imageUrl: string | null }>('/settings/home-hero'),
  updateHomeHero: (imageUrl: string) =>
    apiRequest<{ imageUrl: string }>('/settings/home-hero', {
      method: 'PUT',
      body: JSON.stringify({ imageUrl }),
    }),
  uploadImage: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const url = `${API_BASE}/settings/upload`;
      const res = await fetch(url, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: fd,
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          handleAuthError();
        }
        const error = await res.text();
        throw new Error(error || `Upload failed: ${res.status}`);
      }

      return await res.json();
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

export const heroImagesAPI = {
  getAll: () => apiRequest<any[]>('/hero-images'),
  create: (data: any) =>
    apiRequest<any>('/hero-images', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiRequest<any>(`/hero-images/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<void>(`/hero-images/${id}`, { method: 'DELETE' }),
};

export const supportAPI = {
  getAll: () => apiRequest<any[]>('/support'),
  getById: (id: string) => apiRequest<any>(`/support/${id}`),
  create: (data: any) =>
    apiRequest<any>('/support', { method: 'POST', body: JSON.stringify(data) }),
  addMessage: (id: string, data: { content: string; attachments?: string[] }) =>
    apiRequest<any>(`/support/${id}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, data: { status?: string; priority?: string }) =>
    apiRequest<any>(`/support/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  sendEmailReply: (id: string, data: { content: string }) =>
    apiRequest<any>(`/support/email-reply/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  getReplies: (id: string) => apiRequest<any[]>(`/support/${id}/replies`),
  upload: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const url = `${API_BASE}/support/upload`;
      const res = await fetch(url, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: fd,
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          handleAuthError();
        }
        const error = await res.text();
        throw new Error(error || `Upload failed: ${res.status}`);
      }

      return await res.json();
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
