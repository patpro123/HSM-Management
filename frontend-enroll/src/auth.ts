// API Configuration
const LOCAL_API_URL = 'http://localhost:3000';
const PRODUCTION_API_URL = 'https://hsm-management.onrender.com';

// Determine API URL:
// 1. Use VITE_API_BASE_URL if explicitly set
// 2. Use LOCAL_API_URL in development mode
// 3. Use PRODUCTION_API_URL in production mode
export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? LOCAL_API_URL : PRODUCTION_API_URL);

console.log('Environment:', import.meta.env.MODE);
console.log('API_BASE_URL configured as:', API_BASE_URL);

// Store original fetch before any overrides
const originalFetch = window.fetch.bind(window);

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export interface AuthToken {
  token: string;
  user: User;
  expiresAt: number;
}

const TOKEN_KEY = 'jwt_token';

/**
 * Get stored JWT token from localStorage
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Store JWT token in localStorage
 */
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Remove JWT token from localStorage
 */
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Decode JWT token and extract user information
 */
export const decodeToken = (token: string): User | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name || payload.email,
      roles: payload.roles || []
    };
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch (error) {
    return true;
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): User | null => {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    removeToken();
    return null;
  }
  return decodeToken(token);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = getToken();
  return token !== null && !isTokenExpired(token);
};

/**
 * Redirect to login (Google OAuth)
 */
export const login = (apiBaseUrl: string): void => {
  window.location.href = `${apiBaseUrl}/api/auth/google`;
};

/**
 * Logout user
 */
export const logout = (): void => {
  removeToken();
  // Don't reload, just clear the state to show login screen
  // window.location.reload();
};

/**
 * Make authenticated API request
 */
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken();
  
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Use original fetch to avoid infinite loop with fetch override
  const response = await originalFetch(url, {
    ...options,
    headers,
  });

  // If we get 401, token might be expired
  if (response.status === 401) {
    removeToken();
    // Don't auto-redirect, let the app handle it
  }

  return response;
};

/**
 * Handle OAuth callback - extract token from URL
 */
export const handleOAuthCallback = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    setToken(token);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
  
  return false;
};
