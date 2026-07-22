import axios from 'axios';

// Convention: VITE_API_URL must end with /api
// Example: https://zeplay-backend.onrender.com/api
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Server origin (no /api suffix) — used for building media/HLS streaming URLs
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

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
