import axios from 'axios';
import { apiBaseUrl } from './api-url';

const api = axios.create({
  baseURL: apiBaseUrl,
});

/**
 * Request interceptor to attach Firebase ID token
 * 
 * CRITICAL: Dynamically imports auth to avoid capturing null value.
 * Firebase is initialized lazily in AuthProvider, so we must fetch
 * the auth instance on every request, not at module load time.
 */
api.interceptors.request.use(async (config) => {
  // Dynamic import ensures we get the initialized auth instance
  const { auth } = await import('./firebase');
  const user = auth?.currentUser;
  
  if (user) {
    try {
      // getIdToken(false) - get cached token if valid, refresh if expired
      const token = await user.getIdToken(false);
      config.headers.Authorization = `Bearer ${token}`;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Attached Firebase token to request:', {
          url: config.url,
          method: config.method,
          hasToken: !!token,
          tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
        });
      }
    } catch (error) {
      console.error('[API] Failed to get Firebase token:', error);
      // Don't block the request - let backend return 401 if needed
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[API] No Firebase user - request will be unauthenticated:', {
        url: config.url,
        method: config.method
      });
    }
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * Response interceptor for error handling and token refresh
 * 
 * Handles 401 errors by attempting one token refresh retry.
 * If token refresh fails or returns 401 again, the error propagates.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 - possible expired token
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.error('[API] 401 Unauthorized - attempting token refresh', {
        url: originalRequest?.url,
        method: originalRequest?.method,
      });
      
      originalRequest._retry = true;
      
      try {
        // Try to refresh token and retry request
        const { auth } = await import('./firebase');
        const user = auth?.currentUser;
        
        if (user) {
          // Force token refresh
          const newToken = await user.getIdToken(true);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[API] Token refreshed, retrying request');
          }
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
        // Fall through to reject
      }
    } else if (error.response?.status === 404) {
      console.error('[API] 404 Not Found', {
        url: error.config?.url,
        message: 'Endpoint may not exist or route is incorrect',
      });
    }
    
    return Promise.reject(error);
  }
);

/**
 * Authenticated GET request with explicit token refresh
 * 
 * @param path API path (e.g., '/analytics/summary')
 * @param opts Axios request options
 * 
 * Use this when you need to ensure the freshest token possible,
 * or when you want explicit error handling for missing auth.
 */
export async function authGet<T = any>(path: string, opts = {}) {
  const { auth } = await import('./firebase');
  const user = auth?.currentUser;
  
  if (!user) {
    throw new Error('Not authenticated - user must be logged in');
  }
  
  // Force token refresh to ensure it's valid
  const token = await user.getIdToken(true);
  
  return api.get<T>(path, {
    headers: { Authorization: `Bearer ${token}` },
    ...opts
  });
}

export default api;
