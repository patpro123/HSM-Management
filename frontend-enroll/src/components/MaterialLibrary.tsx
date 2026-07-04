import { useState, useRef, useEffect, useCallback } from 'react';
import { apiPost, apiDelete, searchMaterials, materialFileUrl } from '../api';
import { getCurrentUser } from '../auth';
import { Instrument, TeachingMaterial, MaterialType } from '../types';
import MaterialPreview from './MaterialPreview';

interface MaterialLibraryProps {
  instruments: Instrument[];
}

const TYPE_FILTERS: { value: MaterialType | ''; label: string }[] = [
  { value: '',          label: 'All' },
  { value: 'audio',     label: 'Audio' },
  { value: 'video',     label: 'Video' },
  { value: 'image',     label: 'Image' },
  { value: 'document',  label: 'PDF' },
];

const TYPE_ICON: Record<MaterialType, string> = {
  audio: '🎵', video: '🎬', image: '🖼️', document: '📄',
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

const fmtSeconds = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export default function MaterialLibrary({ instruments }: MaterialLibraryProps) {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.roles?.includes('admin') || false;

  const [instrumentId, setInstrumentId] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MaterialType | ''>('');
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // ── Search existing library for the selected instrument ─────────────────────
  const loadMaterials = useCallback(async () => {
    if (!instrumentId) { setMaterials([]); return; }
    setLoading(true);
    setListError(null);
    try {
      const res = await searchMaterials({ instrumentId, type: typeFilter || undefined, q: query });
      setMaterials(res.materials || []);
    } catch (err: any) {
      setListError(err.message || 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [instrumentId, typeFilter, query]);

  useEffect(() => {
    const t = setTimeout(loadMaterials, 300); // debounce title search
    return () => clearTimeout(t);
  }, [loadMaterials]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this material from the library? Assignments that already used it keep their file.')) return;
    try {
      await apiDelete(`/api/materials/${id}`);
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to remove material');
    }
  };

  // ── Create new material ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pickedFile, setPickedFile] = useState<{ file: File; data: string; mimeType: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetCreateForm = () => {
    setTitle(''); setDescription('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPickedFile(null); setPreviewUrl(null);
    setRecordState('idle'); setRecordSeconds(0);
    setSaveError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFileAsBase64(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPickedFile({ file, data, mimeType: file.type });
    setPreviewUrl(URL.createObjectURL(file));
    setRecordState('idle');
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
        setPickedFile({ file, data, mimeType });
        setPreviewUrl(URL.createObjectURL(blob));
        setRecordState('recorded');
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start(100);
      setRecordState('recording');
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setSaveError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const discardPicked = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPickedFile(null);
    setPreviewUrl(null);
    setRecordState('idle');
    setRecordSeconds(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!title.trim() || !instrumentId || !pickedFile) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiPost('/api/materials', {
        title: title.trim(),
        description: description.trim() || null,
        instrument_id: instrumentId,
        file_name: pickedFile.file.name,
        mime_type: pickedFile.mimeType,
        file_data: pickedFile.data,
      });
      resetCreateForm();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadMaterials();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Material Library</h2>
        <p className="text-sm text-slate-500">
          Record or upload material once, tag it by instrument, and reuse it across assignments instead of re-uploading.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-xs font-medium text-gray-600 mb-1">Instrument *</label>
        <select
          value={instrumentId}
          onChange={e => setInstrumentId(e.target.value)}
          className="w-full md:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="">Select an instrument…</option>
          {instruments.map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      {!instrumentId ? (
        <p className="text-sm text-slate-400 italic">Pick an instrument above to see what's already in the library and add new material.</p>
      ) : (
        <>
          {/* Existing material for this instrument — shown first to avoid duplicates */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-sm text-slate-800">
              Already in the library for {instruments.find(i => String(i.id) === String(instrumentId))?.name}
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by title…"
                className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex gap-1">
                {TYPE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      typeFilter === f.value ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {listError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{listError}</p>}
            {loading && <p className="text-sm text-slate-400">Searching…</p>}
            {!loading && materials.length === 0 && (
              <p className="text-sm text-slate-400 italic">Nothing here yet — be the first to add material for this instrument below.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {materials.map(m => {
                const canDelete = isAdmin || (currentUser && currentUser.id === m.created_by_user_id);
                return (
                  <div key={m.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 truncate">
                          <span>{TYPE_ICON[m.material_type]}</span>
                          <span className="truncate">{m.title}</span>
                        </div>
                        {m.description && <p className="text-xs text-slate-500 truncate">{m.description}</p>}
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-slate-300 hover:text-red-500 flex-shrink-0"
                          title="Remove from library"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <MaterialPreview
                      mimeType={m.mime_type}
                      fileName={m.file_name}
                      previewUrl={materialFileUrl(m.id)}
                      downloadUrl={m.public_url}
                    />
                    <p className="text-[11px] text-slate-400">
                      {m.created_by_name || 'Unknown'} · {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create new material */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm text-orange-900">Add New Material</h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="e.g. Major Scale Backing Track"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {!pickedFile ? (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,video/*,image/*,application/pdf"
                  onChange={handleFilePick}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-orange-600 border border-orange-200 rounded-lg px-3 py-2 bg-white hover:bg-orange-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload file (audio, video, image, PDF)
                </button>

                {recordState === 'idle' && (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-full hover:bg-red-600 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white" />
                    Record Audio
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
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Preview — check it's right before saving to the library</p>
                {previewUrl && (
                  <MaterialPreview mimeType={pickedFile.mimeType} previewUrl={previewUrl} fileName={pickedFile.file.name} />
                )}
                <button onClick={discardPicked} className="text-xs text-gray-400 hover:text-red-500 underline">
                  Discard &amp; redo
                </button>
              </div>
            )}

            {saveError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
            {saveSuccess && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">Saved to the library.</p>}

            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !pickedFile}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save to Library'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
