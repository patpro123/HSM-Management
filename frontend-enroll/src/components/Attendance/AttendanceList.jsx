import React from 'react'

export default function AttendanceList({ students, attendance, onToggle, onSetStatus }) {
  const getStatusLabel = (status) => {
    switch (status) {
      case 'present': return '✓ Present'
      case 'absent': return '✗ Absent'
      case 'excused': return '◐ Excused'
      default: return '✓ Present'
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'present': return 'status-present'
      case 'absent': return 'status-absent'
      case 'excused': return 'status-excused'
      default: return 'status-present'
    }
  }

  return (
    <div className="attendance-list-section">
      <div className="list-header">
        <span className="header-label">Student Name</span>
        <span className="header-status">Status</span>
      </div>
      <div className="attendance-list">
        {students.map(student => {
          const status = attendance[student.id] || 'present'
          return (
            <div key={student.id} className="attendance-item">
              <div className="student-info">
                <span className="student-name">{student.name}</span>
                <span className="student-id">{student.phone}</span>
              </div>
              <div className="status-controls">
                <button
                  className={`status-toggle ${getStatusClass(status)}`}
                  onClick={() => onToggle(student.id)}
                  title="Click to cycle: Present → Absent → Excused"
                >
                  {getStatusLabel(status)}
                </button>
                <div className="status-options">
                  <button
                    className={`status-btn ${status === 'present' ? 'active' : ''}`}
                    onClick={() => onSetStatus(student.id, 'present')}
                    title="Present"
                  >
                    ✓
                  </button>
                  <button
                    className={`status-btn ${status === 'absent' ? 'active' : ''}`}
                    onClick={() => onSetStatus(student.id, 'absent')}
                    title="Absent"
                  >
                    ✗
                  </button>
                  <button
                    className={`status-btn ${status === 'excused' ? 'active' : ''}`}
                    onClick={() => onSetStatus(student.id, 'excused')}
                    title="Excused"
                  >
                    ◐
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
