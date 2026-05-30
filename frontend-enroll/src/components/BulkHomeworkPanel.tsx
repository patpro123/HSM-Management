import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost } from '../api';
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
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-emerald-900">Habit Details</h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input type="text" value={habitTitle} onChange={(e) => setHabitTitle(e.target.value)}
              placeholder="e.g. Daily scales practice"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Icon <span className="font-normal text-gray-400">(emoji)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="text" value={habitIcon} onChange={(e) => setHabitIcon(e.target.value)}
                maxLength={2}
                className="w-14 border border-gray-300 rounded-lg px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              <div className="flex gap-1">
                {['🎵', '🎸', '🎹', '🥁', '🎻', '📖', '🎯', '⭐'].map((e) => (
                  <button key={e} type="button" onClick={() => setHabitIcon(e)}
                    className={`text-xl p-1 rounded hover:bg-emerald-100 transition-colors ${habitIcon === e ? 'bg-emerald-200' : ''}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Type</label>
            <div className="flex gap-4">
              {(['practice', 'theory'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="habitType" value={t} checked={habitType === t}
                    onChange={() => setHabitType(t)}
                    className="text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm text-gray-700 capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {habitType === 'theory' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
              <select value={habitLevel} onChange={(e) => setHabitLevel(e.target.value as typeof habitLevel)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          )}

          {habitError && <p className="text-xs text-red-500">{habitError}</p>}

          <button onClick={handleAssignHabit} disabled={habitAssigning || selectedIds.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {habitAssigning
              ? 'Assigning…'
              : `Assign to ${selectedIds.length} Student${selectedIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* ── Recent Assignments ── */}
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
