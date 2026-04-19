import React from 'react';

const WhyHSM: React.FC = () => {
  return (
    <section className="stack-section why-hsm bg-white" id="why-us">
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">The HSM Difference</span>
          <h2 className="section-title serif-heading">Why families choose HSM</h2>
        </div>
        <div className="value-props-grid">
          <div className="value-card pop-shadow">
            <h3 className="value-title"><span className="value-emoji">🎓</span> Expert Teachers</h3>
            <p className="value-desc">Qualified faculty trained at leading music conservatories</p>
          </div>
          <div className="value-card pop-shadow">
            <h3 className="value-title"><span className="value-emoji">🎵</span> 9 Streams</h3>
            <p className="value-desc">7 instruments + 2 vocal streams — a blend of Indian classical and western music under one roof</p>
          </div>
          <div className="value-card pop-shadow">
            <h3 className="value-title"><span className="value-emoji">🆓</span> First Class Free</h3>
            <p className="value-desc">No commitment. No credit card. Just music.</p>
          </div>
          <div className="value-card pop-shadow">
            <h3 className="value-title"><span className="value-emoji">🏡</span> Community-First</h3>
            <p className="value-desc">Bi-annual recitals, workshops & events in Hyderabad</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyHSM;
