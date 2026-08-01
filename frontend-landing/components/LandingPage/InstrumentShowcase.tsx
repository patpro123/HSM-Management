'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { INSTRUMENTS } from '@/lib/instruments';
import guitarPhoto from '@/app/[instrument]/guitar.webp';
import baseGuitarPhoto from '@/app/[instrument]/base_guitar.webp';
import keyboardPhoto from '@/app/[instrument]/keyboard.webp';
import pianoPhoto from '@/app/[instrument]/piano.webp';
import drumsPhoto from '@/app/[instrument]/drums.webp';
import octopadPhoto from '@/app/[instrument]/octopad.jpeg';
import violinPhoto from '@/app/[instrument]/violin.jpg';
import vocalsPhoto from '@/app/[instrument]/vocals.webp';

const CARD_PHOTOS: Partial<Record<string, typeof guitarPhoto>> = {
  guitar: guitarPhoto,
  bass_guitar: baseGuitarPhoto,
  keyboard: keyboardPhoto,
  piano: pianoPhoto,
  drums: drumsPhoto,
  octopad: octopadPhoto,
  violin: violinPhoto,
  tabla: vocalsPhoto,
  hindustani: vocalsPhoto,
  carnatic: vocalsPhoto,
};

interface InstrumentShowcaseProps {
  onOpenModal: (e: React.MouseEvent, instrument?: string) => void;
}

const InstrumentShowcase: React.FC<InstrumentShowcaseProps> = ({ onOpenModal }) => {
  const router = useRouter();
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
            <Link href={`/${inst.slug}`} className="instrument-card pop-shadow" key={inst.id}>
              {CARD_PHOTOS[inst.id] ? (
                <div className="instrument-photo">
                  <Image src={CARD_PHOTOS[inst.id]!} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div className="instrument-icon">{inst.icon}</div>
              )}
              <h3 className="instrument-name">{inst.name}</h3>
              <p className="instrument-desc">{inst.desc}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--brand-orange)', fontWeight: 600, marginTop: '0.5rem' }}>View details &amp; book a demo →</span>
            </Link>
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
                  onClick={() => router.push(`/${inst.slug}`)}
                >
                  {CARD_PHOTOS[inst.id] ? (
                    <div className="instrument-photo instrument-photo--lg">
                      <Image src={CARD_PHOTOS[inst.id]!} alt="" fill sizes="96px" style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div className="instrument-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>{inst.icon}</div>
                  )}
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
                    <p className="deck-tap-hint">Tap card for details · swipe or use arrows to browse</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="deck-footer">
            <div className="deck-nav-row">
              <button className="deck-arrow" onClick={prevCard} aria-label="Previous instrument">‹</button>
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
              <button className="deck-arrow" onClick={nextCard} aria-label="Next instrument">›</button>
            </div>
            <span className="deck-counter">{deckIndex + 1} / {total}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InstrumentShowcase;
