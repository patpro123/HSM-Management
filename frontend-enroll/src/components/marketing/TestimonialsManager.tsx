import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api';
import type { MarketingTestimonial, EligibleEvaluation } from '../../types';

type Tab = 'published' | 'promote';

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span className="text-yellow-500 text-xs">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function TestimonialsManager() {
  const [tab, setTab] = useState<Tab>('published');
  const [testimonials, setTestimonials] = useState<MarketingTestimonial[]>([]);
  const [evaluations, setEvaluations] = useState<EligibleEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ quote: '', author_name: '', instrument: '', rating: '' });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tData, eData] = await Promise.all([
        apiGet('/api/marketing/testimonials'),
        apiGet('/api/marketing/eligible-evaluations'),
      ]);
      setTestimonials(tData.testimonials || []);
      setEvaluations(eData.evaluations || []);
    } catch {
      setError('Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const promoteEvaluation = async (ev: EligibleEvaluation) => {
    setSaving(ev.evaluation_id);
    try {
      await apiPost('/api/marketing/testimonials', {
        student_id: ev.student_id,
        evaluation_id: ev.evaluation_id,
        quote: ev.feedback || ev.title || '',
        author_name: ev.student_name,
        instrument: ev.instrument,
        rating: ev.rating,
      });
      await loadAll();
      setTab('published');
    } catch {
      setError('Failed to promote evaluation');
    } finally {
      setSaving(null);
    }
  };

  const toggleConsent = async (t: MarketingTestimonial) => {
    setSaving(t.id);
    try {
      await apiPut(`/api/marketing/testimonials/${t.id}`, { consent_obtained: !t.consent_obtained });
      await loadAll();
    } catch {
      setError('Failed to update consent');
    } finally {
      setSaving(null);
    }
  };

  const togglePublish = async (t: MarketingTestimonial) => {
    if (!t.consent_obtained && !t.is_published) {
      setError('Obtain parent consent before publishing');
      return;
    }
    setSaving(t.id);
    try {
      await apiPut(`/api/marketing/testimonials/${t.id}`, { is_published: !t.is_published });
      await loadAll();
    } catch {
      setError('Failed to toggle publish status');
    } finally {
      setSaving(null);
    }
  };

  const deleteTestimonial = async (id: string) => {
    if (!confirm('Delete this testimonial?')) return;
    try {
      await apiDelete(`/api/marketing/testimonials/${id}`);
      setTestimonials(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to delete testimonial');
    }
  };

  const submitManual = async () => {
    if (!form.quote || !form.author_name) { setError('Quote and author name are required'); return; }
    setSaving('form');
    try {
      await apiPost('/api/marketing/testimonials', {
        ...form,
        rating: form.rating ? parseInt(form.rating, 10) : null,
      });
      setForm({ quote: '', author_name: '', instrument: '', rating: '' });
      setShowForm(false);
      await loadAll();
    } catch {
      setError('Failed to save testimonial');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm py-4">Loading testimonials...</div>;

  const publishedCount = testimonials.filter(t => t.is_published).length;
  const pendingConsent = testimonials.filter(t => !t.consent_obtained).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-2 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full">{publishedCount} published</span>
        <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">{testimonials.length} total</span>
        {pendingConsent > 0 && (
          <span className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full">{pendingConsent} awaiting consent</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['published', 'promote'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'published' ? `All (${testimonials.length})` : `Promote from Evaluations (${evaluations.filter(e => !e.already_promoted).length})`}
          </button>
        ))}
      </div>

      {tab === 'published' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              + Add Manual Testimonial
            </button>
          </div>

          {showForm && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">New Testimonial</h4>
              <textarea
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Quote / testimonial text"
                value={form.quote}
                onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Author name"
                  value={form.author_name}
                  onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                />
                <input
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Instrument (optional)"
                  value={form.instrument}
                  onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}
                />
              </div>
              <select
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.rating}
                onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}
              >
                <option value="">Rating (optional)</option>
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} stars</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={submitManual} disabled={saving === 'form'} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50">
                  {saving === 'form' ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {testimonials.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No testimonials yet. Promote evaluations or add manually.</div>
          )}

          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {testimonials.map(t => (
              <div key={t.id} className="bg-white px-4 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 italic">"{t.quote}"</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-medium text-gray-600">— {t.author_name}</span>
                      {t.instrument && <span className="text-xs text-gray-400">{t.instrument}</span>}
                      <StarRating rating={t.rating} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleConsent(t)}
                        disabled={saving === t.id}
                        className={`text-xs px-2 py-1 rounded border ${t.consent_obtained ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}
                      >
                        {t.consent_obtained ? 'Consent ✓' : 'Consent?'}
                      </button>
                      <button
                        onClick={() => togglePublish(t)}
                        disabled={saving === t.id}
                        className={`text-xs px-2 py-1 rounded border ${t.is_published ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                      >
                        {t.is_published ? 'Published' : 'Draft'}
                      </button>
                    </div>
                    <button
                      onClick={() => deleteTestimonial(t.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'promote' && (
        <div className="space-y-2">
          {evaluations.filter(e => !e.already_promoted).length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No eligible evaluations to promote. Teachers need to add ratings ≥ 4 or milestones.
            </div>
          )}
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {evaluations.filter(e => !e.already_promoted).map(ev => (
              <div key={ev.evaluation_id} className="bg-white px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{ev.student_name}</span>
                    {ev.instrument && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ev.instrument}</span>}
                    <StarRating rating={ev.rating} />
                  </div>
                  {ev.title && (
                    <p className="text-xs text-orange-600 mt-0.5">{ev.title}</p>
                  )}
                  {ev.feedback && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 italic">"{ev.feedback}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(ev.evaluation_date).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => promoteEvaluation(ev)}
                  disabled={saving === ev.evaluation_id || (!ev.feedback && !ev.title)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-xs shrink-0 disabled:opacity-40"
                  title={!ev.feedback && !ev.title ? 'No feedback text — teacher feedback is empty' : undefined}
                >
                  {saving === ev.evaluation_id ? 'Promoting...' : 'Promote'}
                </button>
              </div>
            ))}
          </div>
          {evaluations.filter(e => e.already_promoted).length > 0 && (
            <p className="text-xs text-gray-400 text-center pt-2">
              {evaluations.filter(e => e.already_promoted).length} already promoted
            </p>
          )}
        </div>
      )}
    </div>
  );
}
