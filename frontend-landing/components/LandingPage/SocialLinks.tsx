import React from 'react';
import { SOCIAL_LINKS } from '@/lib/socialLinks';

interface SocialLinksProps {
  className?: string;
}

const SocialLinks: React.FC<SocialLinksProps> = ({ className }) => (
  <div className={className}>
    <a
      href={SOCIAL_LINKS.instagram}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="HSM on Instagram"
      className="social-icon-link"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
      </svg>
    </a>
    <a
      href={SOCIAL_LINKS.facebook}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="HSM on Facebook"
      className="social-icon-link"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M15 8.5h2.5V5h-2.5c-2.21 0-4 1.79-4 4v2H9v3.5h2v6.5h3.5V14.5H17l.5-3.5h-3v-2c0-.55.45-.5 1-.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  </div>
);

export default SocialLinks;
