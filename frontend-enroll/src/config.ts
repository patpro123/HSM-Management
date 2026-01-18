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
