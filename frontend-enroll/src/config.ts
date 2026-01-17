// API Configuration
// Reads from environment variable or falls back to localhost for development

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

console.log('API_BASE_URL configured as:', API_BASE_URL);
