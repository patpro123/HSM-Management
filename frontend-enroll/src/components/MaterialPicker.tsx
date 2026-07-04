import { useState, useEffect, useCallback } from 'react';
import { apiGet, searchMaterials, materialFileUrl } from '../api';
import { Instrument, TeachingMaterial, MaterialType } from '../types';
import MaterialPreview from './MaterialPreview';

export interface PickedMaterial {
  materialId: string;
  name: string;
  mimeType: string;
}

interface MaterialPickerProps {
  /** Instrument name (not id) — callers like MakeupAssignPanel only know the batch's
   *  instrument by name, so the picker resolves it to an id itself once instruments load. */
  defaultInstrumentName?: string;
  onPick: (picked: PickedMaterial[]) => void;
  onClose: () => void;
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

export default function MaterialPicker({ defaultInstrumentName, onPick, onClose }: MaterialPickerProps) {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentId, setInstrumentId] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MaterialType | ''>('');
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load instruments once, then resolve the default instrument by name (the caller
  // usually only knows the batch's instrument as a display name, not its id).
  useEffect(() => {
    apiGet('/api/instruments').then(res => {
      const list: Instrument[] = res.instruments || [];
      setInstruments(list);
      if (defaultInstrumentName) {
        const match = list.find(i => i.name.toLowerCase() === defaultInstrumentName.toLowerCase());
        if (match) setInstrumentId(String(match.id));
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!instrumentId) { setMaterials([]); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await searchMaterials({ instrumentId, type: typeFilter || undefined, q: query });
      setMaterials(res.materials || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [instrumentId, typeFilter, query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const picked = materials
      .filter(m => selectedIds.has(m.id))
      .map(m => ({ materialId: m.id, name: m.title, mimeType: m.mime_type }));
    onPick(picked);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Choose from Library</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Instrument *</label>
            <select
              value={instrumentId}
              onChange={e => setInstrumentId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">Select an instrument…</option>
              {instruments.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          {instrumentId && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by title…"
                  className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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

              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              {loading && <p className="text-sm text-slate-400">Searching…</p>}
              {!loading && materials.length === 0 && (
                <p className="text-sm text-slate-400 italic">No material found for this instrument yet.</p>
              )}

              <div className="space-y-2">
                {materials.map(m => {
                  const selected = selectedIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className={`border rounded-lg p-3 space-y-2 ${
                        selected ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => toggleSelect(m.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(m.id)}
                          className="w-4 h-4 accent-orange-600"
                        />
                        <span className="text-lg">{TYPE_ICON[m.material_type]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800 truncate">{m.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {m.created_by_name || 'Unknown'} · {new Date(m.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {/* Stop propagation so interacting with the player/download links doesn't also toggle selection */}
                      <div onClick={e => e.stopPropagation()}>
                        <MaterialPreview
                          mimeType={m.mime_type}
                          fileName={m.file_name}
                          previewUrl={materialFileUrl(m.id)}
                          downloadUrl={m.public_url}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              Add {selectedIds.size > 0 ? selectedIds.size : ''} to Assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
