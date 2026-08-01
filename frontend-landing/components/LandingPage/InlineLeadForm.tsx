'use client';
import React, { useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hsm-management.onrender.com';

const INSTRUMENT_OPTIONS = [
  'Guitar', 'Bass Guitar', 'Keyboard', 'Piano', 'Tabla', 'Drums',
  'Octopad', 'Violin', 'Hindustani Classical', 'Carnatic Classical',
];

type Status = 'idle' | 'loading' | 'success' | 'error';

const InlineLeadForm: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const instrument = String(formData.get('instrument') || '');

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, instrument, source: 'inline_form' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong. Please try WhatsApp instead.');
      }
      setStatus('success');
      form.reset();
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try WhatsApp instead.');
    }
  };

  if (status === 'success') {
    return (
      <div className="inline-lead-form inline-lead-form--success">
        <p>Thanks! We&apos;ll call you within a day to set up your free demo.</p>
      </div>
    );
  }

  return (
    <form className="inline-lead-form trial-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-group mb-0">
          <label htmlFor="inline-lead-name">Full Name *</label>
          <input type="text" id="inline-lead-name" name="name" required placeholder="e.g. Aditi Sharma" />
        </div>
        <div className="form-group mb-0">
          <label htmlFor="inline-lead-phone">Phone Number *</label>
          <input type="tel" id="inline-lead-phone" name="phone" required placeholder="+91" />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="inline-lead-instrument">Instrument you&apos;re interested in</label>
        <select id="inline-lead-instrument" name="instrument" defaultValue="">
          <option value="">Not sure yet</option>
          {INSTRUMENT_OPTIONS.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      {status === 'error' && (
        <p className="inline-lead-form-error">{errorMessage}</p>
      )}
      <button type="submit" className="btn btn-cta" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending…' : 'Request a Callback →'}
      </button>
    </form>
  );
};

export default InlineLeadForm;
