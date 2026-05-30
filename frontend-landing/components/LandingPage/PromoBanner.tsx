'use client';

import React, { useState, useEffect } from 'react';

interface PromoBannerProps {
  onVisibilityChange: (visible: boolean) => void;
}

const DISMISS_KEY = 'hsm_promo_dismissed_v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const PromoBanner: React.FC<PromoBannerProps> = ({ onVisibilityChange }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissedTime = localStorage.getItem(DISMISS_KEY);
    if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > ONE_DAY_MS) {
      setIsVisible(true);
      onVisibilityChange(true);
    } else {
      onVisibilityChange(false);
    }
  }, [onVisibilityChange]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
    onVisibilityChange(false);
  };

  if (!isVisible) return null;

  return (
    <div className="promo-banner" id="promoBanner">
      <div className="promo-banner-content">
        <span className="promo-banner-text">
          🎉 Special Demo Day on June 13th! Experience the HSM Method live in Peeramcheru.
        </span>
        <a href="/demoday" className="promo-banner-btn">
          Claim Your Free Slot
        </a>
      </div>
      <button className="promo-banner-close" onClick={handleDismiss} aria-label="Dismiss promo banner">
        &times;
      </button>
    </div>
  );
};

export default PromoBanner;
