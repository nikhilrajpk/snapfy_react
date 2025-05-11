// axiosInstance.js
import axios from 'axios';
import { store } from './redux/store';
import { logout } from './redux/slices/userSlice';
import { showToast } from './redux/slices/toastSlice';

// Use environment variable for API URL, fallback to Cloud Run URL
const API_URL = import.meta.env.VITE_API_URL || 'https://snapfy-backend-676661542025.asia-south1.run.app';

const axiosInstance = axios.create({
  baseURL: `${API_URL}/api/`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Get access token from cookies
    const accessToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1];
    
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Add CSRF token for non-GET requests
    if (!['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase())) {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
      
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip token refresh for logout requests
    if (originalRequest.url.includes('/logout/') || window.isLoggingOut) {
      store.dispatch(logout());
      window.location.href = '/';
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Get refresh token from cookies
        const refreshToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('refresh_token='))
          ?.split('=')[1];
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        // Refresh the token with the correct URL
        const response = await axios.post(
          `${API_URL}/api/token/refresh/`,
          { refresh: refreshToken },
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );
        
        // Update access token in cookies
        const accessToken = response.data.access;
        document.cookie = `access_token=${accessToken}; path=/; max-age=${3600 * 24}; SameSite=Lax; Secure`;
        
        // Retry original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Clear cookies
        document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        // Logout and redirect
        // store.dispatch(logout());
        store.dispatch(showToast({
          message: 'Session expired. Please log in again.',
          type: 'warning'
        }));
        
        // setTimeout(() => {
        //   window.location.href = '/';
        // }, 1000);
        
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other error responses
    if (error.response?.status >= 500) {
      store.dispatch(showToast({
        message: 'Server error. Please try again later.',
        type: 'error'
      }));
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;