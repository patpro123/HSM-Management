import React from 'react';
import { Student, AttendanceRecord, BatchAssignment, PaymentRecord } from '../types';

interface StudentSummaryProps {
  student: Student;
  attendance: AttendanceRecord[];
  enrollments: BatchAssignment[];
  payments: PaymentRecord[];
}

const StudentSummary: React.FC<StudentSummaryProps> = ({ student, attendance, enrollments, payments }) => {
  if (!student) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-8 mt-10">
        <h2 className="text-2xl font-bold mb-4">Student Summary</h2>
        <div className="text-red-600">No student data available.</div>
      </div>
    );
  }

  // Calculate stats
  const totalClasses = enrollments?.reduce((sum, e) => sum + (e.classes_remaining || 0), 0) ?? 0;
  const attendedDays = attendance?.filter(a => a.student_id === student.id && a.status === 'present').length ?? 0;
  const totalAttendance = attendance?.filter(a => a.student_id === student.id).length ?? 0;
  const progress = totalAttendance > 0 ? Math.round((attendedDays / totalAttendance) * 100) : 0;

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-8 mt-10">
      <h2 className="text-2xl font-bold mb-4">Student Summary</h2>
      <div className="mb-4">
        <div className="font-semibold">Name:</div>
        <div>{student.first_name || student.name || ''} {student.last_name || ''}</div>
      </div>
      <div className="mb-4">
        <div className="font-semibold">Classes Left:</div>
        <div>{totalClasses}</div>
      </div>
      <div className="mb-4">
        <div className="font-semibold">Attendance Days:</div>
        <div>{attendedDays}</div>
      </div>
      <div className="mb-4">
        <div className="font-semibold">Progress:</div>
        <div>{progress}%</div>
      </div>
      <div className="mb-4">
        <div className="font-semibold">Payments:</div>
        <div>{payments?.filter(p => p.student_id === student.id).length ?? 0} payments made</div>
      </div>
    </div>
  );
};

export default StudentSummary;
