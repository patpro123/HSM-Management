import React, { memo } from 'react';

const MAP_SRC = `https://maps.google.com/maps?q=17.3471995,78.3909525&z=17&output=embed`;

const LocationSection: React.FC = memo(() => {
  return (
    <section className="stack-section location-section" id="contact">
      <div className="container split-layout">
        <div className="split-visual location-map rounded-frame pop-shadow overflow-hidden">
          <iframe
            src={MAP_SRC}
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: '400px' }}
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade">
          </iframe>
        </div>
        <div className="split-text location-info">
          <span className="section-label">Find us here</span>
          <h2 className="section-title serif-heading">Come visit us in Kismatpur</h2>
          <div className="contact-details mt-4">
            <div className="contact-item mb-4">
              <p className="text-muted leading-relaxed location-address">
                <strong>📍 Address</strong><br />
                Flat No 1, 3rd Floor, House No 7-214<br />
                Abhyudaya Nagar, Kishan Nagar Colony<br />
                Bandlaguda Jagir-Kismatpura<br />
                Hyderabad — 500086<br />
                <em style={{ fontSize: '0.85rem' }}>(Opposite Kritunga Restaurant)</em>
              </p>
            </div>
            <div className="contact-item mb-5">
              <p className="text-muted location-phone">
                <strong>📱 Phone</strong><br />
                +91 96524 44188
              </p>
            </div>
            <div className="location-actions">
              <a href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ backgroundColor: '#25D366', color: 'white', border: 'none' }}>WhatsApp us now →</a>
              <a href="tel:+919652444188" className="btn btn-secondary">Call us →</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default LocationSection;
