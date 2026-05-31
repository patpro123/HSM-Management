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
            <h3 className="value-title"><span className="value-emoji">🎼</span> Ensemble Over Solo</h3>
            <p className="value-desc">Other schools teach you to play alone. We put students in ensembles from the start — because real musicians perform with others, not just for an examiner.</p>
          </div>
          <div className="value-card pop-shadow">
            <h3 className="value-title"><span className="value-emoji">📱</span> Smart Practice Tech</h3>
            <p className="value-desc">Students use our habit tracker and homework reviewer to stay on track between classes. Progress becomes visible — and addictive.</p>
          </div>
          <div className="value-card pop-shadow">
            <h3 className="value-title"><span className="value-emoji">🏆</span> Built for the Stage</h3>
            <p className="value-desc">Bi-annual recitals, ensembles, and workshops — every student performs live. We're training artists, not just preparing grades.</p>
          </div>
          <div className="value-card pop-shadow">
            <h3 className="value-title"><span className="value-emoji">🎁</span> First Demo Free</h3>
            <p className="value-desc">No commitment, no credit card. Book a free demo and see the difference in person.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyHSM;
