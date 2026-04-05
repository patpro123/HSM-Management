import React from 'react';

const AlumniSection: React.FC = () => {
  return (
    <section className="stack-section logos-section">
      <div className="container center-content section-padding">
        <span className="section-label" style={{ marginBottom: '1rem' }}>Our students go on to achieve great things</span>
        <div className="trust-logos mb-5">
          <div className="trust-logo">Trinity College London</div>
          <div className="trust-logo">Berklee College of Music</div>
          <div className="trust-logo">Royal Academy</div>
          <div className="trust-logo">Juilliard School</div>
        </div>

        <div className="alumni-grid mt-5">
          <div className="alumni-card pop-shadow">
            <div className="alumni-photo bg-secondary"></div>
            <div className="alumni-info">
              <h4>A*** S.</h4>
              <p className="text-muted">Grade 8 Piano, Trinity</p>
            </div>
          </div>
          <div className="alumni-card pop-shadow">
            <div className="alumni-photo bg-secondary"></div>
            <div className="alumni-info">
              <h4>V*** R.</h4>
              <p className="text-muted">Lead Guitar, Local Band</p>
            </div>
          </div>
          <div className="alumni-card pop-shadow">
            <div className="alumni-photo bg-secondary"></div>
            <div className="alumni-info">
              <h4>M*** K.</h4>
              <p className="text-muted">Berklee Summer Program</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AlumniSection;
