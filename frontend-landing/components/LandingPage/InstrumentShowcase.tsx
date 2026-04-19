import React, { useRef, useEffect } from 'react';

interface InstrumentShowcaseProps {
  onOpenModal: (e: React.MouseEvent, instrument?: string) => void;
}

const INSTRUMENTS = [
  { id: 'guitar', name: 'Guitar', icon: '🎸', desc: 'Most popular worldwide — acoustic to electric' },
  { id: 'keyboard', name: 'Keyboard', icon: '🎹', desc: 'Build musical foundations fast — ideal first instrument' },
  { id: 'piano', name: 'Piano', icon: '🎹', desc: 'Classical elegance; read music, compose, perform' },
  { id: 'tabla', name: 'Tabla', icon: '🪘', desc: "India's heartbeat — rhythm, tradition, discipline" },
  { id: 'drums', name: 'Drums', icon: '🥁', desc: 'Rhythm, coordination, and confidence on stage' },
  { id: 'octopad', name: 'Octopad', icon: '🎛️', desc: 'Electronic percussion — versatile, modern, exciting' },
  { id: 'violin', name: 'Violin', icon: '🎻', desc: 'Versatile across classical, folk, and film music' },
  { id: 'hindustani', name: 'Hindustani Classical', icon: '🎤', desc: 'North Indian classical — raga, taal, expression' },
  { id: 'carnatic', name: 'Carnatic Classical', icon: '🎤', desc: 'South Indian classical — precise, devotional, powerful' },
];

const InstrumentShowcase: React.FC<InstrumentShowcaseProps> = ({ onOpenModal }) => {
  const instrumentGridRef = useRef<HTMLDivElement>(null);

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
      const gap = 16;
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

  return (
    <section className="stack-section instrument-showcase" id="programs">
      <div className="container center-content section-padding">
        <span className="section-label">Find your sound</span>
        <h2 className="section-title serif-heading">What Would You Like to Learn?</h2>
        <p className="body-text feature-sub text-center" style={{ marginBottom: '3rem' }}>
          Classical Indian. Contemporary Western. Under one roof.
        </p>

        <div className="instrument-grid" ref={instrumentGridRef}>
          {INSTRUMENTS.map(inst => (
            <div
              className="instrument-card pop-shadow"
              key={inst.id}
              onClick={(e) => onOpenModal(e, inst.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onOpenModal(e as any, inst.id)}
            >
              <div className="instrument-icon">{inst.icon}</div>
              <h3 className="instrument-name">{inst.name}</h3>
              <p className="instrument-desc">{inst.desc}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--brand-orange)', fontWeight: 600, marginTop: '0.5rem' }}>Enquire →</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InstrumentShowcase;
