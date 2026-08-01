'use client';

import React, { useState } from 'react';

interface Faq {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  faqs: Faq[];
}

/** Same collapse behavior/markup as the homepage's FaqSection, self-contained for reuse on subpages. */
const FaqAccordion: React.FC<FaqAccordionProps> = ({ faqs }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <div className="faq-accordion max-w-3xl mx-auto">
      {faqs.map((faq, idx) => (
        <div className="faq-item" key={idx}>
          <button
            className="faq-question"
            onClick={() => setActiveIdx(activeIdx === idx ? null : idx)}
          >
            {faq.q}
            <span className={`faq-icon ${activeIdx === idx ? 'open' : ''}`}>+</span>
          </button>
          <div className={`faq-answer ${activeIdx === idx ? 'open' : ''}`}>
            <div className="faq-answer-inner">
              <p>{faq.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FaqAccordion;
