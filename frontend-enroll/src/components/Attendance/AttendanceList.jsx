import React from 'react'

export default function AttendanceList({ students, attendance, onToggle }) {
  return (
    <div className="attendance-list-section">
      <div className="list-header">
        <span className="header-label">Student Name</span>
        <span className="header-status">Status</span>
      </div>
      <div className="attendance-list">
        {students.map(student => (
          <div key={student.id} className="attendance-item">
            <div className="student-info">
              <span className="student-name">{student.first_name} {student.last_name}</span>
              <span className="student-id">{student.phone}</span>
            </div>
            <button
              className={`status-toggle ${attendance[student.id] || 'present'}`}
              onClick={() => onToggle(student.id)}
            >
              {attendance[student.id] === 'present' ? '✓ Present' : '✗ Absent'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
