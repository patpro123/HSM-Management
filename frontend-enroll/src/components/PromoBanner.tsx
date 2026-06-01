import React, { useState, useEffect } from 'react';

interface FlashConfig {
  demo_day_title?: string;
  demo_day_date?: string;
  demo_day_link_enabled?: boolean;
}

interface PromoBannerProps {
  onVisibilityChange: (visible: boolean) => void;
  enabled?: boolean;
  flashConfig?: FlashConfig;
}

const DISMISS_KEY = 'hsm_promo_dismissed_v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function formatBannerDate(isoDate?: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

function getCountdown(isoDate?: string): { days: number; hours: number } | null {
  if (!isoDate) return null;
  const target = new Date(isoDate + 'T10:00:00+05:30');
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

const PromoBanner: React.FC<PromoBannerProps> = ({ onVisibilityChange, enabled = true, flashConfig }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      onVisibilityChange(false);
      return;
    }
    const dismissedTime = localStorage.getItem(DISMISS_KEY);
    if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > ONE_DAY_MS) {
      setIsVisible(true);
      onVisibilityChange(true);
    } else {
      onVisibilityChange(false);
    }
  }, [enabled, onVisibilityChange]);

  useEffect(() => {
    setCountdown(getCountdown(flashConfig?.demo_day_date));
    const timer = setInterval(() => setCountdown(getCountdown(flashConfig?.demo_day_date)), 60000);
    return () => clearInterval(timer);
  }, [flashConfig?.demo_day_date]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
    onVisibilityChange(false);
  };

  if (!isVisible) return null;

  const title = flashConfig?.demo_day_title || 'Demo Day Special';
  const date = formatBannerDate(flashConfig?.demo_day_date);
  const raw = date ? `🎉 ${title} — ${date}` : `🎉 ${title}`;
  const bannerText = truncate(raw, 80);
  const showLink = flashConfig?.demo_day_link_enabled ?? true;

  return (
    <div className="promo-banner" id="promoBanner">
      <div className="promo-banner-content">
        <span className="promo-banner-text">
          {bannerText}
          {countdown && (
            <span className="promo-countdown"> · {countdown.days}d {countdown.hours}h to go</span>
          )}
        </span>
        {showLink && (
          <a href="/demoday" className="promo-banner-btn">
            Claim Your Free Slot
          </a>
        )}
      </div>
      <button className="promo-banner-close" onClick={handleDismiss} aria-label="Dismiss promo banner">
        &times;
      </button>
    </div>
  );
};

export default PromoBanner;
