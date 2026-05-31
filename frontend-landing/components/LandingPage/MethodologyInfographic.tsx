import React from 'react';

const LOOP_STEPS = [
  { num: '1', icon: '📋', title: 'Teacher Assigns',  sub: 'Homework + audio brief' },
  { num: '2', icon: '⏱️', title: 'Daily Practice',   sub: '20 min, tracked in portal' },
  { num: '3', icon: '📱', title: 'Student Records',  sub: 'Audio/video self-check' },
  { num: '4', icon: '🔍', title: 'Teacher Reviews',  sub: 'Same-day feedback' },
  { num: '5', icon: '📊', title: 'Assessment',       sub: 'Monthly Trinity grade' },
];

const STATS = [
  { num: '20 min', sub: 'daily practice sessions' },
  { num: '6×',     sub: 'more teacher touchpoints per week' },
  { num: '100%',   sub: 'Trinity exam Merit / Distinction rate' },
];

const MethodologyInfographic: React.FC = () => (
  <section className="stack-section" id="method-visual" style={{ background: 'var(--bg-secondary, #f8fafc)' }}>
    <div className="container section-padding">

      <div className="text-center mb-5">
        <span className="section-label">Hyderabad's First</span>
        <h2 className="section-title serif-heading">
          The Only Music School in Hyderabad<br />Training Students for All 167 Hours
        </h2>
        <p className="text-muted" style={{ maxWidth: 540, margin: '0.85rem auto 0', lineHeight: 1.65 }}>
          Every other school teaches the 1 hour you're in class. HSM built a system for the rest of the week —
          daily habit tracking, homework review, and self-recording that closes the loop before the next session.
        </p>
      </div>

      {/* Feedback Loop */}
      <div style={{ maxWidth: 880, margin: '0 auto 2.5rem' }}>
        <p style={{
          textAlign: 'center', fontWeight: 700, fontSize: '0.82rem',
          color: 'var(--text-muted)', letterSpacing: '0.04em',
          textTransform: 'uppercase', marginBottom: '1.25rem',
        }}>
          How it works — repeats every week
        </p>
        <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', gap: 0, paddingBottom: 4 }}>
          {LOOP_STEPS.map((step, i) => (
            <React.Fragment key={step.num}>
              <div style={{
                flex: '1 0 130px', minWidth: 118,
                background: '#fff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 14,
                padding: '1rem 0.65rem',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{step.icon}</div>
                <div style={{
                  width: 22, height: 22,
                  background: 'var(--brand-orange, #f26b38)',
                  borderRadius: '50%', color: '#fff',
                  fontSize: '0.65rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.45rem',
                }}>{step.num}</div>
                <div style={{ fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-heading)', marginBottom: '0.25rem', lineHeight: 1.3 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {step.sub}
                </div>
              </div>
              {i < LOOP_STEPS.length - 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '0 0.25rem',
                  color: 'var(--brand-orange, #f26b38)', fontSize: '1.1rem', fontWeight: 900, flexShrink: 0,
                }}>→</div>
              )}
            </React.Fragment>
          ))}
          <div title="returns to step 1" style={{
            display: 'flex', alignItems: 'center', padding: '0 0.25rem',
            color: 'var(--brand-orange, #f26b38)', fontSize: '1.1rem', fontWeight: 900, flexShrink: 0,
          }}>↩</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem', maxWidth: 620, margin: '0 auto',
      }}>
        {STATS.map(s => (
          <div key={s.num} style={{
            textAlign: 'center', background: '#fff',
            borderRadius: 12, padding: '1rem 0.75rem',
            border: '1.5px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-orange, #f26b38)', lineHeight: 1 }}>
              {s.num}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.4rem', lineHeight: 1.4 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

    </div>
  </section>
);

export default MethodologyInfographic;
