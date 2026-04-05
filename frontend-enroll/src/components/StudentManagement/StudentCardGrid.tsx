import React from 'react';
import { Student } from '../../types';
import PhoneLink from '../PhoneLink';

interface StudentCardGridProps {
  students: Student[];
  isReadonly: boolean;
  onView360: (id: string | number) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string | number) => void;
  onRestore: (id: string | number) => void;
}

const StudentCardGrid: React.FC<StudentCardGridProps> = ({
  students,
  isReadonly,
  onView360,
  onEdit,
  onDelete,
  onRestore,
}) => {
  if (students.length === 0) {
    return (
      <div className="col-span-full text-center py-20 text-slate-400">
        No students found. Add a new student to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {students.map(student => (
        <div key={student.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
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
                <h3 className="font-bold text-slate-900">
                  {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                </h3>
                <p className="text-xs text-slate-500">{((student as any).metadata?.email) || student.email || 'No email'}</p>
              </div>
            </div>
          </div>

          {(student as any).is_active === false && (
            <div className="mb-4">
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">Inactive</span>
            </div>
          )}

          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center gap-2 text-slate-600">
              <span>📱</span>
              <PhoneLink phone={student.phone} fallback="N/A" />
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span>👤</span>
              <span>{((student as any).metadata?.guardian_name) || student.guardian_name || (student as any).guardian_contact || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span>📞</span>
              <PhoneLink phone={((student as any).metadata?.guardian_phone) || student.guardian_phone} fallback="N/A" />
            </div>
            <div className="flex items-start gap-2 text-slate-600">
              <span className="mt-1">📍</span>
              <span className="flex-1">{((student as any).metadata?.address) || student.address || 'No address provided'}</span>
            </div>
          </div>

          {(student as any).batches && (student as any).batches.length > 0 && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-600 mb-2">Instruments:</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set<string>((student as any).batches.map((b: any) => b.instrument).filter(Boolean))].map((instrument, idx) => (
                  <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                    {instrument}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button
              onClick={() => onView360(student.id || (student as any).student_id)}
              className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition"
            >
              View 360°
            </button>
            {!isReadonly && (
              <>
                <button
                  onClick={() => onEdit(student)}
                  className="flex-1 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg font-medium hover:bg-orange-100 transition"
                >
                  ✏️ Edit
                </button>
                {(student as any).is_active !== false ? (
                  <button
                    onClick={() => onDelete((student as any).student_id)}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition"
                  >
                    🗑️
                  </button>
                ) : (
                  <button
                    onClick={() => onRestore((student as any).student_id)}
                    className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg font-medium hover:bg-green-100 transition"
                  >
                    ♻️ Restore
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StudentCardGrid;
