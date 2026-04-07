import React, { useRef } from 'react';
import { AttendanceStatus } from '../../types';

interface BatchStudent {
  student_id: string;
  student_name: string;
  status: AttendanceStatus | null;
  phone: string | null;
  guardian_phone: string | null;
  guardian_contact: string | null;
}

interface MarkAttendanceTabProps {
  attendanceDate: string;
  setAttendanceDate: (date: string) => void;
  selectedBatch: string;
  setSelectedBatch: (id: string) => void;
  filteredBatches: any[];
  selectedBatchInfo: any;
  loading: boolean;
  saving: boolean;
  successMessage: string;
  errorMessage: string;
  batchStudents: BatchStudent[];
  guestStudents: BatchStudent[];
  extraSessions: Set<string>;
  studentSearch: string;
  setStudentSearch: (s: string) => void;
  allStudents: { student_id: string; student_name: string }[];
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  extraCount: number;
  hasStudents: boolean;
  searchResults: { student_id: string; student_name: string }[];
  fetchAllStudents: () => void;
  handleStatusChange: (studentId: string, status: AttendanceStatus) => void;
  handleGuestStatusChange: (studentId: string, status: AttendanceStatus) => void;
  toggleExtraSession: (studentId: string) => void;
  addGuestStudent: (student: { student_id: string; student_name: string }) => void;
  removeGuestStudent: (studentId: string) => void;
  handleResetAll: () => void;
  handleMarkAllPresent: () => void;
  handleMarkAllAbsent: () => void;
  handleMarkAllExcused: () => void;
  handleSubmitAttendance: () => void;
}

