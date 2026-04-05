import React, { useRef, useEffect } from 'react';

interface Teacher {
  id?: number;
  name: string;
  specialty?: string;
  experience?: string;
  quote?: string;
}

interface TeachersSectionProps {
  teachers: Teacher[];
}

const TeachersSection: React.FC<TeachersSectionProps> = ({ teachers }) => {
  const teachersGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = teachersGridRef.current;
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
    <section className="stack-section teachers-section" id="teachers">
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">Learn from working musicians</span>
          <h2 className="section-title serif-heading">Our teachers are performers first,<br />educators always.</h2>
        </div>
        <div className="teachers-grid mt-4" ref={teachersGridRef}>
          {teachers.length > 0 ? teachers.map((teacher, idx) => (
            <div className="teacher-card pop-shadow" key={teacher.id || idx}>
              <div className="teacher-photo-wrapper">
                <div className="teacher-photo-placeholder">
                  {teacher.name.charAt(0)}
                </div>
              </div>
              <h3 className="teacher-name">{teacher.name}</h3>
              <p className="teacher-specialty text-orange">{teacher.specialty || 'Instructor'}</p>
              <p className="teacher-exp text-muted">{teacher.experience || 'Experienced Educator'}</p>
              <p className="teacher-quote">
                {teacher.quote || '"Music is life itself."'}
              </p>
            </div>
          )) : (
            <p className="text-center w-full">Loading teachers...</p>
          )}
        </div>
        <div className="text-center mt-5">
          <a href="#schedule" className="btn btn-outline">See All Teachers →</a>
        </div>
      </div>
    </section>
  );
};

export default TeachersSection;
