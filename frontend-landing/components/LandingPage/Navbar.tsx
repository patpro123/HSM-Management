import React from 'react';

interface NavbarProps {
  isScrolled: boolean;
  onLogin: () => void;
  onOpenModal: (e: React.MouseEvent, instrument?: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ isScrolled, onLogin, onOpenModal }) => {
  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`} id="navbar">
      <div className="nav-container">
        <a href="#" className="logo">
          <img
            src="/HSM_Logo_Horizontal.png"
            alt="HSM Logo"
            className="nav-logo logo-multiply"
          />
        </a>

        <div className="nav-links">
          <a href="#programs">Programs</a>
          <a href="#teachers">Teachers</a>
          <a href="#stories">Stories</a>
          <a href="#schedule">Schedule</a>
        </div>

        <div className="nav-actions">
          <a href="tel:+919652444188" className="nav-phone">
            <span className="phone-icon">📱</span>
            <span className="phone-number">+91 96524 44188</span>
          </a>
          <button
            onClick={onLogin}
            className="btn btn-outline nav-signin"
          >
            Sign In
          </button>
          <button onClick={onOpenModal} className="btn btn-cta">
            Book Free Class
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
