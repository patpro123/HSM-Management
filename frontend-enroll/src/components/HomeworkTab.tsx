import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { getCurrentUser } from '../auth';

interface HistoryEntry {
  type: 'submitted' | 'returned' | 'closed';
  at: string;
  file_url?: string | null;
  file_storage_id?: string | null;
  file_name?: string | null;
  note?: string | null;
  comment?: string | null;
  marks_awarded?: number | null;
  marks_awarded_breakdown?: Record<string, number> | null;
}

interface Submission {
  id: string;
  file_name: string | null;
  file_type: string | null;
  file_url: string | null;        // Drive public URL (new submissions)
  file_storage_id: string | null;
  note: string | null;
  submitted_at: string;
  theory_answer_text: string | null;
  theory_answer_storage_id: string | null;
}

interface Assignment {
  id: string;
  student_id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  assigned_by: string;
  created_at: string;
  status: 'pending' | 'submitted' | 'returned' | 'closed';
  total_marks: number | null;
  marks_breakdown: Record<string, number> | null;
  teacher_comment: string | null;
  marks_awarded: number | null;
  marks_awarded_breakdown: Record<string, number> | null;
  submission: Submission | null;
  submission_history: HistoryEntry[];
  habit_target_habit_id: string | null;
  habit_target_count: number | null;
  habit_target_title: string | null;
  habit_target_icon: string | null;
  habit_target_completed: number;
  habit_target_has_voice_note: boolean;
  habit_target_latest_voice_storage_id: string | null;
  theory_prompt_text: string | null;
  theory_prompt_storage_id: string | null;
}

interface AudioInstruction {
  id: string;
  title: string;
  audio_storage_id: string | null;
  audio_url: string | null;
  mime_type: string;
  created_at: string;
  teacher_name: string | null;
}

interface HomeworkTabProps {
  studentId: string;
  selfMode: boolean;
}

const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === 'closed'    ? 'bg-green-100 text-green-800'  :
    status === 'submitted' ? 'bg-blue-100 text-blue-800'    :
    status === 'returned'  ? 'bg-orange-100 text-orange-800' :
                             'bg-yellow-100 text-yellow-800';
  const label = status === 'closed' ? 'Closed' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

