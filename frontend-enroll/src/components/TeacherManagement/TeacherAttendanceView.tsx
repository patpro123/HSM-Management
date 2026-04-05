interface Teacher {
  id: string;
  name: string;
  is_active: boolean;
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

interface TeacherAttendanceViewProps {
  teachers: Teacher[];
  batches: Batch[];
  attendanceTeacherId: string;
  setAttendanceTeacherId: (id: string) => void;
  attendanceDate: string;
  setAttendanceDate: (date: string) => void;
  scheduledBatches: any[];
  attendanceLoading: boolean;
  attendanceSaving: string | null;
  numExtraBatches: number;
  extraBatchSelections: string[];
  extraReasonPreset: string;
  extraNotes: string;
  setExtraReasonPreset: (v: string) => void;
  setExtraNotes: (v: string) => void;
  handleNumExtraBatchesChange: (maxOptions: number, n: number) => void;
  setExtraBatchSelections: React.Dispatch<React.SetStateAction<string[]>>;
  markTeacherAttendance: (batch: any, status: 'conducted' | 'not_conducted') => void;
  markAllTeacherAttendance: (batches: any[], status: 'conducted' | 'not_conducted') => void;
  markExtraAttendance: (status: 'conducted' | 'not_conducted') => void;
}

export default function TeacherAttendanceView({
  teachers,
  batches,
  attendanceTeacherId,
  setAttendanceTeacherId,
  attendanceDate,
  setAttendanceDate,
  scheduledBatches,
  attendanceLoading,
  attendanceSaving,
  numExtraBatches,
  extraBatchSelections,
  extraReasonPreset,
  extraNotes,
  setExtraReasonPreset,
  setExtraNotes,
  handleNumExtraBatchesChange,
  setExtraBatchSelections,
  markTeacherAttendance,
  markAllTeacherAttendance,
  markExtraAttendance
}: TeacherAttendanceViewProps) {
  const selectedAttTeacher = teachers.find(t => t.id === attendanceTeacherId) || null;
  const teacherScheduledBatches = scheduledBatches.filter(b => b.teacher_id === attendanceTeacherId);
  const teacherBatchOptions = batches.filter(b => b.teacher_id === attendanceTeacherId);
  const formattedDate = attendanceDate
    ? new Date(attendanceDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="space-y-4">
      {/* Teacher + Date selectors */}
      <div className="flex items-center gap-4 bg-violet-50 border border-violet-100 rounded-xl p-4 flex-wrap gap-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-violet-700 whitespace-nowrap">Teacher:</label>
          <select
            value={attendanceTeacherId}
            onChange={e => setAttendanceTeacherId(e.target.value)}
            className="px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          >
            <option value="">Select teacher…</option>
            {teachers.filter(t => t.is_active).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-violet-700 whitespace-nowrap">Date:</label>
          <input
            type="date"
            value={attendanceDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setAttendanceDate(e.target.value)}
            className="px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          />
        </div>
        {formattedDate && (
          <span className="text-xs text-violet-500 ml-auto hidden sm:block">{formattedDate}</span>
        )}
      </div>

      {/* Prompt to select teacher */}
      {!attendanceTeacherId && (
        <div className="text-center py-12 border rounded-xl border-dashed border-slate-200 text-slate-400">
          <p className="text-lg font-medium">Select a teacher above</p>
          <p className="text-sm mt-1">Pick a teacher and date to view or mark their attendance.</p>
        </div>
      )}

      {/* Loading */}
      {attendanceTeacherId && attendanceLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500"></div>
          <p className="mt-3 text-slate-500 text-sm">Loading…</p>
        </div>
      )}

      {/* Attendance content */}
      {attendanceTeacherId && !attendanceLoading && (
        <>
          {teacherScheduledBatches.length > 0 ? (
            /* Scheduled batches */
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap gap-3 justify-between items-center">
                <span className="text-sm font-semibold text-slate-600">
                  {teacherScheduledBatches.length} class{teacherScheduledBatches.length !== 1 ? 'es' : ''} scheduled for {selectedAttTeacher?.name} on {formattedDate}
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-2">
                    <button
                      disabled={attendanceSaving !== null}
                      onClick={() => markAllTeacherAttendance(teacherScheduledBatches, 'conducted')}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-wait transition-colors"
                    >
                      Mark All Conducted
                    </button>
                    <button
                      disabled={attendanceSaving !== null}
                      onClick={() => markAllTeacherAttendance(teacherScheduledBatches, 'not_conducted')}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-wait transition-colors"
                    >
                      Mark All Not Conducted
                    </button>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Conducted</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Not Conducted</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span> Unmarked</span>
                  </div>
                </div>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                    <th className="py-3 px-4">Instrument</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Schedule</th>
                    <th className="py-3 px-4 text-center">Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teacherScheduledBatches.map(b => (
                    <tr key={b.batch_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-medium text-slate-800">{b.instrument_name}</td>
                      <td className="py-3 px-4 text-slate-600 text-sm">{b.start_time} – {b.end_time}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{b.recurrence}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 justify-center">
                          <button
                            disabled={attendanceSaving === b.batch_id}
                            onClick={() => markTeacherAttendance(b, 'conducted')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                              b.status === 'conducted'
                                ? 'bg-green-500 text-white border-green-500 shadow'
                                : 'bg-white text-green-600 border-green-300 hover:bg-green-50'
                            } ${attendanceSaving === b.batch_id ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            Conducted
                          </button>
                          <button
                            disabled={attendanceSaving === b.batch_id}
                            onClick={() => markTeacherAttendance(b, 'not_conducted')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                              b.status === 'not_conducted'
                                ? 'bg-red-500 text-white border-red-500 shadow'
                                : 'bg-white text-red-500 border-red-300 hover:bg-red-50'
                            } ${attendanceSaving === b.batch_id ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            Not Conducted
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* No class scheduled: unscheduled / extra class form */
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900">No class scheduled</h3>
                  <p className="text-amber-800 text-sm mt-1">
                    <strong>{selectedAttTeacher?.name}</strong> doesn't have a class scheduled on {formattedDate}.
                  </p>
                  <p className="text-amber-700 text-sm mt-2">
                    Do you still want to mark attendance? Select a reason below:
                  </p>

                  {/* Reason presets */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {['Compensation Class', 'Extra Class', 'Trial Class', 'Other'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setExtraReasonPreset(extraReasonPreset === preset ? '' : preset)}
                        className={`px-3 py-1 text-sm rounded-full border transition-all ${
                          extraReasonPreset === preset
                            ? 'bg-amber-500 text-white border-amber-500 shadow'
                            : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Free-text notes */}
                  <input
                    type="text"
                    placeholder="Additional notes (e.g. replacing missed class on Feb 10)…"
                    value={extraNotes}
                    onChange={e => setExtraNotes(e.target.value)}
                    className="mt-3 w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />

                  {/* Number of batches + batch selectors */}
                  {teacherBatchOptions.length > 0 ? (
                    <>
                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-sm font-medium text-amber-800 whitespace-nowrap">
                          How many batches were conducted?
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={teacherBatchOptions.length}
                          value={numExtraBatches}
                          onChange={e => handleNumExtraBatchesChange(
                            teacherBatchOptions.length,
                            parseInt(e.target.value) || 1
                          )}
                          className="w-16 px-2 py-1.5 border border-amber-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        />
                        <span className="text-xs text-amber-600">
                          (max {teacherBatchOptions.length})
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {extraBatchSelections.map((batchId, idx) => (
                          <select
                            key={idx}
                            value={batchId}
                            onChange={e => {
                              const next = [...extraBatchSelections];
                              next[idx] = e.target.value;
                              setExtraBatchSelections(next);
                            }}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          >
                            <option value="">Select batch {idx + 1}…</option>
                            {teacherBatchOptions.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.instrument_name} ({b.recurrence})
                              </option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-amber-700 italic">
                      This teacher has no assigned batches. Assign a batch first before marking attendance.
                    </p>
                  )}

                  {/* Action buttons */}
                  {teacherBatchOptions.length > 0 && (() => {
                    const allSelected = extraBatchSelections.every(Boolean);
                    const canSave = extraReasonPreset && allSelected && attendanceSaving === null;
                    return (
                      <div className="flex gap-3 mt-4 flex-wrap">
                        <button
                          disabled={!canSave}
                          onClick={() => markExtraAttendance('conducted')}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
                        >
                          {attendanceSaving ? 'Saving…' : `Mark ${numExtraBatches > 1 ? `All ${numExtraBatches} ` : ''}as Conducted`}
                        </button>
                        <button
                          disabled={!canSave}
                          onClick={() => markExtraAttendance('not_conducted')}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
                        >
                          {attendanceSaving ? 'Saving…' : `Mark ${numExtraBatches > 1 ? `All ${numExtraBatches} ` : ''}as Not Conducted`}
                        </button>
                        {!extraReasonPreset && (
                          <span className="text-xs text-amber-600 self-center">Select a reason to enable marking.</span>
                        )}
                        {extraReasonPreset && !allSelected && (
                          <span className="text-xs text-amber-600 self-center">Select a batch for each row.</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
