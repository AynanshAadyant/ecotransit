import axios from 'axios';

/**
 * Spec §4.3:
 * Staff Service is the sole token issuer. Session comes back as an HTTP-only cookie.
 * No localStorage JWT storage.
 * withCredentials: true sends and receives session cookies automatically.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/staff',
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
    console.warn('[Staff API Error]', error?.response?.status, error?.message);
    return Promise.reject(error);
  }
);
