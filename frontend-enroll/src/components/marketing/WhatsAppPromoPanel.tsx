import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api';

interface WaMessage {
  id: string;
  name: string;
  event_name: string;
  event_date: string | null;
  event_time: string | null;
  venue: string;
  instruments: string[];
  registration_link: string;
  special_info: string | null;
  updated_at: string;
}

const ALL_INSTRUMENTS = [
  'Keyboard', 'Guitar', 'Piano', 'Drums',
  'Tabla', 'Violin', 'Hindustani Vocals', 'Carnatic Vocals',
];
const VENUES = ['HSM Main Branch', 'PBEL City Branch'];
const DEFAULT_LINK = 'https://portal.hsm.org.in/demoday';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function buildTemplateMessage(fields: {
  eventName: string; eventDate: string; eventTime: string;
  venue: string; instruments: string[]; registrationLink: string; specialInfo: string;
}): string {
  const { eventName, eventDate, eventTime, venue, instruments, registrationLink, specialInfo } = fields;
  const dateStr = eventDate ? formatDate(eventDate) : '[Date TBD]';
  const instrLines = instruments.length > 0
    ? instruments.map(i => `  • ${i}`).join('\n')
    : '  • All instruments';

  const lines: string[] = [
    `🎵 *${eventName || 'Demo Day'} — Hyderabad School of Music*`,
    '',
    `📅 Date: ${dateStr}`,
  ];
  if (eventTime) lines.push(`⏰ Time: ${eventTime}`);
  lines.push(
    `📍 Venue: ${venue}`,
    '',
    `🎸 *Instruments offered for demo:*`,
    instrLines,
    '',
    `📝 *Register here:*`,
    registrationLink || DEFAULT_LINK,
  );
  if (specialInfo.trim()) lines.push('', `✨ *Special info:*`, specialInfo.trim());
  lines.push('', `We'd love to see you there! For enquiries, WhatsApp or call us.`, '', `*— Team HSM 🎶*`);

  return lines.join('\n');
}

