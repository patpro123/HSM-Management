import React from 'react';

interface HeroSectionProps {
  onOpenModal: (e: React.MouseEvent) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onOpenModal }) => {
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
          <h1 className="hero-title serif-heading text-white">
            Hyderabad's Home for Music
          </h1>
          <p className="hero-subtitle text-white">
            8 instruments. Expert teachers. <br />
            Your first class is free.
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
            <span className="trust-item">8 Instruments</span>
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
