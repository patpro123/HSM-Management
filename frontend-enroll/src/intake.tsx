import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const PRODUCTION_API_URL = 'https://hsm-management.onrender.com';
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : PRODUCTION_API_URL);

const LOCATIONS = [
  { value: 'hsm_main', label: 'HSM Main Branch', sub: 'Hyderabad School of Music — Main Campus' },
  { value: 'pbel_city', label: 'PBEL City', sub: 'PBEL City Campus' },
];

const SOURCES = [
  'Word of mouth / Friend',
  'Instagram',
  'Facebook',
  'Google search',
  'Walk-in / Noticed the school',
  'Other',
];

// Days shown in the schedule grid (HSM is closed on Mondays)
const SCHEDULE_DAYS = [
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

// ── Schedule helpers ────────────────────────────────────────────────────────

type Period = 'morning' | 'evening';

function parseBatchDays(recurrence: string): string[] {
  const text = recurrence.toUpperCase();
  return SCHEDULE_DAYS.map(d => d.key).filter(d => text.includes(d));
}

function classifyPeriod(startTime: string): Period {
  const hour = parseInt(startTime.split(':')[0], 10);
  return hour < 13 ? 'morning' : 'evening';
}

interface RawBatch {
  id: string;
  instrument_id: string;
  instrument_name: string;
  recurrence: string;
  start_time: string;
  end_time: string;
  is_makeup: boolean;
}

interface ScheduleCell {
  morning: boolean;
  evening: boolean;
}

// Returns: { [instrument_name]: { TUE: { morning, evening }, WED: ... } }
function buildScheduleGrid(
  batches: RawBatch[]
): Record<string, Record<string, ScheduleCell>> {
  const grid: Record<string, Record<string, ScheduleCell>> = {};

  for (const batch of batches) {
    if (batch.is_makeup) continue;
    const name = batch.instrument_name;
    if (!grid[name]) {
      grid[name] = {};
      for (const d of SCHEDULE_DAYS) grid[name][d.key] = { morning: false, evening: false };
    }
    const days = parseBatchDays(batch.recurrence);
    const period = batch.start_time ? classifyPeriod(batch.start_time) : 'evening';
    for (const day of days) {
      if (grid[name][day]) grid[name][day][period] = true;
    }
  }

  return grid;
}

// ── Form state ──────────────────────────────────────────────────────────────

interface Instrument {
  id: number | string;
  name: string;
  is_deprecated?: boolean;
}

type FormStep = 'form' | 'success';

interface FormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  dob: string;
  address: string;
  guardian_name: string;
  guardian_phone: string;
  instrument_id: string;
  location: string;
  source: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  dob: '',
  address: '',
  guardian_name: '',
  guardian_phone: '',
  instrument_id: '',
  location: '',
  source: '',
  notes: '',
};

// ── Schedule chart component ────────────────────────────────────────────────

