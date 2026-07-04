// API utilities with authentication
import { API_BASE_URL } from './config';
import { authenticatedFetch, getToken } from './auth';

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

  // Handle 204 No Content response
  if (response.status === 204) {
    return null;
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
 * Search the shared teaching material library — used by both the Material Library
 * tab and the in-assignment library picker, so the query-building lives in one place.
 */
export const searchMaterials = (opts: { instrumentId: string; type?: string; q?: string }): Promise<any> => {
  const params = new URLSearchParams({ instrument_id: opts.instrumentId });
  if (opts.type) params.set('type', opts.type);
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  return apiGet(`/api/materials?${params.toString()}`);
};

/**
 * Inline-preview URL for a saved library material — <img>/<audio>/<video> src
 * attributes can't send an Authorization header, so the token travels as a query
 * param instead (same pattern as the notifications SSE stream).
 */
export const materialFileUrl = (materialId: string): string => {
  return `${API_BASE_URL}/api/materials/${materialId}/file?token=${getToken() || ''}`;
};

/**
 * DELETE request
 */
export const apiDelete = (endpoint: string): Promise<any> => {
  return apiRequest(endpoint, { method: 'DELETE' });
};
