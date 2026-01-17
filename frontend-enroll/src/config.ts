// API Configuration
const PRODUCTION_API_URL = 'https://hsm-management.onrender.com';

// Use environment variable if set, otherwise use hardcoded production URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PRODUCTION_API_URL;

console.log('API_BASE_URL configured as:', API_BASE_URL);
