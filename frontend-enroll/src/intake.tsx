import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './components/LandingPage.css';

const PRODUCTION_API_URL = 'https://hsm-management.onrender.com';
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : PRODUCTION_API_URL);

const LOCATIONS = [
  { value: 'hsm_main', label: 'HSM Main Branch', sub: 'Kismatpur, Hyderabad' },
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

const SCHEDULE_DAYS = [
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

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

interface ScheduleCell { morning: boolean; evening: boolean; }

function buildScheduleGrid(batches: RawBatch[]): Record<string, Record<string, ScheduleCell>> {
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

interface Instrument { id: number | string; name: string; is_deprecated?: boolean; }

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
  first_name: '', last_name: '', phone: '', email: '', dob: '', address: '',
  guardian_name: '', guardian_phone: '', instrument_id: '', location: '', source: '', notes: '',
};

// ── Schedule Chart ──────────────────────────────────────────────────────────

function ScheduleChart({ batches }: { batches: RawBatch[] }) {
  const grid = buildScheduleGrid(batches);
  const instruments = Object.keys(grid).sort();
  if (instruments.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 12px 6px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 120 }}>
              Instrument
            </th>
            {SCHEDULE_DAYS.map(d => (
              <th key={d.key} style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {instruments.map((name, idx) => (
            <tr key={name} style={{ background: idx % 2 === 0 ? 'rgba(242,107,56,0.03)' : 'transparent' }}>
              <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.85rem' }}>{name}</td>
              {SCHEDULE_DAYS.map(d => {
                const cell = grid[name][d.key];
                return (
                  <td key={d.key} style={{ textAlign: 'center', padding: '8px' }}>
                    {(cell?.morning || cell?.evening) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {cell.morning && (
                          <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            Morn
                          </span>
                        )}
                        {cell.evening && (
                          <span style={{ background: 'rgba(242,107,56,0.12)', color: 'var(--brand-orange)', borderRadius: 20, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            Eve
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>Morn</span>
          Before 1pm
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: 'rgba(242,107,56,0.12)', color: 'var(--brand-orange)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>Eve</span>
          Afternoon / Evening
        </span>
      </div>
    </div>
  );
}

// ── Pill selector ───────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.5rem 1.1rem',
        borderRadius: 999,
        border: `2px solid ${active ? 'var(--brand-orange)' : 'rgba(150,150,150,0.25)'}`,
        background: active ? 'var(--brand-orange)' : 'transparent',
        color: active ? '#fff' : 'var(--text-body)',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.18s',
      }}
    >
      {label}
    </button>
  );
}

// ── Section heading ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: '0.8rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--brand-orange)',
      marginBottom: '0.75rem',
    }}>
      {children}
    </p>
  );
}

// ── Main form ───────────────────────────────────────────────────────────────

function IntakeForm() {
  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get('embed') === '1';

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [batches, setBatches] = useState<RawBatch[]>([]);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');

  // Pre-fill instrument from ?instrument= query param
  useEffect(() => {
    const param = params.get('instrument');
    if (param) setForm(prev => ({ ...prev, instrument_id: param }));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/instruments`)
      .then(r => r.json())
      .then(data => setInstruments((data.instruments || data || []).filter((i: Instrument) => !i.is_deprecated)))
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
    else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.';
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
      instrument: instrument?.name || form.instrument_id,
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
      if (isEmbed) {
        window.parent.postMessage({ type: 'hsm-intake-success' }, '*');
      }
      setDone(true);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──
  if (done) {
    return (
      <div className="landing-wrapper" style={{ minHeight: isEmbed ? '100%' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="modal-content pop-shadow" style={{ textAlign: 'center', padding: '3rem 2.5rem', maxWidth: 480 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="section-label" style={{ display: 'block', textAlign: 'center', marginBottom: 4 }}>You're all set!</span>
          <h2 className="serif-heading" style={{ fontSize: '1.8rem', marginBottom: '1rem', textAlign: 'center' }}>
            We'll be in touch soon
          </h2>
          <p style={{ color: 'var(--text-body)', marginBottom: '0.5rem' }}>
            Thank you for your interest in Hyderabad School of Music.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Our team will reach out to you within 24 hours to schedule your free demo class.
          </p>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: 8,
    border: '1px solid rgba(150,150,150,0.3)',
    background: 'var(--bg-primary)',
    fontSize: '1rem',
    color: 'var(--text-heading)',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: 'var(--text-heading)',
    display: 'block',
  };

  const errorStyle: React.CSSProperties = {
    color: '#ef4444',
    fontSize: '0.8rem',
    marginTop: '0.35rem',
  };

  return (
    <div className="landing-wrapper" style={{ minHeight: '100vh', paddingBottom: isEmbed ? '1rem' : '4rem' }}>

      {/* Header — shown only in full-page mode */}
      {!isEmbed && (
        <div style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid rgba(150,150,150,0.12)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 100 }}>
          <img src="/HSM_Logo_Horizontal.png" alt="HSM" style={{ height: 40 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ flex: 1 }} />
          <a href="/" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>← Back to website</a>
        </div>
      )}

      {/* Close button — shown only in embed/modal mode */}
      {isEmbed && (
        <button
          onClick={() => window.parent.postMessage({ type: 'hsm-intake-close' }, '*')}
          style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 200, background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          aria-label="Close"
        >
          &times;
        </button>
      )}

      <div style={{ maxWidth: 660, margin: '0 auto', padding: '2.5rem 1rem 0' }}>

        {/* Page heading */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="section-label" style={{ fontSize: '1.5rem' }}>Let's get started</span>
          <h1 className="serif-heading" style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', marginBottom: '0.75rem' }}>
            Book a Free Demo Class
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', maxWidth: 480, margin: '0 auto' }}>
            This form is for <strong>enquiry purposes only</strong>. Our team will review your details and reach out within 24 hours to confirm your slot.
          </p>
        </div>

        {/* Card */}
        <div className="modal-content pop-shadow" style={{ borderRadius: 24, padding: '2.5rem', marginBottom: '2rem' }}>
          <form className="trial-form" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* ── About you ── */}
            <div>
              <SectionHeading>About you</SectionHeading>
              <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="form-group mb-0">
                  <label style={labelStyle}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: errors.first_name ? '#ef4444' : undefined }} type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="e.g. Arjun" />
                  {errors.first_name && <p style={errorStyle}>{errors.first_name}</p>}
                </div>
                <div className="form-group mb-0">
                  <label style={labelStyle}>Last Name</label>
                  <input style={inputStyle} type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="e.g. Sharma" />
                </div>
              </div>
              <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="form-group mb-0">
                  <label style={labelStyle}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: errors.phone ? '#ef4444' : undefined }} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                  {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
                </div>
                <div className="form-group mb-0">
                  <label style={labelStyle}>Email <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
                </div>
              </div>
              <div className="form-grid" style={{ marginBottom: 0 }}>
                <div className="form-group mb-0">
                  <label style={labelStyle}>Date of Birth <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
                </div>
                <div className="form-group mb-0">
                  <label style={labelStyle}>Address <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. Banjara Hills" />
                </div>
              </div>
            </div>

            {/* ── Parent / Guardian ── */}
            <div>
              <SectionHeading>Parent / Guardian <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.75rem', color: 'var(--text-muted)' }}>(if applicable)</span></SectionHeading>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '0.75rem' }}>For students under 18 years of age.</p>
              <div className="form-grid">
                <div className="form-group mb-0">
                  <label style={labelStyle}>Guardian Name</label>
                  <input style={inputStyle} type="text" value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} placeholder="Parent / guardian name" />
                </div>
                <div className="form-group mb-0">
                  <label style={labelStyle}>Guardian Phone</label>
                  <input style={inputStyle} type="tel" value={form.guardian_phone} onChange={e => set('guardian_phone', e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
            </div>

            {/* ── Instrument ── */}
            <div>
              <SectionHeading>Stream / Instrument <span style={{ color: '#ef4444' }}>*</span></SectionHeading>
              {instruments.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {instruments.map(instr => (
                    <Pill
                      key={instr.id}
                      label={instr.name}
                      active={form.instrument_id === String(instr.id)}
                      onClick={() => set('instrument_id', String(instr.id))}
                    />
                  ))}
                </div>
              ) : (
                <select value={form.instrument_id} onChange={e => set('instrument_id', e.target.value)} style={inputStyle}>
                  <option value="">Select an instrument...</option>
                  {['Keyboard','Guitar','Piano','Drums','Tabla','Violin','Hindustani Vocals','Carnatic Vocals'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              )}
              {errors.instrument_id && <p style={errorStyle}>{errors.instrument_id}</p>}
            </div>

            {/* ── Class Schedule ── */}
            {batches.length > 0 && (
              <div>
                <SectionHeading>When do classes run?</SectionHeading>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
                  We're closed on Mondays. Here's the current schedule across all instruments.
                </p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '1rem 1.25rem' }}>
                  <ScheduleChart batches={batches} />
                </div>
              </div>
            )}

            {/* ── Branch ── */}
            <div>
              <SectionHeading>Which branch? <span style={{ color: '#ef4444' }}>*</span></SectionHeading>
              <div className="form-grid">
                {LOCATIONS.map(loc => {
                  const active = form.location === loc.value;
                  return (
                    <button
                      key={loc.value}
                      type="button"
                      onClick={() => set('location', loc.value)}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: 12,
                        border: `2px solid ${active ? 'var(--brand-orange)' : 'rgba(150,150,150,0.25)'}`,
                        background: active ? 'var(--brand-orange)' : 'var(--bg-secondary)',
                        color: active ? '#fff' : 'var(--text-heading)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.18s',
                      }}
                    >
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{loc.label}</p>
                      <p style={{ fontSize: '0.775rem', margin: '3px 0 0', opacity: 0.75 }}>{loc.sub}</p>
                    </button>
                  );
                })}
              </div>
              {errors.location && <p style={errorStyle}>{errors.location}</p>}
            </div>

            {/* ── How did you hear ── */}
            <div>
              <SectionHeading>How did you hear about us?</SectionHeading>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {SOURCES.map(src => (
                  <Pill
                    key={src}
                    label={src}
                    active={form.source === src}
                    onClick={() => set('source', form.source === src ? '' : src)}
                  />
                ))}
              </div>
            </div>

            {/* ── Notes ── */}
            <div>
              <SectionHeading>Anything else?</SectionHeading>
              <div className="form-group mb-0">
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={3}
                  placeholder="Prior music experience, goals, questions for us..."
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                />
              </div>
            </div>

            {/* WhatsApp opt-in */}
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginBottom: 0 }}>
              <input type="checkbox" id="whatsapp_optin" defaultChecked style={{ width: 'auto', marginBottom: 0, accentColor: 'var(--brand-orange)' }} />
              <label htmlFor="whatsapp_optin" style={{ marginBottom: 0, fontWeight: 'normal', fontSize: '0.9rem', color: 'var(--text-body)' }}>
                ✓ It's ok to contact me on WhatsApp
              </label>
            </div>

            {/* Server error */}
            {serverError && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{serverError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-cta"
              style={{ width: '100%', fontSize: '1.05rem', padding: '0.9rem', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Submitting...' : 'Book My Free Demo →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
              This form is for enquiry purposes only. No payment required. Our team will reach out to confirm.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('intake-root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <IntakeForm />
    </React.StrictMode>
  );
}
