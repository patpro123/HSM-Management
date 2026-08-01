'use client';

import React, { useState } from 'react';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.hsm.org.in';

interface BookDemoButtonProps {
  label?: string;
  prefilledInstrument?: string;
  className?: string;
}

/**
 * Self-contained booking CTA for use inside server-rendered page content
 * (instrument/locality pages) where there's no shared modal state to hook into.
 */
const BookDemoButton: React.FC<BookDemoButtonProps> = ({
  label = 'Book Your Free Demo Class →',
  prefilledInstrument = '',
  className = 'btn btn-primary btn-cta-main glow-shadow',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const intakeSrc = `${PORTAL_URL}/intake?embed=1` +
    (prefilledInstrument ? `&instrument=${encodeURIComponent(prefilledInstrument)}` : '');

  const close = () => {
    setIsOpen(false);
    document.body.style.overflow = '';
  };

  return (
    <>
      <button
        className={className}
        onClick={() => { setIsOpen(true); document.body.style.overflow = 'hidden'; }}
      >
        {label}
      </button>

      {isOpen && (
        <div
          className="modal-overlay active"
          onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) close(); }}
          style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}
        >
          <div style={{ position: 'relative', width: '92%', maxWidth: 680, height: '92vh', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>
            <button onClick={close} className="modal-close" style={{ zIndex: 10 }} aria-label="Close">
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
    </>
  );
};

export default BookDemoButton;
