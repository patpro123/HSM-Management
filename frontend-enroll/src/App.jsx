import React from 'react'
import { Link, Outlet } from 'react-router-dom'
import hsmLogo from './images/hsmLogo.jpg'

export default function App(){
  return (
    <div className="app">
      <header className="header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <img src={hsmLogo} alt="HSM Logo" className="header-logo" />
            <div style={{fontWeight:700}}>Student Enrollment</div>
          </div>
          <nav style={{display:'flex',gap:12}}>
            <Link to="/" style={{color:'white',textDecoration:'none'}}>Enroll</Link>
            <Link to="/admin" style={{color:'white',textDecoration:'none'}}>Admin</Link>
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
