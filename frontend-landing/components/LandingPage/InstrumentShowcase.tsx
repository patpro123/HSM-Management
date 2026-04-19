'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface InstrumentShowcaseProps {
  onOpenModal: (e: React.MouseEvent, instrument?: string) => void;
}

const INSTRUMENTS = [
  { id: 'guitar',      name: 'Guitar',               icon: '🎸', desc: 'Most popular worldwide — acoustic to electric' },
  { id: 'keyboard',    name: 'Keyboard',              icon: '🎹', desc: 'Build musical foundations fast — ideal first instrument' },
  { id: 'piano',       name: 'Piano',                 icon: '🎹', desc: 'Classical elegance; read music, compose, perform' },
  { id: 'tabla',       name: 'Tabla',                 icon: '🪘', desc: "India's heartbeat — rhythm, tradition, discipline" },
  { id: 'drums',       name: 'Drums',                 icon: '🥁', desc: 'Rhythm, coordination, and confidence on stage' },
  { id: 'octopad',     name: 'Octopad',               icon: '🎛️', desc: 'Electronic percussion — versatile, modern, exciting' },
  { id: 'violin',      name: 'Violin',                icon: '🎻', desc: 'Versatile across classical, folk, and film music' },
  { id: 'hindustani',  name: 'Hindustani Classical',  icon: '🎤', desc: 'North Indian classical — raga, taal, expression' },
  { id: 'carnatic',    name: 'Carnatic Classical',    icon: '🎤', desc: 'South Indian classical — precise, devotional, powerful' },
];

const InstrumentShowcase: React.FC<InstrumentShowcaseProps> = ({ onOpenModal }) => {
  const instrumentGridRef = useRef<HTMLDivElement>(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const touchStartX = useRef(0);
  const total = INSTRUMENTS.length;

  // Desktop carousel auto-scroll
  useEffect(() => {
    const el = instrumentGridRef.current;
    if (!el) return;
    let isInteracting = false;
    const onTouch = () => { isInteracting = true; };
    const onTouchEnd = () => { setTimeout(() => { isInteracting = false; }, 2500); };
    el.addEventListener('touchstart', onTouch, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    const timer = setInterval(() => {
      if (isInteracting) return;
      const cardWidth = (el.firstElementChild as HTMLElement)?.offsetWidth ?? window.innerWidth * 0.75;
      const gap = parseFloat(getComputedStyle(el).gap) || 16;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + cardWidth + gap;
      el.scrollTo({ left: next >= maxScroll - 10 ? 0 : next, behavior: 'smooth' });
    }, 3000);
    return () => {
      clearInterval(timer);
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

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
    <section className="stack-section instrument-showcase" id="programs">
      <div className="container center-content section-padding">
        <span className="section-label">Find your sound</span>
        <h2 className="serif-heading" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.5rem)', marginBottom: '0.75rem' }}>
          What Would You Like to Learn?
        </h2>
        <p className="body-text feature-sub text-center" style={{ marginBottom: '2rem' }}>
          Classical Indian. Contemporary Western. Under one roof.
        </p>

        {/* Desktop: grid */}
        <div className="instrument-grid instrument-grid--desktop" ref={instrumentGridRef}>
          {INSTRUMENTS.map(inst => (
            <div
              className="instrument-card pop-shadow"
              key={inst.id}
              onClick={e => onOpenModal(e, inst.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onOpenModal(e as any, inst.id)}
            >
              <div className="instrument-icon">{inst.icon}</div>
              <h3 className="instrument-name">{inst.name}</h3>
              <p className="instrument-desc">{inst.desc}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--brand-orange)', fontWeight: 600, marginTop: '0.5rem' }}>Enquire →</span>
            </div>
          ))}
        </div>

        {/* Mobile: stacked deck */}
        <div className="instrument-deck">
          <div
            className="deck-stack"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const dx = touchStartX.current - e.changedTouches[0].clientX;
              if (dx > 40) nextCard();
              else if (dx < -40) prevCard();
            }}
          >
            {INSTRUMENTS.map((inst, idx) => {
              const pos = cardPosition(idx);
              return (
                <div
                  key={inst.id}
                  className={`deck-card instrument-deck-card ${pos}`}
                  onClick={pos === 'deck-card--active' ? nextCard : undefined}
                >
                  <div className="instrument-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>{inst.icon}</div>
                  <h3 className="instrument-name" style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>{inst.name}</h3>
                  <p className="instrument-desc" style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>{inst.desc}</p>
                  {pos === 'deck-card--active' && (
                    <button
                      className="btn btn-cta"
                      onClick={e => { e.stopPropagation(); onOpenModal(e, inst.id); }}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Book Free Demo
                    </button>
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
              {INSTRUMENTS.map((_, i) => (
                <button
                  key={i}
                  className={`deck-dot${i === deckIndex ? ' deck-dot--active' : ''}`}
                  onClick={() => setDeckIndex(i)}
                  aria-label={`Go to ${INSTRUMENTS[i].name}`}
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

export default InstrumentShowcase;
