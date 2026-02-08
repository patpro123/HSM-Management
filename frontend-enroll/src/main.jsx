import React from 'react'
import { createRoot } from 'react-dom/client'
import './fetchOverride'  // Apply fetch override for auth
import App from './App.tsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
