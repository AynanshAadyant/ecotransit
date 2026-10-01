import axios from 'axios';

/**
 * Spec §3.4:
 * Admin Service verifies tokens; it does not issue them.
 * Client is configured with withCredentials: true to send cookie session
 * and headers to the API Gateway.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/admin',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.warn('[Admin API Error]', error?.response?.status, error?.message);
    return Promise.reject(error);
  }
);
