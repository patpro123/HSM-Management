import React, { useState, useRef } from 'react';
import { apiGet, apiPost } from '../api';
import { getCurrentUser } from '../auth';

interface HomeworkAssignFormProps {
  studentId: string;
  onAssigned: () => void;
  onShowAudioInst: () => void;
}

const HomeworkAssignForm: React.FC<HomeworkAssignFormProps> = ({ studentId, onAssigned, onShowAudioInst }) => {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignTotalMarks, setAssignTotalMarks] = useState('');
  const [assignBreakdown, setAssignBreakdown] = useState<{ name: string; marks: string }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [habitTargetOpen, setHabitTargetOpen] = useState(false);
  const [habitTargetHabitId, setHabitTargetHabitId] = useState('');
  const [habitTargetCount, setHabitTargetCount] = useState('');
  const [studentHabits, setStudentHabits] = useState<{ id: string; title: string; icon: string }[]>([]);
  const [theoryTaskOpen, setTheoryTaskOpen] = useState(false);
  const [theoryPromptText, setTheoryPromptText] = useState('');
  const [theoryPromptFile, setTheoryPromptFile] = useState<string | null>(null);
  const [theoryPromptFileName, setTheoryPromptFileName] = useState('');
  const theoryPromptFileRef = useRef<HTMLInputElement | null>(null);

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  const handleTheoryPromptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTheoryPromptFile(await readFileAsBase64(file));
    setTheoryPromptFileName(file.name);
  };

  const handleAssign = async () => {
    if (!assignTitle.trim()) { setAssignError('Title is required'); return; }
    setAssigning(true); setAssignError(null);
    try {
      const user = getCurrentUser();
      const breakdown = assignBreakdown
        .filter(r => r.name.trim() && r.marks)
        .reduce<Record<string, number>>((acc, r) => { acc[r.name.trim()] = parseInt(r.marks, 10); return acc; }, {});
      await apiPost('/api/homework/assign', {
        student_id: studentId,
        title: assignTitle.trim(),
        instructions: assignInstructions.trim() || null,
        due_date: assignDueDate || null,
        assigned_by: user?.roles.includes('teacher') ? 'teacher' : 'admin',
        total_marks: assignTotalMarks ? parseInt(assignTotalMarks, 10) : null,
        marks_breakdown: Object.keys(breakdown).length > 0 ? breakdown : null,
        habit_target_habit_id: habitTargetHabitId || null,
        habit_target_count: habitTargetCount ? parseInt(habitTargetCount, 10) : null,
        theory_prompt_text: theoryPromptText.trim() || null,
        theory_prompt_file: theoryPromptFile || null,
      });
      setAssignTitle(''); setAssignInstructions(''); setAssignDueDate('');
      setAssignTotalMarks(''); setAssignBreakdown([]); setShowAssignForm(false);
      setHabitTargetHabitId(''); setHabitTargetCount(''); setHabitTargetOpen(false);
      setTheoryTaskOpen(false); setTheoryPromptText(''); setTheoryPromptFile(null); setTheoryPromptFileName('');
      if (theoryPromptFileRef.current) theoryPromptFileRef.current.value = '';
      onAssigned();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign homework.');
    } finally {
      setAssigning(false);
    }
  };

  if (showAssignForm) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="font-semibold text-sm text-indigo-900 mb-4">New Homework Assignment</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input type="text" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)}
              placeholder="e.g. C Major Scale — both hands"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
            <textarea value={assignInstructions} onChange={(e) => setAssignInstructions(e.target.value)}
              placeholder="What should the student practice or submit?" rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Total Marks <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input type="number" min="0" value={assignTotalMarks}
                onChange={(e) => { setAssignTotalMarks(e.target.value); if (!e.target.value) setAssignBreakdown([]); }}
                placeholder="e.g. 100"
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {assignTotalMarks && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Marks Breakdown <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <div className="space-y-2">
                {assignBreakdown.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={row.name}
                      onChange={(e) => setAssignBreakdown(prev => prev.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                      placeholder="Criterion (e.g. Rhythm)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input type="number" min="0" value={row.marks}
                      onChange={(e) => setAssignBreakdown(prev => prev.map((r, idx) => idx === i ? { ...r, marks: e.target.value } : r))}
                      placeholder="Marks"
                      className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={() => setAssignBreakdown(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button onClick={() => setAssignBreakdown(prev => [...prev, { name: '', marks: '' }])}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  + Add criterion
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-dashed border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => setTheoryTaskOpen(o => !o)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              {theoryTaskOpen ? '▾' : '▸'} Theory Task <span className="font-normal text-gray-400">(optional)</span>
            </button>
            {theoryTaskOpen && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={theoryPromptText}
                  onChange={e => setTheoryPromptText(e.target.value)}
                  rows={2}
                  placeholder="e.g. Name the notes in the D minor scale"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  📎 {theoryPromptFileName || 'Attach music sheet (image/PDF)'}
                  <input
                    ref={theoryPromptFileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleTheoryPromptFile}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => {
                setHabitTargetOpen(o => !o);
                if (!habitTargetOpen && studentHabits.length === 0) {
                  apiGet(`/api/students/${studentId}/habits`)
                    .then(res => setStudentHabits(res.habits || []))
                    .catch(() => {});
                }
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              {habitTargetOpen ? '▾' : '▸'} Practice Target <span className="font-normal text-gray-400">(optional)</span>
            </button>
            {habitTargetOpen && (
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {studentHabits.length === 0 ? (
                  <p className="text-xs text-gray-400">Student has no habits set up yet.</p>
                ) : (
                  <>
                    <select
                      value={habitTargetHabitId}
                      onChange={e => setHabitTargetHabitId(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      <option value="">Select a habit…</option>
                      {studentHabits.map(h => (
                        <option key={h.id} value={h.id}>{h.icon} {h.title}</option>
                      ))}
                    </select>
                    <input
                      type="number" min="1" max="99"
                      value={habitTargetCount}
                      onChange={e => setHabitTargetCount(e.target.value)}
                      placeholder="× times"
                      className="w-20 text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-gray-400">before due date</span>
                  </>
                )}
              </div>
            )}
          </div>

          {assignError && <p className="text-xs text-red-500">{assignError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAssign} disabled={assigning}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
            <button onClick={() => { setShowAssignForm(false); setAssignError(null); setAssignTotalMarks(''); setAssignBreakdown([]); }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setShowAssignForm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Assign Homework
      </button>
      <button onClick={onShowAudioInst}
        className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        Send Audio Instruction
      </button>
    </div>
  );
};

export default HomeworkAssignForm;
