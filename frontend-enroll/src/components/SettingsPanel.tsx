import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

interface BannerConfig {
  demo_day_banner_enabled: boolean;
  demo_day_title: string;
  demo_day_description: string;
  demo_day_link_enabled: boolean;
  demo_day_location: string;
  demo_day_date: string;
  demo_day_instruments: string[];
  piano_teacher_title: string;
  piano_teacher_description: string;
}

const SettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await apiGet('/api/flash-banner');
        setConfig(data);
      } catch (err) {
        console.error('Failed to load flash banner config:', err);
      } finally {
        setLoading(false);
      }
    };
    const fetchInstruments = async () => {
      try {
        const data = await apiGet('/api/instruments');
        const list = data.instruments || data || [];
        setInstruments(list.filter((i: any) => !i.is_deprecated));
      } catch (err) {
        console.error('Failed to load instruments:', err);
      }
    };
    fetchConfig();
    fetchInstruments();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiPost('/api/flash-banner', config);
      setMessage({ text: 'Landing page settings successfully saved!', type: 'success' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Failed to save settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 animate-pulse">Loading settings...</div>;
  }

  if (!config) {
    return <div className="text-sm text-red-500">Failed to load configuration.</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Landing Page Announcements</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure the double-part announcements flash section shown at the top of the public landing page.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-semibold ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm">
        
        {/* Section 1: Demo Day Registration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span>📢</span> Part 1: Demo Day Registration
            </h3>
            <div className="flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.demo_day_banner_enabled ?? true}
                  onChange={(e) => setConfig({ ...config, demo_day_banner_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                <span className="ml-2 text-xs font-bold text-slate-600">
                  {config.demo_day_banner_enabled ?? true ? 'Banner On' : 'Banner Off'}
                </span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.demo_day_link_enabled}
                  onChange={(e) => setConfig({ ...config, demo_day_link_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                <span className="ml-2 text-xs font-bold text-slate-600">
                  {config.demo_day_link_enabled ? 'Link Active' : 'Link Disabled'}
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={config.demo_day_title}
                onChange={(e) => setConfig({ ...config, demo_day_title: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Demo Day Date
                </label>
                <input
                  type="date"
                  value={config.demo_day_date}
                  onChange={(e) => setConfig({ ...config, demo_day_date: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Demo Day Location / Campus
                </label>
                <select
                  value={config.demo_day_location}
                  onChange={(e) => setConfig({ ...config, demo_day_location: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white animate-none"
                  required
                >
                  <option value="hsm_main">HSM Main Branch (Kismatpur)</option>
                  <option value="pbel_city">PBEL City Campus</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Demo Day Instruments
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                {instruments.map((inst) => {
                  const isChecked = config.demo_day_instruments?.includes(inst.name);
                  return (
                    <label key={inst.id} className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...(config.demo_day_instruments || []), inst.name]
                            : (config.demo_day_instruments || []).filter((name) => name !== inst.name);
                          setConfig({ ...config, demo_day_instruments: updated });
                        }}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span>{inst.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Select the instruments that will be demoed during Demo Day. Prospects will only be able to choose from these streams on the registration form.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                value={config.demo_day_description}
                onChange={(e) => setConfig({ ...config, demo_day_description: e.target.value })}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Note: Even when the registration link is disabled, the placeholder remains visible on the landing page, but the buttons/links are disabled to preserve permanent sections.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: New Piano Batches */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span>🎹</span> Part 2: Starting New Piano Batches
          </h3>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={config.piano_teacher_title}
                onChange={(e) => setConfig({ ...config, piano_teacher_title: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                value={config.piano_teacher_description}
                onChange={(e) => setConfig({ ...config, piano_teacher_description: e.target.value })}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          {saving ? 'Saving changes...' : 'Save Settings'}
        </button>

      </form>
    </div>
  );
};

export default SettingsPanel;
