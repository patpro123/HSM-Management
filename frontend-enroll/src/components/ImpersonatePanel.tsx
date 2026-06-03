import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';

export interface ImpersonateTarget {
  type: 'teacher' | 'student';
  id: string;
  name: string;
}

interface Props {
  onSelect: (target: ImpersonateTarget) => void;
  onClose: () => void;
}

const ImpersonatePanel: React.FC<Props> = ({ onSelect, onClose }) => {
  const [tab, setTab] = useState<'teacher' | 'student'>('teacher');
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet('/api/teachers'),
      apiGet('/api/enrollments'),
    ]).then(([t, s]) => {
      setTeachers((t.teachers || []).map((x: any) => ({ id: String(x.id), name: x.name })));
      setStudents((s.enrollments || []).map((x: any) => ({ id: String(x.id), name: x.name })).filter((x: any) => x.name));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const list = tab === 'teacher' ? teachers : students;
  const filtered = list.filter(x => x.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">View as...</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
            >
              ×
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            {(['teacher', 'student'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(''); }}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  tab === t ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'teacher' ? 'Teachers' : 'Students'}
              </button>
            ))}
          </div>

          <input
            autoFocus
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />

          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelect({ type: tab, id: item.id, name: item.name })}
                  className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-colors text-sm font-medium text-slate-700"
                >
                  {item.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">No results</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImpersonatePanel;
