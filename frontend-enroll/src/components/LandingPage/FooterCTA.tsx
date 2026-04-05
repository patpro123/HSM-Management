import React from 'react';

interface FooterCTAProps {
  onOpenModal: (e: React.MouseEvent) => void;
}

const FooterCTA: React.FC<FooterCTAProps> = ({ onOpenModal }) => {
  return (
    <section className="stack-section footer-section" id="trial">
      <div className="footer-cta container">
        <div className="cta-box pop-shadow">
          <div className="motif-circle motif-cta"></div>
          <span className="section-label text-white">Your stage awaits</span>
          <h2 className="serif-heading text-white">Your first class is free.<br />No strings attached.</h2>
          <p className="text-white body-text mb-4 text-center">
            Limited demo slots available each week.
          </p>
          <button onClick={onOpenModal} className="btn btn-cta btn-large pulse-animation">
            Book Your Free Demo Now →
          </button>
        </div>
      </div>

      <footer className="real-footer">
        <div className="container footer-grid">
          <div>
            <img
              src="/HSM_Logo_Horizontal.png"
              alt="HSM Logo"
              className="logo-screen"
              style={{ height: '160px', marginTop: '-40px', marginBottom: '0', marginLeft: '-20px' }}
            />
            <p className="text-muted">Hyderabad School of Music. Shaping the artists of tomorrow.</p>
          </div>
          <div className="footer-links">
            <h4>Explore</h4>
            <a href="#curriculum">Curriculum</a>
            <a href="#faculty">Faculty</a>
            <a href="#success">Ensembles</a>
          </div>
          <div className="footer-links">
            <h4>Connect</h4>
            <a href="#contact">Contact Us</a>
            <button onClick={onOpenModal} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', display: 'block', marginBottom: '0.75rem' }} className="hover:text-white transition-colors">Enrollment</button>
            <a href="#careers">Careers</a>
          </div>
        </div>
      </footer>
    </section>
  );
};

export default FooterCTA;
