import React, { useState, useEffect } from 'react'
import BatchSelector from './BatchSelector'
import AttendanceList from './AttendanceList'
import './AttendanceTab.css'

export default function AttendanceTab() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedInstrument, setSelectedInstrument] = useState(null)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [instruments, setInstruments] = useState([])
  const [batches, setBatches] = useState([])
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [existingAttendance, setExistingAttendance] = useState({})
  const [loadingInstruments, setLoadingInstruments] = useState(false)
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [error, setError] = useState('')

  // Fetch instruments on mount
  useEffect(() => {
    fetchInstruments()
  }, [])

  // Fetch batches when instrument changes
  useEffect(() => {
    if (selectedInstrument) {
      fetchBatches()
    } else {
      setBatches([])
      setSelectedBatch(null)
      setStudents([])
      setAttendance({})
    }
  }, [selectedInstrument, selectedDate]) // Added selectedDate dependency

  // Fetch instruments
  async function fetchInstruments() {
    setLoadingInstruments(true)
    setError('')
    try {
      const response = await fetch('http://localhost:3000/api/instruments')
      if (!response.ok) throw new Error('Failed to fetch instruments')
      const data = await response.json()
      setInstruments(data.instruments || [])
    } catch (err) {
      console.error('Error fetching instruments:', err)
      setError('Failed to load instruments. Please try again.')
    } finally {
      setLoadingInstruments(false)
    }
  }

  // Fetch batches for selected instrument and filter by selected date's day
  async function fetchBatches() {
    setLoadingBatches(true)
    setError('')
    try {
      const response = await fetch(`http://localhost:3000/api/batches/${selectedInstrument}`)
      if (!response.ok) throw new Error('Failed to fetch batches')
      const data = await response.json()
      
      // Filter batches based on selected date's day of week
      const selectedDayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
      const dayMap = {
        'MON': ['MON', 'MONDAY'],
        'TUE': ['TUE', 'TUESDAY'],
        'WED': ['WED', 'WEDNESDAY'],
        'THU': ['THU', 'THURSDAY'],
        'FRI': ['FRI', 'FRIDAY'],
        'SAT': ['SAT', 'SATURDAY'],
        'SUN': ['SUN', 'SUNDAY']
      }
      
      const filteredBatches = (data.batches || []).filter(batch => {
        if (!batch.recurrence) return false
        const recurrence = batch.recurrence.toUpperCase()
        // Check if the recurrence contains the selected day
        const dayVariants = dayMap[selectedDayOfWeek] || []
        return dayVariants.some(day => recurrence.includes(day))
      })
      
      setBatches(filteredBatches)
      setSelectedBatch(null)
      setStudents([])
      setAttendance({})
      setExistingAttendance({})
    } catch (err) {
      console.error('Error fetching batches:', err)
      setError('Failed to load batches. Please try again.')
    } finally {
      setLoadingBatches(false)
    }
  }

  async function handleBatchSelect(batchId) {
    setSelectedBatch(batchId)
    setLoadingStudents(true)
    setError('')
    try {
      // Fetch students in batch
      const studentsResponse = await fetch(`http://localhost:3000/api/batches/${batchId}/students`)
      if (!studentsResponse.ok) throw new Error('Failed to fetch students')
      const studentsData = await studentsResponse.json()
      const studentsList = studentsData.students || []
      setStudents(studentsList)

      // Fetch existing attendance for selected date
      const attendanceResponse = await fetch(
        `http://localhost:3000/api/attendance/batch/${batchId}?date=${selectedDate}`
      )
      
      const initAttendance = {}
      const existing = {}
      
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json()
        // Map existing attendance by student_id
        attendanceData.attendance?.forEach(record => {
          existing[record.student_id] = record.id
          initAttendance[record.student_id] = record.status
        })
      }
      
      // Initialize attendance for students without records (default to present)
      studentsList.forEach(student => {
        if (!initAttendance[student.id]) {
          initAttendance[student.id] = 'present'
        }
      })
      
      setExistingAttendance(existing)
      setAttendance(initAttendance)
    } catch (err) {
      console.error('Error fetching students:', err)
      setError('Failed to load students for this batch.')
    } finally {
      setLoadingStudents(false)
    }
  }

  // Cycle through attendance states: present -> absent -> excused -> present
  function toggleAttendance(studentId) {
    setAttendance(prev => {
      const current = prev[studentId] || 'present'
      let next
      if (current === 'present') next = 'absent'
      else if (current === 'absent') next = 'excused'
      else next = 'present'
      return { ...prev, [studentId]: next }
    })
  }

  function setAttendanceStatus(studentId, status) {
    setAttendance(prev => ({ ...prev, [studentId]: status }))
  }

  function markAllPresent() {
    const allPresent = {}
    students.forEach(student => {
      allPresent[student.id] = 'present'
    })
    setAttendance(allPresent)
  }

  function markAllAbsent() {
    const allAbsent = {}
    students.forEach(student => {
      allAbsent[student.id] = 'absent'
    })
    setAttendance(allAbsent)
  }

  async function submitAttendance() {
    if (!selectedBatch || students.length === 0) {
      setError('Please select a batch first.')
      return
    }

    setSubmitting(true)
    setError('')
    setSubmitSuccess('')

    const attendanceRecords = students.map(student => ({
      student_id: student.id,
      batch_id: selectedBatch,
      session_date: selectedDate,
      status: attendance[student.id] || 'present',
      source: 'web'
    }))

    try {
      const response = await fetch('http://localhost:3000/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: attendanceRecords })
      })
      if (!response.ok) throw new Error('Failed to submit attendance')
      setSubmitSuccess('Attendance submitted successfully!')
      setTimeout(() => setSubmitSuccess(''), 3000)
      // Reload attendance to show updated state
      if (selectedBatch) {
        handleBatchSelect(selectedBatch)
      }
    } catch (err) {
      console.error('Error submitting attendance:', err)
      setError('Failed to submit attendance. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="attendance-container">
      <div className="attendance-header">
        <h2>Mark Attendance</h2>
        <p className="subtitle">Select instrument, batch, and mark student attendance</p>
      </div>

      {error && <div className="error-banner">{error}<button className="dismiss" onClick={() => setError('')}>×</button></div>}
      {submitSuccess && <div className="success-banner">{submitSuccess}</div>}

      <div className="attendance-controls">
        <div className="date-picker">
          <label>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value)
              // Clear selection when date changes - batches will be refetched
              setSelectedBatch(null)
              setStudents([])
              setAttendance({})
            }}
          />
        </div>
      </div>

      {/* Instrument Selection */}
      <div className="instrument-selector-section">
        <label className="section-label">Select Instrument</label>
        {loadingInstruments ? (
          <div className="loading">Loading instruments...</div>
        ) : instruments.length === 0 ? (
          <div className="no-data">No instruments available</div>
        ) : (
          <div className="instrument-grid">
            {instruments.map(instrument => (
              <button
                key={instrument.id}
                className={`instrument-card ${selectedInstrument === instrument.id ? 'active' : ''}`}
                onClick={() => setSelectedInstrument(instrument.id)}
              >
                <div className="instrument-name">{instrument.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Batch Selection */}
      {selectedInstrument && (
        <BatchSelector
          batches={batches}
          selectedBatch={selectedBatch}
          onSelect={handleBatchSelect}
          loading={loadingBatches}
        />
      )}

      {selectedBatch && (
        <div className="attendance-section">
          <div className="bulk-actions">
            <button className="btn-bulk" onClick={markAllPresent}>Mark All Present</button>
            <button className="btn-bulk secondary" onClick={markAllAbsent}>Mark All Absent</button>
          </div>

          {loadingStudents ? (
            <div className="loading">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="no-data">No students enrolled in this batch</div>
          ) : (
            <AttendanceList
              students={students}
              attendance={attendance}
              onToggle={toggleAttendance}
              onSetStatus={setAttendanceStatus}
            />
          )}

          <div className="submit-section">
            <button
              className="btn btn-submit"
              onClick={submitAttendance}
              disabled={submitting || students.length === 0}
            >
              {submitting ? 'Submitting...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
