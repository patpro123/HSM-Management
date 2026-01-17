// API Configuration
// Reads from environment variable or falls back to production backend
// To change: Update the PRODUCTION_API_URL below or set VITE_API_BASE_URL environment variable

const PRODUCTION_API_URL = 'https://hsm-management.onrender.com';
const LOCAL_API_URL = 'http://localhost:3000';

// Use environment variable if available, otherwise use production URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PRODUCTION_API_URL;

console.log('API_BASE_URL configured as:', API_BASE_URL);
