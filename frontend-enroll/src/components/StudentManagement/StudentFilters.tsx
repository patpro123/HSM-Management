import React from 'react';
import { Instrument, Batch } from '../../types';

interface StudentFiltersProps {
  filterType: 'permanent' | 'prospect';
  filterStatus: 'active' | 'inactive' | 'all';
  filterTeacher: string;
  filterInstruments: (string | number)[];
  filterBatches: (string | number)[];
  instruments: Instrument[];
  batches: Batch[];
  teachers: any[];
  prospects: any[];
  relevantBatches: Batch[];
  onFilterTypeChange: (type: 'permanent' | 'prospect') => void;
  onFilterStatusChange: (status: 'active' | 'inactive' | 'all') => void;
  onFilterTeacherChange: (teacher: string) => void;
  onInstrumentToggle: (instrumentId: string | number) => void;
  onBatchToggle: (batchId: string | number) => void;
  onClearInstruments: () => void;
  onClearBatches: () => void;
}

const StudentFilters: React.FC<StudentFiltersProps> = ({
  filterType,
  filterStatus,
  filterTeacher,
  filterInstruments,
  filterBatches,
  instruments,
  teachers,
  prospects,
  relevantBatches,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterTeacherChange,
  onInstrumentToggle,
  onBatchToggle,
  onClearInstruments,
  onClearBatches,
}) => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap gap-8">
        {/* Type filter */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Student Type</h3>
          <div className="flex gap-4">
            {([['permanent', 'Students'], ['prospect', 'Prospects']] as const).map(([type, label]) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filterType"
                  checked={filterType === type}
                  onChange={() => onFilterTypeChange(type)}
                  className="text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-slate-700">
                  {label}
                  {type === 'prospect' && prospects.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">{prospects.length}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
        {/* Status filter */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Status</h3>
          <div className="flex gap-4">
            {(['active', 'inactive', 'all'] as const).map(status => (
              <label key={status} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="status" checked={filterStatus === status} onChange={() => onFilterStatusChange(status)} className="text-orange-600 focus:ring-orange-500" />
                <span className="text-sm text-slate-700 capitalize">{status}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Instrument</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(instruments || []).map(inst => (
            <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterInstruments.includes(inst.id)}
                onChange={() => onInstrumentToggle(inst.id)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-sm text-slate-700">{inst.name}</span>
            </label>
          ))}
        </div>
        {filterInstruments.length > 0 && (
          <button
            onClick={onClearInstruments}
            className="mt-3 text-xs text-orange-600 hover:text-orange-800 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {filterInstruments.length > 0 && relevantBatches.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Batch</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {relevantBatches.map(batch => (
              <label key={batch.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterBatches.includes(batch.id)}
                  onChange={() => onBatchToggle(batch.id)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-sm text-slate-700">
                  {batch.recurrence} {batch.start_time ? `(${String(batch.start_time).slice(0, 5)})` : ''}
                </span>
              </label>
            ))}
          </div>
          {filterBatches.length > 0 && (
            <button
              onClick={onClearBatches}
              className="mt-3 text-xs text-orange-600 hover:text-orange-800 font-medium"
            >
              Clear batch filters
            </button>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Teacher</h3>
        <select
          value={filterTeacher}
          onChange={e => onFilterTeacherChange(e.target.value)}
          className="w-full md:w-64 px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
        >
          <option value="all">All Teachers</option>
          {teachers.map(teacher => (
            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default StudentFilters;
