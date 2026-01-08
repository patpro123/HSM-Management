import React from 'react'
import { Link, Outlet } from 'react-router-dom'
import logo from './images/hsmLogo.jpg'

export default function App(){
  return (
    <div className="app">
      <header className="header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div className="brand">
            <img src={logo} alt="Hyderabad School of Music logo" className="brand-logo" />
            <div className="brand-text">Hyderabad School of Music</div>
          </div>
          <nav className="nav">
            <Link to="/">Enroll</Link>
            <Link to="/students">Students</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
