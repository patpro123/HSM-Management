import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section className="stack-section about-section bg-white" id="about">
      <div className="container section-padding">
        <div className="about-inner">
          <div className="about-text">
            <span className="section-label">Who we are</span>
            <h2 className="section-title serif-heading">
              Unleash the musician in you.
            </h2>
            <p className="about-body">
              At Hyderabad School of Music, we believe every person carries a musician waiting to be heard.
              Since opening our doors in Kismatpur, we have helped over <strong>200 students</strong> — from
              curious five-year-olds to adults revisiting an old passion — find their voice through music.
            </p>
            <p className="about-body">
              Our motto is a promise: that with the right system, the right teachers, and the right daily
              habits, musical potential exists in everyone. Our <strong>100% Merit or Distinction record</strong> in
              Trinity College London examinations is the proof.
            </p>
            <p className="about-body">
              Music at HSM is not a hobby class. It is a structured journey with real milestones,
              live performances, and a community that grows together.
            </p>
          </div>

          <div className="about-stats">
            <div className="about-stat-card">
              <span className="about-stat-number">200+</span>
              <span className="about-stat-label">Students taught</span>
            </div>
            <div className="about-stat-card">
              <span className="about-stat-number">100%</span>
              <span className="about-stat-label">Trinity Merit / Distinction rate</span>
            </div>
            <div className="about-stat-card">
              <span className="about-stat-number">8</span>
              <span className="about-stat-label">Instruments &amp; streams</span>
            </div>
            <div className="about-stat-card">
              <span className="about-stat-number">4.9★</span>
              <span className="about-stat-label">Google rating</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
