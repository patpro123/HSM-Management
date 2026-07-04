import { useState, useRef, useEffect } from 'react';
import { apiPost } from '../api';
import MaterialPicker, { PickedMaterial } from './MaterialPicker';

const fmtSeconds = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export interface MakeupMaterialTarget {
  student_id: string;
  name: string;
  batch_id: string;
  instrument_name: string;
}

// Either a freshly recorded/uploaded file (carries its own base64 data) or a
// reference to an existing library item (carries only its id — no re-upload).
type MakeupFile =
  | { kind: 'upload'; name: string; mimeType: string; data: string }
  | { kind: 'library'; name: string; mimeType: string; materialId: string };

interface MakeupAssignPanelProps {
  targets: MakeupMaterialTarget[];
  sessionDate: string;
  onAssigned: () => void;
}

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

// Always-visible inline panel — mirrors BulkHomeworkPanel's "select recipients, then
// fill in the shared form below" pattern. Stays mounted while the parent's selection
// changes, so its own form state (title/instructions/files) is not reset by that;
// it only resets itself after a successful assignment.
export default function MakeupAssignPanel({ targets, sessionDate, onAssigned }: MakeupAssignPanelProps) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState<MakeupFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [theoryOpen, setTheoryOpen] = useState(false);
  const [theoryText, setTheoryText] = useState('');
  const [theoryFile, setTheoryFile] = useState<string | null>(null);
  const [theoryFileName, setTheoryFileName] = useState('');
  const theoryFileRef = useRef<HTMLInputElement | null>(null);

  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedFileRef, setRecordedFileRef] = useState<MakeupFile | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);

  const resetForm = () => {
    setTitle(''); setInstructions('');
    setFiles([]); setError(null); setUploadWarning(null);
    setTheoryOpen(false); setTheoryText(''); setTheoryFile(null); setTheoryFileName('');
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null); setRecordedFileRef(null); setRecordState('idle'); setRecordSeconds(0);
    if (fileRef.current) fileRef.current.value = '';
    if (theoryFileRef.current) theoryFileRef.current.value = '';
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const newFiles: MakeupFile[] = await Promise.all(
      picked.map(async f => ({ kind: 'upload' as const, name: f.name, mimeType: f.type, data: await readFileAsBase64(f) }))
    );
    setFiles(prev => [...prev, ...newFiles]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleLibraryPick = (picked: PickedMaterial[]) => {
    setFiles(prev => [
      ...prev,
      ...picked.map(p => ({ kind: 'library' as const, name: p.name, mimeType: p.mimeType, materialId: p.materialId })),
    ]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: mimeType });
        const data = await readFileAsBase64(file);
        const entry: MakeupFile = { kind: 'upload', name: file.name, mimeType, data };
        setFiles(prev => [...prev, entry]);
        setRecordedFileRef(entry);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecordState('recorded');
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start(100);
      setRecordState('recording');
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const discardRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    if (recordedFileRef) setFiles(prev => prev.filter(f => f !== recordedFileRef));
    setRecordedUrl(null);
    setRecordedFileRef(null);
    setRecordState('idle');
    setRecordSeconds(0);
  };

  // Stop any in-progress recording / release the mic on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTheoryFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTheoryFile(await readFileAsBase64(file));
    setTheoryFileName(file.name);
  };

  const handleSubmit = async () => {
    if (!title.trim() || targets.length === 0) return;
    setSubmitting(true);
    setError(null);
    setUploadWarning(null);
    try {
      const res = await apiPost('/api/homework/assign-makeup-bulk', {
        targets: targets.map(t => ({ student_id: t.student_id, batch_id: t.batch_id })),
        session_date: sessionDate,
        title:        title.trim(),
        instructions: instructions.trim() || null,
        theory_prompt_text: theoryText.trim() || null,
        theory_prompt_file: theoryFile || null,
        files: files.map(f => f.kind === 'library'
          ? { material_id: f.materialId, name: f.name, mimeType: f.mimeType }
          : { name: f.name, mimeType: f.mimeType, data: f.data }),
      });

      const failedFiles: string[] = res?.failed_files || [];
      if (failedFiles.length > 0 || res?.theory_upload_failed) {
        const parts = [];
        if (failedFiles.length > 0) parts.push(`${failedFiles.length} file(s) (${failedFiles.join(', ')})`);
        if (res?.theory_upload_failed) parts.push('the theory music sheet');
        setUploadWarning(
          `Material was assigned, but ${parts.join(' and ')} failed to upload. The title/instructions/theory text were saved — try re-adding the file(s) or check the file storage service.`
        );
        onAssigned();
        return;
      }

      resetForm();
      onAssigned();
    } catch (err: any) {
      setError(err.message || 'Failed to assign material');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-sm text-orange-900">Assign Makeup Material</h3>
      <p className="text-xs text-orange-700">
        {targets.length === 0
          ? 'Select one or more students above to assign material.'
          : `${targets.length} student${targets.length !== 1 ? 's' : ''} selected: ${targets.map(t => t.name).join(', ')}`}
      </p>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="e.g. Missed class — scales practice"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          placeholder="What to practice or review…"
        />
      </div>

      <div className="border-t border-dashed border-orange-200 pt-3">
        <button
          type="button"
          onClick={() => setTheoryOpen(o => !o)}
          className="text-xs text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
        >
          {theoryOpen ? '▾' : '▸'} Theory Task <span className="font-normal text-gray-400">(optional)</span>
        </button>
        {theoryOpen && (
          <div className="mt-2 space-y-2">
            <textarea
              value={theoryText}
              onChange={e => setTheoryText(e.target.value)}
              rows={2}
              placeholder="e.g. Name the notes in the D minor scale"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
              📎 {theoryFileName || 'Attach music sheet (image/PDF)'}
              <input ref={theoryFileRef} type="file" accept="image/*,application/pdf" onChange={handleTheoryFilePick} className="hidden" />
            </label>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Attachments</label>
        {files.length > 0 && (
          <div className="space-y-1 mb-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-700 truncate flex-1">
                  {f.kind === 'library' && <span className="text-orange-500 mr-1" title="From library">📚</span>}
                  {f.name}
                </span>
                <button
                  onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="audio/*,video/*,image/*,application/pdf"
          onChange={handleFilePick}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-sm text-orange-600 border border-orange-200 rounded-lg px-3 py-2 bg-white hover:bg-orange-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add files (mp3, mp4, image, pdf)
          </button>

          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 text-sm text-orange-600 border border-orange-200 rounded-lg px-3 py-2 bg-white hover:bg-orange-50 transition-colors"
          >
            📚 Choose from Library
          </button>

          {recordState === 'idle' && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-full hover:bg-red-600 active:scale-95 transition-all shadow-sm"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
              Start Recording
            </button>
          )}
          {recordState === 'recording' && (
            <div className="flex items-center gap-4">
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-full hover:bg-gray-900 active:scale-95 transition-all shadow-sm"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                Stop
              </button>
              <span className="text-base font-mono font-bold text-red-500 animate-pulse">{fmtSeconds(recordSeconds)}</span>
              <span className="flex gap-0.5 items-end h-5">
                {[3, 5, 4, 6, 3, 5, 4].map((h, i) => (
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
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {uploadWarning && (
        <p className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">⚠ {uploadWarning}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || targets.length === 0}
        className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
      >
        {submitting
          ? 'Assigning…'
          : `Assign to ${targets.length} Student${targets.length !== 1 ? 's' : ''}`}
      </button>

      {pickerOpen && (
        <MaterialPicker
          defaultInstrumentName={targets[0]?.instrument_name}
          onPick={handleLibraryPick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
