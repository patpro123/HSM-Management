'use client';

import React, { useState, useEffect } from 'react';

interface PromoBannerProps {
  onVisibilityChange: (visible: boolean) => void;
}

const DISMISS_KEY = 'hsm_promo_dismissed_v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_DAY = new Date('2026-06-13T10:00:00+05:30');

function getCountdown(): { days: number; hours: number } | null {
  const diff = DEMO_DAY.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
  };
}

const PromoBanner: React.FC<PromoBannerProps> = ({ onVisibilityChange }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number } | null>(null);

  useEffect(() => {
    const dismissedTime = localStorage.getItem(DISMISS_KEY);
    if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > ONE_DAY_MS) {
      setIsVisible(true);
      onVisibilityChange(true);
    } else {
      onVisibilityChange(false);
    }
  }, [onVisibilityChange]);

  useEffect(() => {
    setCountdown(getCountdown());
    const timer = setInterval(() => setCountdown(getCountdown()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
    onVisibilityChange(false);
  };

  if (!isVisible) return null;

  const countdownLabel = countdown
    ? ` — ${countdown.days}d ${countdown.hours}h to go`
    : '';

  return (
    <div className="promo-banner" id="promoBanner">
      <div className="promo-banner-content">
        <span className="promo-banner-text">
          🎉 Demo Day: Sat June 13{countdownLabel}. Try any instrument free at our Kismatpur studio.
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