// Spinner icon reused in two places
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function WhatsAppPromoPanel() {
  // ── template persistence ──────────────────────────────────────────────────
  const [saved, setSaved]         = useState<WaMessage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // ── form fields ───────────────────────────────────────────────────────────
  const [templateName, setTemplateName]           = useState('');
  const [eventName, setEventName]                 = useState('Demo Day');
  const [eventDate, setEventDate]                 = useState('');
  const [eventTime, setEventTime]                 = useState('');
  const [venue, setVenue]                         = useState('HSM Main Branch');
  const [instruments, setInstruments]             = useState<string[]>([]);
  const [registrationLink, setRegistrationLink]   = useState(DEFAULT_LINK);
  const [specialInfo, setSpecialInfo]             = useState('');

  // ── preview / AI ─────────────────────────────────────────────────────────
  const [previewMode, setPreviewMode] = useState<'template' | 'ai'>('template');
  const [aiMessage, setAiMessage]     = useState('');
  const [maxWords, setMaxWords]       = useState(150);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError]       = useState('');
  const [aiIsStale, setAiIsStale]     = useState(false);
  const generatedSnapshotRef          = useRef('');

  // ── shared ui ─────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [error, setError]   = useState('');

  const templateMessage = buildTemplateMessage({ eventName, eventDate, eventTime, venue, instruments, registrationLink, specialInfo });
  const activeMessage   = previewMode === 'ai' && aiMessage ? aiMessage : templateMessage;
  const waLink          = `https://wa.me/?text=${encodeURIComponent(activeMessage)}`;

  useEffect(() => { fetchSaved(); }, []);

  // Mark AI message stale when form fields or word limit change after generation
  useEffect(() => {
    if (!aiMessage) return;
    const snapshot = JSON.stringify({ eventName, eventDate, eventTime, venue, instruments, registrationLink, specialInfo, maxWords });
    setAiIsStale(snapshot !== generatedSnapshotRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, eventDate, eventTime, venue, JSON.stringify(instruments), registrationLink, specialInfo, maxWords]);

  async function fetchSaved() {
    setLoadingList(true);
    try {
      const data = await apiGet('/api/marketing/whatsapp-messages');
      setSaved(data.messages || []);
    } catch { /* non-fatal */ } finally {
      setLoadingList(false);
    }
  }

  function toggleInstrument(instr: string) {
    setInstruments(prev => prev.includes(instr) ? prev.filter(i => i !== instr) : [...prev, instr]);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(activeMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function generateWithAI() {
    setIsGenerating(true);
    setGenError('');
    try {
      const data = await apiPost('/api/marketing/ai-whatsapp-promo', {
        event_name: eventName,
        event_date: eventDate || null,
        event_time: eventTime || null,
        venue,
        instruments,
        registration_link: registrationLink || DEFAULT_LINK,
        special_info: specialInfo || null,
        max_words: maxWords,
      });
      setAiMessage(data.message);
      setPreviewMode('ai');
      generatedSnapshotRef.current = JSON.stringify({ eventName, eventDate, eventTime, venue, instruments, registrationLink, specialInfo, maxWords });
      setAiIsStale(false);
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
      setPreviewMode('ai');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!templateName.trim()) { setError('Give this template a name before saving.'); return; }
    setError('');
    setSaving(true);
    try {
      const body = {
        name: templateName.trim(),
        event_name: eventName,
        event_date: eventDate || null,
        event_time: eventTime || null,
        venue,
        instruments,
        registration_link: registrationLink || DEFAULT_LINK,
        special_info: specialInfo || null,
      };
      if (editingId) {
        const data = await apiPut(`/api/marketing/whatsapp-messages/${editingId}`, body);
        setSaved(prev => prev.map(m => m.id === editingId ? data.message : m));
      } else {
        const data = await apiPost('/api/marketing/whatsapp-messages', body);
        setSaved(prev => [data.message, ...prev]);
        setEditingId(data.message.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleLoad(m: WaMessage) {
    setEditingId(m.id);
    setTemplateName(m.name);
    setEventName(m.event_name);
    setEventDate(m.event_date ? m.event_date.slice(0, 10) : '');
    setEventTime(m.event_time || '');
    setVenue(m.venue);
    setInstruments(m.instruments || []);
    setRegistrationLink(m.registration_link || DEFAULT_LINK);
    setSpecialInfo(m.special_info || '');
    setAiMessage('');
    setPreviewMode('template');
    setGenError('');
    setError('');
  }

  function handleNew() {
    setEditingId(null);
    setTemplateName('');
    setEventName('Demo Day');
    setEventDate('');
    setEventTime('');
    setVenue('HSM Main Branch');
    setInstruments([]);
    setRegistrationLink(DEFAULT_LINK);
    setSpecialInfo('');
    setAiMessage('');
    setPreviewMode('template');
    setGenError('');
    setError('');
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await apiDelete(`/api/marketing/whatsapp-messages/${id}`);
      setSaved(prev => prev.filter(m => m.id !== id));
      if (editingId === id) handleNew();
    } catch {
      setError('Delete failed');
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">WhatsApp Event Promotions</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in the event details, then use the structured template or let AI write a warm, personalised message. Save it as a reusable template.
          </p>
        </div>
        {editingId && (
          <button onClick={handleNew} className="shrink-0 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
            + New template
          </button>
        )}
      </div>

      {/* Main two-column layout — stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Form ── */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Template name</label>
            <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. Demo Day July 2025"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Event name</label>
            <input type="text" value={eventName} onChange={e => setEventName(e.target.value)}
              placeholder="Demo Day"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Time <span className="text-gray-400 font-normal">(e.g. 10 AM – 1 PM)</span>
              </label>
              <input type="text" value={eventTime} onChange={e => setEventTime(e.target.value)}
                placeholder="10:00 AM – 1:00 PM"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Venue</label>
            <div className="flex gap-2">
              {VENUES.map(v => (
                <button key={v} onClick={() => setVenue(v)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    venue === v ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Instruments for demo <span className="text-gray-400 font-normal">(select all that apply)</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_INSTRUMENTS.map(instr => (
                <label key={instr}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                    instruments.includes(instr) ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  <input type="checkbox" checked={instruments.includes(instr)} onChange={() => toggleInstrument(instr)}
                    className="accent-green-500 w-3.5 h-3.5" />
                  {instr}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Registration link</label>
            <input type="url" value={registrationLink} onChange={e => setRegistrationLink(e.target.value)}
              placeholder={DEFAULT_LINK}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400 font-mono" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Special info <span className="text-gray-400 font-normal">(optional — discounts, new batches, etc.)</span>
            </label>
            <textarea value={specialInfo} onChange={e => setSpecialInfo(e.target.value)}
              placeholder="e.g. New Hindustani Classical batch starting soon! Avail 10% discount on admission fee."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-green-400" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? <><Spinner /> Saving...</> : editingId ? 'Update template' : 'Save template'}
          </button>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">

          {/* Mode tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button onClick={() => setPreviewMode('template')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                previewMode === 'template' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Template
            </button>
            <button onClick={() => setPreviewMode('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                previewMode === 'ai' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI-Generated
              {aiMessage && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />}
            </button>
          </div>

          {/* ── TEMPLATE VIEW ── */}
          {previewMode === 'template' && (
            <div className="space-y-2">
              <div className="flex justify-end">
                <button onClick={() => { setPreviewMode('ai'); if (!aiMessage && !isGenerating) generateWithAI(); }}
                  className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Try AI instead
                </button>
              </div>
              <div className="bg-[#e9fbe6] border border-[#c3ebbf] rounded-2xl rounded-tl-sm p-4 min-h-[280px]">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {templateMessage}
                </pre>
              </div>
            </div>
          )}

          {/* ── AI VIEW ── */}
          {previewMode === 'ai' && (
            <div className="space-y-2">
              {/* Stale warning */}
              {aiIsStale && aiMessage && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Event details changed — regenerate to refresh the AI message.
                </div>
              )}

              {/* Word limit */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 shrink-0">Max words</label>
                <input
                  type="number"
                  min={50}
                  max={500}
                  step={25}
                  value={maxWords}
                  onChange={e => setMaxWords(Math.max(50, Math.min(500, Number(e.target.value))))}
                  className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-violet-400"
                />
                <div className="flex gap-1">
                  {[100, 150, 200, 300].map(n => (
                    <button key={n} onClick={() => setMaxWords(n)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        maxWords === n ? 'bg-violet-100 text-violet-700 border border-violet-300' : 'text-gray-400 hover:text-gray-600 border border-transparent'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate / Regenerate button */}
              <button onClick={generateWithAI} disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
                {isGenerating ? (
                  <><Spinner /> Writing your message...</>
                ) : aiMessage ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate with AI
                  </>
                )}
              </button>

              {genError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{genError}</p>
              )}

              {/* AI message (editable) or empty state */}
              {aiMessage ? (
                <div className="space-y-1">
                  <textarea
                    value={aiMessage}
                    onChange={e => setAiMessage(e.target.value)}
                    rows={14}
                    className="w-full px-4 py-3 bg-[#e9fbe6] border border-[#c3ebbf] rounded-2xl rounded-tl-sm text-sm text-gray-800 font-sans leading-relaxed resize-none focus:outline-none focus:border-green-400"
                  />
                  <p className="text-xs text-gray-400 text-right">Editable — tweak the AI message directly.</p>
                </div>
              ) : !isGenerating && (
                <div className="flex flex-col items-center justify-center gap-3 min-h-[200px] bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center px-6 py-8">
                  <svg className="w-8 h-8 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    AI will write a warm, personalised message using the event details on the left.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Char count + action buttons */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-400">{activeMessage.length} chars</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? 'Copied!' : 'Copy message'}
            </button>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#25D366] hover:bg-[#1ebe5c] text-white rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.845L.057 23.43a.5.5 0 00.612.612l5.578-1.473A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.656-.502-5.184-1.38l-.371-.214-3.857 1.018 1.018-3.857-.214-.371A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              Open in WhatsApp
            </a>
          </div>
          <p className="text-xs text-gray-400 text-center">
            On mobile, opens WhatsApp with the message pre-filled — choose any contact or broadcast list.
          </p>
        </div>
      </div>

      {/* ── Saved templates ── */}
      <div className="pt-2 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Saved templates</h4>
        {loadingList ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : saved.length === 0 ? (
          <p className="text-sm text-gray-400">No saved templates yet. Fill out the form above and save one.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {saved.map(m => (
              <div key={m.id}
                className={`border rounded-lg p-4 space-y-2 transition-colors ${
                  editingId === m.id ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {m.event_name}{m.event_date ? ` · ${formatDate(m.event_date.slice(0, 10))}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{m.venue}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleLoad(m)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-500 hover:text-green-700 hover:border-green-300 transition-colors">
                      Load
                    </button>
                    <button onClick={() => handleDelete(m.id)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-400 hover:text-red-600 hover:border-red-300 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
                {m.instruments?.length > 0 && (
                  <p className="text-xs text-gray-400 truncate">{m.instruments.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
