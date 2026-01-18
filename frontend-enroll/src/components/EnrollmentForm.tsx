import React, { useState } from 'react';
import { apiPost } from '../api';
import { Student, Batch, Instrument, PaymentFrequency } from '../types';

interface EnrollmentFormProps {
  students: Student[];
  batches: Batch[];
  instruments: Instrument[];
  onRefresh: () => void;
}

interface EnrollmentData {
  student_id: number | null;
  enrollments: {
    batch_id: number;
    payment_frequency: PaymentFrequency;
  }[];
}

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ students, batches, instruments, onRefresh }) => {
  const [step, setStep] = useState(1);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData>({
    student_id: null,
    enrollments: []
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setEnrollmentData({ ...enrollmentData, student_id: student.id as number });
    setStep(2);
  };

  const handleBatchToggle = (batchId: number) => {
    const exists = enrollmentData.enrollments.find(e => e.batch_id === batchId);
    if (exists) {
      setEnrollmentData({
        ...enrollmentData,
        enrollments: enrollmentData.enrollments.filter(e => e.batch_id !== batchId)
      });
    } else {
      setEnrollmentData({
        ...enrollmentData,
        enrollments: [...enrollmentData.enrollments, { batch_id: batchId, payment_frequency: 'monthly' as PaymentFrequency }]
      });
    }
  };

  const handlePaymentFrequencyChange = (batchId: number, frequency: PaymentFrequency) => {
    setEnrollmentData({
      ...enrollmentData,
      enrollments: enrollmentData.enrollments.map(e =>
        e.batch_id === batchId ? { ...e, payment_frequency: frequency } : e
      )
    });
  };

  const handleSubmit = async () => {
    if (!enrollmentData.student_id || enrollmentData.enrollments.length === 0) {
      alert('Please select a student and at least one batch');
      return;
    }

    try {
      await apiPost('/api/enroll', enrollmentData);
      alert('Enrollment successful!');
      setStep(1);
      setSelectedStudent(null);
      setEnrollmentData({ student_id: null, enrollments: [] });
      setSearchTerm('');
      onRefresh();
    } catch (error: any) {
        alert(`Enrollment failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error enrolling student:', error);
      alert('Error enrolling student');
    }
  };

  const filteredStudents = students.filter(student => {
    const fullName = student.first_name && student.last_name 
      ? `${student.first_name} ${student.last_name}` 
      : (student as any).name || '';
    return fullName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Group batches by instrument
  const batchesByInstrument = instruments.map(instrument => ({
    instrument,
    batches: batches.filter(batch => batch.instrument_id === instrument.id)
  })).filter(group => group.batches.length > 0);

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
            1
          </div>
          <span className="font-semibold">Select Student</span>
        </div>
        <div className="w-16 h-1 bg-slate-200"></div>
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
            2
          </div>
          <span className="font-semibold">Select Batches</span>
        </div>
        <div className="w-16 h-1 bg-slate-200"></div>
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
            3
          </div>
          <span className="font-semibold">Confirm</span>
        </div>
      </div>

      {/* Step 1: Student Selection */}
      {step === 1 && (
        <div>
          <h3 className="text-xl font-bold text-slate-800 mb-4">Select a Student</h3>
          <input
            type="text"
            placeholder="🔍 Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none mb-6"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map(student => (
              <div
                key={student.id}
                onClick={() => handleStudentSelect(student)}
                className="p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold">
                    {(() => {
                      if (student.first_name && student.last_name) {
                        return `${student.first_name[0]}${student.last_name[0]}`;
                      }
                      const name = (student as any).name || 'N A';
                      const parts = name.split(' ');
                      return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}` : name.substring(0, 2).toUpperCase();
                    })()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500">{student.email || 'No email'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Batch Selection */}
      {step === 2 && selectedStudent && (
        <div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-lg">
                {(() => {
                  if (selectedStudent.first_name && selectedStudent.last_name) {
                    return `${selectedStudent.first_name[0]}${selectedStudent.last_name[0]}`;
                  }
                  const name = (selectedStudent as any).name || 'N A';
                  const parts = name.split(' ');
                  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}` : name.substring(0, 2).toUpperCase();
                })()}
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {selectedStudent.first_name && selectedStudent.last_name ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : (selectedStudent as any).name || 'Unknown'}
                </p>
                <p className="text-sm text-slate-600">{selectedStudent.email || 'No email'}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setStep(1);
                setSelectedStudent(null);
                setEnrollmentData({ ...enrollmentData, enrollments: [] });
              }}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
            >
              Change Student
            </button>
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-4">Select Batches & Payment Plan</h3>

          <div className="space-y-6">
            {batchesByInstrument.map(({ instrument, batches: instrumentBatches }) => (
              <div key={instrument.id} className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  🎵 {instrument.name}
                </h4>
                <div className="space-y-3">
                  {instrumentBatches.map(batch => {
                    const isSelected = enrollmentData.enrollments.some(e => e.batch_id === Number(batch.id));
                    const enrollment = enrollmentData.enrollments.find(e => e.batch_id === Number(batch.id));

                    return (
                      <div
                        key={batch.id}
                        className={`p-4 rounded-lg border-2 transition ${
                          isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleBatchToggle(Number(batch.id))}
                            className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <p className="font-bold text-slate-900">Batch {batch.id}</p>
                            <p className="text-sm text-slate-600">
                              {batch.day_of_week} • {batch.start_time} - {batch.end_time}
                            </p>
                            <p className="text-sm text-slate-600">Teacher: {batch.teacher_id}</p>

                            {isSelected && (
                              <div className="mt-3">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Frequency</label>
                                <select
                                  value={enrollment?.payment_frequency || 'monthly'}
                                  onChange={(e) => handlePaymentFrequencyChange(Number(batch.id), e.target.value as PaymentFrequency)}
                                  className="px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                >
                                  <option value="monthly">Monthly (8 classes)</option>
                                  <option value="quarterly">Quarterly (24 classes)</option>
                                  <option value="half_yearly">Half-Yearly (48 classes)</option>
                                  <option value="yearly">Yearly (96 classes)</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={enrollmentData.enrollments.length === 0}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && selectedStudent && (
        <div>
          <h3 className="text-xl font-bold text-slate-800 mb-6">Confirm Enrollment</h3>

          <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xl">
                {(() => {
                  if (selectedStudent.first_name && selectedStudent.last_name) {
                    return `${selectedStudent.first_name[0]}${selectedStudent.last_name[0]}`;
                  }
                  const name = (selectedStudent as any).name || 'N A';
                  const parts = name.split(' ');
                  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}` : name.substring(0, 2).toUpperCase();
                })()}
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {selectedStudent.first_name && selectedStudent.last_name ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : (selectedStudent as any).name || 'Unknown'}
                </p>
                <p className="text-slate-600">{selectedStudent.email || 'No email'}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-bold text-slate-800 mb-3">Selected Batches:</h4>
              <div className="space-y-3">
                {enrollmentData.enrollments.map(enrollment => {
                  const batch = batches.find(b => Number(b.id) === enrollment.batch_id);
                  if (!batch) return null;

                  const instrument = instruments.find(i => i.id === batch.instrument_id);
                  const classesCount = {
                    monthly: 8,
                    quarterly: 24,
                    half_yearly: 48,
                    yearly: 96
                  }[enrollment.payment_frequency];

                  return (
                    <div key={batch.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="font-bold text-slate-900">Batch {batch.id}</p>
                      <p className="text-sm text-slate-600">Instrument: {instrument?.name}</p>
                      <p className="text-sm text-slate-600">Schedule: {batch.day_of_week} • {batch.start_time} - {batch.end_time}</p>
                      <p className="text-sm text-indigo-600 font-semibold mt-2">
                        Payment: {enrollment.payment_frequency.replace('_', ' ')} ({classesCount} classes)
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg"
            >
              ✓ Confirm Enrollment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentForm;
