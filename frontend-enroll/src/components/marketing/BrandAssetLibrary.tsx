import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiDelete, apiUpload } from '../../api';
import { API_BASE_URL } from '../../config';
import type { BrandAsset, BrandAssetKind } from '../../types';

const KIND_LABELS: Record<BrandAssetKind, string> = {
  logo:     'Logo',
  color:    'Color',
  tagline:  'Tagline',
  photo:    'Photo',
  doc:      'Document',
  template: 'Template',
};

const KIND_COLORS: Record<BrandAssetKind, string> = {
  logo:     'bg-purple-100 text-purple-700',
  color:    'bg-pink-100 text-pink-700',
  tagline:  'bg-blue-100 text-blue-700',
  photo:    'bg-green-100 text-green-700',
  doc:      'bg-gray-100 text-gray-700',
  template: 'bg-orange-100 text-orange-700',
};

const ALL_KINDS: BrandAssetKind[] = ['logo', 'color', 'tagline', 'photo', 'doc', 'template'];

// Kinds stored as uploaded files (vs. inline text like colors and taglines)
const FILE_KINDS: BrandAssetKind[] = ['logo', 'photo', 'doc', 'template'];

const ACCEPTED_FILE_TYPES = '.png,.jpg,.jpeg,.webp,.gif,.svg,.pdf';

const emptyForm = { kind: 'tagline' as BrandAssetKind, name: '', value: '' };

const isFileKind = (kind: BrandAssetKind) => FILE_KINDS.includes(kind);

const streamUrl = (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/stream`;

export default function BrandAssetLibrary() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [filter, setFilter] = useState<BrandAssetKind | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/marketing/brand-assets');
      setAssets(data.assets || []);
    } catch {
      setError('Failed to load brand assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    if (!form.name) { setError('Name is required'); return; }
    if (isFileKind(form.kind) && !file && !form.value) {
      setError('Choose a file to upload (or paste a URL)');
      return;
    }
    setSaving(true);
    try {
      let fileId: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'marketing');
        fd.append('entityType', 'brand_asset');
        const uploaded = await apiUpload('/api/files/upload', fd);
        fileId = uploaded.fileStorageId;
      }
      await apiPost('/api/marketing/brand-assets', {
        kind: form.kind,
        name: form.name,
        value: form.value || null,
        file_id: fileId,
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = async (asset: BrandAsset) => {
    const link = asset.public_url || (asset.file_id ? streamUrl(asset.file_id) : asset.value);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Could not copy link to clipboard');
    }
  };

  const deactivate = async (id: string) => {
    if (!confirm('Remove this asset from the library?')) return;
    try {
      await apiDelete(`/api/marketing/brand-assets/${id}`);
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch {
      setError('Failed to remove asset');
    }
  };

  const visible = filter === 'all' ? assets : assets.filter(a => a.kind === filter);

  const groupedCounts = ALL_KINDS.reduce((acc, k) => {
    acc[k] = assets.filter(a => a.kind === k).length;
    return acc;
  }, {} as Record<BrandAssetKind, number>);

  if (loading) return <div className="text-gray-400 text-sm py-4">Loading brand assets...</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-2 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1 rounded-full border ${filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
        >
          All ({assets.length})
        </button>
        {ALL_KINDS.map(k => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === k ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            {KIND_LABELS[k]} ({groupedCounts[k]})
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          + Add Asset
        </button>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">New Brand Asset</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kind</label>
              <select
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.kind}
                onChange={e => setForm(f => ({ ...f, kind: e.target.value as BrandAssetKind }))}
              >
                {ALL_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Primary Logo, Main Tagline"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
          </div>
          {isFileKind(form.kind) ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File (.png, .jpg, .webp, .svg, .gif, .pdf)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
                {file && (
                  <p className="text-xs text-gray-500 mt-1">
                    {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Or external URL (optional — used if no file is chosen)
                </label>
                <input
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value {form.kind === 'color' ? '(hex code, e.g. #FF6B35)' : '(tagline text)'}
              </label>
              <input
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={form.kind === 'color' ? '#FF6B35' : 'Your music, your journey'}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50">
              {saving ? (file ? 'Uploading...' : 'Saving...') : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No {filter === 'all' ? '' : KIND_LABELS[filter] + ' '}assets yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.map(asset => (
          <div key={asset.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KIND_COLORS[asset.kind]}`}>
                  {KIND_LABELS[asset.kind]}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">{asset.name}</span>
              </div>
              {asset.value && asset.kind === 'color' ? (
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-6 h-6 rounded border border-gray-200 shrink-0"
                    style={{ backgroundColor: asset.value }}
                  />
                  <span className="text-xs text-gray-500 font-mono">{asset.value}</span>
                </div>
              ) : asset.file_id ? (
                <div className="mt-2 space-y-2">
                  {asset.mime_type?.startsWith('image/') ? (
                    <a href={streamUrl(asset.file_id)} target="_blank" rel="noopener noreferrer">
                      <img
                        src={streamUrl(asset.file_id)}
                        alt={asset.name}
                        className="h-24 max-w-full object-contain rounded border border-gray-100 bg-gray-50"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-gray-600 truncate">
                      📄 {asset.file_name || 'Attached file'}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <a
                      href={streamUrl(asset.file_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => copyShareLink(asset)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {copiedId === asset.id ? '✓ Copied' : 'Copy share link'}
                    </button>
                  </div>
                </div>
              ) : asset.value ? (
                <p className="text-sm text-gray-600 mt-1 truncate">{asset.value}</p>
              ) : (
                <p className="text-xs text-gray-400 mt-1 italic">File-based asset</p>
              )}
            </div>
            <button
              onClick={() => deactivate(asset.id)}
              className="text-xs text-red-500 hover:text-red-700 shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
