import axios from 'axios';

/**
 * Spec §2.4:
 * api/client.ts is the ONLY place base fetch config / axios instance lives.
 * Base URL is driven from environment configuration.
 */
const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
export const apiClient = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] || `http://${defaultHost}:4000/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standard error logging without throwing unhandled exceptions to UI
    console.warn('[Transit API Error]', error?.response?.status, error?.message);
    return Promise.reject(error);
  }
);
