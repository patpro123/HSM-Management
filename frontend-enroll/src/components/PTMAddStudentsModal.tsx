import { useState, useEffect } from 'react';
import { apiGet } from '../api';

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
}

export default function PTMAddStudentsModal({ existingStudentIds, onClose, onAdd }: PTMAddStudentsModalProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [studentTeacherMap, setStudentTeacherMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet('/api/students?status=active&student_type=permanent'),
      apiGet('/api/teachers'),
    ]).then(([sRes, tRes]) => {
      const rawStudents: any[] = sRes.students || [];
      const rawTeachers: any[] = tRes.teachers || [];

      const opts: StudentOption[] = rawStudents.map((s: any) => {
        const primaryBatch = (s.batches || [])[0];
        return {
          id: String(s.id),
          name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
          teacher_id: primaryBatch?.teacher_id ? String(primaryBatch.teacher_id) : undefined,
          teacher_name: primaryBatch?.teacher_name,
          instrument_name: primaryBatch?.instrument_name,
        };
      });

      setStudents(opts);
      setTeachers(rawTeachers.map((t: any) => ({ id: String(t.id), name: t.name })));

      const map: Record<string, string> = {};
      opts.forEach(s => { if (s.teacher_id) map[s.id] = s.teacher_id; });
      setStudentTeacherMap(map);
    }).finally(() => setLoading(false));
  }, []);

  const visible = students.filter(s => {
    if (existingStudentIds.includes(s.id)) return false;
    if (filterTeacher && s.teacher_id !== filterTeacher) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map(s => s.id)));
    }
  };

  const handleAdd = async () => {
    if (!selected.size) return;
    setAdding(true);
    try {
      const selections = [...selected].map(id => {
        const teacherId = studentTeacherMap[id] || (teachers[0]?.id ?? '');
        return { student_id: id, teacher_id: teacherId };
      }).filter(s => s.teacher_id);
      await onAdd(selections);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Add Students to PTM</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 border-b border-slate-100 space-y-2">
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

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center py-8 text-slate-400 text-sm">Loading...</p>
          ) : visible.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No students match the filter.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50">
                <input
                  type="checkbox"
                  checked={selected.size === visible.length && visible.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="text-xs text-slate-500">{selected.size} of {visible.length} selected</span>
              </div>
              {visible.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                      setSelected(next);
                    }}
                    className="w-4 h-4 accent-orange-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.teacher_name && <span className="text-xs text-slate-500">{s.teacher_name}</span>}
                      {s.instrument_name && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{s.instrument_name}</span>}
                    </div>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={adding || selected.size === 0}
            className="flex-1 bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : `Add ${selected.size || ''} Students`}
          </button>
        </div>
      </div>
    </div>
  );
}
