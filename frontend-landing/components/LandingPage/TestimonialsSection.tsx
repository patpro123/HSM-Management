import React, { useLayoutEffect, useRef, useState } from 'react';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  initials: string;
  color: string;
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  testimonialIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSetIndex: (idx: number) => void;
}

const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({
  testimonials,
  testimonialIndex,
  onNext,
  onPrev,
  onSetIndex,
}) => {
  // Testimonials vary a lot in length (one is ~4x the others). Without a fixed
  // height, the carousel resizes on every rotation and shoves the rest of the
  // page up/down. Measure every quote's natural height off-screen and lock the
  // carousel to the tallest one instead.
  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [carouselHeight, setCarouselHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const measure = () => {
      const heights = measureRefs.current.map(el => el?.offsetHeight ?? 0);
      const max = Math.max(0, ...heights);
      if (max > 0) setCarouselHeight(max);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [testimonials]);

  return (
    <section className="stack-section testimonials-section bg-secondary" id="stories">
      <div className="container section-padding text-center">
        <span className="section-label">What our families say</span>
        <h2 className="section-title serif-heading mb-5">Stories from the HSM community</h2>

        {/* Off-screen clones used only to measure each testimonial's natural height. */}
        <div aria-hidden="true" style={{ height: 0, overflow: 'hidden', visibility: 'hidden' }}>
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              ref={el => { measureRefs.current[idx] = el; }}
              className="testimonial-carousel mx-auto"
            >
              <div className="testimonial-content">
                <div className="reviewer-header">
                  <div className="reviewer-initials" style={{ background: t.color }}>{t.initials}</div>
                  <div className="reviewer-info">
                    <p className="testimonial-author">{t.author}</p>
                    <p className="reviewer-time">{t.role}</p>
                  </div>
                  <span className="google-g-badge">G</span>
                </div>
                <div className="testimonial-stars text-orange">★★★★★</div>
                <p className="testimonial-quote">"{t.quote}"</p>
              </div>
              <div className="carousel-controls mt-4">
                <button className="carousel-btn">&larr;</button>
                <div className="carousel-dots">
                  {testimonials.map((_, i) => <span key={i} className="dot" />)}
                </div>
                <button className="carousel-btn">&rarr;</button>
              </div>
            </div>
          ))}
        </div>

        <div
          className="testimonial-carousel pop-shadow bg-white mx-auto relative cursor-pointer"
          onClick={onNext}
          style={carouselHeight ? { minHeight: carouselHeight } : undefined}
        >
          <div className="testimonial-content fade-in" key={testimonialIndex}>
            <div className="reviewer-header">
              <div className="reviewer-initials" style={{ background: testimonials[testimonialIndex].color }}>
                {testimonials[testimonialIndex].initials}
              </div>
              <div className="reviewer-info">
                <p className="testimonial-author">{testimonials[testimonialIndex].author}</p>
                <p className="reviewer-time">{testimonials[testimonialIndex].role}</p>
              </div>
              <span className="google-g-badge" title="Google review">G</span>
            </div>
            <div className="testimonial-stars text-orange">★★★★★</div>
            <p className="testimonial-quote">
              "{testimonials[testimonialIndex].quote}"
            </p>
          </div>
          <div className="carousel-controls mt-4">
            <button className="carousel-btn" onClick={(e) => { e.stopPropagation(); onPrev(); }}>&larr;</button>
            <div className="carousel-dots">
              {testimonials.map((_, idx) => (
                <span
                  key={idx}
                  className={`dot ${idx === testimonialIndex ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onSetIndex(idx); }}
                ></span>
              ))}
            </div>
            <button className="carousel-btn" onClick={(e) => { e.stopPropagation(); onNext(); }}>&rarr;</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
