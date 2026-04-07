import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';
import { Student, Batch, Instrument } from '../types';

type PaymentType = 'trial' | 'quarterly';

export interface EnrollmentSelection {
  batch_id: number | string;
  payment_frequency: PaymentType;
  enrollment_date: string;
  trinity_grade?: string;
}

const VOCAL_INSTRUMENTS = ['Hindustani Vocals', 'Carnatic Vocals'];
const TRINITY_GRADES = ['Initial', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'];
const DAYS_ORDER = ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS: Record<string, string> = { TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

interface StudentDetailsProps {
  student?: Student | null;
  batches: Batch[];
  instruments: Instrument[];
  onSave: (data: any, enrollments: EnrollmentSelection[], prospectId?: string, feeTotal?: number) => void;
  onCancel: () => void;
}

/** Parse a batch's recurrence text (e.g. "TUE 17:00-18:00, THU 17:00-18:00") into day codes */
function getBatchDays(batch: Batch): string[] {
  const rec = (batch.recurrence || '').trim();
  const fromRec = rec.split(',').map(s => {
    const m = s.trim().match(/^([A-Z]{2,3})\s/i);
    return m ? m[1].toUpperCase() : null;
  }).filter(Boolean) as string[];
  if (fromRec.length > 0) return fromRec;
  // Fallback: day_of_week field
  return (batch.day_of_week || '').split(',').map(d => d.trim().toUpperCase()).filter(Boolean);
}

/** Count how many weekly day-slots the currently selected batches occupy for an instrument */
function calcSelectedSlots(instrumentId: string, selectedBatches: EnrollmentSelection[], allBatches: Batch[]): number {
  const instrBatchIds = new Set(allBatches.filter(b => String(b.instrument_id) === instrumentId).map(b => String(b.id)));
  return selectedBatches
    .filter(sel => instrBatchIds.has(String(sel.batch_id)))
    .reduce((sum, sel) => {
      const b = allBatches.find(bb => String(bb.id) === String(sel.batch_id));
      return sum + (b ? Math.max(getBatchDays(b).length, 1) : 1);
    }, 0);
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, batches, instruments, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', date_of_birth: '',
    email: '', phone: '', guardian_name: '', guardian_phone: '', address: ''
  });
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<EnrollmentSelection[]>([]);
  const [instrumentSettings, setInstrumentSettings] = useState<Record<string, { payment_frequency: PaymentType; enrollment_date: string }>>({});

  // Fee resolution
  const [instrGrades, setInstrGrades] = useState<Record<string, string>>({});
  const [instrPayTypes, setInstrPayTypes] = useState<Record<string, PaymentType>>({});
  const [instrFees, setInstrFees] = useState<Record<string, { fee_amount: number; fee_structure_id: string } | null>>({});
  const [mainBranchId, setMainBranchId] = useState<string | null>(null);

  const [prospects, setProspects] = useState<any[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'prospect' | 'form' | 'batches'>(student ? 'form' : 'prospect');
  const [prospectSearch, setProspectSearch] = useState('');

  useEffect(() => {
    apiGet('/api/fee-structures/branches')
      .then(data => {
        const main = (data.branches || []).find((b: any) => b.code === 'main');
        if (main) setMainBranchId(main.id);
      })
      .catch(() => {});
  }, []);

  const resolveFee = async (instrumentId: string, grade: string, payType: PaymentType) => {
    if (!mainBranchId) return;
    const isVocal = VOCAL_INSTRUMENTS.includes(instruments.find(i => String(i.id) === instrumentId)?.name || '');
    const isTrial = payType === 'trial';
    const resolveGrade = isTrial ? 'Initial' : (isVocal ? 'Fixed' : grade);
    const classesCount = isTrial ? 4 : 24;
    try {
      const data = await apiGet(
        `/api/fee-structures/resolve?branch_id=${mainBranchId}&instrument_id=${instrumentId}` +
        `&trinity_grade=${encodeURIComponent(resolveGrade)}&classes_count=${classesCount}&is_trial=${isTrial}`
      );
      setInstrFees(prev => ({ ...prev, [instrumentId]: { fee_amount: data.fee_structure.fee_amount, fee_structure_id: data.fee_structure.id } }));
    } catch {
      setInstrFees(prev => ({ ...prev, [instrumentId]: null }));
    }
  };

  useEffect(() => {
    if (!student) {
      apiGet('/api/prospects')
        .then(res => setProspects(res.prospects || []))
        .catch(() => {});
    }
  }, [student]);

  useEffect(() => {
    if (student) {
      const name = (student as any).name || '';
      const parts = name.split(' ');
      const metadata = (student as any).metadata || {};
      setFormData({
        first_name: student.first_name || parts[0] || '',
        last_name: student.last_name || (parts.length > 1 ? parts.slice(1).join(' ') : ''),
        date_of_birth: student.date_of_birth || (student as any).dob?.split('T')[0] || '',
        email: metadata.email || student.email || '',
        phone: student.phone || '',
        guardian_name: metadata.guardian_name || student.guardian_name || (student as any).guardian_contact || '',
        guardian_phone: metadata.guardian_phone || student.guardian_phone || '',
        address: metadata.address || student.address || ''
      });
      const studentBatches = (student as any).batches || (student as any).enrollments || [];
      const initBatches: EnrollmentSelection[] = studentBatches.map((enr: any) => ({
        batch_id: enr.batch_id || '',
        payment_frequency: (enr.payment_frequency as PaymentType) || 'quarterly',
        enrollment_date: enr.enrolled_on ? enr.enrolled_on.split('T')[0] : '',
        trinity_grade: enr.trinity_grade || 'Initial',
      }));
      setSelectedBatches(initBatches);
      // Pre-select instruments from existing batches
      const instrIds: string[] = [...new Set<string>(studentBatches.map((e: any) => String(e.instrument_id)).filter(Boolean))];
      setSelectedInstrumentIds(instrIds);
      const settings: Record<string, any> = {};
      instruments.forEach(inst => {
        const existing = initBatches.find(eb => batches.some(b => String(b.id) === String(eb.batch_id) && String(b.instrument_id) === String(inst.id)));
        settings[String(inst.id)] = { payment_frequency: existing?.payment_frequency || 'quarterly', enrollment_date: existing?.enrollment_date || new Date().toISOString().split('T')[0] };
      });
      setInstrumentSettings(settings);
    } else {
      setFormData({ first_name: '', last_name: '', date_of_birth: '', email: '', phone: '', guardian_name: '', guardian_phone: '', address: '' });
      setSelectedBatches([]);
      setSelectedInstrumentIds([]);
      const settings: Record<string, any> = {};
      instruments.forEach(inst => { settings[String(inst.id)] = { payment_frequency: 'quarterly', enrollment_date: new Date().toISOString().split('T')[0] }; });
      setInstrumentSettings(settings);
    }
  }, [student, instruments, batches]);

  const handleProspectSelect = (prospectId: string) => {
    setSelectedProspectId(prospectId);
    if (!prospectId) return;
    const prospect = prospects.find(p => String(p.id) === prospectId);
    if (prospect) {
      const parts = (prospect.name || '').split(' ');
      const metadata = prospect.metadata || {};
      setFormData(prev => ({
        ...prev,
        first_name: parts[0] || '',
        last_name: parts.length > 1 ? parts.slice(1).join(' ') : '',
        email: metadata.email || '',
        phone: prospect.phone || '',
        address: metadata.address || ''
      }));
      // Pre-select instrument from prospect interest
      if (metadata.interested_instrument) {
        const match = instruments.find(i => i.name.toLowerCase().includes((metadata.interested_instrument || '').toLowerCase()));
        if (match) setSelectedInstrumentIds([String(match.id)]);
      }
      setActiveTab('form');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleInstrument = (instrumentId: string) => {
    setSelectedInstrumentIds(prev => {
      if (prev.includes(instrumentId)) {
        // Deselect: also remove any selected batches for this instrument
        const instrBatchIds = new Set(batches.filter(b => String(b.instrument_id) === instrumentId).map(b => String(b.id)));
        setSelectedBatches(sb => sb.filter(s => !instrBatchIds.has(String(s.batch_id))));
        setInstrFees(f => { const { [instrumentId]: _, ...rest } = f; return rest; });
        return prev.filter(id => id !== instrumentId);
      }
      return [...prev, instrumentId];
    });
  };

  const handleBatchSlotToggle = (batchId: number | string, instrumentId: string) => {
    const batchIdStr = String(batchId);
    const exists = selectedBatches.find(e => String(e.batch_id) === batchIdStr);
    if (exists) {
      setSelectedBatches(prev => prev.filter(e => String(e.batch_id) !== batchIdStr));
      return;
    }
    const batch = batches.find(b => String(b.id) === batchIdStr);
    if (!batch) return;
    const slotsNeeded = Math.max(getBatchDays(batch).length, 1);
    const slotsUsed = calcSelectedSlots(instrumentId, selectedBatches, batches);
    if (slotsUsed + slotsNeeded > 2) return; // max 2 slots/week per instrument

    const settings = instrumentSettings[instrumentId] || { payment_frequency: 'quarterly' as PaymentType, enrollment_date: new Date().toISOString().split('T')[0] };
    const isVocal = VOCAL_INSTRUMENTS.includes(instruments.find(i => String(i.id) === instrumentId)?.name || '');
    const grade = isVocal ? 'Fixed' : (instrGrades[instrumentId] || 'Initial');
    if (!instrFees[instrumentId]) resolveFee(instrumentId, grade, settings.payment_frequency);
    setSelectedBatches(prev => [...prev, {
      batch_id: batchId,
      payment_frequency: settings.payment_frequency,
      enrollment_date: settings.enrollment_date,
      trinity_grade: grade,
    }]);
  };

  const handleInstrumentSettingChange = (instrumentId: string, field: 'payment_frequency' | 'enrollment_date', value: any) => {
    setInstrumentSettings(prev => ({ ...prev, [instrumentId]: { ...prev[instrumentId], [field]: value } }));
    if (field === 'payment_frequency') {
      setInstrPayTypes(prev => ({ ...prev, [instrumentId]: value as PaymentType }));
      resolveFee(instrumentId, instrGrades[instrumentId] || 'Initial', value as PaymentType);
    }
    const instrBatchIds = batches.filter(b => String(b.instrument_id) === instrumentId).map(b => String(b.id));
    setSelectedBatches(prev => prev.map(eb => instrBatchIds.includes(String(eb.batch_id)) ? { ...eb, [field]: value } : eb));
  };

  const handleGradeChange = (instrumentId: string, grade: string) => {
    setInstrGrades(prev => ({ ...prev, [instrumentId]: grade }));
    const payType = instrPayTypes[instrumentId] || instrumentSettings[instrumentId]?.payment_frequency || 'quarterly';
    resolveFee(instrumentId, grade, payType);
    const instrBatchIds = batches.filter(b => String(b.instrument_id) === instrumentId).map(b => String(b.id));
    setSelectedBatches(prev => prev.map(eb => instrBatchIds.includes(String(eb.batch_id)) ? { ...eb, trinity_grade: grade } : eb));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const feeTotal = selectedInstrumentIds.reduce((sum, id) => sum + (instrFees[id]?.fee_amount || 0), 0);
    onSave(formData, selectedBatches, selectedProspectId, feeTotal);
  };

  // For new enrollments: only non-deprecated instruments.
  // For editing: also include deprecated instruments if the student is already enrolled in them.
  const activeInstruments = instruments.filter(i => {
    if (!i.is_deprecated) return true;
    return !!student && selectedInstrumentIds.includes(String(i.id));
  });

  const filteredProspects = prospects.filter(p => {
    if (!prospectSearch) return true;
    const q = prospectSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.metadata?.email || '').toLowerCase().includes(q) ||
      (p.metadata?.interested_instrument || '').toLowerCase().includes(q);
  });

  const steps = student
    ? [{ key: 'form', label: 'Personal Details' }, { key: 'batches', label: 'Schedule' }]
    : [{ key: 'prospect', label: 'Prospect' }, { key: 'form', label: 'Personal Details' }, { key: 'batches', label: 'Schedule' }];
  const currentStepIndex = steps.findIndex(s => s.key === activeTab);

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center border-b border-slate-200 px-6 py-3 gap-0">
        {steps.map((step, idx) => {
          const isActive = step.key === activeTab;
          const isDone = idx < currentStepIndex;
          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                onClick={() => { if (isDone || isActive) setActiveTab(step.key as any); }}
                className={`flex items-center gap-1.5 text-xs font-semibold transition ${isActive ? 'text-orange-600' : isDone ? 'text-slate-600 hover:text-orange-500 cursor-pointer' : 'text-slate-300 cursor-default'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'border-orange-500 bg-orange-500 text-white' : isDone ? 'border-slate-400 bg-slate-400 text-white' : 'border-slate-200 text-slate-300'}`}>
                  {isDone ? '✓' : idx + 1}
                </span>
                {step.label}
              </button>
              {idx < steps.length - 1 && <div className={`flex-1 h-px mx-2 ${idx < currentStepIndex ? 'bg-slate-400' : 'bg-slate-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1 (new student): Prospect picker */}
      {!student && activeTab === 'prospect' && (
        <div className="p-6 space-y-4">
          <input
            type="text"
            placeholder="Search by name, phone, email, or instrument..."
            value={prospectSearch}
            onChange={e => setProspectSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
          />
          {prospects.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg font-medium">No prospects yet</p>
              <p className="text-sm mt-1">Prospects come from demo/trial signups on the landing page.</p>
              <button type="button" onClick={() => setActiveTab('form')} className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition">
                Add as New Student instead
              </button>
            </div>
          ) : filteredProspects.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No prospects match your search.</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredProspects.map(p => {
                const isSelected = String(p.id) === selectedProspectId;
                return (
                  <button key={p.id} type="button" onClick={() => handleProspectSelect(String(p.id))}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{[p.phone, p.metadata?.email].filter(Boolean).join(' · ')}</p>
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
            <button type="button" onClick={() => setActiveTab('form')} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition">
              Skip — New Student
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Personal Details + Instrument Selection */}
      {activeTab === 'form' && (
        <form onSubmit={e => {
          e.preventDefault();
          if (selectedInstrumentIds.length === 0) { alert('Please select at least one instrument.'); return; }
          setActiveTab('batches');
        }} className="p-6 space-y-4">
          {selectedProspectId && !student && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm">
              <span className="text-orange-600 font-semibold">Prospect: {prospects.find(p => String(p.id) === selectedProspectId)?.name}</span>
              <button type="button" onClick={() => { setSelectedProspectId(''); setActiveTab('prospect'); }} className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline">Change</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">First Name *</label>
              <input name="first_name" value={formData.first_name} onChange={handleInputChange} required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name *</label>
              <input name="last_name" value={formData.last_name} onChange={handleInputChange} required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
              <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Name</label>
              <input name="guardian_name" value={formData.guardian_name} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Phone</label>
              <input type="tel" name="guardian_phone" value={formData.guardian_phone} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
            <textarea name="address" value={formData.address} onChange={handleInputChange} rows={2} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
          </div>

          {/* Instrument Selection */}
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Instrument(s) to Enroll <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">Select the instrument(s) the student will learn. Available slots will be shown in the next step.</p>
            <div className="flex flex-wrap gap-2">
              {activeInstruments.map(inst => {
                const instrKey = String(inst.id);
                const isSelected = selectedInstrumentIds.includes(instrKey);
                const hasBatches = batches.some(b => String(b.instrument_id) === instrKey);
                // Legacy instruments shown when editing but can't be toggled off
                const isLegacy = !!inst.is_deprecated;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => !isLegacy && toggleInstrument(instrKey)}
                    disabled={!hasBatches}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition ${
                      isSelected && isLegacy
                        ? 'border-amber-500 bg-amber-500 text-white cursor-default'
                        : isSelected
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : hasBatches
                            ? 'border-slate-300 bg-white text-slate-700 hover:border-orange-400'
                            : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {inst.name}
                    {isLegacy && <span className="ml-1 text-[10px] opacity-75">(legacy)</span>}
                    {!isLegacy && !hasBatches && <span className="ml-1 text-[10px]">(no batches)</span>}
                  </button>
                );
              })}
            </div>
            {selectedInstrumentIds.length > 0 && (
              <p className="mt-2 text-xs text-orange-700">
                Selected: {selectedInstrumentIds.map(id => instruments.find(i => String(i.id) === id)?.name).filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg">
              Next: Select Schedule →
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Schedule Selection — per instrument, day-based slots, max 2/week */}
      {activeTab === 'batches' && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-sm text-slate-500">For each instrument, choose your level, package, and select up to 2 time slots per week.</p>

          {selectedInstrumentIds.map(instrId => {
            const instrument = instruments.find(i => String(i.id) === instrId);
            if (!instrument) return null;
            const instrKey = instrId;
            const isVocal = VOCAL_INSTRUMENTS.includes(instrument.name);
            const settings = instrumentSettings[instrKey] || { payment_frequency: 'quarterly' as PaymentType, enrollment_date: new Date().toISOString().split('T')[0] };
            const currentGrade = instrGrades[instrKey] || 'Initial';
            const feeInfo = instrFees[instrKey];
            const instrBatches = batches.filter(b => String(b.instrument_id) === instrKey);
            const slotsUsed = calcSelectedSlots(instrKey, selectedBatches, batches);

            // Build day → batches map
            const dayMap: Record<string, Batch[]> = {};
            instrBatches.forEach(b => {
              getBatchDays(b).forEach(day => {
                if (!dayMap[day]) dayMap[day] = [];
                if (!dayMap[day].find(existing => existing.id === b.id)) dayMap[day].push(b);
              });
            });
            const activeDays = DAYS_ORDER.filter(d => dayMap[d]?.length > 0);

            return (
              <div key={instrId} className="rounded-xl border-2 border-slate-200 overflow-hidden">
                {/* Instrument header */}
                <div className={`px-5 py-3 flex items-center justify-between ${instrument.is_deprecated ? 'bg-amber-700' : 'bg-slate-800'} text-white`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{instrument.name}</span>
                    {instrument.is_deprecated && (
                      <span className="text-[10px] font-semibold bg-amber-900 border border-amber-500 rounded px-1.5 py-0.5">Legacy</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-300">{slotsUsed}/2 weekly slots selected</span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Level + Package row */}
                  <div className="flex flex-wrap gap-4">
                    {!isVocal && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Student's Level
                          <span className="ml-1.5 text-[10px] font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Confirm with teacher</span>
                        </label>
                        <select
                          value={currentGrade}
                          onChange={e => handleGradeChange(instrKey, e.target.value)}
                          className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 focus:border-orange-500 outline-none bg-white"
                        >
                          {TRINITY_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Package</label>
                      <div className="flex gap-2">
                        {(['trial', 'quarterly'] as PaymentType[]).map(pt => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => handleInstrumentSettingChange(instrKey, 'payment_frequency', pt)}
                            className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition flex flex-col items-start ${settings.payment_frequency === pt ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-orange-400'}`}
                          >
                            <span>{pt === 'trial' ? 'Trial' : 'Quarterly'}</span>
                            <span className={`font-normal ${settings.payment_frequency === pt ? 'text-orange-100' : 'text-slate-400'}`}>{pt === 'trial' ? '4 cls' : '24 cls'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {feeInfo ? (
                      <div className="flex items-end">
                        <span className="inline-flex items-center gap-1 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                          <span className="text-green-600 font-medium">Fee:</span>
                          <span className="text-green-800 font-bold">₹{feeInfo.fee_amount.toLocaleString()}</span>
                        </span>
                      </div>
                    ) : feeInfo === null ? (
                      <div className="flex items-end">
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">No fee configured</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Day-based slot grid */}
                  {activeDays.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No batches available for this instrument.</p>
                  ) : (
                    <div className="space-y-3">
                      {activeDays.map(day => (
                        <div key={day}>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{DAY_LABELS[day] || day}</div>
                          <div className="space-y-1.5">
                            {dayMap[day].map(batch => {
                              const batchIdStr = String(batch.id);
                              const isSelected = selectedBatches.some(s => String(s.batch_id) === batchIdStr);
                              const batchDays = getBatchDays(batch);
                              const slotsNeeded = Math.max(batchDays.length, 1);
                              const canSelect = isSelected || slotsUsed + slotsNeeded <= 2;
                              const allDaysLabel = batchDays.length > 1
                                ? batchDays.map(d => DAY_LABELS[d] || d).join(' + ')
                                : null;

                              return (
                                <button
                                  key={batch.id}
                                  type="button"
                                  onClick={() => canSelect ? handleBatchSlotToggle(batch.id, instrKey) : undefined}
                                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition ${
                                    isSelected
                                      ? 'border-orange-500 bg-orange-50'
                                      : canSelect
                                        ? 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50 cursor-pointer'
                                        : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                                    {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-slate-900 text-sm">{batch.start_time.slice(0,5)}–{batch.end_time.slice(0,5)}</span>
                                      {(batch as any).teacher_name && (
                                        <span className="text-xs text-slate-500">· {(batch as any).teacher_name}</span>
                                      )}
                                      {allDaysLabel && (
                                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
                                          Also {allDaysLabel}
                                        </span>
                                      )}
                                    </div>
                                    {(batch as any).student_count !== undefined && (
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        {batch.capacity - ((batch as any).student_count || 0)} seat{batch.capacity - ((batch as any).student_count || 0) !== 1 ? 's' : ''} available
                                      </div>
                                    )}
                                  </div>
                                  {!canSelect && !isSelected && <span className="text-[10px] text-slate-400 flex-shrink-0">Week full</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Enrollment date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Enrollment Date</label>
                    <input
                      type="date"
                      value={settings.enrollment_date}
                      onChange={e => handleInstrumentSettingChange(instrKey, 'enrollment_date', e.target.value)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 focus:border-orange-500 outline-none bg-white"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Summary of selections */}
          {selectedBatches.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-orange-800 mb-2">Your Weekly Schedule</p>
              {selectedBatches.map(sel => {
                const b = batches.find(bb => String(bb.id) === String(sel.batch_id));
                const inst = b ? instruments.find(i => String(i.id) === String(b.instrument_id)) : null;
                const days = b ? getBatchDays(b) : [];
                return (
                  <div key={String(sel.batch_id)} className="text-sm text-orange-700 flex items-center gap-2">
                    <span className="font-medium">{inst?.name}</span>
                    <span>·</span>
                    <span>{days.map(d => DAY_LABELS[d] || d).join(' + ')}</span>
                    {b && <span className="text-orange-500">{b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setActiveTab('form')} className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">← Back</button>
            <button type="submit" disabled={selectedBatches.length === 0} className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed">
              {student ? 'Save Changes' : 'Add Student & Enroll'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default StudentDetails;