const MarkAttendanceTab: React.FC<MarkAttendanceTabProps> = ({
  attendanceDate,
  setAttendanceDate,
  selectedBatch,
  setSelectedBatch,
  filteredBatches,
  selectedBatchInfo,
  loading,
  saving,
  successMessage,
  errorMessage,
  batchStudents,
  guestStudents,
  extraSessions,
  studentSearch,
  setStudentSearch,
  searchResults,
  presentCount,
  absentCount,
  excusedCount,
  extraCount,
  hasStudents,
  fetchAllStudents,
  handleStatusChange,
  handleGuestStatusChange,
  toggleExtraSession,
  addGuestStudent,
  removeGuestStudent,
  handleResetAll,
  handleMarkAllPresent,
  handleMarkAllAbsent,
  handleMarkAllExcused,
  handleSubmitAttendance,
}) => {
  const searchRef = useRef<HTMLDivElement>(null);

  const renderStatusButtons = (student: BatchStudent, isGuest: boolean) => (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      <button
        onClick={() => isGuest ? handleGuestStatusChange(student.student_id, 'present') : handleStatusChange(student.student_id, 'present')}
        className={`flex items-center justify-center rounded-lg font-medium transition
          w-11 h-11 text-lg sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:text-base ${
          student.status === 'present' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100'
        }`}
        title="Present"
      >
        <span>✓</span>
        <span className="hidden sm:inline ml-1">Present</span>
      </button>
      <button
        onClick={() => isGuest ? handleGuestStatusChange(student.student_id, 'absent') : handleStatusChange(student.student_id, 'absent')}
        className={`flex items-center justify-center rounded-lg font-medium transition
          w-11 h-11 text-lg sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:text-base ${
          student.status === 'absent' ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-red-100'
        }`}
        title="Absent"
      >
        <span>✗</span>
        <span className="hidden sm:inline ml-1">Absent</span>
      </button>
      <button
        onClick={() => isGuest ? handleGuestStatusChange(student.student_id, 'excused') : handleStatusChange(student.student_id, 'excused')}
        className={`flex items-center justify-center rounded-lg font-medium transition
          w-11 h-11 text-lg sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:text-base ${
          student.status === 'excused' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-amber-100'
        }`}
        title="Excused"
      >
        <span>~</span>
        <span className="hidden sm:inline ml-1">Excused</span>
      </button>
    </div>
  );

  return (
    <>
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Attendance Date *</label>
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Select Batch *</label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            disabled={filteredBatches.length === 0}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          >
            <option value="">-- Choose a batch --</option>
            {filteredBatches.map(batch => (
              <option key={batch.id} value={batch.id}>
                {(batch as any).instrument_name || 'Batch'} ({batch.recurrence})
              </option>
            ))}
          </select>
          {filteredBatches.length === 0 && (
            <p className="text-sm text-red-500 mt-2">No batches exist for this day.</p>
          )}
        </div>
      </div>

      {selectedBatchInfo && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900">{(selectedBatchInfo as any).instrument_name || 'Selected Batch'}</p>
              <p className="text-sm text-slate-600">
                {selectedBatchInfo.recurrence} • {selectedBatchInfo.start_time} - {selectedBatchInfo.end_time}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleMarkAllPresent} className="flex-1 sm:flex-none px-3 py-2 text-sm bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition text-center">
                ✓ <span className="hidden sm:inline">All </span>Present
              </button>
              <button onClick={handleMarkAllAbsent} className="flex-1 sm:flex-none px-3 py-2 text-sm bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition text-center">
                ✗ <span className="hidden sm:inline">All </span>Absent
              </button>
              <button onClick={handleMarkAllExcused} className="flex-1 sm:flex-none px-3 py-2 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition text-center">
                ~ <span className="hidden sm:inline">All </span>Excused
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-slate-600">Loading students...</p>
        </div>
      ) : !selectedBatch ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-400">Please select a batch to mark attendance</p>
        </div>
      ) : (
        <>
          {hasStudents && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-emerald-700">Present</p>
                <p className="text-3xl font-bold text-emerald-900">{presentCount}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-red-700">Absent</p>
                <p className="text-3xl font-bold text-red-900">{absentCount}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-amber-700">Excused</p>
                <p className="text-3xl font-bold text-amber-900">{excusedCount}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-purple-700">Extra Sessions</p>
                <p className="text-3xl font-bold text-purple-900">{extraCount}</p>
              </div>
            </div>
          )}

          {hasStudents ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="hidden sm:table-cell px-6 py-4 text-left text-sm font-bold text-slate-700">#</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-sm font-bold text-slate-700">Student Name</th>
                    <th className="hidden sm:table-cell px-6 py-4 text-left text-sm font-bold text-slate-700">Contact</th>
                    <th className="px-4 sm:px-6 py-4 text-center text-sm font-bold text-slate-700">Status</th>
                    <th className="px-2 sm:px-6 py-4 text-center text-sm font-bold text-slate-700">Extra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {batchStudents.map((student, index) => (
                    <tr key={student.student_id} className="hover:bg-slate-50 transition">
                      <td className="hidden sm:table-cell px-6 py-4 text-slate-600">{index + 1}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{student.student_name}</p>
                          {extraSessions.has(student.student_id) && student.status === 'present' && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">+Extra</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-sm text-slate-600">
                        {student.phone ? (
                          <a href={`tel:${student.phone}`} className="hover:text-indigo-600 hover:underline">{student.phone}</a>
                        ) : student.guardian_phone ? (
                          <a href={`tel:${student.guardian_phone}`} className="hover:text-indigo-600 hover:underline">{student.guardian_phone}</a>
                        ) : (student.guardian_contact || 'N/A')}
                      </td>
                      <td className="px-4 sm:px-6 py-4">{renderStatusButtons(student, false)}</td>
                      <td className="px-2 sm:px-6 py-4 text-center">
                        {student.status === 'present' ? (
                          <button
                            onClick={() => toggleExtraSession(student.student_id)}
                            title="Mark an extra/makeup session — deducts one additional class credit"
                            className={`w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-lg text-sm font-medium transition flex items-center justify-center mx-auto ${
                              extraSessions.has(student.student_id)
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-purple-100'
                            }`}
                          >
                            <span className="sm:hidden">+</span>
                            <span className="hidden sm:inline">+ Extra</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {guestStudents.length > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 sm:px-6 py-2 bg-orange-50 border-t-2 border-orange-200 text-xs font-bold text-orange-600 uppercase tracking-wide">
                        Out-of-Turn Students
                      </td>
                    </tr>
                  )}

                  {guestStudents.map((student, index) => (
                    <tr key={`guest-${student.student_id}`} className="hover:bg-orange-50 bg-orange-50/30 transition">
                      <td className="hidden sm:table-cell px-6 py-4 text-slate-600">{batchStudents.length + index + 1}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{student.student_name}</p>
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Out of Turn</span>
                          {extraSessions.has(student.student_id) && student.status === 'present' && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">+Extra</span>
                          )}
                          <button
                            onClick={() => removeGuestStudent(student.student_id)}
                            title="Remove from this session"
                            className="text-slate-300 hover:text-red-500 transition text-sm ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-sm text-slate-400">—</td>
                      <td className="px-4 sm:px-6 py-4">{renderStatusButtons(student, true)}</td>
                      <td className="px-2 sm:px-6 py-4 text-center">
                        {student.status === 'present' ? (
                          <button
                            onClick={() => toggleExtraSession(student.student_id)}
                            title="Mark an extra/makeup session — deducts one additional class credit"
                            className={`w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-lg text-sm font-medium transition flex items-center justify-center mx-auto ${
                              extraSessions.has(student.student_id)
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-purple-100'
                            }`}
                          >
                            <span className="sm:hidden">+</span>
                            <span className="hidden sm:inline">+ Extra</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-400">No students enrolled in this batch. Use the search below to add out-of-turn students.</p>
            </div>
          )}

          {/* Out-of-turn student search */}
          <div className="relative" ref={searchRef}>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Add Out-of-Turn Student</label>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              onFocus={fetchAllStudents}
              placeholder="Search students to add out of turn..."
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                {searchResults.map(student => (
                  <button
                    key={student.student_id}
                    onClick={() => addGuestStudent(student)}
                    className="w-full text-left px-4 py-3 hover:bg-orange-50 transition border-b border-slate-100 last:border-b-0"
                  >
                    <span className="font-medium text-slate-800">{student.student_name}</span>
                    <span className="ml-2 text-xs text-orange-600 font-medium">Out of Turn</span>
                  </button>
                ))}
              </div>
            )}
            {studentSearch.length >= 1 && searchResults.length === 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-400">
                No students found
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handleResetAll}
              className="px-5 py-3 bg-slate-100 text-slate-600 rounded-lg font-semibold hover:bg-slate-200 transition border border-slate-300"
            >
              Reset All Selections
            </button>
            <button
              onClick={handleSubmitAttendance}
              disabled={saving}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : '💾 Save Attendance'}
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default MarkAttendanceTab;
