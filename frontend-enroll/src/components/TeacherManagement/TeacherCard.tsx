import PhoneLink from '../PhoneLink';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  role: string;
  payout_type: 'per_student_monthly' | 'fixed';
  rate: number;
  is_active: boolean;
  batch_count: number;
  created_at: string;
  metadata?: {
    email?: string;
  };
}

interface Batch {
  id: string;
  instrument_id: string;
  instrument_name: string;
  teacher_id: string | null;
  recurrence: string;
  start_time: string;
  end_time: string;
  capacity: number;
}

interface TeacherCardProps {
  teacher: Teacher;
  onEdit: () => void;
  onDelete: () => void;
  onView360: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  batches: Batch[];
  students?: any[];
  onEditBatch?: (batch: Batch) => void;
}

export default function TeacherCard({
  teacher,
  onEdit,
  onDelete,
  onView360,
  isExpanded,
  onToggleExpand,
  batches,
  students,
  onEditBatch
}: TeacherCardProps) {
  const getPayTypeLabel = (type: string) => {
    if (type === 'per_student_monthly') return 'Per Student/Month';
    if (type === 'fixed') return 'Fixed Salary';
    return type.replace('_', ' ');
  };

  return (
    <div className={`bg-white rounded-lg border-2 transition-all hover:shadow-lg ${
      teacher.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {teacher.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{teacher.name}</h3>
              <p className="text-sm text-slate-500"><PhoneLink phone={teacher.phone} fallback="No phone" /></p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onView360}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              360
            </button>
            <button
              onClick={onEdit}
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 font-medium text-sm"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Pay Type:</span>
            <span className="font-medium">{getPayTypeLabel(teacher.payout_type)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Rate:</span>
            <span className="font-medium">₹{teacher.rate.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Batches:</span>
            <span className="font-medium">{teacher.batch_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Status:</span>
            <span className={`font-medium ${teacher.is_active ? 'text-green-600' : 'text-slate-400'}`}>
              {teacher.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {teacher.batch_count > 0 && (
          <button
            onClick={onToggleExpand}
            className="w-full mt-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 border-t border-slate-200 transition-colors"
          >
            {isExpanded ? '▼ Hide Details' : '▶ View Batches & Students'}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50">
          {/* Batches sub-section */}
          {batches.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Assigned Batches</h4>
              <div className="space-y-2">
                {batches.map(batch => (
                  <div key={batch.id} className="bg-white rounded p-3 border border-slate-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 text-sm">{batch.instrument_name}</div>
                        <div className="text-xs text-slate-600 mt-1">{batch.recurrence}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-500">Cap: {batch.capacity}</div>
                        {onEditBatch && (
                          <button
                            onClick={() => onEditBatch(batch)}
                            className="text-orange-600 hover:text-orange-700 text-xs font-medium px-2 py-1 rounded hover:bg-orange-50"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students sub-section */}
          <div className={`p-4 ${batches.length > 0 ? 'border-t border-slate-200' : ''}`}>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Enrolled Students
              {students !== undefined && (
                <span className="ml-2 text-xs font-normal text-slate-500">({students.length})</span>
              )}
            </h4>
            {students === undefined ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-orange-400"></div>
                Loading…
              </div>
            ) : students.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active students enrolled.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {students.map(s => (
                  <div key={s.id} className="bg-white rounded p-2 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.instrument} · {s.recurrence}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500"><PhoneLink phone={s.phone || s.guardian_contact} fallback="" /></div>
                      {s.classes_remaining !== null && (
                        <div className="text-xs text-orange-600 font-medium">{s.classes_remaining} cls left</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
