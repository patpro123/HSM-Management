'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_KEY   = 'hsm_exit_intent_shown_v2';
const BOOKED_KEY    = 'hsm_demo_booked';  // set by LandingPage on intake success
const SCROLL_DEPTH  = 0.70;   // fire after 70% page scrolled
const TIME_DELAY_MS = 60_000; // fire after 60 s on page

type Trigger = 'exit_intent' | 'scroll_depth' | 'time_on_page';

const TRIGGER_COPY: Record<Trigger, { eyebrow: string; headline: string }> = {
  exit_intent: {
    eyebrow:  "Wait — don't leave empty-handed.",
    headline: 'Get the Free Guide Before You Go',
  },
  scroll_depth: {
    eyebrow:  "You're clearly serious about this.",
    headline: 'Take Our Blueprint Home With You',
  },
  time_on_page: {
    eyebrow:  'Enjoyed the read? Here\'s a gift.',
    headline: 'Download the Full HSM Method Guide',
  },
};

interface ExitIntentModalProps {
  apiBaseUrl: string;
  onOpenBooking?: () => void;
}

const ExitIntentModal: React.FC<ExitIntentModalProps> = ({ apiBaseUrl, onOpenBooking }) => {
  const [isOpen,         setIsOpen]         = useState(false);
  const [trigger,        setTrigger]        = useState<Trigger>('exit_intent');
  const [firstName,      setFirstName]      = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [status,         setStatus]         = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [errorMessage,   setErrorMessage]   = useState('');
  const hasShownRef = useRef(false);

  const openModal = useCallback((t: Trigger) => {
    if (hasShownRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (localStorage.getItem(BOOKED_KEY)) return; // already booked a demo — skip
    hasShownRef.current = true;
    sessionStorage.setItem(SESSION_KEY, 'true');
    setTrigger(t);
    setIsOpen(true);
  }, []);

  // Close + suppress permanently if user books a demo during the session
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'hsm-intake-success') {
        setIsOpen(false);
        hasShownRef.current = true; // stop any pending triggers
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Trigger 1: cursor leaves top of viewport (desktop exit intent)
  useEffect(() => {
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5) {
        openModal('exit_intent');
        document.removeEventListener('mouseleave', onMouseLeave);
      }
    };
    document.addEventListener('mouseleave', onMouseLeave);
    return () => document.removeEventListener('mouseleave', onMouseLeave);
  }, [openModal]);

  // Trigger 2: scroll depth ≥ 70% (works on mobile too)
  useEffect(() => {
    const onScroll = () => {
      const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct >= SCROLL_DEPTH) {
        openModal('scroll_depth');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [openModal]);

  // Trigger 3: time on page (catches idle visitors)
  useEffect(() => {
    const t = setTimeout(() => openModal('time_on_page'), TIME_DELAY_MS);
    return () => clearTimeout(t);
  }, [openModal]);

  const handleClose = () => setIsOpen(false);

  const triggerDownload = () => {
    const a = document.createElement('a');
    a.href     = '/hsm-methodology.pdf';
    a.download = 'HSM-Method-5-Daily-Habits.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !whatsappNumber.trim()) {
      setErrorMessage('Please fill in both fields.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMessage('');

    try {
      await fetch(`${apiBaseUrl}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      firstName.trim(),
          phone:     whatsappNumber.trim(),
          instrument: 'General',
          location:  'hsm_main',
          source:    `Exit Intent — ${trigger}`,
          notes:     "Downloaded: The HSM Method — 5 Daily Habits guide",
          demo_type: 'normal',
          user_type: 'intentful',
        }),
      });
      // Deliver PDF immediately regardless of API status
      triggerDownload();
      setStatus('success');
    } catch {
      // Still deliver the PDF even if the lead capture fails
      triggerDownload();
      setStatus('success');
    }
  };

  if (!isOpen) return null;

  const copy = TRIGGER_COPY[trigger];

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) handleClose();
      }}
    >
      <div
        className="modal-content pop-shadow lead-magnet-modal"
        style={{ maxWidth: '480px', padding: '2.5rem' }}
      >
        <button className="modal-close" onClick={handleClose}>&times;</button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#dcfce7', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1.25rem',
            }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="serif-heading" style={{ fontSize: '1.6rem', marginBottom: '0.6rem' }}>
              Your guide is downloading!
            </h3>
            <p style={{ color: 'var(--text-body)', fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '1.5rem' }}>
              <strong>HSM Method — 5 Daily Habits</strong> should be in your downloads folder now.
              If it didn't start, tap below.
            </p>
            <button
              onClick={triggerDownload}
              className="btn btn-cta"
              style={{ width: '100%', marginBottom: '0.85rem' }}
            >
              📄 Download PDF Again
            </button>
            <a
              href={`https://wa.me/919652444188?text=${encodeURIComponent("Hi HSM, I just downloaded the 5 Habits guide — would love to know more!")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              💬 Chat with us on WhatsApp
            </a>
          </div>
        ) : (
          <>
            {/* Eyebrow */}
            <p style={{
              fontSize: '0.78rem', fontWeight: 800, color: 'var(--brand-orange)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              textAlign: 'center', marginBottom: '0.4rem',
            }}>
              {copy.eyebrow}
            </p>

            {/* Headline */}
            <h3 className="serif-heading" style={{
              fontSize: '1.6rem', textAlign: 'center',
              marginBottom: '0.75rem', lineHeight: 1.2,
            }}>
              {copy.headline}
            </h3>

            {/* PDF preview card */}
            <div style={{
              background: 'var(--bg-secondary, #f8fafc)',
              border: '1.5px solid var(--border, #e2e8f0)',
              borderRadius: 12, padding: '0.9rem 1rem',
              display: 'flex', alignItems: 'center', gap: '0.85rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{
                width: 44, height: 52, background: 'var(--brand-orange)',
                borderRadius: 6, display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, fontSize: '1.4rem',
              }}>📄</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-heading)', marginBottom: '0.2rem' }}>
                  The HSM Method
                </div>
                <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  5 Daily Habits of Students Who Score 'Distinction' — the full 7-page guide, free.
                </div>
              </div>
            </div>

            <p style={{
              color: 'var(--text-body)', fontSize: '0.875rem',
              textAlign: 'center', marginBottom: '1.25rem', lineHeight: 1.5,
            }}>
              Leave your name and number — we'll send the guide straight to your WhatsApp
              and keep you updated on Demo Days and batch openings.
            </p>

            <form onSubmit={handleSubmit} className="trial-form">
              <div className="form-group mb-4">
                <label htmlFor="lead-name">First Name *</label>
                <input
                  type="text" id="lead-name" required
                  placeholder="e.g. Arjun"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group mb-4">
                <label htmlFor="lead-phone">WhatsApp Number *</label>
                <input
                  type="tel" id="lead-phone" required
                  placeholder="e.g. +91 98765 43210"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {status === 'error' && (
                <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn btn-cta"
                style={{ width: '100%', opacity: status === 'loading' ? 0.7 : 1 }}
              >
                {status === 'loading' ? 'Preparing your guide…' : '🎁 Send Me The Free Guide'}
              </button>
            </form>

            {/* Divider + Book a demo path */}
            {onOpenBooking && (
              <div style={{ margin: '1.1rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border, #e2e8f0)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                  Already decided?
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border, #e2e8f0)' }} />
              </div>
            )}
            {onOpenBooking && (
              <button
                onClick={() => { handleClose(); onOpenBooking(); }}
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: '0.6rem' }}
              >
                Book My Free Demo Class →
              </button>
            )}

            {/* Skip link */}
            <p style={{ textAlign: 'center', marginTop: '0.4rem' }}>
              <button
                onClick={() => { triggerDownload(); handleClose(); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', color: 'var(--text-muted)',
                  textDecoration: 'underline',
                }}
              >
                Download without sharing details
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ExitIntentModal;
