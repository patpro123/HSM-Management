import React, { useState } from 'react';
import Student360View from './Student360View';
import TeacherBatchAttendance from './TeacherBatchAttendance';
import PhoneLink from './PhoneLink';
import XPBadge from './XPBadge';

interface TeacherStudent {
  id: string;
  name: string;
  phone?: string;
  guardian_contact?: string;
  instrument: string;
  batch_id: string;
  recurrence: string;
  enrollment_status?: string;
  classes_remaining?: number | null;
  total_xp?: number;
}

interface TeacherStudentListProps {
  students: TeacherStudent[];
}

const TeacherStudentList: React.FC<TeacherStudentListProps> = ({ students }) => {
  const [search, setSearch] = useState('');
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [attendanceBatchId, setAttendanceBatchId] = useState<string | null>(null);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.instrument.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or instrument…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 italic text-sm">
          {students.length === 0 ? 'No active students enrolled.' : 'No students match your search.'}
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map(s => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-gray-900 text-sm">{s.name}</span>
                    {s.total_xp != null && <XPBadge totalXP={s.total_xp} compact />}
                  </div>
                  {s.classes_remaining !== null && s.classes_remaining !== undefined && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.classes_remaining <= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.classes_remaining} cls left
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{s.instrument}</span>
                  <span className="text-xs text-gray-500">{s.recurrence}</span>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  <PhoneLink phone={s.phone || s.guardian_contact} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProfileStudentId(s.id)}
                    className="flex-1 text-xs px-3 py-2 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors text-center"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => setAttendanceBatchId(s.batch_id)}
                    className="flex-1 text-xs px-3 py-2 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium transition-colors text-center"
                  >
                    Attendance
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Instrument</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Cls Left</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="py-3 pl-4 pr-3 text-sm font-medium text-gray-900">
                      <div className="flex flex-col gap-0.5">
                        <span>{s.name}</span>
                        {s.total_xp != null && <XPBadge totalXP={s.total_xp} compact />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{s.instrument}</td>
                    <td className="px-3 py-3 text-sm text-gray-500">{s.recurrence}</td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      <PhoneLink phone={s.phone || s.guardian_contact} />
                    </td>
                    <td className="px-3 py-3 text-sm text-right">
                      {s.classes_remaining !== null && s.classes_remaining !== undefined ? (
                        <span className={`font-medium ${s.classes_remaining <= 3 ? 'text-red-600' : 'text-gray-700'}`}>
                          {s.classes_remaining}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setProfileStudentId(s.id)}
                          className="text-xs px-3 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => setAttendanceBatchId(s.batch_id)}
                          className="text-xs px-3 py-1 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium transition-colors"
                        >
                          Attendance
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Student Profile Modal */}
      {profileStudentId && (
        <Student360View
          studentId={profileStudentId}
          hidePayments={true}
          isModal={true}
          onClose={() => setProfileStudentId(null)}
        />
      )}

      {/* Batch Attendance Modal */}
      {attendanceBatchId && (
        <TeacherBatchAttendance
          batchId={attendanceBatchId}
          onClose={() => setAttendanceBatchId(null)}
        />
      )}
    </div>
  );
};

export default TeacherStudentList;
