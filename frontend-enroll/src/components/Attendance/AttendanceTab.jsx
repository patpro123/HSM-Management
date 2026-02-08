import React, { useState, useEffect } from 'react'
import BatchSelector from './BatchSelector'
import AttendanceList from './AttendanceList'
import './AttendanceTab.css'

export default function AttendanceTab() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [batches, setBatches] = useState([])
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [error, setError] = useState('')

  // Fetch batches on mount and when date changes
  useEffect(() => {
    fetchBatches()
  }, [selectedDate])

  async function fetchBatches() {
    setLoadingBatches(true)
    setError('')
    try {
      const response = await fetch(`http://localhost:3000/api/batches?date=${selectedDate}`)
      if (!response.ok) throw new Error('Failed to fetch batches')
      const data = await response.json()
      setBatches(data.batches || [])
      setSelectedBatch(null)
      setStudents([])
      setAttendance({})
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
      const response = await fetch(`http://localhost:3000/api/batches/${batchId}/students`)
      if (!response.ok) throw new Error('Failed to fetch students')
      const data = await response.json()
      setStudents(data.students || [])
      // Initialize attendance with all present
      const initAttendance = {}
      data.students.forEach(student => {
        initAttendance[student.id] = 'present'
      })
      setAttendance(initAttendance)
    } catch (err) {
      console.error('Error fetching students:', err)
      setError('Failed to load students for this batch.')
    } finally {
      setLoadingStudents(false)
    }
  }

  function toggleAttendance(studentId) {
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }))
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
      date: selectedDate,
      status: attendance[student.id] === 'present' ? 'present' : 'absent'
    }))

    try {
      const response = await fetch('http://localhost:3000/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance: attendanceRecords })
      })
      if (!response.ok) throw new Error('Failed to submit attendance')
      setSubmitSuccess('Attendance submitted successfully!')
      // Reset form
      setSelectedBatch(null)
      setStudents([])
      setAttendance({})
      setTimeout(() => setSubmitSuccess(''), 3000)
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
        <p className="subtitle">Select batch and mark student attendance</p>
      </div>

      {error && <div className="error-banner">{error}<button className="dismiss" onClick={() => setError('')}>×</button></div>}
      {submitSuccess && <div className="success-banner">{submitSuccess}</div>}

      <div className="attendance-controls">
        <div className="date-picker">
          <label>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <BatchSelector
        batches={batches}
        selectedBatch={selectedBatch}
        onSelect={handleBatchSelect}
        loading={loadingBatches}
      />

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
            />
          )}

          <div className="submit-section">
            <button
              className="btn btn-submit"
              onClick={submitAttendance}
              disabled={submitting || students.length === 0}
            >
              {submitting ? 'Submitting...' : 'Submit Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
