// This file provides a wrapper for components that haven't been fully updated
// It allows plain fetch calls to work with authentication by using the authenticated wrapper
import { API_BASE_URL } from './config';
import { authenticatedFetch } from './auth';

// Override global fetch for backward compatibility during migration
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = input.toString();
    
    // If it's an API call to our backend, use authenticated fetch
    if (url.includes(API_BASE_URL) || url.startsWith('/api/')) {
      const fullUrl = url.startsWith('/api/') ? `${API_BASE_URL}${url}` : url;
      return authenticatedFetch(fullUrl, init);
    }
    
    // Otherwise use original fetch
    return originalFetch(input, init);
  };
}

export {}; // Make this a module
