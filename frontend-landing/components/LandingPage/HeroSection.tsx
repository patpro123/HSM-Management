import React from 'react';

interface HeroSectionProps {
  onOpenModal: (e: React.MouseEvent, instrument?: string, isDemoDay?: boolean) => void;
  flashConfig?: {
    demo_day_title: string;
    demo_day_description: string;
    demo_day_link_enabled: boolean;
    demo_day_location: string;
    demo_day_date: string;
    demo_day_instruments: string[];
    piano_teacher_title: string;
    piano_teacher_description: string;
  } | null;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onOpenModal, flashConfig }) => {
  return (
    <section className="stack-section hero" id="home">
      <div className="video-background">
        <video autoPlay loop muted playsInline className="hero-video">
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="video-overlay"></div>
      </div>

      <div className="container hero-content-new">
        <div className="hero-text-new fade-up">

          {/* Announcements Container */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.75rem',
            width: '100%',
          }}>
            {/* 1. PBEL City (Original Announcement Pill) */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 999, padding: '0.4rem 0.95rem',
            }}>
              <span style={{ fontSize: '0.8rem' }}>🎉</span>
              <span style={{ color: '#fff', fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.01em' }}>
                PBEL City: Vocal classes live!
              </span>
            </div>

            {/* 2. Demo Day (glowing dynamic pill if enabled) */}
            {flashConfig?.demo_day_link_enabled && (
              <div
                onClick={(e) => onOpenModal(e, undefined, true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'linear-gradient(135deg, rgba(242,107,56,0.25) 0%, rgba(251,191,36,0.25) 100%)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(242,107,56,0.6)',
                  borderRadius: 999,
                  padding: '0.4rem 0.95rem',
                  cursor: 'pointer',
                  animation: 'hsm-pulse-glow 2s ease-in-out infinite',
                  boxShadow: '0 0 10px rgba(242,107,56,0.25)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span style={{ fontSize: '0.8rem' }}>🎁</span>
                <span style={{ color: '#fff', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.01em' }}>
                  {flashConfig.demo_day_title} &rarr;
                </span>
              </div>
            )}

            {/* 3. New Piano Batches (glowing dynamic pill) */}
            <div
              onClick={(e) => onOpenModal(e, 'Piano')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(168,85,247,0.6)',
                borderRadius: 999,
                padding: '0.4rem 0.95rem',
                cursor: 'pointer',
                animation: 'hsm-pulse-glow-purple 2.5s ease-in-out infinite',
                boxShadow: '0 0 10px rgba(168,85,247,0.25)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span style={{ fontSize: '0.8rem' }}>🎹</span>
              <span style={{ color: '#fff', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.01em' }}>
                {flashConfig?.piano_teacher_title || 'New Piano Batches'} &rarr;
              </span>
            </div>
          </div>

          <h1 className="hero-title serif-heading text-white">
            From First Note<br />to Centre Stage.
          </h1>
          <p className="hero-subtitle text-white">
            The school that turns beginners into performers —<br />
            ensemble sessions, daily habit tracking, and live recitals,{' '}
            under one roof.{' '}
            <span style={{ color: '#f26b38', fontWeight: 700 }}>First time in Hyderabad.</span>
          </p>
          <div className="hero-cta-group">
            <button onClick={onOpenModal} className="btn btn-primary btn-cta-main glow-shadow">
              Book Your Free Demo Class →
            </button>
            <div className="hero-secondary-row">
              <a
                href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost hero-whatsapp-ghost"
              >
                💬 WhatsApp
              </a>
              <a href="#programs" className="btn btn-secondary btn-ghost">
                See Our Programs ↓
              </a>
            </div>
          </div>

          <div className="trust-strip">
            <span className="trust-item">⭐ 4.9★</span>
            <span className="trust-divider">|</span>
            <span className="trust-item">100+ Students</span>
            <span className="trust-divider">|</span>
            <span className="trust-item">9 Streams</span>
          </div>
          <div className="trust-location">
            📍 Kismatpur, Hyderabad
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
