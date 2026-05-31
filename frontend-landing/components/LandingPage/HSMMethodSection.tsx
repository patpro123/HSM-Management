import React from 'react';

const habits = [
  {
    icon: '⚡',
    title: 'Zero Friction Setup',
    body: 'Keep your instrument out, tuned, and uncovered. Reduce the time it takes to start playing to under 10 seconds.',
    goal: 'If it\'s hard to start, it won\'t happen.',
  },
  {
    icon: '⏱️',
    title: '20-Minute Daily Sessions',
    body: 'Short, focused daily sessions build muscle memory far faster than a frantic 2-hour weekend cram. We track streaks, not hours.',
    goal: 'Consistency beats intensity.',
  },
  {
    icon: '🎯',
    title: 'Isolate, Don\'t Play Through',
    body: 'Find the 2 hard bars. Loop them at half-speed until they\'re airtight. Never rehearse your way through a mistake.',
    goal: 'Fix it before you move on.',
  },
  {
    icon: '📱',
    title: 'Record Yourself',
    body: '60 seconds of phone video reveals what your brain misses while playing — posture, timing, tone. Watch it back and self-correct.',
    goal: 'The camera is honest. Your ears aren\'t.',
  },
  {
    icon: '📊',
    title: 'Monthly Assessment Check-In',
    body: 'Teachers formally grade students every month. Students log in to the portal and see exactly where they stand on the Trinity Grade 1–8 path.',
    goal: 'Progress that isn\'t measured isn\'t happening.',
  },
];

const HSMMethodSection: React.FC = () => {
  return (
    <section className="stack-section why-hsm" id="method" style={{ background: 'var(--bg-secondary, #f8fafc)' }}>
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">Our Practice System</span>
          <h2 className="section-title serif-heading">The HSM Method</h2>
          <p className="text-muted" style={{ maxWidth: '560px', margin: '0.75rem auto 0' }}>
            5 daily habits every HSM student builds — so practice at home actually works.
          </p>
        </div>
        <div className="value-props-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {habits.map(({ icon, title, body, goal }) => (
            <div key={title} className="value-card pop-shadow" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 className="value-title">
                <span className="value-emoji">{icon}</span> {title}
              </h3>
              <p className="value-desc">{body}</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--brand-orange)', fontWeight: 700, marginTop: 'auto', fontStyle: 'italic' }}>
                "{goal}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HSMMethodSection;
