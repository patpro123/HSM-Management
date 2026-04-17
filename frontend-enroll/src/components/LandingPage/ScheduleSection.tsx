import React from 'react';

const SCHEDULE_DAYS = [
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

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

        <div className="schedule-table-container pop-shadow bg-white" style={{ overflowX: 'auto', borderRadius: 16, padding: '1.5rem' }}>
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

        <div className="text-center mt-5">
          <button onClick={onOpenModal} className="btn btn-primary">Book your slot →</button>
        </div>
      </div>
    </section>
  );
};

export default ScheduleSection;
