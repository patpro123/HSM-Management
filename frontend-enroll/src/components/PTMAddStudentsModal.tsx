import { useState, useEffect } from 'react';
import { apiGet } from '../api';

const PAGE_SIZE = 10;

interface StudentOption {
  id: string;
  name: string;
  teacher_name?: string;
  teacher_id?: string;
  instrument_name?: string;
}

interface PTMAddStudentsModalProps {
  sessionId?: string;
  existingStudentIds: string[];
  onClose: () => void;
  onAdd: (selections: { student_id: string; teacher_id: string }[]) => Promise<void>;
  onRemove?: (studentId: string) => Promise<void>;
}

export default function PTMAddStudentsModal({
  existingStudentIds,
  onClose,
  onAdd,
  onRemove,
}: PTMAddStudentsModalProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [studentTeacherMap, setStudentTeacherMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    apiGet('/api/ptm/eligible-students').then(res => {
      const rawStudents: any[] = res.students || [];
      const opts: StudentOption[] = rawStudents.map((s: any) => ({
        id: String(s.id),
        name: s.name || '',
        teacher_id: s.teacher_id ? String(s.teacher_id) : undefined,
        teacher_name: s.teacher_name || undefined,
        instrument_name: s.instrument_name || undefined,
      }));
      setStudents(opts);
      const teacherMap = new Map<string, string>();
      opts.forEach(s => { if (s.teacher_id) teacherMap.set(s.teacher_id, s.teacher_name || ''); });
      setTeachers([...teacherMap.entries()].map(([id, name]) => ({ id, name })));
      const map: Record<string, string> = {};
      opts.forEach(s => { if (s.teacher_id) map[s.id] = s.teacher_id; });
      setStudentTeacherMap(map);
    }).finally(() => setLoading(false));
  }, []);

  // Reset to first page when search or filter changes
  useEffect(() => { setPage(0); }, [search, filterTeacher]);

  const visible = students.filter(s => {
    if (filterTeacher && s.teacher_id !== filterTeacher) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(visible.length / PAGE_SIZE);
  const paged = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const newOnPage = paged.filter(s => !existingStudentIds.includes(s.id));
  const allNewOnPageSelected = newOnPage.length > 0 && newOnPage.every(s => selected.has(s.id));

  const togglePageAll = () => {
    const next = new Set(selected);
    if (allNewOnPageSelected) {
      newOnPage.forEach(s => next.delete(s.id));
    } else {
      newOnPage.forEach(s => next.add(s.id));
    }
    setSelected(next);
  };

  const handleAdd = async () => {
    if (!selected.size) return;
    setAdding(true);
    try {
      const selections = [...selected]
        .map(id => ({ student_id: id, teacher_id: studentTeacherMap[id] || '' }))
        .filter(s => s.teacher_id);
      await onAdd(selections);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (!onRemove) return;
    if (!window.confirm('Remove this student from the PTM?')) return;
    setRemovingId(studentId);
    try {
      await onRemove(studentId);
    } finally {
      setRemovingId(null);
    }
  };

  const existingCount = visible.filter(s => existingStudentIds.includes(s.id)).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Manage PTM Students</h2>
            {!loading && (
              <p className="text-xs text-slate-500 mt-0.5">
                {existingStudentIds.length} in PTM · {students.length - existingStudentIds.length} available
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Search + Filter */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
            value={filterTeacher}
            onChange={e => setFilterTeacher(e.target.value)}
          >
            <option value="">All Teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center py-10 text-slate-400 text-sm">Loading...</p>
          ) : visible.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">No students match the filter.</p>
          ) : (
            <>
              {/* Select-all row for this page */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                <input
                  type="checkbox"
                  checked={allNewOnPageSelected}
                  onChange={togglePageAll}
                  disabled={newOnPage.length === 0}
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="text-xs text-slate-500 flex-1">
                  {selected.size > 0 ? `${selected.size} selected` : 'Select all on page'}
                  {existingCount > 0 && ` · ${existingCount} already in PTM`}
                </span>
              </div>

              {paged.map(s => {
                const isExisting = existingStudentIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 ${isExisting ? 'bg-green-50' : ''}`}
                  >
                    {isExisting ? (
                      <span className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                          setSelected(next);
                        }}
                        className="w-5 h-5 accent-orange-600 flex-shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 text-sm leading-tight">{s.name}</span>
                        {isExisting && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">In PTM</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {s.teacher_name && <span className="text-xs text-slate-500">{s.teacher_name}</span>}
                        {s.instrument_name && (
                          <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{s.instrument_name}</span>
                        )}
                        {!s.teacher_id && (
                          <span className="text-xs text-amber-600">No teacher assigned</span>
                        )}
                      </div>
                    </div>

                    {isExisting && onRemove && (
                      <button
                        onClick={() => handleRemove(s.id)}
                        disabled={removingId === s.id}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
                        title="Remove from PTM"
                      >
                        {removingId === s.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-white font-medium"
            >
              ← Prev
            </button>
            <span className="text-xs text-slate-500">
              {page + 1} / {totalPages} &nbsp;·&nbsp; {visible.length} students
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-white font-medium"
            >
              Next →
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 pb-5 pt-3 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Done
          </button>
          <button
            onClick={handleAdd}
            disabled={adding || selected.size === 0}
            className="flex-1 bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : selected.size > 0 ? `Add ${selected.size} Student${selected.size !== 1 ? 's' : ''}` : 'Add Students'}
          </button>
        </div>
      </div>
    </div>
  );
}
