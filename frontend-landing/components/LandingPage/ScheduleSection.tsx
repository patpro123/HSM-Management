'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';

const SCHEDULE_DAYS = [
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

const INSTRUMENT_ICONS: Record<string, string> = {
  guitar:     '🎸',
  keyboard:   '🎹',
  piano:      '🎹',
  tabla:      '🪘',
  drums:      '🥁',
  octopad:    '🎛️',
  violin:     '🎻',
  hindustani: '🎤',
  carnatic:   '🎤',
  vocals:     '🎤',
};

function getIcon(name: string): string {
  const key = name.toLowerCase().split(' ')[0];
  return INSTRUMENT_ICONS[key] || '🎵';
}

interface Batch {
  instrument_name?: string;
  recurrence?: string;
  start_time?: string;
  end_time?: string;
  is_makeup?: boolean;
}

interface ScheduleCell { morning: boolean; evening: boolean; }

function parseBatchDays(recurrence: string): string[] {
  const text = recurrence.toUpperCase();
  return SCHEDULE_DAYS.map(d => d.key).filter(d => text.includes(d));
}

function classifyPeriod(startTime: string): 'morning' | 'evening' {
  const hour = parseInt(startTime.split(':')[0], 10);
  return hour < 13 ? 'morning' : 'evening';
}

function buildScheduleGrid(batches: Batch[]): Record<string, Record<string, ScheduleCell>> {
  const grid: Record<string, Record<string, ScheduleCell>> = {};
  for (const batch of batches) {
    if (batch.is_makeup || !batch.instrument_name || !batch.recurrence) continue;
    const name = batch.instrument_name;
    if (!grid[name]) {
      grid[name] = {};
      for (const d of SCHEDULE_DAYS) grid[name][d.key] = { morning: false, evening: false };
    }
    const days = parseBatchDays(batch.recurrence);
    const period = batch.start_time ? classifyPeriod(batch.start_time) : 'evening';
    for (const day of days) {
      if (grid[name][day]) grid[name][day][period] = true;
    }
  }
  return grid;
}

interface ScheduleSectionProps {
  batches: Batch[];
  onOpenModal: (e: React.MouseEvent) => void;
}

const ScheduleSection: React.FC<ScheduleSectionProps> = ({ batches, onOpenModal }) => {
  const grid = buildScheduleGrid(batches);
  const instruments = Object.keys(grid).sort();
  const total = instruments.length;

  const [deckIndex, setDeckIndex] = useState(0);
  const touchStartX = useRef(0);
  const isPaused = useRef(false);

  const nextCard = useCallback(() => setDeckIndex(i => (i + 1) % total), [total]);
  const prevCard = useCallback(() => setDeckIndex(i => (i - 1 + total) % total), [total]);

  // Auto-rotate every 3s, pause on touch
  useEffect(() => {
    if (total === 0) return;
    const timer = setInterval(() => {
      if (!isPaused.current) nextCard();
    }, 3000);
    return () => clearInterval(timer);
  }, [total, nextCard]);

  const cardPosition = (idx: number) => {
    const pos = (idx - deckIndex + total) % total;
    if (pos === 0) return 'deck-card--active';
    if (pos === 1) return 'deck-card--behind-1';
    if (pos === 2) return 'deck-card--behind-2';
    return 'deck-card--hidden';
  };

  return (
    <section className="stack-section schedule-section bg-secondary" id="schedule">
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">Find your perfect slot</span>
          <h2 className="section-title serif-heading">Class Schedule Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            All classes are in-person at our Kismatpur centre. Closed on Mondays.
          </p>
        </div>

        {/* Desktop: table */}
        <div className="schedule-table-desktop schedule-table-container pop-shadow bg-white" style={{ overflowX: 'auto', borderRadius: 16, padding: '1.5rem' }}>
          {instruments.length > 0 ? (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 16px 10px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 130 }}>
                      Instrument
                    </th>
                    {SCHEDULE_DAYS.map(d => (
                      <th key={d.key} style={{ textAlign: 'center', padding: '6px 10px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instruments.map((name, idx) => (
                    <tr key={name} style={{ background: idx % 2 === 0 ? 'rgba(242,107,56,0.03)' : 'transparent' }}>
                      <td style={{ padding: '10px 16px 10px 0', fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.875rem' }}>{name}</td>
                      {SCHEDULE_DAYS.map(d => {
                        const cell = grid[name][d.key];
                        return (
                          <td key={d.key} style={{ textAlign: 'center', padding: '10px 8px' }}>
                            {(cell?.morning || cell?.evening) ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                {cell.morning && (
                                  <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 9px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    Morn
                                  </span>
                                )}
                                {cell.evening && (
                                  <span style={{ background: 'rgba(242,107,56,0.12)', color: 'var(--brand-orange)', borderRadius: 20, padding: '2px 9px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    Eve
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: 14, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 9px', fontWeight: 700 }}>Morn</span>
                  Before 1 pm
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: 'rgba(242,107,56,0.12)', color: 'var(--brand-orange)', borderRadius: 20, padding: '2px 9px', fontWeight: 700 }}>Eve</span>
                  Afternoon / Evening
                </span>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Loading schedule...</p>
          )}
        </div>

        {/* Mobile: stacked deck */}
        {instruments.length > 0 && (
          <div className="schedule-deck instrument-deck">
            <div
              className="deck-stack"
              onTouchStart={e => {
                touchStartX.current = e.touches[0].clientX;
                isPaused.current = true;
              }}
              onTouchEnd={e => {
                const dx = touchStartX.current - e.changedTouches[0].clientX;
                if (dx > 40) nextCard();
                else if (dx < -40) prevCard();
                setTimeout(() => { isPaused.current = false; }, 3000);
              }}
            >
              {instruments.map((name, idx) => {
                const pos = cardPosition(idx);
                const icon = getIcon(name);
                const activeDays = SCHEDULE_DAYS.filter(d => grid[name][d.key]?.morning || grid[name][d.key]?.evening);
                return (
                  <div
                    key={name}
                    className={`deck-card schedule-deck-card ${pos}`}
                    onClick={pos === 'deck-card--active' ? nextCard : undefined}
                  >
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{icon}</div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 1rem' }}>{name}</h3>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {activeDays.map(d => {
                        const cell = grid[name][d.key];
                        return (
                          <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-heading)' }}>{d.label}</span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {cell.morning && (
                                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700 }}>Morn</span>
                              )}
                              {cell.evening && (
                                <span style={{ background: 'rgba(242,107,56,0.15)', color: 'var(--brand-orange)', borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700 }}>Eve</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {pos === 'deck-card--active' && (
                      <button
                        className="btn btn-cta"
                        onClick={e => { e.stopPropagation(); onOpenModal(e); }}
                        style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                      >
                        Book this slot →
                      </button>
                    )}
                    {pos === 'deck-card--active' && (
                      <p className="deck-tap-hint">Auto-rotating · tap to skip · swipe to jump</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="deck-footer">
              <div className="deck-dots">
                {instruments.map((_, i) => (
                  <button
                    key={i}
                    className={`deck-dot${i === deckIndex ? ' deck-dot--active' : ''}`}
                    onClick={() => { setDeckIndex(i); isPaused.current = true; setTimeout(() => { isPaused.current = false; }, 5000); }}
                    aria-label={`Go to ${instruments[i]}`}
                  />
                ))}
              </div>
              <span className="deck-counter">{deckIndex + 1} / {total}</span>
            </div>
          </div>
        )}

        <div className="text-center mt-5">
          <button onClick={onOpenModal} className="btn btn-primary">Book your slot →</button>
        </div>
      </div>
    </section>
  );
};

export default ScheduleSection;
