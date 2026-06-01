'use client';

import React, { useState } from 'react';

interface NavbarProps {
  isScrolled: boolean;
  onLogin: () => void;
  onOpenModal: (e: React.MouseEvent, instrument?: string) => void;
  promoActive?: boolean;
}

const NAV_LINKS = [
  { href: '#programs', label: 'Programs' },
  { href: '#method', label: 'The Method' },
  { href: '#teachers', label: 'Faculty' },
  { href: '#stories', label: 'Results' },
  { href: '#schedule', label: 'Schedule' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
];

const Navbar: React.FC<NavbarProps> = ({ isScrolled, onLogin, onOpenModal, promoActive }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav
        className={`navbar ${isScrolled ? 'scrolled' : ''} ${promoActive ? 'has-promo' : ''}`}
        id="navbar"
      >
        <div className="nav-container">
          <a href="#" className="logo">
            <img
              src="/HSM_Logo_Horizontal.png"
              alt="HSM Logo"
              className="nav-logo logo-multiply"
            />
          </a>

          <div className="nav-links">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </div>

          <div className="nav-actions">
            <button onClick={onLogin} className="btn btn-outline nav-signin">
              Sign In
            </button>

            <button
              className={`nav-hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      <div
        className={`mobile-nav-menu${menuOpen ? ' open' : ''}${promoActive ? ' has-promo' : ''}`}
        aria-hidden={!menuOpen}
      >
        {NAV_LINKS.map(link => (
          <a key={link.href} href={link.href} className="mobile-nav-link" onClick={closeMenu}>
            {link.label}
          </a>
        ))}
        <div className="mobile-nav-footer">
          <button
            onClick={(e) => { onOpenModal(e); closeMenu(); }}
            className="btn btn-cta mobile-nav-cta"
          >
            Book Free Demo Class →
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-nav-backdrop" onClick={closeMenu} aria-hidden="true" />
      )}
    </>
  );
};

export default Navbar;
