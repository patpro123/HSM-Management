'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Teacher {
  id?: number;
  name: string;
  specialty?: string;
  experience?: string;
  quote?: string;
  metadata?: any;
}

interface TeachersSectionProps {
  teachers: Teacher[];
}

interface TeacherProfile {
  displayName?: string;
  specialty: string;
  icon: string;
  quote: string;
}

const TEACHER_PROFILES: Record<string, TeacherProfile> = {
  josva: {
    specialty: 'Keyboard · Guitar',
    icon: '🎸🎹',
    quote: '"The guitar and keyboard are two sides of the same musical coin — master one and the other opens up."',
  },
  david: {
    specialty: 'Piano',
    icon: '🎹',
    quote: '"Piano teaches you to listen to every voice simultaneously — it builds your musical mind from the ground up."',
  },
  shiva: {
    displayName: 'David',
    specialty: 'Piano',
    icon: '🎹',
    quote: '"Piano teaches you to listen to every voice simultaneously — it builds your musical mind from the ground up."',
  },
  subroto: {
    displayName: 'Subroto Bhaduri',
    specialty: 'Drums · Tabla · Octopad',
    icon: '🥁',
    quote: '"Rhythm is the heartbeat of all music. Before you play a note, you must first feel the pulse."',
  },
  subrata: {
    displayName: 'Subroto Bhaduri',
    specialty: 'Drums · Tabla · Octopad',
    icon: '🥁',
    quote: '"Rhythm is the heartbeat of all music. Before you play a note, you must first feel the pulse."',
  },
  issac: {
    displayName: 'Issac Lawrence',
    specialty: 'Violin',
    icon: '🎻',
    quote: '"Every string speaks. The violin gives voice to the emotions that words can never quite reach."',
  },
  lawrence: {
    displayName: 'Issac Lawrence',
    specialty: 'Violin',
    icon: '🎻',
    quote: '"Every string speaks. The violin gives voice to the emotions that words can never quite reach."',
  },
  sangeeta: {
    specialty: 'Hindustani Classical · Carnatic Classical',
    icon: '🎤',
    quote: '"Your voice is the most personal instrument you will ever own — train it and it stays with you forever."',
  },
};

const TeachersSection: React.FC<TeachersSectionProps> = ({ teachers }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const touchStartX = useRef(0);

  // Desktop carousel auto-scroll
  useEffect(() => {
    const el = gridRef.current;
    if (!el || teachers.length === 0) return;
    let isInteracting = false;
    const onTouch = () => { isInteracting = true; };
    const onTouchEnd = () => { setTimeout(() => { isInteracting = false; }, 2500); };
    el.addEventListener('touchstart', onTouch, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    const timer = setInterval(() => {
      if (isInteracting) return;
      const cardWidth = (el.firstElementChild as HTMLElement)?.offsetWidth ?? 280;
      const gap = parseFloat(getComputedStyle(el).gap) || 16;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + cardWidth + gap;
      el.scrollTo({ left: next >= maxScroll - 10 ? 0 : next, behavior: 'smooth' });
    }, 3200);
    return () => {
      clearInterval(timer);
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [teachers]);

  const seen = new Set<string>();
  const enriched = teachers
    .filter(t => {
      const key = (t.id ?? t.name).toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(t => {
      const profileKey = t.name.split(' ')[0].toLowerCase();
      const profile = TEACHER_PROFILES[profileKey];
      return {
        ...t,
        displayName: profile?.displayName || t.name,
        specialty: t.specialty || profile?.specialty || 'Instructor',
        icon: profile?.icon || '🎵',
        quote: t.quote || profile?.quote || '',
      };
    });

  const total = enriched.length;
  const next = useCallback(() => setDeckIndex(i => (i + 1) % total), [total]);
  const prev = useCallback(() => setDeckIndex(i => (i - 1 + total) % total), [total]);

  const cardPosition = (idx: number) => {
    const pos = (idx - deckIndex + total) % total;
    if (pos === 0) return 'deck-card--active';
    if (pos === 1) return 'deck-card--behind-1';
    if (pos === 2) return 'deck-card--behind-2';
    return 'deck-card--hidden';
  };

  return (
    <section className="stack-section teachers-section" id="teachers">
      <div className="container section-padding">
        <div className="text-center" style={{ marginBottom: '1.5rem' }}>
          <span className="section-label">Learn from working musicians</span>
          <h2 className="serif-heading" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.5rem)', marginBottom: 0 }}>
            Our teachers are performers first,<br />educators always.
          </h2>
        </div>

        {/* Desktop: horizontal carousel */}
        {enriched.length > 0 ? (
          <div className="teachers-carousel teachers-carousel--desktop" ref={gridRef}>
            {enriched.map((teacher, idx) => (
              <div className="teacher-card pop-shadow" key={teacher.id || idx}>
                <div className="teacher-icon-badge">{teacher.icon}</div>
                <div className="teacher-photo-wrapper">
                  <div className="teacher-photo-placeholder">{teacher.displayName.charAt(0)}</div>
                </div>
                <h3 className="teacher-name">{teacher.displayName}</h3>
                <p className="teacher-specialty text-orange">{teacher.specialty}</p>
                {teacher.quote && <p className="teacher-quote">{teacher.quote}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center teachers-carousel--desktop">Loading teachers...</p>
        )}

        {/* Mobile: stacked deck */}
        {enriched.length > 0 && (
          <div className="teacher-deck">
            <div
              className="deck-stack"
              onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={e => {
                const dx = touchStartX.current - e.changedTouches[0].clientX;
                if (dx > 40) next();
                else if (dx < -40) prev();
              }}
            >
              {enriched.map((teacher, idx) => (
                <div
                  key={teacher.id || idx}
                  className={`deck-card ${cardPosition(idx)}`}
                  onClick={cardPosition(idx) === 'deck-card--active' ? next : undefined}
                >
                  <div className="teacher-icon-badge">{teacher.icon}</div>
                  <div className="teacher-photo-wrapper">
                    <div className="teacher-photo-placeholder">{teacher.displayName.charAt(0)}</div>
                  </div>
                  <h3 className="teacher-name">{teacher.displayName}</h3>
                  <p className="teacher-specialty text-orange">{teacher.specialty}</p>
                  {teacher.quote && <p className="teacher-quote">{teacher.quote}</p>}
                  {cardPosition(idx) === 'deck-card--active' && (
                    <p className="deck-tap-hint">Tap to see next →</p>
                  )}
                </div>
              ))}
            </div>
            <div className="deck-footer">
              <div className="deck-dots">
                {enriched.map((_, i) => (
                  <button
                    key={i}
                    className={`deck-dot${i === deckIndex ? ' deck-dot--active' : ''}`}
                    onClick={() => setDeckIndex(i)}
                    aria-label={`Go to teacher ${i + 1}`}
                  />
                ))}
              </div>
              <span className="deck-counter">{deckIndex + 1} / {total}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default TeachersSection;
