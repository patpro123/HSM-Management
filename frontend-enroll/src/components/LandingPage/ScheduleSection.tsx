import React from 'react';

interface Batch {
  instrument_name?: string;
  days?: string;
  day_of_week?: string;
  timings?: string;
  start_time?: string;
  end_time?: string;
  age_group?: string;
}

interface ScheduleSectionProps {
  batches: Batch[];
  onOpenModal: (e: React.MouseEvent) => void;
}

const ScheduleSection: React.FC<ScheduleSectionProps> = ({ batches, onOpenModal }) => {
  return (
    <section className="stack-section schedule-section bg-secondary" id="schedule">
      <div className="container section-padding">
        <div className="text-center mb-5">
          <span className="section-label">Find your perfect slot</span>
          <h2 className="section-title serif-heading">Class Schedule Overview</h2>
        </div>

        <div className="schedule-table-container pop-shadow bg-white">
          <div className="schedule-badge">Online classes available for all instruments 🌐</div>
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Days</th>
                <th>Timings</th>
                <th>Age Group</th>
              </tr>
            </thead>
            <tbody>
              {batches.length > 0 ? batches.map((b, i) => (
                <tr key={i}>
                  <td><strong>{b.instrument_name}</strong></td>
                  <td>{b.days || b.day_of_week}</td>
                  <td>{b.timings || `${b.start_time}-${b.end_time}`}</td>
                  <td>{b.age_group || 'All ages'}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-center">Loading schedule...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-center mt-5">
          <button onClick={onOpenModal} className="btn btn-primary">Book your slot →</button>
        </div>
      </div>
    </section>
  );
};

export default ScheduleSection;
