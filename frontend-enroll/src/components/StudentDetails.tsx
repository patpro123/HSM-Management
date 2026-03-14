import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';
import { Student, Batch, Instrument, PaymentFrequency } from '../types';
import BatchScheduleGrid from './BatchScheduleGrid';

export interface EnrollmentSelection {
  batch_id: number | string;
  payment_frequency: PaymentFrequency;
  enrollment_date: string;
}

interface StudentDetailsProps {
  student?: Student | null;
  batches: Batch[];
  instruments: Instrument[];
  onSave: (data: any, enrollments: EnrollmentSelection[], prospectId?: string) => void;
  onCancel: () => void;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, batches, instruments, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    email: '',
    phone: '',
    guardian_name: '',
    guardian_phone: '',
    address: ''
  });
  const [selectedBatches, setSelectedBatches] = useState<EnrollmentSelection[]>([]);
  const [instrumentSettings, setInstrumentSettings] = useState<Record<string, { payment_frequency: PaymentFrequency; enrollment_date: string }>>({});

  const [prospects, setProspects] = useState<any[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'prospect' | 'form' | 'batches'>(student ? 'form' : 'prospect');
  const [prospectSearch, setProspectSearch] = useState('');

  // Fetch prospects only when adding a new student
  useEffect(() => {
    if (!student) {
      apiGet('/api/prospects')
        .then(res => setProspects(res.prospects || []))
        .catch(err => console.error('Error fetching prospects:', err));
    }
  }, [student]);

  useEffect(() => {
    if (student) {
      const name = (student as any).name || '';
      const nameParts = name.split(' ');
      const firstName = student.first_name || nameParts[0] || '';
      const lastName = student.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
      const metadata = (student as any).metadata || {};

      setFormData({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: student.date_of_birth || (student as any).dob?.split('T')[0] || '',
        email: metadata.email || student.email || '',
        phone: student.phone || '',
        guardian_name: metadata.guardian_name || student.guardian_name || (student as any).guardian_contact || '',
        guardian_phone: metadata.guardian_phone || student.guardian_phone || '',
        address: metadata.address || student.address || ''
      });

      // Pre-select batches and payment modes if editing
      let initialBatches: EnrollmentSelection[] = [];
      const studentBatches = (student as any).batches || (student as any).enrollments;
      if (Array.isArray(studentBatches)) {
        initialBatches = studentBatches.map((enr: any) => ({
          batch_id: enr.batch_id || enr.batchId || '',
          payment_frequency: enr.payment_frequency || 'monthly',
          enrollment_date: enr.enrolled_on ? enr.enrolled_on.split('T')[0] : ''
        }));
      }
      setSelectedBatches(initialBatches);

      // Initialize instrument settings based on existing enrollments
      const newSettings: Record<string, any> = {};
      instruments.forEach(inst => {
        const instBatchIds = batches
          .filter(b => String(b.instrument_id) === String(inst.id))
          .map(b => String(b.id));

        // Find if any batch of this instrument is selected to grab settings
        const existing = initialBatches.find(eb => instBatchIds.includes(String(eb.batch_id)));

        newSettings[inst.id] = {
          payment_frequency: existing?.payment_frequency || 'monthly',
          enrollment_date: existing?.enrollment_date || new Date().toISOString().split('T')[0]
        };
      });
      setInstrumentSettings(newSettings);

    } else {
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        email: '',
        phone: '',
        guardian_name: '',
        guardian_phone: '',
        address: ''
      });
      setSelectedBatches([]);

      // Reset instrument settings to defaults
      const newSettings: Record<string, any> = {};
      instruments.forEach(inst => {
        newSettings[inst.id] = {
          payment_frequency: 'monthly',
          enrollment_date: new Date().toISOString().split('T')[0]
        };
      });
      setInstrumentSettings(newSettings);
    }
  }, [student, instruments, batches]);

  const handleProspectSelect = (prospectId: string) => {
    setSelectedProspectId(prospectId);
    if (!prospectId) return;

    const prospect = prospects.find(p => String(p.id) === prospectId);
    if (prospect) {
      const name = prospect.name || '';
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      const metadata = prospect.metadata || {};

      setFormData(prev => ({
        ...prev,
        first_name: firstName,
        last_name: lastName,
        email: metadata.email || '',
        phone: prospect.phone || '',
        address: metadata.address || ''
      }));

      // Switch to form tab after selecting a prospect
      setActiveTab('form');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBatchToggle = (batchId: number | string, instrumentId: string) => {
    setSelectedBatches(prev => {
      const exists = prev.find(e => String(e.batch_id) === String(batchId));
      if (exists) {
        return prev.filter(e => String(e.batch_id) !== String(batchId));
      } else {
        const settings = instrumentSettings[instrumentId] || {
          payment_frequency: 'monthly',
          enrollment_date: new Date().toISOString().split('T')[0]
        };
        return [...prev, {
          batch_id: batchId,
          payment_frequency: settings.payment_frequency,
          enrollment_date: settings.enrollment_date
        }];
      }
    });
  };

  const handleInstrumentSettingChange = (instrumentId: string, field: 'payment_frequency' | 'enrollment_date', value: any) => {
    setInstrumentSettings(prev => ({
      ...prev,
      [instrumentId]: { ...prev[instrumentId], [field]: value }
    }));

    // Update all selected batches for this instrument
    const instBatches = batches.filter(b => String(b.instrument_id) === String(instrumentId));
    const instBatchIds = instBatches.map(b => String(b.id));

    setSelectedBatches(prev => prev.map(eb => {
      if (instBatchIds.includes(String(eb.batch_id))) {
        return { ...eb, [field]: value };
      }
      return eb;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 [StudentDetails] Submitting form:', { formData, selectedBatches, selectedProspectId });
    onSave(formData, selectedBatches, selectedProspectId);
  };

  // Group batches by instrument
  const batchesByInstrument = (instruments || []).map(instrument => ({
    instrument,
    batches: (batches || []).filter(batch => String(batch.instrument_id) === String(instrument.id))
  }));

  const filteredProspects = prospects.filter(p => {
    if (!prospectSearch) return true;
    const q = prospectSearch.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const phone = (p.phone || '').toLowerCase();
    const email = (p.metadata?.email || '').toLowerCase();
    const instrument = (p.metadata?.interested_instrument || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || email.includes(q) || instrument.includes(q);
  });

  // Step indicator steps
  const steps = student
    ? [
        { key: 'form',    label: 'Personal Details' },
        { key: 'batches', label: 'Batch Selection'  },
      ]
    : [
        { key: 'prospect', label: 'Select Prospect' },
        { key: 'form',     label: 'Personal Details' },
        { key: 'batches',  label: 'Batch Selection'  },
      ];

  const currentStepIndex = steps.findIndex(s => s.key === activeTab);

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center border-b border-slate-200 px-6 py-3 gap-0">
        {steps.map((step, idx) => {
          const isActive = step.key === activeTab;
          const isDone   = idx < currentStepIndex;
          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                onClick={() => {
                  // Allow navigating back to any earlier step freely
                  if (isDone || isActive) setActiveTab(step.key as any);
                }}
                className={`flex items-center gap-1.5 text-xs font-semibold transition ${
                  isActive ? 'text-orange-600' : isDone ? 'text-slate-600 hover:text-orange-500 cursor-pointer' : 'text-slate-300 cursor-default'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                  isActive ? 'border-orange-500 bg-orange-500 text-white'
                  : isDone  ? 'border-slate-400 bg-slate-400 text-white'
                  : 'border-slate-200 text-slate-300'
                }`}>
                  {isDone ? '✓' : idx + 1}
                </span>
                {step.label}
              </button>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${idx < currentStepIndex ? 'bg-slate-400' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1 (new student): Prospect picker */}
      {!student && activeTab === 'prospect' && (
        <div className="p-6 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Search by name, phone, email, or instrument..."
              value={prospectSearch}
              onChange={e => setProspectSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
            />
          </div>

          {prospects.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg font-medium">No prospects yet</p>
              <p className="text-sm mt-1">Prospects come from demo/trial signups on the landing page.</p>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition"
              >
                Add as New Student instead
              </button>
            </div>
          ) : filteredProspects.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No prospects match your search.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProspects.map(p => {
                const isSelected = String(p.id) === selectedProspectId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProspectSelect(String(p.id))}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[p.phone, p.metadata?.email].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {p.metadata?.interested_instrument && (
                        <span className="ml-3 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold whitespace-nowrap">
                          {p.metadata.interested_instrument}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-200">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">Cancel</button>
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition"
            >
              Skip — New Student
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Personal Details */}
      {(activeTab === 'form') && (
      <form
        onSubmit={(e) => { e.preventDefault(); setActiveTab('batches'); }}
        className="p-6 space-y-4"
      >
        {selectedProspectId && !student && (
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm">
            <span className="text-orange-600 font-semibold">
              Prospect: {prospects.find(p => String(p.id) === selectedProspectId)?.name}
            </span>
            <button
              type="button"
              onClick={() => { setSelectedProspectId(''); setActiveTab('prospect'); }}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Change
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">First Name *</label>
            <input name="first_name" value={formData.first_name} onChange={handleInputChange} required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name *</label>
            <input name="last_name" value={formData.last_name} onChange={handleInputChange} required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
            <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Name</label>
            <input name="guardian_name" value={formData.guardian_name} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Phone</label>
            <input type="tel" name="guardian_phone" value={formData.guardian_phone} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
          <textarea name="address" value={formData.address} onChange={handleInputChange} rows={3} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onCancel} className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">Cancel</button>
          <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg">
            Next: Select Batches →
          </button>
        </div>
      </form>
      )}

      {/* Step 3: Batch Selection */}
      {activeTab === 'batches' && (
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <p className="text-sm text-slate-500">Click a batch slot to select it. Batches on multiple days (e.g. Tue+Thu) are linked — selecting one selects both days.</p>

        <BatchScheduleGrid
          batches={batches}
          instruments={instruments}
          selectedBatchIds={new Set(selectedBatches.map(b => String(b.batch_id)))}
          onToggle={handleBatchToggle}
        />

        {/* Payment settings — shown per instrument once at least one batch is selected */}
        {batchesByInstrument
          .filter(({ instrument }) =>
            selectedBatches.some(sel =>
              batches.find(b => String(b.id) === String(sel.batch_id) && String(b.instrument_id) === String(instrument.id))
            )
          )
          .map(({ instrument }) => {
            const settings = instrumentSettings[String(instrument.id)] || {
              payment_frequency: 'monthly',
              enrollment_date: new Date().toISOString().split('T')[0],
            };
            return (
              <div key={instrument.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-3">🎵 {instrument.name} — Payment Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment Date</label>
                    <input
                      type="date"
                      value={settings.enrollment_date}
                      onChange={(e) => handleInstrumentSettingChange(String(instrument.id), 'enrollment_date', e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 focus:border-indigo-500 outline-none w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Frequency</label>
                    <select
                      value={settings.payment_frequency}
                      onChange={(e) => handleInstrumentSettingChange(String(instrument.id), 'payment_frequency', e.target.value as PaymentFrequency)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 focus:border-indigo-500 outline-none w-full"
                    >
                      <option value="monthly">Monthly (8 classes)</option>
                      <option value="quarterly">Quarterly (24 classes)</option>
                      <option value="half_yearly">Half-Yearly (48 classes)</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        }

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => setActiveTab('form')} className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">← Back</button>
          <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg">
            {student ? 'Save Changes' : 'Add Student & Enroll'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};

export default StudentDetails;
