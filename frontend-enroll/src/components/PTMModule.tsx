import React, { useState, useEffect } from 'react';
import { PTMSession } from '../types';
import { apiGet, apiPost, apiDelete } from '../api';
import PTMSessionView from './PTMSessionView';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

interface CreateModalProps {
  onClose: () => void;
  onCreated: (session: PTMSession) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) { setError('Title and date are required'); return; }
    setSaving(true);
    try {
      const res = await apiPost('/api/ptm/sessions', { title: title.trim(), scheduled_date: date, description: description.trim() || undefined });
      onCreated(res.session);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">New PTM Session</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="e.g. PTM June 2026"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              rows={2}
              placeholder="Notes about this PTM round..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SessionCardProps {
  session: PTMSession;
  onOpen: () => void;
  onDelete: () => void;
}

function SessionCard({ session, onOpen, onDelete }: SessionCardProps) {
  const total = session.appointment_count ?? 0;
  const done = session.completed_count ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-slate-800 text-base">{session.title}</h3>
          <p className="text-slate-500 text-sm mt-0.5">{formatDate(session.scheduled_date)}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[session.status]}`}>
          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
        </span>
      </div>
      {session.description && (
        <p className="text-slate-600 text-sm mb-3 line-clamp-2">{session.description}</p>
      )}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{done} of {total} completed</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onOpen}
          className="flex-1 bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-orange-700"
        >
          Open Session
        </button>
        <button
          onClick={e => { e.stopPropagation(); if (window.confirm('Delete this PTM session?')) onDelete(); }}
          className="px-3 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50"
          title="Delete session"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function PTMModule() {
  const [sessions, setSessions] = useState<PTMSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/ptm/sessions');
      setSessions(res.sessions || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleCreated = (session: PTMSession) => {
    setSessions(prev => [session, ...prev]);
    setShowCreate(false);
    setActiveSessionId(session.id);
  };

  const handleDelete = async (sessionId: string) => {
    try {
      await apiDelete(`/api/ptm/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch {
      /* ignore */
    }
  };

  const handleSessionUpdate = (updated: PTMSession) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
  };

  if (activeSessionId) {
    return (
      <PTMSessionView
        sessionId={activeSessionId}
        onBack={() => { setActiveSessionId(null); loadSessions(); }}
        onSessionUpdate={handleSessionUpdate}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parent-Teacher Meetings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Schedule PTMs, send WhatsApp invites, and capture action items.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New PTM
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-500 font-medium">No PTM sessions yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first PTM session to get started.</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700">
            Create First PTM
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              onOpen={() => setActiveSessionId(session.id)}
              onDelete={() => handleDelete(session.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
