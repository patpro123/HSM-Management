import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { getCurrentUser } from '../auth';

interface Submission {
  id: string;
  file_name: string | null;
  file_type: string | null;
  file_url: string | null;        // Drive public URL (new submissions)
  file_storage_id: string | null;
  note: string | null;
  submitted_at: string;
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
      const res = await apiGet(`/api/students/${studentId}/homework`);
      setAssignments(res.assignments || []);
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
      });
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
      });
      setAssignTitle(''); setAssignInstructions(''); setAssignDueDate('');
      setAssignTotalMarks(''); setAssignBreakdown([]); setShowAssignForm(false);
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

  // ── Submission playback ────────────────────────────────────────────────────
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
          <button onClick={() => setShowAssignForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Assign Homework
          </button>
        )
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