function ScheduleChart({ batches }: { batches: RawBatch[] }) {
  const grid = buildScheduleGrid(batches);
  const instruments = Object.keys(grid).sort();

  if (instruments.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 font-semibold text-slate-600 text-xs uppercase tracking-wide w-32">
              Instrument
            </th>
            {SCHEDULE_DAYS.map(d => (
              <th key={d.key} className="text-center py-2 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {instruments.map((name, idx) => (
            <tr key={name} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
              <td className="py-2.5 pr-4 font-medium text-slate-800 text-sm">{name}</td>
              {SCHEDULE_DAYS.map(d => {
                const cell = grid[name][d.key];
                const hasMorning = cell?.morning;
                const hasEvening = cell?.evening;
                return (
                  <td key={d.key} className="text-center py-2.5 px-2">
                    {hasMorning || hasEvening ? (
                      <div className="flex flex-col items-center gap-1">
                        {hasMorning && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap">
                            Morn
                          </span>
                        )}
                        {hasEvening && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 whitespace-nowrap">
                            Eve
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-200 text-xs">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Morn</span>
          Morning (before 1pm)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">Eve</span>
          Afternoon / Evening (1pm onwards)
        </span>
      </div>
    </div>
  );
}

// ── Main form ───────────────────────────────────────────────────────────────

function IntakeForm() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [batches, setBatches] = useState<RawBatch[]>([]);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<FormStep>('form');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/instruments`)
      .then(r => r.json())
      .then(data => {
        const list: Instrument[] = (data.instruments || data || []).filter(
          (i: Instrument) => !i.is_deprecated
        );
        setInstruments(list);
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/batches`)
      .then(r => r.json())
      .then(data => setBatches(data.batches || []))
      .catch(() => {});
  }, []);

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.first_name.trim()) errs.first_name = 'First name is required.';
    if (!form.phone.trim()) errs.phone = 'Phone number is required.';
    else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.phone.trim()))
      errs.phone = 'Enter a valid phone number.';
    if (!form.instrument_id) errs.instrument_id = 'Please choose an instrument / stream.';
    if (!form.location) errs.location = 'Please select a branch location.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    const instrument = instruments.find(i => String(i.id) === form.instrument_id);

    const payload = {
      name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      instrument: instrument?.name || '',
      location: form.location,
      source: form.source || undefined,
      dob: form.dob || undefined,
      address: form.address.trim() || undefined,
      guardian_name: form.guardian_name.trim() || undefined,
      guardian_phone: form.guardian_phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Submission failed. Please try again.');
      }
      setStep('success');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Thank you!</h2>
          <p className="text-slate-600 text-lg mb-2">
            We've received your details and our team will reach out to you shortly.
          </p>
          <p className="text-slate-500 text-sm">
            Hyderabad School of Music — we look forward to welcoming you!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
            H
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hyderabad School of Music</h1>
            <p className="text-sm text-slate-500">Student Enquiry Form</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Hero banner */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-8 text-white">
            <h2 className="text-2xl font-bold mb-1">Begin your musical journey</h2>
            <p className="text-indigo-100 text-sm">
              Fill in the details below and we'll get in touch to set up your first class.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-8 space-y-8" noValidate>

            {/* ── Section 1: Basic Info ── */}
            <section>
              <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-4">About you</h3>
              <div className="space-y-4">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => set('first_name', e.target.value)}
                      placeholder="e.g. Arjun"
                      className={`w-full px-4 py-2.5 rounded-lg border ${errors.first_name ? 'border-red-400 bg-red-50' : 'border-slate-300'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none`}
                    />
                    {errors.first_name && <p className="text-xs text-red-600 mt-1">{errors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => set('last_name', e.target.value)}
                      placeholder="e.g. Sharma"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className={`w-full px-4 py-2.5 rounded-lg border ${errors.phone ? 'border-red-400 bg-red-50' : 'border-slate-300'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none`}
                    />
                    {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={form.dob}
                      onChange={e => set('dob', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    placeholder="e.g. Banjara Hills, Hyderabad"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
              </div>
            </section>

            {/* ── Section 2: Guardian ── */}
            <section>
              <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                Parent / Guardian <span className="text-slate-400 font-normal normal-case">(if applicable)</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">For students under 18 years of age.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    value={form.guardian_name}
                    onChange={e => set('guardian_name', e.target.value)}
                    placeholder="Parent / guardian name"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Guardian Phone</label>
                  <input
                    type="tel"
                    value={form.guardian_phone}
                    onChange={e => set('guardian_phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
              </div>
            </section>

            {/* ── Section 3: Stream ── */}
            <section>
              <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-4">
                Stream / Instrument <span className="text-red-500">*</span>
              </h3>
              {instruments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {instruments.map(instr => {
                    const selected = form.instrument_id === String(instr.id);
                    return (
                      <button
                        key={instr.id}
                        type="button"
                        onClick={() => set('instrument_id', String(instr.id))}
                        className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition text-center ${
                          selected
                            ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {instr.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select
                  value={form.instrument_id}
                  onChange={e => set('instrument_id', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg border ${errors.instrument_id ? 'border-red-400 bg-red-50' : 'border-slate-300'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none`}
                >
                  <option value="">Select an instrument...</option>
                  {['Keyboard','Guitar','Piano','Drums','Tabla','Violin','Hindustani Vocals','Carnatic Vocals'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              )}
              {errors.instrument_id && <p className="text-xs text-red-600 mt-2">{errors.instrument_id}</p>}
            </section>

            {/* ── Section 4: Class Schedule ── */}
            {batches.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                  Class Schedule
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Here's when each instrument's classes are currently available. We're closed on Mondays.
                </p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <ScheduleChart batches={batches} />
                </div>
              </section>
            )}

            {/* ── Section 5: Location ── */}
            <section>
              <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-4">
                Which branch are you interested in? <span className="text-red-500">*</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LOCATIONS.map(loc => {
                  const selected = form.location === loc.value;
                  return (
                    <button
                      key={loc.value}
                      type="button"
                      onClick={() => set('location', loc.value)}
                      className={`py-4 px-5 rounded-xl border-2 text-left transition ${
                        selected
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      <p className="font-bold text-sm">{loc.label}</p>
                      <p className={`text-xs mt-0.5 ${selected ? 'text-indigo-200' : 'text-slate-400'}`}>{loc.sub}</p>
                    </button>
                  );
                })}
              </div>
              {errors.location && <p className="text-xs text-red-600 mt-2">{errors.location}</p>}
            </section>

            {/* ── Section 6: How you found us ── */}
            <section>
              <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-4">How did you hear about us?</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SOURCES.map(src => {
                  const active = form.source === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => set('source', active ? '' : src)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium text-center transition ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {src}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Section 7: Anything else ── */}
            <section>
              <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-4">Anything else you'd like us to know?</h3>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                placeholder="Prior music experience, specific goals, any questions..."
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none"
              />
            </section>

            {/* Server error */}
            {serverError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base transition shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Enquiry'}
            </button>

            <p className="text-xs text-slate-400 text-center">
              Your information is used only to contact you about classes at HSM. We do not share it with third parties.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// Mount
const container = document.getElementById('intake-root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <IntakeForm />
    </React.StrictMode>
  );
}