const SubmissionHistory: React.FC<{
  history: HistoryEntry[];
  assignId: string;
  totalMarks: number | null;
  marksBreakdown: Record<string, number> | null;
  playingAssignId: string | null;
  playingSubUrl: string | null;
  onPlay: (entry: HistoryEntry, assignId: string) => void;
}> = ({ history, assignId, totalMarks, marksBreakdown, playingAssignId, playingSubUrl, onPlay }) => {
  if (!history || history.length === 0) return null;
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">History</p>
      <div className="relative pl-4">
        {/* vertical line */}
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200" />
        <div className="space-y-3">
          {history.map((entry, i) => {
            const isSubmitted = entry.type === 'submitted';
            const isReturned  = entry.type === 'returned';
            const isClosed    = entry.type === 'closed';
            const dotColor    = isSubmitted ? 'bg-blue-400' : isReturned ? 'bg-orange-400' : 'bg-green-500';
            const isPlaying   = playingAssignId === assignId &&
                                playingSubUrl === `/api/files/${entry.file_storage_id}/stream`;
            return (
              <div key={i} className="relative flex gap-2.5 items-start">
                {/* dot */}
                <div className={`absolute -left-4 mt-1 w-2 h-2 rounded-full ${dotColor} ring-2 ring-white`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${
                      isSubmitted ? 'text-blue-700' : isReturned ? 'text-orange-700' : 'text-green-700'
                    }`}>
                      {isSubmitted ? 'Student submitted' : isReturned ? 'Teacher returned' : 'Teacher closed'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(entry.at).toLocaleString()}
                    </span>
                    {isSubmitted && entry.file_name && (
                      <span className="text-xs text-gray-400 truncate max-w-[180px]">{entry.file_name}</span>
                    )}
                    {isSubmitted && entry.file_storage_id && (
                      <button onClick={() => onPlay(entry, assignId)}
                        className={`p-1 rounded-full transition-colors ${
                          isPlaying ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        }`} title={isPlaying ? 'Stop' : 'Play this recording'}>
                        {isPlaying ? (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 ml-px" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {isSubmitted && entry.note && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">"{entry.note}"</p>
                  )}
                  {(isReturned || isClosed) && entry.comment && (
                    <p className="text-xs text-gray-600 mt-0.5">{entry.comment}</p>
                  )}
                  {isClosed && entry.marks_awarded != null && (
                    <div className="mt-1">
                      <span className="text-xs font-semibold text-green-700">
                        Score: {entry.marks_awarded}{totalMarks != null ? ` / ${totalMarks}` : ''} pts
                      </span>
                      {entry.marks_awarded_breakdown && marksBreakdown &&
                        Object.keys(entry.marks_awarded_breakdown).length > 0 && (
                        <span className="text-xs text-green-600 ml-2">
                          ({Object.entries(entry.marks_awarded_breakdown)
                            .map(([k, v]) => `${k}: ${v}${marksBreakdown[k] != null ? `/${marksBreakdown[k]}` : ''}`)
                            .join(', ')})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const HomeworkTab: React.FC<HomeworkTabProps> = ({ studentId, selfMode }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Assign form (teacher / admin) ─────────────────────────────────────────
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

  // Theory task fields (assign form)
  const [theoryTaskOpen, setTheoryTaskOpen] = useState(false);
  const [theoryPromptText, setTheoryPromptText] = useState('');
  const [theoryPromptFile, setTheoryPromptFile] = useState<string | null>(null);
  const [theoryPromptFileName, setTheoryPromptFileName] = useState('');
  const theoryPromptFileRef = useRef<HTMLInputElement | null>(null);

  // Theory task fields (student submit form)
  const [theoryAnswerText, setTheoryAnswerText] = useState('');
  const [theoryAnswerFile, setTheoryAnswerFile] = useState<string | null>(null);
  const [theoryAnswerFileName, setTheoryAnswerFileName] = useState('');
  const theoryAnswerFileRef = useRef<HTMLInputElement | null>(null);

  // Voice note playback on homework card (teacher view)
  const [playingVoiceNote, setPlayingVoiceNote] = useState<string | null>(null);

  // ── Audio instructions ────────────────────────────────────────────────────
  const [audioInstructions, setAudioInstructions] = useState<AudioInstruction[]>([]);
  const [playingInstId, setPlayingInstId] = useState<string | null>(null);

  // Audio instruction creation form (teacher only — single student, this 360 view only)
  const [showAudioInstForm, setShowAudioInstForm] = useState(false);
  const [audioInstTitle, setAudioInstTitle] = useState('');
  const [audioInstRecordState, setAudioInstRecordState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [audioInstBlob, setAudioInstBlob] = useState<Blob | null>(null);
  const [audioInstUrl, setAudioInstUrl] = useState<string | null>(null);
  const [audioInstFile, setAudioInstFile] = useState<File | null>(null);
  const [audioInstPreviewUrl, setAudioInstPreviewUrl] = useState<string | null>(null);
  const [audioInstSeconds, setAudioInstSeconds] = useState(0);
  const [audioInstError, setAudioInstError] = useState<string | null>(null);
  const [audioInstSubmitting, setAudioInstSubmitting] = useState(false);

  const instMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const instChunksRef = useRef<Blob[]>([]);
  const instTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const instUploadRef = useRef<HTMLInputElement | null>(null);

  // ── Teacher review panel ───────────────────────────────────────────────────
  const [reviewExpandedId, setReviewExpandedId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMarksAwarded, setReviewMarksAwarded] = useState('');
  const [reviewBreakdownMarks, setReviewBreakdownMarks] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ── Submit form (student) ─────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [submitNote, setSubmitNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // ── Submission playback ────────────────────────────────────────────────────
  const [playingAssignId, setPlayingAssignId] = useState<string | null>(null);
  const [playingSubUrl, setPlayingSubUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const [hwRes, instRes] = await Promise.all([
        apiGet(`/api/students/${studentId}/homework`),
        apiGet(`/api/students/${studentId}/audio-instructions`),
      ]);
      setAssignments(hwRes.assignments || []);
      setAudioInstructions(instRes.instructions || []);
    } catch (err) {
      console.error('Failed to fetch homework', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioInstUrl) URL.revokeObjectURL(audioInstUrl);
      if (audioInstPreviewUrl) URL.revokeObjectURL(audioInstPreviewUrl);
      if (instTimerRef.current) clearInterval(instTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit form helpers ────────────────────────────────────────────────────
  const resetSubmitForm = () => {
    setRecordState('idle');
    setRecordSeconds(0);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setUploadedFile(null);
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadPreviewUrl(null);
    setSubmitNote('');
    setSubmitError(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const handleExpandToggle = (id: string) => {
    if (expandedId === id) { setExpandedId(null); resetSubmitForm(); return; }
    if (expandedId) resetSubmitForm();
    setExpandedId(id);
  };

  // ── Audio recorder ─────────────────────────────────────────────────────────
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
        setUploadedFile(null);
        if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
        setUploadPreviewUrl(null);
        if (uploadInputRef.current) uploadInputRef.current.value = '';
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecordState('recorded');
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      setRecordState('recording');
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setSubmitError('Microphone access denied. Allow mic permissions and try again.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const discardRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null); setRecordedUrl(null); setRecordState('idle'); setRecordSeconds(0);
  };

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setSubmitError('Please select an audio file (MP3, WAV, M4A, etc.)'); return; }
    discardRecording();
    setUploadedFile(file);
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadPreviewUrl(URL.createObjectURL(file));
    setSubmitError(null);
  };

  // ── Theory file upload helpers ─────────────────────────────────────────────
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

  const handleTheoryAnswerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTheoryAnswerFile(await readFileAsBase64(file));
    setTheoryAnswerFileName(file.name);
  };

  // ── Submit homework ────────────────────────────────────────────────────────
  const handleSubmit = async (assignmentId: string) => {
    const source = recordedBlob || uploadedFile;
    if (!source) { setSubmitError('Please record or upload an audio file first.'); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const fileName = recordedBlob ? `recording_${Date.now()}.webm` : uploadedFile!.name;
      const fileType = source.type || 'audio/webm';
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(source);
      });
      await apiPost(`/api/homework/${assignmentId}/submit`, {
        file_name: fileName, file_type: fileType, file_data: base64,
        note: submitNote.trim() || null,
        theory_answer_text: theoryAnswerText.trim() || null,
        theory_answer_file: theoryAnswerFile || null,
      });
      setTheoryAnswerText(''); setTheoryAnswerFile(null); setTheoryAnswerFileName('');
      if (theoryAnswerFileRef.current) theoryAnswerFileRef.current.value = '';
      resetSubmitForm(); setExpandedId(null); await fetchAssignments();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Assign homework ────────────────────────────────────────────────────────
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
      await fetchAssignments();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign homework.');
    } finally {
      setAssigning(false);
    }
  };

  // ── Teacher review ─────────────────────────────────────────────────────────
  const handleOpenReview = (a: Assignment) => {
    if (reviewExpandedId === a.id) {
      setReviewExpandedId(null); setReviewComment(''); setReviewMarksAwarded('');
      setReviewBreakdownMarks({}); setReviewError(null); return;
    }
    setReviewExpandedId(a.id); setReviewComment(''); setReviewMarksAwarded(''); setReviewError(null);
    if (a.marks_breakdown) {
      const init: Record<string, string> = {};
      Object.keys(a.marks_breakdown).forEach(k => { init[k] = ''; });
      setReviewBreakdownMarks(init);
    } else {
      setReviewBreakdownMarks({});
    }
  };

  const handleReturn = async (assignmentId: string) => {
    setReviewing(true); setReviewError(null);
    try {
      await apiPut(`/api/homework/${assignmentId}/review`, {
        action: 'return', comment: reviewComment.trim() || null,
      });
      setReviewExpandedId(null); setReviewComment(''); await fetchAssignments();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to return assignment.');
    } finally {
      setReviewing(false);
    }
  };

  const handleClose = async (a: Assignment) => {
    setReviewing(true); setReviewError(null);
    try {
      const marks = reviewMarksAwarded ? parseInt(reviewMarksAwarded, 10) : null;
      const bkd = Object.fromEntries(
        Object.entries(reviewBreakdownMarks).filter(([, v]) => v !== '').map(([k, v]) => [k, parseInt(v, 10)])
      );
      await apiPut(`/api/homework/${a.id}/review`, {
        action: 'close',
        comment: reviewComment.trim() || null,
        marks_awarded: marks,
        marks_awarded_breakdown: Object.keys(bkd).length > 0 ? bkd : null,
      });
      setReviewExpandedId(null); setReviewComment(''); setReviewMarksAwarded(''); setReviewBreakdownMarks({});
      await fetchAssignments();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to close assignment.');
    } finally {
      setReviewing(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Delete this homework assignment?')) return;
    try {
      await apiDelete(`/api/homework/${assignmentId}`);
      if (expandedId === assignmentId) { setExpandedId(null); resetSubmitForm(); }
      if (reviewExpandedId === assignmentId) setReviewExpandedId(null);
      await fetchAssignments();
    } catch (err) {
      console.error('Failed to delete homework', err);
    }
  };

  // ── Audio instruction handlers ─────────────────────────────────────────────
  const resetAudioInstForm = () => {
    setAudioInstTitle('');
    setAudioInstRecordState('idle');
    setAudioInstSeconds(0);
    if (audioInstUrl) URL.revokeObjectURL(audioInstUrl);
    setAudioInstBlob(null);
    setAudioInstUrl(null);
    setAudioInstFile(null);
    if (audioInstPreviewUrl) URL.revokeObjectURL(audioInstPreviewUrl);
    setAudioInstPreviewUrl(null);
    setAudioInstError(null);
    if (instUploadRef.current) instUploadRef.current.value = '';
    if (instTimerRef.current) { clearInterval(instTimerRef.current); instTimerRef.current = null; }
  };

  const startInstRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      instMediaRecorderRef.current = recorder;
      instChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) instChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(instChunksRef.current, { type: mimeType });
        setAudioInstFile(null);
        if (audioInstPreviewUrl) URL.revokeObjectURL(audioInstPreviewUrl);
        setAudioInstPreviewUrl(null);
        if (instUploadRef.current) instUploadRef.current.value = '';
        setAudioInstBlob(blob);
        setAudioInstUrl(URL.createObjectURL(blob));
        setAudioInstRecordState('recorded');
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      setAudioInstRecordState('recording');
      setAudioInstSeconds(0);
      instTimerRef.current = setInterval(() => setAudioInstSeconds((s) => s + 1), 1000);
    } catch {
      setAudioInstError('Microphone access denied.');
    }
  };

  const stopInstRecording = () => {
    instMediaRecorderRef.current?.stop();
    if (instTimerRef.current) { clearInterval(instTimerRef.current); instTimerRef.current = null; }
  };

  const discardInstRecording = () => {
    if (audioInstUrl) URL.revokeObjectURL(audioInstUrl);
    setAudioInstBlob(null); setAudioInstUrl(null);
    setAudioInstRecordState('idle'); setAudioInstSeconds(0);
  };

  const handleInstFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setAudioInstError('Please select an audio file (MP3, WAV, M4A, etc.)');
      return;
    }
    discardInstRecording();
    setAudioInstFile(file);
    if (audioInstPreviewUrl) URL.revokeObjectURL(audioInstPreviewUrl);
    setAudioInstPreviewUrl(URL.createObjectURL(file));
    setAudioInstError(null);
  };

  const handleSendAudioInst = async () => {
    if (!audioInstTitle.trim()) { setAudioInstError('Title is required.'); return; }
    const source = audioInstBlob || audioInstFile;
    if (!source) { setAudioInstError('Please record or upload an audio file.'); return; }
    setAudioInstSubmitting(true); setAudioInstError(null);
    try {
      const fileName = audioInstBlob
        ? `instruction_${Date.now()}.webm`
        : audioInstFile!.name;
      const mimeType = source.type || 'audio/webm';
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(source);
      });
      await apiPost('/api/homework/audio-instruction', {
        title: audioInstTitle.trim(),
        student_ids: [studentId],
        audio_data: base64,
        audio_file_name: fileName,
        audio_mime_type: mimeType,
      });
      resetAudioInstForm();
      setShowAudioInstForm(false);
      await fetchAssignments();
    } catch (err) {
      setAudioInstError(err instanceof Error ? err.message : 'Failed to send instruction.');
    } finally {
      setAudioInstSubmitting(false);
    }
  };

  const handleDeleteInst = async (instId: string) => {
    if (!confirm('Delete this audio instruction? It will be removed for all recipients.')) return;
    try {
      await apiDelete(`/api/homework/audio-instructions/${instId}`);
      await fetchAssignments();
    } catch (err) {
      console.error('Failed to delete audio instruction', err);
    }
  };

  // ── Submission playback ────────────────────────────────────────────────────
  const handlePlayEntry = (entry: HistoryEntry, assignId: string) => {
    if (playingAssignId === assignId && playingSubUrl === `/api/files/${entry.file_storage_id}/stream`) {
      setPlayingAssignId(null); setPlayingSubUrl(null); return;
    }
    if (entry.file_storage_id) {
      setPlayingSubUrl(`/api/files/${entry.file_storage_id}/stream`);
      setPlayingAssignId(assignId);
    }
  };

  const handlePlaySub = async (assignment: Assignment) => {
    if (playingAssignId === assignment.id) { setPlayingAssignId(null); setPlayingSubUrl(null); return; }

    // Fast path: Drive file — stream via backend proxy (avoids CORS/redirect issues)
    if (assignment.submission?.file_storage_id) {
      setPlayingSubUrl(`/api/files/${assignment.submission.file_storage_id}/stream`);
      setPlayingAssignId(assignment.id);
      return;
    }

    // Legacy path: fetch full row to get base64 file_data
    try {
      const res = await apiGet(`/api/homework/${assignment.id}/submission`);
      setPlayingSubUrl(res.file_data);
      setPlayingAssignId(assignment.id);
    } catch (err) {
      console.error('Failed to load submission audio', err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
  }

  return (
    <div className="space-y-5">

      {/* ── Audio instructions section ── */}
      {audioInstructions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Audio Instructions from Teacher
          </p>
          {audioInstructions.map((inst) => (
            <div key={inst.id} className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
              <button
                onClick={() => setPlayingInstId(playingInstId === inst.id ? null : inst.id)}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  playingInstId === inst.id
                    ? 'bg-sky-700 text-white'
                    : 'bg-sky-500 text-white hover:bg-sky-600'
                }`}
                title={playingInstId === inst.id ? 'Stop' : 'Play'}
              >
                {playingInstId === inst.id ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sky-900 truncate">{inst.title}</p>
                <p className="text-xs text-sky-600">
                  {inst.teacher_name ?? 'Teacher'} · {new Date(inst.created_at).toLocaleDateString()}
                </p>
                {playingInstId === inst.id && (
                  <audio
                    controls
                    autoPlay
                    src={`/api/homework/audio-instructions/${inst.id}/stream`}
                    className="mt-2 h-9 w-full"
                    onEnded={() => setPlayingInstId(null)}
                  />
                )}
              </div>
              {!selfMode && (
                <button
                  onClick={() => handleDeleteInst(inst.id)}
                  className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                  title="Delete instruction"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Assign form — teacher / admin ── */}
      {!selfMode && (
        showAssignForm ? (
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

              {/* Marks breakdown — only shown when total marks is set */}
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

              {/* Theory task (optional) */}
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

              {/* Practice target (optional) */}
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
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAssignForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Assign Homework
            </button>
            <button onClick={() => setShowAudioInstForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Send Audio Instruction
            </button>
          </div>
        )
      )}

      {/* ── Audio instruction form (teacher) ── */}
      {!selfMode && showAudioInstForm && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-sky-900">Send Audio Instruction</h3>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              value={audioInstTitle}
              onChange={(e) => setAudioInstTitle(e.target.value)}
              placeholder="e.g. How to practice the C major scale"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Recording */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Record Audio</p>
            {audioInstRecordState === 'idle' && (
              <button onClick={startInstRecording}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-full hover:bg-red-600 active:scale-95 transition-all shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                Start Recording
              </button>
            )}
            {audioInstRecordState === 'recording' && (
              <div className="flex items-center gap-4">
                <button onClick={stopInstRecording}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-full hover:bg-gray-900 active:scale-95 transition-all shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                  Stop
                </button>
                <span className="text-base font-mono font-bold text-red-500 animate-pulse">{fmt(audioInstSeconds)}</span>
                <span className="flex gap-0.5 items-end h-5">
                  {[3,5,4,6,3,5,4].map((h, i) => (
                    <span key={i} className="w-1 bg-red-400 rounded-full animate-bounce"
                      style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms` }} />
                  ))}
                </span>
              </div>
            )}
            {audioInstRecordState === 'recorded' && audioInstUrl && (
              <div className="flex flex-wrap items-center gap-3">
                <audio src={audioInstUrl} controls className="h-10" style={{ minWidth: 220 }} />
                <button onClick={discardInstRecording} className="text-xs text-gray-400 hover:text-red-500 underline">
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

          {/* File upload */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Upload MP3 / Audio File</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-sm">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Choose File
              <input ref={instUploadRef} type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/m4a,audio/*"
                onChange={handleInstFileUpload} className="hidden" />
            </label>
            {audioInstFile && (
              <p className="text-xs text-gray-500 mt-1.5">
                {audioInstFile.name} · {(audioInstFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
            {audioInstPreviewUrl && <audio src={audioInstPreviewUrl} controls className="mt-2 h-10" style={{ minWidth: 220 }} />}
          </div>

          <p className="text-xs text-gray-500">This instruction will be sent to this student only.</p>

          {audioInstError && <p className="text-xs text-red-500">{audioInstError}</p>}
          <div className="flex gap-2">
            <button onClick={handleSendAudioInst} disabled={audioInstSubmitting}
              className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors">
              {audioInstSubmitting ? 'Sending…' : 'Send Audio Instruction'}
            </button>
            <button onClick={() => { resetAudioInstForm(); setShowAudioInstForm(false); }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Assignment list ── */}
      {assignments.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4">
          {selfMode ? 'No homework assigned yet.' : 'No homework assigned to this student yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const isExpanded = expandedId === a.id;
            const isReviewOpen = reviewExpandedId === a.id;
            const canSubmit = selfMode && (a.status === 'pending' || a.status === 'returned');

            return (
              <div key={a.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">

                {/* ── Card header ── */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-gray-800">{a.title}</span>
                        <StatusBadge status={a.status} />
                        {a.due_date && (
                          <span className="text-xs text-gray-400">
                            Due {new Date(a.due_date + 'T00:00:00').toLocaleDateString()}
                          </span>
                        )}
                        {a.total_marks != null && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {a.marks_awarded != null ? `${a.marks_awarded} / ` : ''}{a.total_marks} pts
                          </span>
                        )}
                      </div>
                      {a.instructions && (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.instructions}</p>
                      )}
                      {/* Habit practice target progress */}
                      {a.habit_target_habit_id && a.habit_target_count != null && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{a.habit_target_icon ?? '🎵'}</span>
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-slate-600">
                                  Practice target: <span className="font-medium">{a.habit_target_title}</span>
                                </span>
                                <span className={`font-semibold ${a.habit_target_completed >= a.habit_target_count ? 'text-green-600' : 'text-amber-600'}`}>
                                  {a.habit_target_completed}/{a.habit_target_count}×
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${a.habit_target_completed >= a.habit_target_count ? 'bg-green-500' : 'bg-amber-400'}`}
                                  style={{ width: `${Math.min(100, Math.round((a.habit_target_completed / a.habit_target_count) * 100))}%` }}
                                />
                              </div>
                            </div>
                            {/* Teacher: mic icon if voice note exists */}
                            {!selfMode && a.habit_target_has_voice_note && (
                              <button
                                onClick={() => setPlayingVoiceNote(playingVoiceNote === a.id ? null : a.id)}
                                className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 flex-shrink-0"
                                title="Play student voice note"
                              >
                                🎙 {playingVoiceNote === a.id ? 'Hide' : 'Voice note'}
                              </button>
                            )}
                          </div>
                          {/* Inline audio player for voice note */}
                          {!selfMode && playingVoiceNote === a.id && a.habit_target_latest_voice_storage_id && (
                            <div className="mt-2">
                              <audio
                                controls
                                autoPlay
                                src={`/api/files/${a.habit_target_latest_voice_storage_id}/stream`}
                                className="h-10 w-full"
                                onEnded={() => setPlayingVoiceNote(null)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Theory task prompt (student view) */}
                      {selfMode && (a.theory_prompt_text || a.theory_prompt_storage_id) && (
                        <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-indigo-700">Theory Task</p>
                          {a.theory_prompt_text && (
                            <p className="text-xs text-indigo-800">{a.theory_prompt_text}</p>
                          )}
                          {a.theory_prompt_storage_id && (
                            <a
                              href={`/api/files/${a.theory_prompt_storage_id}/stream`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800"
                            >
                              📄 View sheet
                            </a>
                          )}
                          {a.submission?.theory_answer_text && (
                            <p className="text-xs text-indigo-600 italic">Your answer: {a.submission.theory_answer_text}</p>
                          )}
                        </div>
                      )}

                      {/* Theory task answer — teacher view */}
                      {!selfMode && a.submission && (a.submission.theory_answer_text || a.submission.theory_answer_storage_id) && (
                        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-semibold text-slate-600">Theory Answer</p>
                          {a.submission.theory_answer_text && (
                            <p className="text-xs text-slate-700">{a.submission.theory_answer_text}</p>
                          )}
                          {a.submission.theory_answer_storage_id && (
                            <a
                              href={`/api/files/${a.submission.theory_answer_storage_id}/stream`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800"
                            >
                              📄 View scan
                            </a>
                          )}
                        </div>
                      )}
                      {/* Marks breakdown pills */}
                      {a.marks_breakdown && Object.keys(a.marks_breakdown).length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                          {Object.entries(a.marks_breakdown).map(([k, max]) => (
                            <span key={k} className="text-xs text-gray-400">
                              {k}: {a.marks_awarded_breakdown?.[k] != null ? `${a.marks_awarded_breakdown[k]}/` : ''}{max}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Assigned by {a.assigned_by} · {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {a.submission && (
                        <button onClick={() => handlePlaySub(a)}
                          className="p-1.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                          title={playingAssignId === a.id ? 'Stop' : 'Play submission'}>
                          {playingAssignId === a.id ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      )}
                      {/* Teacher: Review button shown only for submitted */}
                      {!selfMode && a.status === 'submitted' && (
                        <button onClick={() => handleOpenReview(a)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            isReviewOpen ? 'bg-gray-200 text-gray-700' : 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200'
                          }`}>
                          {isReviewOpen ? 'Cancel' : 'Review'}
                        </button>
                      )}
                      {/* Student: Submit / Resubmit */}
                      {canSubmit && (
                        <button onClick={() => handleExpandToggle(a.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            isExpanded ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' :
                            a.status === 'returned' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                            'bg-blue-500 text-white hover:bg-blue-600'
                          }`}>
                          {isExpanded ? 'Cancel' : a.status === 'returned' ? 'Resubmit' : 'Submit Work'}
                        </button>
                      )}
                      {/* Teacher/admin: delete */}
                      {!selfMode && (
                        <button onClick={() => handleDelete(a.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete assignment">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Submission metadata */}
                  {a.submission && (
                    <div className="mt-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs text-gray-500">
                        {selfMode ? 'Submitted' : 'Student submitted'} · {new Date(a.submission.submitted_at).toLocaleString()}
                        {a.submission.file_name && <span className="ml-1 text-gray-400">· {a.submission.file_name}</span>}
                      </p>
                      {a.submission.note && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">"{a.submission.note}"</p>
                      )}
                    </div>
                  )}

                  {/* Submission history timeline */}
                  {a.submission_history?.length > 0 && (
                    <SubmissionHistory
                      history={a.submission_history}
                      assignId={a.id}
                      totalMarks={a.total_marks}
                      marksBreakdown={a.marks_breakdown}
                      playingAssignId={playingAssignId}
                      playingSubUrl={playingSubUrl}
                      onPlay={handlePlayEntry}
                    />
                  )}

                  {/* Teacher feedback banner (student view) */}
                  {selfMode && a.teacher_comment && (
                    <div className={`mt-3 px-3 py-2 rounded-lg border text-xs ${
                      a.status === 'returned'
                        ? 'bg-orange-50 border-orange-200 text-orange-800'
                        : 'bg-green-50 border-green-200 text-green-800'
                    }`}>
                      <span className="font-medium">Teacher feedback:</span> {a.teacher_comment}
                    </div>
                  )}

                  {/* Marks awarded (student view, closed) */}
                  {selfMode && a.status === 'closed' && a.marks_awarded != null && (
                    <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-semibold text-green-800">
                        Score: {a.marks_awarded}{a.total_marks != null ? ` / ${a.total_marks}` : ''} pts
                      </p>
                      {a.marks_awarded_breakdown && Object.keys(a.marks_awarded_breakdown).length > 0 && (
                        <div className="flex flex-wrap gap-x-3 mt-1">
                          {Object.entries(a.marks_awarded_breakdown).map(([k, v]) => (
                            <span key={k} className="text-xs text-green-700">
                              {k}: {v}{a.marks_breakdown?.[k] != null ? `/${a.marks_breakdown[k]}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Teacher review panel ── */}
                {!selfMode && a.status === 'submitted' && isReviewOpen && (
                  <div className="border-t border-gray-100 bg-slate-50 p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Comment to Student <span className="font-normal normal-case text-gray-400">(optional)</span>
                      </label>
                      <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Feedback for the student..." rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                    </div>

                    {/* Marks inputs — only when assignment has total_marks */}
                    {a.total_marks != null && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                          Marks Awarded <span className="font-normal normal-case text-gray-400">(out of {a.total_marks})</span>
                        </label>
                        <input type="number" min="0" max={a.total_marks} value={reviewMarksAwarded}
                          onChange={(e) => setReviewMarksAwarded(e.target.value)}
                          placeholder={`0 – ${a.total_marks}`}
                          className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        {/* Per-criterion inputs */}
                        {a.marks_breakdown && Object.keys(a.marks_breakdown).length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {Object.entries(a.marks_breakdown).map(([k, max]) => (
                              <div key={k} className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 flex-1">{k} <span className="text-gray-400">/ {max}</span></span>
                                <input type="number" min="0" max={max}
                                  value={reviewBreakdownMarks[k] ?? ''}
                                  onChange={(e) => setReviewBreakdownMarks(prev => ({ ...prev, [k]: e.target.value }))}
                                  placeholder={`0–${max}`}
                                  className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}

                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => handleReturn(a.id)} disabled={reviewing}
                        className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg disabled:opacity-50 transition-colors">
                        {reviewing ? '…' : 'Return to Student'}
                      </button>
                      <button onClick={() => handleClose(a)} disabled={reviewing}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors">
                        {reviewing ? '…' : 'Mark as Closed'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Student submit / resubmit form ── */}
                {canSubmit && isExpanded && (
                  <div className="border-t border-gray-100 bg-slate-50 p-5 space-y-5">
                    {a.status === 'returned' && a.teacher_comment && (
                      <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
                        <span className="font-medium">Address this feedback:</span> {a.teacher_comment}
                      </div>
                    )}

                    {/* Audio recorder */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Record Audio</p>
                      {recordState === 'idle' && (
                        <button onClick={startRecording}
                          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-full hover:bg-red-600 active:scale-95 transition-all shadow-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-white" />
                          Start Recording
                        </button>
                      )}
                      {recordState === 'recording' && (
                        <div className="flex items-center gap-4">
                          <button onClick={stopRecording}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-full hover:bg-gray-900 active:scale-95 transition-all shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                            Stop
                          </button>
                          <span className="text-base font-mono font-bold text-red-500 animate-pulse">{fmt(recordSeconds)}</span>
                          <span className="flex gap-0.5 items-end h-5">
                            {[3,5,4,6,3,5,4].map((h, i) => (
                              <span key={i} className="w-1 bg-red-400 rounded-full animate-bounce"
                                style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms` }} />
                            ))}
                          </span>
                        </div>
                      )}
                      {recordState === 'recorded' && recordedUrl && (
                        <div className="flex flex-wrap items-center gap-3">
                          <audio src={recordedUrl} controls className="h-10" style={{ minWidth: 220 }} />
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

                    {/* File upload */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Upload MP3 / Audio File</p>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-sm transition-colors">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Choose File
                        <input ref={uploadInputRef} type="file"
                          accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/m4a,audio/*"
                          onChange={handleFileUpload} className="hidden" />
                      </label>
                      {uploadedFile && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          {uploadedFile.name} · {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                      {uploadPreviewUrl && <audio src={uploadPreviewUrl} controls className="mt-2 h-10" style={{ minWidth: 220 }} />}
                    </div>

                    {/* Theory answer — only shown when the assignment has a theory task */}
                    {(a.theory_prompt_text || a.theory_prompt_storage_id) && (
                      <div className="space-y-2 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Theory Answer</p>
                        {a.theory_prompt_text && (
                          <p className="text-xs text-indigo-800 font-medium">{a.theory_prompt_text}</p>
                        )}
                        {a.theory_prompt_storage_id && (
                          <a
                            href={`/api/files/${a.theory_prompt_storage_id}/stream`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800"
                          >
                            📄 View sheet
                          </a>
                        )}
                        <textarea
                          value={theoryAnswerText}
                          onChange={e => setTheoryAnswerText(e.target.value)}
                          rows={2}
                          placeholder="Type your theory answer here…"
                          className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                        />
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                          📎 {theoryAnswerFileName || 'Attach scan (image/PDF)'}
                          <input
                            ref={theoryAnswerFileRef}
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleTheoryAnswerFile}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}

                    {/* Note to teacher */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Note to Teacher <span className="font-normal normal-case text-gray-400">(optional)</span>
                      </label>
                      <textarea value={submitNote} onChange={(e) => setSubmitNote(e.target.value)}
                        placeholder="Any questions or comments for your teacher..." rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                    </div>

                    {submitError && <p className="text-xs text-red-500">{submitError}</p>}

                    <button onClick={() => handleSubmit(a.id)}
                      disabled={submitting || (!recordedBlob && !uploadedFile)}
                      className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                      {submitting ? 'Submitting…' : a.status === 'returned' ? 'Resubmit Homework' : 'Submit Homework'}
                    </button>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* ── Floating audio player ── */}
      {playingSubUrl && (
        <div className="sticky bottom-0 bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
          <p className="text-xs text-gray-500 mb-1.5 font-medium">
            Playing: {assignments.find((a) => a.id === playingAssignId)?.title}
          </p>
          <audio src={playingSubUrl} controls autoPlay className="w-full h-10"
            onEnded={() => { setPlayingAssignId(null); setPlayingSubUrl(null); }}
            onError={(e) => console.error('Audio playback error', e.currentTarget.error)} />
        </div>
      )}
    </div>
  );
};

export default HomeworkTab;
