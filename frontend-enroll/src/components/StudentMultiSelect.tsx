import { useMemo, useState } from 'react';

export interface PickerStudent {
  id: string;
  name: string;
  instrument: string;
}

interface StudentMultiSelectProps {
  students: PickerStudent[];
  value: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

export default function StudentMultiSelect({ students, value, onChange, loading }: StudentMultiSelectProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? students.filter((s) => s.name.toLowerCase().includes(q) || s.instrument.toLowerCase().includes(q))
      : students;
  }, [students, search]);

  const groups = useMemo(() => {
    const map: Record<string, PickerStudent[]> = {};
    for (const s of filtered) {
      (map[s.instrument] ??= []).push(s);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleOne = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const selectAllGroup = (ids: string[]) => {
    const next = new Set(value);
    ids.forEach((id) => next.add(id));
    onChange([...next]);
  };

  const clearGroup = (ids: string[]) => {
    const remove = new Set(ids);
    onChange(value.filter((id) => !remove.has(id)));
  };

  const clearAll = () => onChange([]);

  if (loading) {
    return <p className="text-xs text-gray-400 py-2">Loading students…</p>;
  }

  if (students.length === 0) {
    return <p className="text-xs text-gray-400 py-2">No students found.</p>;
  }

  return (
    <div className="space-y-2">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or instrument…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      {/* Grouped list */}
      <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
        {groups.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 py-3">No students match your search.</p>
        ) : (
          groups.map(([instrument, gStudents]) => {
            const groupIds = gStudents.map((s) => s.id);
            const allSelected = groupIds.every((id) => value.includes(id));

            return (
              <div key={instrument}>
                {/* Group header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 sticky top-0">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {instrument}
                    <span className="ml-1 font-normal text-gray-400">({gStudents.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => allSelected ? clearGroup(groupIds) : selectAllGroup(groupIds)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {allSelected ? 'Clear' : 'Select All'}
                  </button>
                </div>
                {/* Students in group */}
                {gStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.includes(s.id)}
                      onChange={() => toggleOne(s.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-800">{s.name}</span>
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {value.length} of {students.length} selected
        </span>
        {value.length > 0 && (
          <button type="button" onClick={clearAll} className="text-red-400 hover:text-red-600">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
