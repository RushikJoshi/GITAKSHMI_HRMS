import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { getToken, removeToken } from './token';

/**
 * Centralized Axios instance for HRMS SaaS API calls
 * Handles authentication, tenant context, and error management
 */

// Construct API base URL safely, avoiding double '/api' paths
const rawBase = (import.meta.env.VITE_API_URL || 'https://hrms.gitakshmi.com').replace(/\/+$/, '');
const API_BASE = rawBase.endsWith('/api') ? rawBase : rawBase + '/api';

console.log('🔥 Using API BASE:', API_BASE);

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10 second timeout for production
});

/**
 * Request Interceptor: Automatically attach JWT token and tenantId
 * - Adds Authorization header with Bearer token
 * - Decodes JWT to extract tenantId and adds X-Tenant-ID header
 * - Ensures all requests include proper authentication and tenant context
 */
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    // Attach JWT token for authentication
    config.headers.Authorization = `Bearer ${token}`;

    // Decode token to extract tenantId for multi-tenant context
    try {
      const decoded = jwtDecode(token);
      if (decoded.tenantId) {
        config.headers['X-Tenant-ID'] = decoded.tenantId;
      }
    } catch (error) {
      // Log warning but don't fail - some tokens might not have tenantId (e.g., super admin)
      console.warn('Failed to decode token for tenantId:', error.message);
    }
  }
  // If request body is FormData, do not set Content-Type here so the browser can add the correct boundary
  try {
    if (config && config.data && typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers) delete config.headers['Content-Type'];
    }
  } catch (e) {
    // ignore
  }

  return config;
});

/**
 * Response Interceptor: Handle authentication errors and token expiry
 * - Automatically removes invalid/expired tokens
 * - Redirects to login page on 401 errors
 * - Prevents redirect loops by checking current path
 */

// Global error handler for connection issues
import.meta.env && (window.__HRMS_API_ERROR = window.__HRMS_API_ERROR || null);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle backend unreachable (ERR_CONNECTION_REFUSED)
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      // Only show once per page load
      if (!window.__HRMS_API_ERROR) {
        window.__HRMS_API_ERROR = 'Backend server is not running. Please start the server.';
        // Try to show a toast if available, else fallback to alert
        if (window.showToast) {
          window.showToast({ message: window.__HRMS_API_ERROR, type: 'error' });
        } else {
          alert(window.__HRMS_API_ERROR);
        }
      }
    }
    if (error.response && error.response.status === 401) {
      // Token expired or invalid - clean up and redirect
      removeToken();
      // Avoid redirect loops if already on login
      if (!window.location.pathname.includes('/login')) {
        console.log('Token expired, redirecting to login');
        window.location.href = '/login'; // Super admin / choice page
      }
    }
    return Promise.reject(error);
  }
);

export default api;
