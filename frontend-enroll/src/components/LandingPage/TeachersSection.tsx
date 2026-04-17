import React, { useRef, useEffect } from 'react';

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

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    let isInteracting = false;
    const onTouch = () => { isInteracting = true; };
    const onTouchEnd = () => { setTimeout(() => { isInteracting = false; }, 2500); };
    el.addEventListener('touchstart', onTouch, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    const timer = setInterval(() => {
      if (isInteracting) return;
      const cardWidth = (el.firstElementChild as HTMLElement)?.offsetWidth ?? 280;
      const gap = 24;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + cardWidth + gap;
      el.scrollTo({ left: next >= maxScroll - 10 ? 0 : next, behavior: 'smooth' });
    }, 3200);
    return () => {
      clearInterval(timer);
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const enriched = teachers.map(t => {
    const key = t.name.split(' ')[0].toLowerCase();
    const profile = TEACHER_PROFILES[key];
    return {
      ...t,
      displayName: profile?.displayName || t.name,
      specialty: t.specialty || profile?.specialty || 'Instructor',
      icon: profile?.icon || '🎵',
      quote: t.quote || profile?.quote || '',
    };
  });

  return (
    <section className="stack-section teachers-section" id="teachers">
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">Learn from working musicians</span>
          <h2 className="section-title serif-heading">Our teachers are performers first,<br />educators always.</h2>
        </div>

        {enriched.length > 0 ? (
          <div className="teachers-carousel" ref={gridRef}>
            {enriched.map((teacher, idx) => (
              <div className="teacher-card pop-shadow" key={teacher.id || idx}>
                <div className="teacher-icon-badge">{teacher.icon}</div>
                <div className="teacher-photo-wrapper">
                  <div className="teacher-photo-placeholder">
                    {teacher.displayName.charAt(0)}
                  </div>
                </div>
                <h3 className="teacher-name">{teacher.displayName}</h3>
                <p className="teacher-specialty text-orange">{teacher.specialty}</p>
                {teacher.quote && (
                  <p className="teacher-quote">{teacher.quote}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center">Loading teachers...</p>
        )}
      </div>
    </section>
  );
};

export default TeachersSection;
