// API utilities with authentication
import { API_BASE_URL } from './config';
import { authenticatedFetch } from './auth';

/**
 * Wrapper around authenticatedFetch for API calls
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await authenticatedFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      error: 'Request failed',
      message: `HTTP ${response.status}: ${response.statusText}` 
    }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
};

/**
 * GET request
 */
export const apiGet = (endpoint: string): Promise<any> => {
  return apiRequest(endpoint, { method: 'GET' });
};

/**
 * POST request
 */
export const apiPost = (endpoint: string, data: any): Promise<any> => {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * PUT request
 */
export const apiPut = (endpoint: string, data: any): Promise<any> => {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * DELETE request
 */
export const apiDelete = (endpoint: string): Promise<any> => {
  return apiRequest(endpoint, { method: 'DELETE' });
};
