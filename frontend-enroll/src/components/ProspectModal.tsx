import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut } from '../api';
import { getCurrentUser } from '../auth';
import PhoneLink from './PhoneLink';

interface ProspectModalProps {
  prospect: any;
  onClose: () => void;
  onUpdated: (updated: any) => void;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'interested', label: 'Interested', color: 'bg-green-100 text-green-700' },
  { value: 'not-interested', label: 'Not Interested', color: 'bg-red-100 text-red-700' },
];

function ageBucket(createdAt: string): { label: string; days: number; color: string; dot: string } {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days <= 7)  return { label: 'Fresh',     days, color: 'bg-green-100 text-green-700',  dot: '🟢' };
  if (days <= 14) return { label: 'Follow up', days, color: 'bg-yellow-100 text-yellow-700', dot: '🟡' };
  if (days <= 30) return { label: 'Warm',      days, color: 'bg-orange-100 text-orange-700', dot: '🟠' };
  return           { label: 'Cold',      days, color: 'bg-red-100 text-red-700',    dot: '🔴' };
}

function buildWaLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const e164 = digits.startsWith('91') && digits.length === 12 ? digits
    : digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

const BRANCH_MAP_LINKS: Record<string, string> = {
  hsm_main: 'https://maps.google.com/?q=17.3471995,78.3909525',
  pbel_city: 'https://maps.google.com/?q=PBEL+City,+Hyderabad',
};

function generateNudgeMessage(name: string, instrument?: string, location?: string): string {
  const inst = instrument && instrument !== 'Not specified' && instrument !== '—' ? instrument : null;
  const mapLink = location ? BRANCH_MAP_LINKS[location] : null;
  const locationLine = mapLink ? `\n\n📍 Find us here: ${mapLink}` : '';
  return `Hi ${name}! 👋\n\nThis is the team at Hyderabad School of Music. You recently signed up for a free demo class${inst ? ` for ${inst}` : ''}. We'd love to get you started!\n\nCould you share a convenient time? We're available Tue–Fri (5–9 PM) and weekends.${locationLine}\n\nLooking forward to meeting you! 🎵`;
}

const ProspectModal: React.FC<ProspectModalProps> = ({ prospect, onClose, onUpdated }) => {
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [status, setStatus] = useState<string>(prospect.metadata?.status || 'new');
  const [savingStatus, setSavingStatus] = useState(false);
  const [markingInactive, setMarkingInactive] = useState(false);
  const [showWaCompose, setShowWaCompose] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [sendingWa, setSendingWa] = useState(false);

  const user = getCurrentUser();
  const age = ageBucket(prospect.created_at);
  const meta = prospect.metadata || {};

  useEffect(() => {
    apiGet(`/api/prospects/${prospect.id}/notes`)
      .then(res => setNotes(res.notes || []))
      .catch(err => console.error('Failed to load notes', err));
  }, [prospect.id]);

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    setSavingStatus(true);
    try {
      const res = await apiPut(`/api/prospects/${prospect.id}`, { status: newStatus });
      onUpdated(res.prospect);
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await apiPost(`/api/prospects/${prospect.id}/notes`, {
        note: noteText.trim(),
        created_by: user?.name || user?.email || 'Admin',
      });
      setNotes(prev => [...prev, res.note]);
      setNoteText('');
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setAddingNote(false);
    }
  };

  const handleMarkInactive = async () => {
    if (!confirm(`Mark ${prospect.name} as inactive? They will no longer appear in the active prospects list.`)) return;
    setMarkingInactive(true);
    try {
      const res = await apiPut(`/api/prospects/${prospect.id}`, { is_active: false });
      onUpdated(res.prospect);
      onClose();
    } catch (err) {
      console.error('Failed to mark inactive', err);
    } finally {
      setMarkingInactive(false);
    }
  };

  const handleMarkActive = async () => {
    setMarkingInactive(true);
    try {
      const res = await apiPut(`/api/prospects/${prospect.id}`, { is_active: true });
      onUpdated(res.prospect);
      onClose();
    } catch (err) {
      console.error('Failed to restore prospect', err);
    } finally {
      setMarkingInactive(false);
    }
  };

  const handleOpenWaCompose = () => {
    setWaMessage(generateNudgeMessage(prospect.name, meta.interested_instrument, meta.location));
    setShowWaCompose(true);
  };

  const handleSendWhatsApp = async () => {
    setSendingWa(true);
    try {
      window.open(buildWaLink(prospect.phone, waMessage), '_blank');
      const res = await apiPost(`/api/prospects/${prospect.id}/whatsapp-nudge`, {
        message: waMessage,
        created_by: user?.name || user?.email || 'Admin',
      });
      if (res.note) setNotes(prev => [...prev, res.note]);
      setStatus('contacted');
      onUpdated(res.prospect);
      setShowWaCompose(false);
    } catch (err) {
      console.error('Failed to send WhatsApp nudge', err);
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 text-white flex items-center justify-center font-bold text-xl shadow-lg">
              {(prospect.name || 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{prospect.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${age.color}`}>
                  {age.dot} {age.label} · {age.days}d ago
                </span>
                {!prospect.is_active && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">Inactive</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contact details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Phone</p>
              <PhoneLink phone={prospect.phone} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Email</p>
              <p className="text-slate-900">{meta.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Interested In</p>
              <p className="text-slate-900 font-semibold">{meta.interested_instrument || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Lead Source</p>
              <p className="text-slate-900">{meta.lead_source || '—'}</p>
            </div>
            {meta.address && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Address</p>
                <p className="text-slate-900">{meta.address}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Signed Up</p>
              <p className="text-slate-900">{new Date(prospect.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Status selector */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Pipeline Status {savingStatus && <span className="text-slate-400 font-normal normal-case ml-1">saving…</span>}</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition ${
                    status === opt.value
                      ? `${opt.color} border-current`
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp Nudge */}
          <div>
            {!showWaCompose ? (
              <button
                onClick={handleOpenWaCompose}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Send WhatsApp Nudge
              </button>
            ) : (
              <div className="border border-green-200 bg-green-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-green-700 uppercase mb-2">WhatsApp Message Preview — edit before sending</p>
                <textarea
                  value={waMessage}
                  onChange={e => setWaMessage(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-sm resize-none bg-white"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSendWhatsApp}
                    disabled={sendingWa || !waMessage.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {sendingWa ? 'Opening…' : 'Open in WhatsApp'}
                  </button>
                  <button
                    onClick={() => setShowWaCompose(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Communications log */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">
              Communications Log ({notes.length})
            </p>
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No notes yet. Record your first contact attempt below.</p>
            ) : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                    <p className="text-sm text-slate-800">{n.note}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {n.created_by || 'Admin'} · {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add note */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Add Note</p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="e.g. Called — went to voicemail. Will retry tomorrow."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm resize-none"
            />
            <button
              onClick={handleAddNote}
              disabled={addingNote || !noteText.trim()}
              className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50"
            >
              {addingNote ? 'Adding…' : 'Add Note'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex items-center justify-between">
          {prospect.is_active ? (
            <button
              onClick={handleMarkInactive}
              disabled={markingInactive}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
            >
              {markingInactive ? 'Marking…' : 'Mark Inactive'}
            </button>
          ) : (
            <button
              onClick={handleMarkActive}
              disabled={markingInactive}
              className="px-4 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-semibold hover:bg-green-100 transition disabled:opacity-50"
            >
              {markingInactive ? 'Restoring…' : 'Restore Prospect'}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProspectModal;
