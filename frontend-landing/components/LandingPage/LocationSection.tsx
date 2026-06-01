import React, { memo } from 'react';

const MAP_SRC = `https://maps.google.com/maps?q=17.3471995,78.3909525&z=17&output=embed`;

const HOURS = [
  { days: 'Tuesday – Friday', time: '5:00 PM – 9:00 PM' },
  { days: 'Saturday',         time: '3:00 PM – 9:00 PM' },
  { days: 'Sunday',           time: '10:00 AM – 1:00 PM  &  5:00 PM – 9:00 PM' },
  { days: 'Monday',           time: 'Closed', closed: true },
];

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
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="split-text location-info">
          <span className="section-label">Get in touch</span>
          <h2 className="section-title serif-heading">Contact Us</h2>

          <div className="contact-details mt-4">

            {/* Address */}
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

            {/* Phone & Email */}
            <div className="contact-item mb-4">
              <p className="text-muted" style={{ lineHeight: 1.9 }}>
                <strong>📞 Phone</strong><br />
                <a href="tel:+919652444188" style={{ color: 'var(--brand-orange)', fontWeight: 600, textDecoration: 'none' }}>
                  +91 96524 44188
                </a>
              </p>
              <p className="text-muted" style={{ lineHeight: 1.9, marginTop: '0.75rem' }}>
                <strong>✉️ Email</strong><br />
                <a href="mailto:adminuser@hsm.org.in" style={{ color: 'var(--brand-orange)', fontWeight: 600, textDecoration: 'none' }}>
                  adminuser@hsm.org.in
                </a>
              </p>
            </div>

            {/* Hours */}
            <div className="contact-item mb-5">
              <p className="text-muted" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🕐 Opening Hours</p>
              <table className="hours-table">
                <tbody>
                  {HOURS.map(({ days, time, closed }) => (
                    <tr key={days} className={closed ? 'hours-closed' : ''}>
                      <td className="hours-day">{days}</td>
                      <td className="hours-time">{time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="location-actions">
              <a
                href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ backgroundColor: '#25D366', color: 'white', border: 'none' }}
              >
                WhatsApp us →
              </a>
              <a href="tel:+919652444188" className="btn btn-secondary">Call us →</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default LocationSection;
