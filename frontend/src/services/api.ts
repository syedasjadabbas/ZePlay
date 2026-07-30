import axios from 'axios';

const getInitialApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
};

const API_URL = getInitialApiUrl();

// Server origin (no /api suffix) — used for building media/HLS streaming URLs
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

/**
 * Centralized poster URL resolver.
 * Converts relative static paths (/static/posters/...) to full backend origin URLs.
 */
export const resolvePosterUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${API_ORIGIN}${path}`;
};

const api = axios.create({
  baseURL: API_URL,
});

// Helper utilities for auth session management (localStorage / sessionStorage)
export const getToken = (): string | null => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const setAuthSession = (token: string, rememberMe: boolean) => {
  if (rememberMe) {
    localStorage.setItem('token', token);
    localStorage.setItem('rememberMe', 'true');
    sessionStorage.removeItem('token');
  } else {
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('selectedProfileId');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
};

// Request interceptor to automatically attach authorization tokens
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
