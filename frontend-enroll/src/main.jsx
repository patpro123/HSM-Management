import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import EnrollPage from './pages/EnrollPage'
import AdminPage from './pages/AdminPage'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<EnrollPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
)
