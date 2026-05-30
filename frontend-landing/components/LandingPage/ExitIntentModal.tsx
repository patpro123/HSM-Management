'use client';

import React, { useState, useEffect } from 'react';

const SESSION_KEY = 'hsm_exit_intent_shown_v1';

interface ExitIntentModalProps {
  apiBaseUrl: string;
}

const ExitIntentModal: React.FC<ExitIntentModalProps> = ({ apiBaseUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Check session storage
    const hasShown = sessionStorage.getItem(SESSION_KEY);
    if (hasShown) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // clientY <= 5 indicates cursor left top of viewport
      if (e.clientY <= 5) {
        setIsOpen(true);
        sessionStorage.setItem(SESSION_KEY, 'true');
        // Clean up event listener once triggered
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !whatsappNumber.trim()) {
      setErrorMessage('Please fill in all fields.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const payload = {
        name: firstName.trim(),
        phone: whatsappNumber.trim(),
        instrument: 'General',
        location: 'hsm_main',
        source: 'Exit Intent Lead Magnet',
        notes: "Requested: The HSM Method - 5 Habits to Achieve a Trinity 'Distinction' guide",
        demo_type: 'normal'
      };

      const res = await fetch(`${apiBaseUrl}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit. Please try again.');
      }

      setStatus('success');
      
      // Pre-filled WhatsApp redirect
      const message = "Hi HSM, I'd love a copy of the 5 Habits guide!";
      const waUrl = `https://wa.me/919652444188?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) handleClose();
    }}>
      <div className="modal-content pop-shadow lead-magnet-modal" style={{ maxWidth: '480px', padding: '2.5rem' }}>
        <button className="modal-close" onClick={handleClose}>&times;</button>
        
        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="serif-heading" style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Sent to your WhatsApp!</h3>
            <p style={{ color: 'var(--text-body)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              We've triggered your WhatsApp to request the guide. If the tab did not open automatically, please click below.
            </p>
            <a 
              href={`https://wa.me/919652444188?text=${encodeURIComponent("Hi HSM, I'd love a copy of the 5 Habits guide!")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-cta"
              style={{ display: 'inline-flex', width: '100%' }}
            >
              Open WhatsApp
            </a>
          </div>
        ) : (
          <>
            <span className="section-label text-center" style={{ fontSize: '1.5rem', marginBottom: '-5px' }}>
              Wait! Don't leave empty-handed.
            </span>
            <h3 className="serif-heading text-center" style={{ fontSize: '1.75rem', marginBottom: '1rem', lineHeight: 1.2 }}>
              Get our Free Guide
            </h3>
            <p style={{ color: 'var(--text-body)', fontSize: '0.925rem', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Download <strong>The HSM Method - 5 Habits to Achieve a Trinity 'Distinction'</strong>. Learn the daily routines our routines get a 100% success rate.
            </p>

            <form onSubmit={handleSubmit} className="trial-form">
              <div className="form-group mb-4">
                <label htmlFor="lead-name">First Name *</label>
                <input 
                  type="text" 
                  id="lead-name" 
                  required 
                  placeholder="e.g. Arjun" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group mb-4">
                <label htmlFor="lead-phone">WhatsApp Number *</label>
                <input 
                  type="tel" 
                  id="lead-phone" 
                  required 
                  placeholder="e.g. +91 98765 43210" 
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {status === 'error' && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn btn-cta"
                style={{ width: '100%', opacity: status === 'loading' ? 0.7 : 1 }}
              >
                {status === 'loading' ? 'Sending...' : 'Send Me The Free Guide 🎁'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ExitIntentModal;
