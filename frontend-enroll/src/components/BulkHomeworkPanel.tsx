import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { getCurrentUser } from '../auth';
import StudentMultiSelect, { PickerStudent } from './StudentMultiSelect';

interface BulkHomeworkPanelProps {
  mode: 'teacher' | 'admin';
  teacherId?: string;
}

interface RecentAssignment {
  title: string;
  assigned_by: string;
  created_at: string;
  recipient_count: number;
  student_names: string[];
}

const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export default function BulkHomeworkPanel({ mode, teacherId }: BulkHomeworkPanelProps) {
  // Student list
  const [students, setStudents] = useState<PickerStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Sub-panel: 'homework' | 'audio' | 'habit'
  const [subPanel, setSubPanel] = useState<'homework' | 'audio' | 'habit'>('homework');

  // Selected recipients
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── Homework assign form ──────────────────────────────────────────────────
  const [hwTitle, setHwTitle] = useState('');
  const [hwInstructions, setHwInstructions] = useState('');
  const [hwDueDate, setHwDueDate] = useState('');
  const [hwTotalMarks, setHwTotalMarks] = useState('');
  const [hwBreakdown, setHwBreakdown] = useState<{ name: string; marks: string }[]>([]);
  const [hwTheoryOpen, setHwTheoryOpen] = useState(false);
  const [hwTheoryText, setHwTheoryText] = useState('');
  const [hwTheoryFile, setHwTheoryFile] = useState<string | null>(null);
  const [hwTheoryFileName, setHwTheoryFileName] = useState('');
  const [hwAssigning, setHwAssigning] = useState(false);
  const [hwError, setHwError] = useState<string | null>(null);
  const hwTheoryFileRef = useRef<HTMLInputElement | null>(null);

  // ── Audio instruction form ────────────────────────────────────────────────
  const [audioTitle, setAudioTitle] = useState('');
  const [audioRecordState, setAudioRecordState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [audioSending, setAudioSending] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // ── Habit assign form ────────────────────────────────────────────────────
  const [habitTitle, setHabitTitle] = useState('');
  const [habitIcon, setHabitIcon] = useState('🎵');
  const [habitType, setHabitType] = useState<'practice' | 'theory'>('practice');
  const [habitLevel, setHabitLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [habitAssigning, setHabitAssigning] = useState(false);
  const [habitError, setHabitError] = useState<string | null>(null);

  // ── Predefined practice templates ─────────────────────────────────────────
  const [habitTab, setHabitTab] = useState<'template' | 'custom' | 'manage'>('template');

  // ── Manage active habits state ────────────────────────────────────────────
  const [manageHabits, setManageHabits] = useState<{ id: string; student_id: string; title: string; icon: string; student_name: string }[]>([]);
  const [loadingManage, setLoadingManage] = useState(false);
  const [selectedManageIds, setSelectedManageIds] = useState<string[]>([]);
  
  // Bulk edit state
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditTitle, setBulkEditTitle] = useState('');
  const [bulkEditIcon, setBulkEditIcon] = useState('🎵');

  // Single edit state
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editHabitTitle, setEditHabitTitle] = useState('');
  const [editHabitIcon, setEditHabitIcon] = useState('🎵');

  useEffect(() => {
    if (habitTab !== 'manage' || selectedIds.length === 0) {
      setManageHabits([]);
      return;
    }
    const fetchManageHabits = async () => {
      setLoadingManage(true);
      try {
        const res = await apiGet(`/api/habits/by-students?student_ids=${selectedIds.join(',')}`);
        setManageHabits(res.habits || []);
        setSelectedManageIds([]);
        setEditingHabitId(null);
        setIsBulkEditing(false);
      } catch (err) {
        console.error('Failed to fetch active habits:', err);
      } finally {
        setLoadingManage(false);
      }
    };
    fetchManageHabits();
  }, [habitTab, selectedIds]);

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit?')) return;
    try {
      await apiDelete(`/api/habits/${habitId}`);
      setManageHabits(prev => prev.filter(h => h.id !== habitId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete habit');
    }
  };

  const handleUpdateHabit = async (habitId: string) => {
    if (!editHabitTitle.trim()) return;
    try {
      const res = await apiPut(`/api/habits/${habitId}`, { title: editHabitTitle, icon: editHabitIcon });
      setManageHabits(prev => prev.map(h => h.id === habitId ? { ...h, title: res.habit.title, icon: res.habit.icon } : h));
      setEditingHabitId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update habit');
    }
  };

  const handleBulkDeleteHabits = async () => {
    if (selectedManageIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedManageIds.length} selected habits?`)) return;
    try {
      await apiPost('/api/habits/archive-bulk', { habit_ids: selectedManageIds });
      setManageHabits(prev => prev.filter(h => !selectedManageIds.includes(h.id)));
      setSelectedManageIds([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete habits');
    }
  };

  const handleBulkUpdateHabits = async () => {
    if (selectedManageIds.length === 0 || !bulkEditTitle.trim()) return;
    try {
      await apiPost('/api/habits/update-bulk', { habit_ids: selectedManageIds, title: bulkEditTitle, icon: bulkEditIcon });
      setManageHabits(prev => prev.map(h => selectedManageIds.includes(h.id) ? { ...h, title: bulkEditTitle, icon: bulkEditIcon } : h));
      setIsBulkEditing(false);
      setBulkEditTitle('');
      setSelectedManageIds([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update habits');
    }
  };
  const [predefinedItems, setPredefinedItems] = useState<Record<string, { id: string; title: string; icon: string }[]>>({});
  const [loadingPredefined, setLoadingPredefined] = useState(true);
  const [predefinedInstrument, setPredefinedInstrument] = useState('');
  const [selectedPredefinedIds, setSelectedPredefinedIds] = useState<string[]>([]);

  // ── Fetch predefined items ────────────────────────────────────────────────
  useEffect(() => {
    const fetchPredefined = async () => {
      try {
        const res = await apiGet('/api/practice-items');
        setPredefinedItems(res || {});
      } catch (err) {
        console.error('Failed to fetch predefined practice items:', err);
      } finally {
        setLoadingPredefined(false);
      }
    };
    fetchPredefined();
  }, []);

  const getPredefinedKey = useCallback((instrumentName: string) => {
    const norm = instrumentName.toLowerCase().trim();
    if (norm.includes('piano') || norm.includes('keyboard')) return 'piano_keyboard';
    if (norm.includes('guitar')) return 'guitar';
    if (norm.includes('drum') || norm.includes('tabla') || norm.includes('octopad')) return 'drums';
    if (norm.includes('violin')) return 'violin';
    if (norm.includes('vocals') || norm.includes('singing') || norm.includes('carnatik') || norm.includes('carnatic') || norm.includes('hindustani')) return 'vocals_classical';
    return null;
  }, []);

  // Auto-detect instrument filter based on selected students
  useEffect(() => {
    if (selectedIds.length > 0) {
      const selectedStudents = students.filter(s => selectedIds.includes(s.id));
      const instruments = Array.from(new Set(selectedStudents.map(s => s.instrument)));
      if (instruments.length === 1) {
        setPredefinedInstrument(instruments[0]);
      }
    }
  }, [selectedIds, students]);

  const key = getPredefinedKey(predefinedInstrument);
  const itemsToRender = key ? (predefinedItems[key] || []) : [];

  const handleAssignPredefinedHabits = async () => {
    if (selectedIds.length === 0) { setHabitError('Select at least one student.'); return; }
    if (selectedPredefinedIds.length === 0) { setHabitError('Select at least one practice template.'); return; }

    setHabitAssigning(true); setHabitError(null);
    try {
      const selectedItems = itemsToRender.filter(item => selectedPredefinedIds.includes(item.id));
      let created = 0;
      let skipped = 0;

      for (const item of selectedItems) {
        const res = await apiPost('/api/habits/assign-bulk', {
          student_ids: selectedIds,
          title: item.title,
          icon: item.icon,
          type: 'practice',
        });
        created += res.created || 0;
        skipped += res.skipped || 0;
      }

      setSelectedPredefinedIds([]);
      setSelectedIds([]);
      if (skipped > 0) {
        setHabitError(`Assigned templates. ${created} succeeded, ${skipped} skipped (limit reached).`);
      } else {
        alert('Practice templates successfully assigned!');
      }
    } catch (err) {
      setHabitError(err instanceof Error ? err.message : 'Failed to assign practice templates.');
    } finally {
      setHabitAssigning(false);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUploadRef = useRef<HTMLInputElement | null>(null);

  // ── Recent assignments ────────────────────────────────────────────────────
  const [recent, setRecent] = useState<RecentAssignment[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // ── Fetch students ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoadingStudents(true);
        let res;
        if (mode === 'teacher' && teacherId) {
          res = await apiGet(`/api/teachers/${teacherId}/students`);
        } else {
          res = await apiGet('/api/students/active-with-instruments');
        }
        setStudents(res.students || []);
      } catch {
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [mode, teacherId]);

  // ── Fetch recent ──────────────────────────────────────────────────────────
  const fetchRecent = useCallback(async () => {
    try {
      setLoadingRecent(true);
      const user = getCurrentUser();
      const qs = user?.id && mode === 'teacher' ? `?assignerUserId=${user.id}` : '';
      const res = await apiGet(`/api/homework/recent${qs}`);
      setRecent(res.recent || []);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, [mode]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Homework form helpers ─────────────────────────────────────────────────
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  const handleHwTheoryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHwTheoryFile(await readFileAsBase64(file));
    setHwTheoryFileName(file.name);
  };

  const resetHwForm = () => {
    setHwTitle(''); setHwInstructions(''); setHwDueDate(''); setHwTotalMarks('');
    setHwBreakdown([]); setHwTheoryOpen(false); setHwTheoryText('');
    setHwTheoryFile(null); setHwTheoryFileName(''); setHwError(null);
    if (hwTheoryFileRef.current) hwTheoryFileRef.current.value = '';
  };

  const handleAssign = async () => {
    if (!hwTitle.trim()) { setHwError('Title is required.'); return; }
    if (selectedIds.length === 0) { setHwError('Select at least one student.'); return; }
    setHwAssigning(true); setHwError(null);
    try {
      const user = getCurrentUser();
      const breakdown = hwBreakdown
        .filter((r) => r.name.trim() && r.marks)
        .reduce<Record<string, number>>((acc, r) => { acc[r.name.trim()] = parseInt(r.marks, 10); return acc; }, {});
      await apiPost('/api/homework/assign-bulk', {
        student_ids: selectedIds,
        title: hwTitle.trim(),
        instructions: hwInstructions.trim() || null,
        due_date: hwDueDate || null,
        assigned_by: user?.roles?.includes('teacher') ? 'teacher' : 'admin',
        total_marks: hwTotalMarks ? parseInt(hwTotalMarks, 10) : null,
        marks_breakdown: Object.keys(breakdown).length > 0 ? breakdown : null,
        theory_prompt_text: hwTheoryText.trim() || null,
        theory_prompt_file: hwTheoryFile || null,
      });
      resetHwForm();
      setSelectedIds([]);
      await fetchRecent();
    } catch (err) {
      setHwError(err instanceof Error ? err.message : 'Failed to assign homework.');
    } finally {
      setHwAssigning(false);
    }
  };

  // ── Audio form helpers ────────────────────────────────────────────────────
  const resetAudioForm = () => {
    setAudioTitle(''); setAudioRecordState('idle'); setAudioSeconds(0);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null); setAudioUrl(null); setAudioFile(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null); setAudioError(null);
    if (audioUploadRef.current) audioUploadRef.current.value = '';
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioFile(null);
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
        if (audioUploadRef.current) audioUploadRef.current.value = '';
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioRecordState('recorded');
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      setAudioRecordState('recording');
      setAudioSeconds(0);
      timerRef.current = setInterval(() => setAudioSeconds((s) => s + 1), 1000);
    } catch {
      setAudioError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null); setAudioUrl(null);
    setAudioRecordState('idle'); setAudioSeconds(0);
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setAudioError('Please select an audio file.'); return; }
    discardRecording();
    setAudioFile(file);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(URL.createObjectURL(file));
    setAudioError(null);
  };

  const handleSendAudio = async () => {
    if (!audioTitle.trim()) { setAudioError('Title is required.'); return; }
    const source = audioBlob || audioFile;
    if (!source) { setAudioError('Please record or upload an audio file.'); return; }
    if (selectedIds.length === 0) { setAudioError('Select at least one student.'); return; }

    setAudioSending(true); setAudioError(null);
    try {
      const fileName = audioBlob ? `instruction_${Date.now()}.webm` : audioFile!.name;
      const mimeType = source.type || 'audio/webm';
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(source);
      });
      await apiPost('/api/homework/audio-instruction', {
        title: audioTitle.trim(),
        student_ids: selectedIds,
        audio_data: base64,
        audio_file_name: fileName,
        audio_mime_type: mimeType,
      });
      resetAudioForm();
      setSelectedIds([]);
      await fetchRecent();
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Failed to send audio instruction.');
    } finally {
      setAudioSending(false);
    }
  };

  // ── Habit form helpers ────────────────────────────────────────────────────
  const resetHabitForm = () => {
    setHabitTitle(''); setHabitIcon('🎵'); setHabitType('practice');
    setHabitLevel('beginner'); setHabitError(null);
  };

  const handleAssignHabit = async () => {
    if (!habitTitle.trim()) { setHabitError('Title is required.'); return; }
    if (selectedIds.length === 0) { setHabitError('Select at least one student.'); return; }
    setHabitAssigning(true); setHabitError(null);
    try {
      const res = await apiPost('/api/habits/assign-bulk', {
        student_ids: selectedIds,
        title: habitTitle.trim(),
        icon: habitIcon.trim() || '🎵',
        type: habitType,
        level: habitType === 'theory' ? habitLevel : undefined,
      });
      resetHabitForm();
      setSelectedIds([]);
      if (res.skipped > 0) {
        setHabitError(`Assigned to ${res.created} student${res.created !== 1 ? 's' : ''}. ${res.skipped} skipped (already at 10-habit limit).`);
      }
    } catch (err) {
      setHabitError(err instanceof Error ? err.message : 'Failed to assign habit.');
    } finally {
      setHabitAssigning(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Sub-panel toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setSubPanel('homework')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subPanel === 'homework' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Assign Homework
        </button>
        <button
          onClick={() => setSubPanel('audio')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subPanel === 'audio' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Send Audio Instruction
        </button>
        <button
          onClick={() => setSubPanel('habit')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subPanel === 'habit' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Assign Habit
        </button>
      </div>

      {/* Student multi-select (shared) */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Recipients</p>
        <StudentMultiSelect
          students={students}
          value={selectedIds}
          onChange={setSelectedIds}
          loading={loadingStudents}
        />
      </div>

      {/* ── Assign Homework form ── */}
      {subPanel === 'homework' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-indigo-900">Homework Details</h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input type="text" value={hwTitle} onChange={(e) => setHwTitle(e.target.value)}
              placeholder="e.g. C Major Scale — both hands"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
            <textarea value={hwInstructions} onChange={(e) => setHwInstructions(e.target.value)}
              placeholder="What should the student practice or submit?" rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" value={hwDueDate} onChange={(e) => setHwDueDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Total Marks <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input type="number" min="0" value={hwTotalMarks}
                onChange={(e) => { setHwTotalMarks(e.target.value); if (!e.target.value) setHwBreakdown([]); }}
                placeholder="e.g. 100"
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {hwTotalMarks && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Marks Breakdown <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <div className="space-y-2">
                {hwBreakdown.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={row.name}
                      onChange={(e) => setHwBreakdown((prev) => prev.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                      placeholder="Criterion (e.g. Rhythm)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input type="number" min="0" value={row.marks}
                      onChange={(e) => setHwBreakdown((prev) => prev.map((r, idx) => idx === i ? { ...r, marks: e.target.value } : r))}
                      placeholder="Marks"
                      className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={() => setHwBreakdown((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button onClick={() => setHwBreakdown((prev) => [...prev, { name: '', marks: '' }])}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  + Add criterion
                </button>
              </div>
            </div>
          )}

          {/* Theory task */}
          <div className="border-t border-dashed border-slate-200 pt-3">
            <button type="button" onClick={() => setHwTheoryOpen((o) => !o)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              {hwTheoryOpen ? '▾' : '▸'} Theory Task <span className="font-normal text-gray-400">(optional)</span>
            </button>
            {hwTheoryOpen && (
              <div className="mt-2 space-y-2">
                <textarea value={hwTheoryText} onChange={(e) => setHwTheoryText(e.target.value)} rows={2}
                  placeholder="e.g. Name the notes in the D minor scale"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  📎 {hwTheoryFileName || 'Attach music sheet (image/PDF)'}
                  <input ref={hwTheoryFileRef} type="file" accept="image/*,application/pdf"
                    onChange={handleHwTheoryFile} className="hidden" />
                </label>
              </div>
            )}
          </div>

          {hwError && <p className="text-xs text-red-500">{hwError}</p>}

          <button onClick={handleAssign} disabled={hwAssigning || selectedIds.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {hwAssigning
              ? 'Assigning…'
              : `Assign to ${selectedIds.length} Student${selectedIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* ── Send Audio Instruction form ── */}
      {subPanel === 'audio' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-sky-900">Audio Instruction Details</h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input type="text" value={audioTitle} onChange={(e) => setAudioTitle(e.target.value)}
              placeholder="e.g. How to practice the C major scale"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Record Audio</p>
            {audioRecordState === 'idle' && (
              <button onClick={startRecording}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-full hover:bg-red-600 active:scale-95 transition-all shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                Start Recording
              </button>
            )}
            {audioRecordState === 'recording' && (
              <div className="flex items-center gap-4">
                <button onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-full hover:bg-gray-900 active:scale-95 transition-all shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                  Stop
                </button>
                <span className="text-base font-mono font-bold text-red-500 animate-pulse">{fmt(audioSeconds)}</span>
                <span className="flex gap-0.5 items-end h-5">
                  {[3,5,4,6,3,5,4].map((h, i) => (
                    <span key={i} className="w-1 bg-red-400 rounded-full animate-bounce"
                      style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms` }} />
                  ))}
                </span>
              </div>
            )}
            {audioRecordState === 'recorded' && audioUrl && (
              <div className="flex flex-wrap items-center gap-3">
                <audio src={audioUrl} controls className="h-10" style={{ minWidth: 220 }} />
                <button onClick={discardRecording} className="text-xs text-gray-400 hover:text-red-500 underline">
                  Discard &amp; re-record
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Upload MP3 / Audio File</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-sm">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Choose File
              <input ref={audioUploadRef} type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/m4a,audio/*"
                onChange={handleAudioFileUpload} className="hidden" />
            </label>
            {audioFile && (
              <p className="text-xs text-gray-500 mt-1.5">
                {audioFile.name} · {(audioFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
            {audioPreviewUrl && <audio src={audioPreviewUrl} controls className="mt-2 h-10" style={{ minWidth: 220 }} />}
          </div>

          {audioError && <p className="text-xs text-red-500">{audioError}</p>}

          <button onClick={handleSendAudio} disabled={audioSending || selectedIds.length === 0}
            className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors">
            {audioSending
              ? 'Sending…'
              : `Send to ${selectedIds.length} Student${selectedIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* ── Assign Habit form ── */}
      {subPanel === 'habit' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex gap-2 border-b border-emerald-100 pb-3 mb-2">
            {(['template', 'custom', 'manage'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setHabitTab(tab);
                  setHabitError(null);
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  habitTab === tab
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 hover:bg-emerald-100/50'
                }`}
              >
                {tab === 'template' ? 'Practice Templates' : tab === 'custom' ? 'Custom Habit' : 'Manage Habits'}
              </button>
            ))}
          </div>

          {habitTab === 'template' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Filter by Instrument</label>
                <select
                  value={predefinedInstrument}
                  onChange={(e) => {
                    setPredefinedInstrument(e.target.value);
                    setSelectedPredefinedIds([]);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  <option value="">-- Select Instrument --</option>
                  <option value="Keyboard">Keyboard / Piano</option>
                  <option value="Guitar">Guitar</option>
                  <option value="Drums">Drums / Tabla</option>
                  <option value="Violin">Violin</option>
                  <option value="Vocals">Vocals (Hindustani / Carnatic)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Select Practice Items</label>
                {loadingPredefined ? (
                  <p className="text-xs text-gray-400 animate-pulse">Loading templates...</p>
                ) : itemsToRender.length === 0 ? (
                  <p className="text-xs text-gray-400 italic bg-white border border-gray-200 rounded-lg p-4 text-center">
                    Select an instrument to view its predefined practice curriculum templates.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg p-2.5 shadow-inner">
                    {itemsToRender.map((item) => {
                      const checked = selectedPredefinedIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${
                            checked ? 'bg-emerald-50 border-emerald-200' : 'bg-transparent border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedPredefinedIds((prev) =>
                                checked ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                              );
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                          />
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-sm font-medium text-gray-700">{item.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {habitError && <p className="text-xs text-red-500 font-medium">{habitError}</p>}

              <button
                onClick={handleAssignPredefinedHabits}
                disabled={habitAssigning || selectedIds.length === 0 || selectedPredefinedIds.length === 0}
                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {habitAssigning
                  ? 'Assigning…'
                  : `Assign ${selectedPredefinedIds.length} Practice Item${selectedPredefinedIds.length !== 1 ? 's' : ''} to ${selectedIds.length} Student${selectedIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {habitTab === 'custom' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Title *</label>
                <input
                  type="text"
                  value={habitTitle}
                  onChange={(e) => setHabitTitle(e.target.value)}
                  placeholder="e.g. Daily scales practice"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Icon <span className="font-normal text-gray-400">(emoji)</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg p-2">
                  <input
                    type="text"
                    value={habitIcon}
                    onChange={(e) => setHabitIcon(e.target.value)}
                    maxLength={2}
                    className="w-12 border border-gray-300 rounded-lg py-1.5 text-center text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50 font-bold"
                  />
                  <div className="flex flex-wrap gap-1">
                    {['🎵', '🎸', '🎹', '🥁', '🎻', '📖', '🎯', '⭐'].map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setHabitIcon(e)}
                        className={`text-xl p-1 rounded-md hover:bg-emerald-100 transition-colors ${habitIcon === e ? 'bg-emerald-200' : ''}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Type</label>
                <div className="flex gap-4">
                  {(['practice', 'theory'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="habitType"
                        value={t}
                        checked={habitType === t}
                        onChange={() => setHabitType(t)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-gray-700 capitalize">{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              {habitType === 'theory' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Level</label>
                  <select
                    value={habitLevel}
                    onChange={(e) => setHabitLevel(e.target.value as typeof habitLevel)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              )}

              {habitError && <p className="text-xs text-red-500 font-medium">{habitError}</p>}

              <button
                onClick={handleAssignHabit}
                disabled={habitAssigning || selectedIds.length === 0}
                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {habitAssigning
                  ? 'Assigning…'
                  : `Assign Habit to ${selectedIds.length} Student${selectedIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {habitTab === 'manage' && (
            <div className="space-y-4">
              {selectedIds.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-white border border-gray-200 rounded-lg p-4 text-center">
                  Select one or more students from the list above to manage their active habits.
                </p>
              ) : loadingManage ? (
                <p className="text-xs text-gray-400 animate-pulse">Loading active habits...</p>
              ) : manageHabits.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-white border border-gray-200 rounded-lg p-4 text-center">
                  No active habits found for the selected students.
                </p>
              ) : (
                <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-3 shadow-inner">
                  {/* Bulk Actions Header */}
                  {selectedManageIds.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 border border-emerald-100 rounded-lg p-2 mb-2">
                      <span className="text-xs font-semibold text-emerald-800">
                        {selectedManageIds.length} habit{selectedManageIds.length !== 1 ? 's' : ''} selected
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsBulkEditing(!isBulkEditing);
                            if (!isBulkEditing) {
                              setBulkEditTitle('');
                            }
                          }}
                          className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-medium transition-colors"
                        >
                          {isBulkEditing ? 'Cancel Edit' : '✏️ Bulk Edit'}
                        </button>
                        <button
                          onClick={handleBulkDeleteHabits}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                        >
                          🗑️ Bulk Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bulk Edit Form */}
                  {isBulkEditing && selectedManageIds.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 mb-2 animate-fadeIn">
                      <p className="text-xs font-semibold text-amber-800">Bulk Edit Selected Habits</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={bulkEditTitle}
                          onChange={(e) => setBulkEditTitle(e.target.value)}
                          placeholder="New habit title"
                          className="col-span-2 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-400"
                        />
                        <select
                          value={bulkEditIcon}
                          onChange={(e) => setBulkEditIcon(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-400"
                        >
                          {['🎵', '🎸', '🎹', '🥁', '🎻', '📖', '🎯', '⭐'].map(ic => (
                            <option key={ic} value={ic}>{ic}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleBulkUpdateHabits}
                        disabled={!bulkEditTitle.trim()}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                      >
                        Apply Changes
                      </button>
                    </div>
                  )}

                  {/* Habit List Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-slate-50 text-gray-500 font-semibold">
                          <th className="p-2 w-8">
                            <input
                              type="checkbox"
                              checked={manageHabits.length > 0 && selectedManageIds.length === manageHabits.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedManageIds(manageHabits.map(h => h.id));
                                } else {
                                  setSelectedManageIds([]);
                                }
                              }}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </th>
                          <th className="p-2">Student</th>
                          <th className="p-2">Habit</th>
                          <th className="p-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manageHabits.map((h) => {
                          const isSelected = selectedManageIds.includes(h.id);
                          const isEditing = editingHabitId === h.id;
                          return (
                            <tr
                              key={h.id}
                              className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                                isSelected ? 'bg-emerald-50/20' : ''
                              }`}
                            >
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedManageIds(prev =>
                                      isSelected ? prev.filter(id => id !== h.id) : [...prev, h.id]
                                    );
                                  }}
                                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="p-2 font-medium text-gray-900">{h.student_name}</td>
                              <td className="p-2">
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={editHabitIcon}
                                      onChange={(e) => setEditHabitIcon(e.target.value)}
                                      className="border border-gray-300 rounded px-1 py-0.5 text-xs focus:outline-none"
                                    >
                                      {['🎵', '🎸', '🎹', '🥁', '🎻', '📖', '🎯', '⭐'].map(ic => (
                                        <option key={ic} value={ic}>{ic}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      value={editHabitTitle}
                                      onChange={(e) => setEditHabitTitle(e.target.value)}
                                      className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1 min-w-0"
                                    />
                                    <button
                                      onClick={() => handleUpdateHabit(h.id)}
                                      disabled={!editHabitTitle.trim()}
                                      className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-[10px] font-semibold"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingHabitId(null)}
                                      className="text-gray-400 hover:text-gray-600 text-[10px] font-semibold px-0.5"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{h.icon}</span>
                                    <span className="text-gray-700">{h.title}</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-right space-x-1.5">
                                {!isEditing && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingHabitId(h.id);
                                        setEditHabitTitle(h.title);
                                        setEditHabitIcon(h.icon);
                                      }}
                                      className="text-slate-400 hover:text-slate-600 p-0.5"
                                      title="Edit Habit"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteHabit(h.id)}
                                      className="text-slate-400 hover:text-red-600 p-0.5"
                                      title="Delete Habit"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}      {/* ── Recent Assignments ── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Assignments</p>
        {loadingRecent ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No assignments sent yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-start gap-3 border border-gray-100 rounded-lg px-3 py-2.5 bg-white">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.recipient_count} student{r.recipient_count !== 1 ? 's' : ''} ·{' '}
                    {new Date(r.created_at).toLocaleDateString()} ·{' '}
                    by {r.assigned_by}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {r.student_names.slice(0, 5).join(', ')}
                    {r.student_names.length > 5 ? ` +${r.student_names.length - 5} more` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
