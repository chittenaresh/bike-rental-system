import { handleApiError, isAuthError, logError } from './errorHandler';

// Get API base URL - use environment variable in production, fallback to proxy in development
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  // In development, use proxy. In production, use relative path or env var
  if (import.meta.env.PROD) {
    return '/api'; // Use relative path in production
  }
  return '/api'; // Use proxy in development
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

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  // Ensure we have the latest token from storage if we don't have one in memory
  if (!authToken && typeof window !== 'undefined') {
    authToken = localStorage.getItem('authToken');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  try {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const res = await fetch(url, { 
      ...init, 
      headers: { ...headers, ...(init?.headers as any) },
      credentials: 'include', // Include cookies for CORS
    });
    
    if (!res.ok) {
      // Handle auth errors silently
      if (res.status === 401 || res.status === 403) {
        handleAuthError();
        const error = new Error(`Authentication failed: ${res.status}`);
        (error as any).status = res.status;
        throw error;
      }
      
      let msg = '';
      try {
        msg = await res.text();
        // Try to parse as JSON for better error messages
        try {
          const json = JSON.parse(msg);
          msg = json.message || json.error || msg;
        } catch {
          // Not JSON, use as is
        }
      } catch {
        msg = `Request failed with status ${res.status}`;
      }
      
      const error = new Error(msg || `Request failed ${res.status}`);
      (error as any).status = res.status;
      throw error;
    }
    
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        return await res.json();
      } catch (e) {
        logError(e, 'apiRequest.json');
        throw new Error('Invalid JSON response');
      }
    }
    return (await res.text()) as unknown as T;
  } catch (error) {
    // Re-throw auth errors as-is (they're handled silently)
    if (isAuthError(error)) {
      throw error;
    }
    throw handleApiError(error);
  }
}

export const authAPI = {
  login: (credentials: any) => apiRequest<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data: any) => apiRequest<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email: string) => apiRequest<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) => apiRequest<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  logout: () => {
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
    }
  },
  getCurrentUser: () => apiRequest<any>('/auth/me'),
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
  getAll: (locationId?: string) => {
    const query = locationId ? `?locationId=${locationId}&_t=${Date.now()}` : `?_t=${Date.now()}`;
    return apiRequest<any[]>(`/bikes${query}`);
  },
  getAvailable: (start: Date, end: Date, locationId?: string) => {
    const query = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      ...(locationId ? { locationId } : {})
    });
    return apiRequest<any[]>(`/bikes/available?${query.toString()}`);
  },
  getById: (id: string) => apiRequest<any>(`/bikes/${id}?_t=${Date.now()}`),
  create: (data: any) => apiRequest<any>('/bikes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiRequest<any>(`/bikes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<void>(`/bikes/${id}`, { method: 'DELETE' }),
};

export const rentalsAPI = {
  create: (data: any) => apiRequest<any>('/rentals', { method: 'POST', body: JSON.stringify(data) }),
  getAll: () => apiRequest<any[]>('/rentals'),
  getUserRentals: () => apiRequest<any[]>('/rentals'),
  update: (id: string, updates: any) => apiRequest<any>(`/rentals/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  updateStatus: (id: string, status: string) => 
    apiRequest<any>(`/rentals/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  startRide: (id: string) => apiRequest<any>(`/rentals/${id}/start`, { method: 'POST' }),
  completeRide: (id: string, data?: { startKm?: number; endKm?: number; delay?: number; totalCost?: number }) => 
    apiRequest<any>(`/rentals/${id}/complete`, { method: 'POST', body: JSON.stringify(data || {}) }),
  end: (id: string) => apiRequest<any>(`/rentals/${id}/complete`, { method: 'POST' }),
  cancel: (id: string) => apiRequest<any>(`/rentals/${id}/cancel`, { method: 'POST' }),
  delete: (id: string) => apiRequest<void>(`/rentals/${id}`, { method: 'DELETE' }),
  submitReview: (id: string, data: { rating: number; comment: string }) =>
    apiRequest<any>(`/rentals/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
};

export const usersAPI = {
  getAll: () => apiRequest<any[]>(`/users?_t=${Date.now()}`),
  getById: (id: string) => apiRequest<any>(`/users/${id}?_t=${Date.now()}`),
  update: (id: string, updates: any) => apiRequest<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  createAdmin: (payload: { name: string; email: string; password: string; locationId: string }) =>
    apiRequest<any>('/users/create-admin', { method: 'POST', body: JSON.stringify(payload) }),
  delete: (id: string) => apiRequest<any>(`/users/${id}`, { method: 'DELETE' }),
  topUpWallet: (id: string, amount: number) =>
    apiRequest<any>(`/users/${id}/wallet/topup`, { method: 'POST', body: JSON.stringify({ amount }) }),
};

export const documentsAPI = {
  getAll: () => apiRequest<any[]>(`/documents?_t=${Date.now()}`),
  upload: (name: string, type: string, fileUrl: string | undefined) =>
    apiRequest<any>('/documents', { method: 'POST', body: JSON.stringify({ name, type, url: fileUrl }) }),
  getUploadUrl: (name: string, type: string, contentType: string) =>
    apiRequest<any>('/documents/upload-url', { method: 'POST', body: JSON.stringify({ name, type, contentType }) }),
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
        credentials: 'include',
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
  updateStatus: (id: string, status: 'pending' | 'approved' | 'rejected') =>
    apiRequest<any>(`/documents/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

export const paymentsAPI = {
  getKey: () => apiRequest<{ keyId: string }>('/payments/key'),
  createOrder: (amount: number) => apiRequest<any>('/payments/order', { method: 'POST', body: JSON.stringify({ amount }) }),
  verifyPayment: (payload: any) => apiRequest<any>('/payments/verify', { method: 'POST', body: JSON.stringify(payload) }),
};

export const locationsAPI = {
  getAll: () => apiRequest<any[]>('/locations'),
  getById: (id: string) => apiRequest<any>(`/locations/${id}`),
  create: (location: any) => apiRequest<any>('/locations', { method: 'POST', body: JSON.stringify(location) }),
  update: (id: string, location: any) => apiRequest<any>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(location) }),
  delete: (id: string) => apiRequest<any>(`/locations/${id}`, { method: 'DELETE' }),
};

export const settingsAPI = {
  getHomeHero: () => apiRequest<{ imageUrl: string | null }>('/settings/home-hero'),
  updateHomeHero: (imageUrl: string) => apiRequest<{ imageUrl: string }>('/settings/home-hero', { method: 'PUT', body: JSON.stringify({ imageUrl }) }),
  uploadImage: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const url = `${API_BASE}/settings/upload`;
      const res = await fetch(url, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: fd,
        credentials: 'include',
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
  }
};

export const heroImagesAPI = {
  getAll: () => apiRequest<any[]>('/hero-images'),
  create: (data: any) => apiRequest<any>('/hero-images', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiRequest<any>(`/hero-images/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<void>(`/hero-images/${id}`, { method: 'DELETE' }),
};

export const supportAPI = {
  getAll: () => apiRequest<any[]>('/support'),
  getById: (id: string) => apiRequest<any>(`/support/${id}`),
  create: (data: any) => apiRequest<any>('/support', { method: 'POST', body: JSON.stringify(data) }),
  addMessage: (id: string, data: { content: string; attachments?: string[] }) => 
    apiRequest<any>(`/support/${id}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, data: { status?: string; priority?: string }) => 
    apiRequest<any>(`/support/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  upload: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const url = `${API_BASE}/support/upload`;
      const res = await fetch(url, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: fd,
        credentials: 'include',
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
