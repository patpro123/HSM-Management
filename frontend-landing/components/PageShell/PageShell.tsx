'use client';

import React, { useState, useEffect } from 'react';
import '../LandingPage.css';
import Navbar from '../LandingPage/Navbar';
import FooterCTA from '../LandingPage/FooterCTA';
import { PublicCleffChat } from '../Chat/PublicCleffChat';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.hsm.org.in';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hsm-management.onrender.com';

interface PageShellProps {
  children: React.ReactNode;
  /** Pre-selects an instrument in the booking iframe when the CTA is opened from an instrument page. */
  prefilledInstrument?: string;
}

/**
 * Shared chrome (nav, footer, booking modal, chat) for every non-homepage page
 * (instrument pages, locality pages, practice-portal). Mirrors the structure
 * LandingPage.tsx uses so booking/nav behavior stays identical across the site.
 */
const PageShell: React.FC<PageShellProps> = ({ children, prefilledInstrument = '' }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'hsm-intake-success' || event.data?.type === 'hsm-intake-close') {
        handleCloseModal();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    document.body.style.overflow = '';
  };

  const intakeSrc = `${PORTAL_URL}/intake?embed=1` +
    (prefilledInstrument ? `&instrument=${encodeURIComponent(prefilledInstrument)}` : '');

  return (
    <div className="landing-wrapper subpage">
      <Navbar
        isScrolled={isScrolled}
        onLogin={() => { window.location.href = `${API_BASE_URL}/api/auth/google`; }}
        onOpenModal={handleOpenModal}
      />

      <main className="stacking-container">
        {children}
        <FooterCTA onOpenModal={handleOpenModal} />
      </main>

      <PublicCleffChat onBookDemo={() => handleOpenModal({ preventDefault: () => {} } as React.MouseEvent)} />

      {isModalOpen && (
        <div
          className="modal-overlay active"
          onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) handleCloseModal(); }}
          style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}
        >
          <div style={{ position: 'relative', width: '92%', maxWidth: 680, height: '92vh', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>
            <button
              onClick={handleCloseModal}
              className="modal-close"
              style={{ zIndex: 10 }}
              aria-label="Close"
            >
              &times;
            </button>
            <iframe
              src={intakeSrc}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Book a Free Demo"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PageShell;
