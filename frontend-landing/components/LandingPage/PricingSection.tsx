'use client';
import React, { useCallback, useRef, useState } from 'react';
import { PLANS } from '@/lib/plans';

interface PricingSectionProps {
  onOpenModal: (e: React.MouseEvent) => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({ onOpenModal }) => {
  const total = PLANS.length;
  const [deckIndex, setDeckIndex] = useState(0);
  const touchStartX = useRef(0);

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
    <section className="stack-section bg-white" id="pricing">
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">Plans &amp; fees</span>
          <h2 className="section-title serif-heading">Simple pricing, no surprises</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Start with a free demo. Move to a Trial Pack whenever you&apos;re ready.
          </p>
        </div>

        {/* Desktop: grid */}
        <div
          className="pricing-grid--desktop"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem', maxWidth: 900, margin: '0 auto' }}
        >
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className="pop-shadow"
              style={{
                background: plan.highlight ? 'var(--brand-navy)' : '#fff',
                color: plan.highlight ? '#fff' : 'var(--text-heading)',
                borderRadius: 16,
                padding: '1.75rem 1.5rem',
                border: plan.highlight ? 'none' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.35rem' }}>{plan.name}</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem', color: plan.highlight ? '#fff' : 'var(--brand-orange)' }}>
                {plan.priceLabel}
              </p>
              <p style={{ fontSize: '0.85rem', opacity: plan.highlight ? 0.85 : undefined, color: plan.highlight ? undefined : 'var(--text-muted)', margin: '0 0 1rem' }}>
                {plan.classes} class{plan.classes === 1 ? '' : 'es'}
              </p>
              <p style={{ fontSize: '0.9rem', margin: 0, color: plan.highlight ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}>
                {plan.description}
              </p>
            </div>
          ))}
        </div>

        {/* Mobile: swipeable deck */}
        <div className="pricing-deck instrument-deck">
          <div
            className="deck-stack"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const dx = touchStartX.current - e.changedTouches[0].clientX;
              if (dx > 40) nextCard();
              else if (dx < -40) prevCard();
            }}
          >
            {PLANS.map((plan, idx) => {
              const pos = cardPosition(idx);
              return (
                <div
                  key={plan.name}
                  className={`deck-card pricing-deck-card ${pos}`}
                  style={plan.highlight ? { background: 'var(--brand-navy)', color: '#fff' } : undefined}
                  onClick={pos === 'deck-card--active' ? nextCard : undefined}
                >
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{plan.name}</h3>
                  <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.35rem', color: plan.highlight ? '#fff' : 'var(--brand-orange)' }}>
                    {plan.priceLabel}
                  </p>
                  <p style={{ fontSize: '0.85rem', margin: '0 0 1rem', opacity: plan.highlight ? 0.85 : undefined, color: plan.highlight ? undefined : 'var(--text-muted)' }}>
                    {plan.classes} class{plan.classes === 1 ? '' : 'es'}
                  </p>
                  <p style={{ fontSize: '0.9rem', margin: 0, color: plan.highlight ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}>
                    {plan.description}
                  </p>
                  {pos === 'deck-card--active' && (
                    <button
                      className="btn btn-cta"
                      onClick={e => { e.stopPropagation(); onOpenModal(e); }}
                      style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                    >
                      Book your free demo →
                    </button>
                  )}
                  {pos === 'deck-card--active' && (
                    <p className="deck-tap-hint">Tap card for next plan · swipe to browse</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="deck-footer">
            <div className="deck-dots">
              {PLANS.map((_, i) => (
                <button
                  key={i}
                  className={`deck-dot${i === deckIndex ? ' deck-dot--active' : ''}`}
                  onClick={() => setDeckIndex(i)}
                  aria-label={`Go to ${PLANS[i].name}`}
                />
              ))}
            </div>
            <span className="deck-counter">{deckIndex + 1} / {total}</span>
          </div>
        </div>

        <div className="text-center mt-5">
          <button onClick={onOpenModal} className="btn btn-primary">Book your free demo →</button>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
