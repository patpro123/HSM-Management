import React from 'react'

// Helper function to format recurrence to day name
function formatRecurrence(recurrence) {
  // If recurrence already contains formatted text like "Tue/Thu 17:00-18:00", extract day
  if (recurrence.includes('/') || recurrence.includes(':')) {
    // Extract just the day part before time
    const dayPart = recurrence.split(/\d/)[0].trim()
    return dayPart
  }
  
  const days = {
    'MON': 'Monday',
    'TUE': 'Tuesday',
    'WED': 'Wednesday',
    'THU': 'Thursday',
    'FRI': 'Friday',
    'SAT': 'Saturday',
    'SUN': 'Sunday'
  }
  return days[recurrence.toUpperCase()] || recurrence
}

export default function BatchSelector({ batches, selectedBatch, onSelect, loading }) {
  return (
    <div className="batch-selector-section">
      <label className="section-label">Select Batch</label>
      {loading ? (
        <div className="loading">Loading batches...</div>
      ) : batches.length === 0 ? (
        <div className="no-data">No batches available for this instrument</div>
      ) : (
        <div className="batch-grid">
          {batches.map(batch => {
            // Extract day and time from recurrence or use start/end time
            let batchLabel
            if (batch.recurrence && batch.recurrence.includes(':')) {
              // Recurrence already formatted like "Tue/Thu 17:00-18:00"
              batchLabel = batch.recurrence
            } else {
              const dayName = formatRecurrence(batch.recurrence)
              const startTime = batch.start_time?.substring(0, 5) || ''
              const endTime = batch.end_time?.substring(0, 5) || ''
              batchLabel = `${dayName} ${startTime}-${endTime}`
            }
            
            return (
              <button
                key={batch.id}
                className={`batch-card ${selectedBatch === batch.id ? 'active' : ''}`}
                onClick={() => onSelect(batch.id)}
              >
                <div className="batch-time-main">{batchLabel}</div>
                <div className="batch-teacher">{batch.teacher_name || 'No teacher assigned'}</div>
                <div className="batch-capacity">{batch.enrolled_count || 0} students</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
