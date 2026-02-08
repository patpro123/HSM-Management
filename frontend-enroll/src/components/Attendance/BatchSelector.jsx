import React from 'react'

export default function BatchSelector({ batches, selectedBatch, onSelect, loading }) {
  return (
    <div className="batch-selector-section">
      <label className="section-label">Select Batch</label>
      {loading ? (
        <div className="loading">Loading batches...</div>
      ) : batches.length === 0 ? (
        <div className="no-data">No batches scheduled for this date</div>
      ) : (
        <div className="batch-grid">
          {batches.map(batch => (
            <button
              key={batch.id}
              className={`batch-card ${selectedBatch === batch.id ? 'active' : ''}`}
              onClick={() => onSelect(batch.id)}
            >
              <div className="batch-time">{batch.start_time} - {batch.end_time}</div>
              <div className="batch-instrument">{batch.instrument_name}</div>
              <div className="batch-teacher">{batch.teacher_name}</div>
              <div className="batch-capacity">{batch.enrolled_count || 0} students</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
