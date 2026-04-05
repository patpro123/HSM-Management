import { Instrument } from '../../types';

interface Teacher {
  id: string;
  name: string;
  payout_type: 'per_student_monthly' | 'fixed';
  rate: number;
  is_active: boolean;
  batch_count: number;
  created_at: string;
}

interface BatchForm {
  instrument_id: string;
  teacher_id: string;
  dayTimings: { day: string; start_time: string; end_time: string }[];
  capacity: number;
}

interface BatchModalProps {
  form: BatchForm;
  setForm: (form: BatchForm) => void;
  instruments: Instrument[];
  teachers: Teacher[];
  onSave: () => void;
  onClose: () => void;
  isEdit?: boolean;
  batchInstrument?: string;
}

const dayOptions = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' }
];

export default function BatchModal({
  form,
  setForm,
  instruments,
  teachers,
  onSave,
  onClose,
  isEdit = false,
  batchInstrument
}: BatchModalProps) {
  const addDayTiming = () => {
    setForm({
      ...form,
      dayTimings: [...form.dayTimings, { day: '', start_time: '', end_time: '' }]
    });
  };

  const removeDayTiming = (index: number) => {
    if (form.dayTimings.length > 1) {
      setForm({
        ...form,
        dayTimings: form.dayTimings.filter((_, i) => i !== index)
      });
    }
  };

  const updateDayTiming = (index: number, field: 'day' | 'start_time' | 'end_time', value: string) => {
    const newDayTimings = [...form.dayTimings];
    newDayTimings[index] = { ...newDayTimings[index], [field]: value };
    setForm({ ...form, dayTimings: newDayTimings });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-slate-900 mb-4">
          {isEdit ? 'Edit Batch' : 'Create New Batch'}
        </h3>

        <div className="space-y-4">
          {isEdit ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Instrument</label>
              <div className="text-slate-900 font-medium">{batchInstrument}</div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instrument *</label>
              <select
                value={form.instrument_id}
                onChange={e => setForm({ ...form, instrument_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select instrument</option>
                {instruments.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teacher</label>
            <select
              value={form.teacher_id}
              onChange={e => setForm({ ...form, teacher_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">No teacher assigned</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Day & Timings *</h4>
              <button
                type="button"
                onClick={addDayTiming}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
              >
                + Add Day
              </button>
            </div>

            <div className="space-y-3">
              {form.dayTimings.map((dayTiming, index) => (
                <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
                        <select
                          value={dayTiming.day}
                          onChange={e => updateDayTiming(index, 'day', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Select day</option>
                          {dayOptions.map(day => (
                            <option key={day.value} value={day.value}>{day.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={dayTiming.start_time}
                            onChange={e => updateDayTiming(index, 'start_time', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">End Time</label>
                          <input
                            type="time"
                            value={dayTiming.end_time}
                            onChange={e => updateDayTiming(index, 'end_time', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                    {form.dayTimings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDayTiming(index)}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Each day can have different timings. Add multiple days for classes held on different days.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Capacity *</label>
            <input
              type="number"
              value={form.capacity}
              onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 8 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="8"
              min="1"
            />
          </div>

          {!isEdit && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                <strong>Batch Summary:</strong> {
                  (() => {
                    const validDays = form.dayTimings.filter(dt => dt.day && dt.start_time && dt.end_time);
                    return validDays.length > 0
                      ? `Creating 1 batch with ${validDays.length} day${validDays.length > 1 ? 's' : ''}`
                      : 'No valid day timings added yet';
                  })()
                }
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-colors font-medium shadow-lg"
          >
            {isEdit ? 'Update Batch' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}
