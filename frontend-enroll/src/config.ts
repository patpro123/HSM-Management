// API Configuration
const PRODUCTION_API_URL = 'https://hsm-management.onrender.com';

// Determine API URL:
// 1. Use VITE_API_BASE_URL if explicitly set
// 2. In dev mode, use the same hostname the browser used (works for mobile on LAN)
// 3. Fall back to production URL
const devApiUrl = `${window.location.protocol}//${window.location.hostname}:3000`;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? devApiUrl : PRODUCTION_API_URL);

console.log('Environment:', import.meta.env.MODE);
console.log('API_BASE_URL configured as:', API_BASE_URL);
