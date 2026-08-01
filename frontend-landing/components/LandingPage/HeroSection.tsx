import React from 'react';
import { SITE_STATS } from '@/lib/siteStats';

interface HeroSectionProps {
  onOpenModal: (e: React.MouseEvent, instrument?: string, isDemoDay?: boolean) => void;
  flashConfig?: {
    demo_day_title: string;
    demo_day_description: string;
    demo_day_link_enabled: boolean;
    demo_day_location: string;
    demo_day_date: string;
    demo_day_instruments: string[];
    piano_teacher_title: string;
    piano_teacher_description: string;
  } | null;
}

const TERM_WEEKS = 12;
const TERM_DAYS = 7;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CLASS_DAY_INDICES = Array.from(
  { length: SITE_STATS.weeklyClassesPerStudent },
  (_, i) => Math.round(((i + 1) * TERM_DAYS) / (SITE_STATS.weeklyClassesPerStudent + 1)) - 1
);

type CellState = 'class' | 'practice' | 'rest';

function cellState(week: number, day: number): CellState {
  if (CLASS_DAY_INDICES.includes(day)) return 'class';
  return (week * 3 + day * 5) % 7 !== 0 ? 'practice' : 'rest';
}

const TERM_CLASS_COUNT = TERM_WEEKS * CLASS_DAY_INDICES.length;

const HeroSection: React.FC<HeroSectionProps> = ({ onOpenModal, flashConfig }) => {
  return (
    <section className="stack-section hero" id="home">
      <div className="container hero-content-new">
        <div className="hero-text-new fade-up">

          {/* Announcements Container */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.75rem',
            width: '100%',
          }}>
            {/* 1. PBEL City (Original Announcement Pill) */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 999, padding: '0.4rem 0.95rem',
            }}>
              <span style={{ fontSize: '0.8rem' }}>🎉</span>
              <span style={{ color: '#fff', fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.01em' }}>
                PBEL City: Vocal classes live!
              </span>
            </div>

            {/* 2. New Piano Batches (glowing dynamic pill) */}
            <div
              onClick={(e) => onOpenModal(e, 'Piano')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(168,85,247,0.6)',
                borderRadius: 999,
                padding: '0.4rem 0.95rem',
                cursor: 'pointer',
                animation: 'hsm-pulse-glow-purple 2.5s ease-in-out infinite',
                boxShadow: '0 0 10px rgba(168,85,247,0.25)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span style={{ fontSize: '0.8rem' }}>🎹</span>
              <span style={{ color: '#fff', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.01em' }}>
                {flashConfig?.piano_teacher_title || 'New Piano Batches'} &rarr;
              </span>
            </div>
          </div>

          <h1 className="hero-title serif-heading text-white">
            From first note to centre stage —<br />
            <span style={{ color: '#f26b38' }}>one day at a time</span>.
          </h1>
          <p className="hero-subtitle text-white">
            Ensemble sessions, daily habit tracking, and live recitals,{' '}
            under one roof.{' '}
            <span style={{ color: '#f26b38', fontWeight: 700 }}>First time in Hyderabad.</span>
          </p>

          <div className="hero-heatmap-wrap">
            <div className="hero-heatmap-days">
              {DAY_LABELS.map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div
              className="hero-heatmap"
              role="img"
              aria-label={`An illustrative calendar of one 12-week term, 7 days a week. ${TERM_CLASS_COUNT} class days are marked, matching a Quarterly Pack; most other days show logged practice, with occasional rest days — the same view a family sees in the HSM portal. Not a specific student's actual data.`}
            >
              {Array.from({ length: TERM_WEEKS }).map((_, week) => (
                <div className="hero-heatmap-col" key={week}>
                  {Array.from({ length: TERM_DAYS }).map((_, day) => (
                    <i
                      key={day}
                      className={`cell-${cellState(week, day)}`}
                      style={{ animationDelay: `${week * 55 + day * 12}ms` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="hero-week-legend">
            <span><b className="hero-week-swatch hero-week-swatch--class" /> Class day ({TERM_CLASS_COUNT} this term)</span>
            <span><b className="hero-week-swatch hero-week-swatch--practice" /> Practice logged</span>
            <span><b className="hero-week-swatch hero-week-swatch--rest" /> Rest day</span>
          </div>

          <div className="hero-cta-group">
            <button onClick={onOpenModal} className="btn btn-primary btn-cta-main glow-shadow">
              Book Your Free Demo Class →
            </button>
            <div className="hero-secondary-row">
              <a
                href="https://wa.me/919652444188?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost hero-whatsapp-ghost"
              >
                💬 WhatsApp
              </a>
              <a href="#programs" className="btn btn-secondary btn-ghost">
                See Our Programs ↓
              </a>
            </div>
          </div>

          <div className="trust-strip">
            <a
              href={SITE_STATS.googleReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="trust-item trust-item--link"
            >
              ⭐ {SITE_STATS.rating}★ ({SITE_STATS.reviewCount} reviews)
            </a>
            <span className="trust-divider">|</span>
            <span className="trust-item">{SITE_STATS.studentsLabel} Students</span>
            <span className="trust-divider">|</span>
            <span className="trust-item">{SITE_STATS.streamsCount} Streams</span>
          </div>
          <div className="trust-location">
            📍 Kismatpur, Hyderabad
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
