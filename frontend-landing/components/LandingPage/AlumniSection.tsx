'use client';
import React, { useState, useCallback, useRef } from 'react';

const TRINITY_URL = 'https://www.trinitycollege.com/qualifications/music/music-certificate-exams';
const BASE = 'https://www.trinitycollege.com/qualifications/music/music-certificate-exams';

const instruments = [
  { name: 'Guitar',   icon: '🎸', url: `${BASE}/guitar` },
  { name: 'Keyboard', icon: '🎹', url: `${BASE}/electronic-keyboard` },
  { name: 'Piano',    icon: '🎹', url: `${BASE}/piano` },
  { name: 'Tabla',    icon: '🪘', url: `${BASE}/percussion` },
  { name: 'Drums',    icon: '🥁', url: `${BASE}/percussion` },
  { name: 'Octopad',  icon: '🎛️', url: `${BASE}/percussion` },
  { name: 'Violin',   icon: '🎻', url: `${BASE}/strings` },
];

const AlumniSection: React.FC = () => {
  const [deckIndex, setDeckIndex] = useState(0);
  const touchStartX = useRef(0);
  const total = instruments.length;

  const nextCard = useCallback(() => setDeckIndex(i => (i + 1) % total), [total]);
  const prevCard = useCallback(() => setDeckIndex(i => (i - 1 + total) % total), [total]);

  const cardPosition = (idx: number) => {
    const pos = (idx - deckIndex + total) % total;
    if (pos === 0) return 'deck-card--active';
    if (pos === 1) return 'deck-card--behind-1';
    if (pos === 2) return 'deck-card--behind-2';
    return 'deck-card--hidden';
  };

  return (
    <section className="stack-section logos-section">
      <div className="container section-padding" style={{ textAlign: 'center' }}>

        {/* Trinity badge */}
        <a
          href={TRINITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 999, padding: '0.4rem 1.1rem',
            fontSize: '0.8rem', fontWeight: 700, color: '#1e293b',
            textDecoration: 'none', letterSpacing: '0.04em',
            textTransform: 'uppercase', marginBottom: '1.5rem',
          }}
        >
          <span style={{ fontSize: '1rem' }}>🎓</span>
          Trinity College London &nbsp;·&nbsp; Learn more →
        </a>

        <span className="section-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Internationally Recognised</span>
        <h2 className="section-title serif-heading" style={{ marginBottom: '1rem' }}>
          We follow the Trinity College London syllabus
        </h2>
        <p className="text-muted" style={{ maxWidth: '560px', margin: '0 auto 2.5rem' }}>
          Our teaching across 7 instruments is structured around the Trinity College London
          graded exam syllabus — Grade 1 through Grade 8. Trinity exams celebrate each learner's
          unique strengths, offer flexibility in repertoire, and provide clear progression milestones
          recognised worldwide.
        </p>

        {/* Desktop: 4-column grid */}
        <div className="trinity-grid--desktop" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          maxWidth: 720,
          margin: '0 auto',
        }}>
          {instruments.map(({ name, icon, url }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="pop-shadow"
              style={{
                display: 'block',
                background: 'var(--bg-tertiary)',
                borderRadius: 14,
                padding: '1.1rem 0.75rem',
                textAlign: 'center',
                border: '1px solid rgba(0,0,0,0.05)',
                textDecoration: 'none',
                transition: 'border-color 0.2s, transform 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-orange)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.05)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-heading)', marginBottom: '0.2rem' }}>{name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Grade 1 – 8</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--brand-orange)', marginTop: '0.3rem', fontWeight: 600 }}>View syllabus →</div>
            </a>
          ))}
        </div>

        {/* Mobile: stacked deck */}
        <div className="instrument-deck trinity-deck">
          <div
            className="deck-stack"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const dx = touchStartX.current - e.changedTouches[0].clientX;
              if (dx > 40) nextCard();
              else if (dx < -40) prevCard();
            }}
          >
            {instruments.map((inst, idx) => {
              const pos = cardPosition(idx);
              return (
                <div
                  key={inst.name}
                  className={`deck-card ${pos}`}
                  onClick={pos === 'deck-card--active' ? nextCard : undefined}
                  style={{ justifyContent: 'center', gap: '0.75rem' }}
                >
                  <div style={{ fontSize: '3.5rem' }}>{inst.icon}</div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                    {inst.name}
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                    Grade 1 – 8
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0, lineHeight: 1.5 }}>
                    Structured syllabus recognised worldwide
                  </p>
                  {pos === 'deck-card--active' && (
                    <a
                      href={inst.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-cta"
                      onClick={e => e.stopPropagation()}
                      style={{ marginTop: '0.5rem', textDecoration: 'none', width: '100%', justifyContent: 'center' }}
                    >
                      View Syllabus →
                    </a>
                  )}
                  {pos === 'deck-card--active' && (
                    <p className="deck-tap-hint">Tap card to browse · swipe to jump</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="deck-footer">
            <div className="deck-dots">
              {instruments.map((_, i) => (
                <button
                  key={i}
                  className={`deck-dot${i === deckIndex ? ' deck-dot--active' : ''}`}
                  onClick={() => setDeckIndex(i)}
                  aria-label={`Go to ${instruments[i].name}`}
                />
              ))}
            </div>
            <span className="deck-counter">{deckIndex + 1} / {total}</span>
          </div>
        </div>

      </div>
    </section>
  );
};

export default AlumniSection;
