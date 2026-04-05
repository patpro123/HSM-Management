import React from 'react';

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
  return (
    <section className="stack-section testimonials-section bg-secondary" id="stories">
      <div className="container section-padding text-center">
        <span className="section-label">What our families say</span>
        <h2 className="section-title serif-heading mb-5">Stories from the HSM community</h2>

        <div
          className="testimonial-carousel pop-shadow bg-white mx-auto relative cursor-pointer"
          onClick={onNext}
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
