import React, { useState, useRef, useEffect } from 'react';
import { apiPost } from '../api';

const fmtSeconds = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export interface MakeupMaterialTarget {
  student_id: string;
  name: string;
  batch_id: string;
  instrument_name: string;
}

interface MakeupFile {
  file: File;
  data: string;
  mimeType: string;
}

interface MakeupMaterialModalProps {
  target: MakeupMaterialTarget;
  sessionDate: string;
  onClose: () => void;
  onAssigned: () => void;
}

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

// Remount this component (e.g. key={`${target.student_id}-${target.batch_id}`})
// whenever the target changes so its internal form state resets cleanly.
const MakeupMaterialModal: React.FC<MakeupMaterialModalProps> = ({ target, sessionDate, onClose, onAssigned }) => {
  const sessionDateLabel = new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const [title, setTitle] = useState(
    `Missed class — ${target.instrument_name} ${new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
  );
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

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const newFiles: MakeupFile[] = await Promise.all(
      picked.map(async f => ({ file: f, data: await readFileAsBase64(f), mimeType: f.type }))
    );
    setFiles(prev => [...prev, ...newFiles]);
    if (fileRef.current) fileRef.current.value = '';
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
        setFiles(prev => [...prev, { file, data, mimeType }]);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start(100);
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // Stop any in-progress recording / release the mic if the modal is closed mid-recording.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    };
  }, []);

  const handleTheoryFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTheoryFile(await readFileAsBase64(file));
    setTheoryFileName(file.name);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    setUploadWarning(null);
    try {
      const res = await apiPost('/api/homework/assign-makeup', {
        student_id:   target.student_id,
        batch_id:     target.batch_id,
        session_date: sessionDate,
        title:        title.trim(),
        instructions: instructions.trim() || null,
        theory_prompt_text: theoryText.trim() || null,
        theory_prompt_file: theoryFile || null,
        files: files.map(f => ({ name: f.file.name, mimeType: f.mimeType, data: f.data })),
      });

      const failedFiles: string[] = res?.failed_files || [];
      if (failedFiles.length > 0 || res?.theory_upload_failed) {
        const parts = [];
        if (failedFiles.length > 0) parts.push(`${failedFiles.length} file(s) (${failedFiles.join(', ')})`);
        if (res?.theory_upload_failed) parts.push('the theory music sheet');
        setUploadWarning(
          `Material was assigned, but ${parts.join(' and ')} failed to upload. The title/instructions/theory text were saved — try re-adding the file(s) or check the file storage service.`
        );
        // Keep the modal open so this warning is seen; the caller refreshes on close.
        return;
      }

      onAssigned();
    } catch (err: any) {
      setError(err.message || 'Failed to assign material');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h3 className="font-bold text-gray-900">Assign Makeup Material</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {target.name} · {target.instrument_name} · {sessionDateLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="e.g. Missed class — scales practice"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              placeholder="What to practice or review…"
            />
          </div>

          <div className="border-t border-dashed border-slate-200 pt-3">
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
            <label className="block text-xs font-semibold text-gray-600 mb-2">Attachments</label>
            {files.length > 0 && (
              <div className="space-y-1 mb-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-700 truncate flex-1">{f.file.name}</span>
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
                className="flex items-center gap-2 text-sm text-orange-600 border border-orange-200 rounded-lg px-3 py-2 hover:bg-orange-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add files (mp3, mp4, image, pdf)
              </button>

              {!recording ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 text-sm text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Record Audio
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 text-sm text-white bg-gray-800 rounded-lg px-3 py-2 hover:bg-gray-900 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-sm bg-white" />
                    Stop
                  </button>
                  <span className="text-sm font-mono font-bold text-red-500 animate-pulse">{fmtSeconds(recordSeconds)}</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {uploadWarning && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ {uploadWarning}</p>
          )}

          <div className="flex gap-3 pt-1">
            {uploadWarning ? (
              <button
                onClick={onAssigned}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim()}
                  className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Sending…' : 'Assign + Notify'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MakeupMaterialModal;
