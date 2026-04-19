import React from 'react';

interface Faq {
  q: string;
  a: string;
}

interface FaqSectionProps {
  faqs: Faq[];
  activeFaq: number | null;
  onToggle: (idx: number) => void;
}

const FaqSection: React.FC<FaqSectionProps> = ({ faqs, activeFaq, onToggle }) => {
  return (
    <section className="stack-section faq-section bg-white" id="faq">
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">You asked, we answered</span>
          <h2 className="section-title serif-heading">Frequently Asked Questions</h2>
        </div>

        <div className="faq-accordion max-w-3xl mx-auto">
          {faqs.map((faq, idx) => (
            <div className="faq-item" key={idx}>
              <button
                className="faq-question"
                onClick={() => onToggle(idx)}
              >
                {faq.q}
                <span className={`faq-icon ${activeFaq === idx ? 'open' : ''}`}>+</span>
              </button>
              <div className={`faq-answer ${activeFaq === idx ? 'open' : ''}`}>
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
