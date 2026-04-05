import React from 'react';
import { Student } from '../../types';
import PhoneLink from '../PhoneLink';

interface StudentTableViewProps {
  students: Student[];
  isReadonly: boolean;
  onView360: (id: string | number) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string | number) => void;
  onRestore: (id: string | number) => void;
}

const StudentTableView: React.FC<StudentTableViewProps> = ({
  students,
  isReadonly,
  onView360,
  onEdit,
  onDelete,
  onRestore,
}) => {
  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="text-center py-20 text-slate-400">
          No students found. Add a new student to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Student</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Guardian</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Enrollments</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map(student => (
              <tr key={student.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                      {(() => {
                        if (student.first_name && student.last_name) {
                          return `${student.first_name[0]}${student.last_name[0]}`;
                        }
                        const name = (student as any).name || 'N A';
                        const parts = name.split(' ');
                        return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.substring(0, 2).toUpperCase();
                      })()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                        {(student as any).is_active === false && (
                          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">Inactive</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{((student as any).metadata?.email) || student.email || 'No email'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-600">
                    <PhoneLink phone={student.phone} fallback="N/A" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-600">
                    <div>{((student as any).metadata?.guardian_name) || student.guardian_name || (student as any).guardian_contact || 'N/A'}</div>
                    <div className="text-xs text-slate-500"><PhoneLink phone={((student as any).metadata?.guardian_phone) || student.guardian_phone} fallback="N/A" /></div>
                    <div className="text-xs text-slate-500">{((student as any).metadata?.address) || student.address || ''}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {(student as any).batches && (student as any).batches.length > 0 ? (
                    <div className="space-y-1">
                      {(student as any).batches.map((batch: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {batch.instrument || 'Unknown'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {batch.teacher || 'No teacher'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Not enrolled</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView360(student.id || (student as any).student_id)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                    >
                      360°
                    </button>
                    {!isReadonly && (
                      <>
                        <button
                          onClick={() => onEdit(student)}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition"
                        >
                          ✏️ Edit
                        </button>
                        {(student as any).is_active !== false ? (
                          <button
                            onClick={() => onDelete((student as any).student_id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                          >
                            🗑️
                          </button>
                        ) : (
                          <button
                            onClick={() => onRestore((student as any).student_id)}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition"
                          >
                            ♻️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentTableView;
