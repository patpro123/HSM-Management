import React from 'react'

export default function HistoricalAttendance() {
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0])
  const [selectedBatch, setSelectedBatch] = React.useState(null)
  const [batches, setBatches] = React.useState([])
  const [records, setRecords] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetchHistoricalRecords()
  }, [selectedDate])

  async function fetchHistoricalRecords() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`http://localhost:3000/api/attendance?date=${selectedDate}`)
      if (!response.ok) throw new Error('Failed to fetch records')
      const data = await response.json()
      setRecords(data.records || [])
    } catch (err) {
      console.error('Error fetching records:', err)
      setError('Failed to load attendance records.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="historical-section">
      <h3>View Attendance History (Admin Only)</h3>
      
      {error && <div className="error-banner">{error}</div>}
      
      <div className="history-controls">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      {loading ? (
        <div className="loading">Loading records...</div>
      ) : records.length === 0 ? (
        <div className="no-data">No attendance records for this date</div>
      ) : (
        <div className="records-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th>Status</th>
                <th>Recorded At</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>{record.student_name}</td>
                  <td>{record.batch_name}</td>
                  <td>
                    <span className={`badge ${record.status}`}>
                      {record.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{new Date(record.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
