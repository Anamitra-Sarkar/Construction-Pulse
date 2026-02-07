import axios from 'axios';
import { auth } from './firebase';
import { apiBaseUrl } from './api-url';

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use(async (config) => {
  const user = auth?.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Enhanced error interceptor for better logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('API returned 401 Unauthorized — possible expired token or missing auth', {
        url: error.config?.url,
        method: error.config?.method,
      });
    } else if (error.response?.status === 404) {
      console.error('API returned 404 Not Found', {
        url: error.config?.url,
        message: 'Endpoint may not exist or route is incorrect',
      });
    }
    return Promise.reject(error);
  }
);

/**
 * Authenticated GET request with explicit token refresh
 * @param path API path (e.g., '/analytics/summary')
 * @param opts Axios request options
 */
export async function authGet<T = any>(path: string, opts = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('Not authenticated - user must be logged in');
  }
  const token = await user.getIdToken(true); // Force refresh
  return api.get<T>(path, {
    headers: { Authorization: `Bearer ${token}` },
    ...opts
  });
}

export default api;
