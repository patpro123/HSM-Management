import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../../api';
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

const emptyForm = { kind: 'tagline' as BrandAssetKind, name: '', value: '' };

export default function BrandAssetLibrary() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [filter, setFilter] = useState<BrandAssetKind | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

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

  const save = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await apiPost('/api/marketing/brand-assets', form);
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch {
      setError('Failed to save asset');
    } finally {
      setSaving(false);
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value {form.kind === 'color' ? '(hex code, e.g. #FF6B35)' : form.kind === 'tagline' ? '(tagline text)' : '(URL or text value)'}
            </label>
            <input
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={form.kind === 'color' ? '#FF6B35' : form.kind === 'tagline' ? 'Your music, your journey' : ''}
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 text-sm">
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
