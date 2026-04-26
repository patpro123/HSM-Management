import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';
import { Student, Batch, Instrument } from '../types';

type PaymentType = 'trial' | 'quarterly' | 'pbel_4' | 'pbel_8';

export interface EnrollmentSelection {
  batch_id: number | string;
  payment_frequency: PaymentType;
  enrollment_date: string;
  trinity_grade?: string;
  fee_structure_id?: string;
  classes_remaining?: number;
}

const VOCAL_INSTRUMENTS = ['Hindustani Vocals', 'Carnatic Vocals'];
const TRINITY_GRADES = ['Initial', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'];

interface StudentDetailsProps {
  student?: Student | null;
  batches: Batch[];
  instruments: Instrument[];
  onSave: (data: any, enrollments: EnrollmentSelection[], prospectId?: string, feeTotal?: number, creditsTotal?: number) => void;
  onCancel: () => void;
  initialProspectId?: string | null;
}


const StudentDetails: React.FC<StudentDetailsProps> = ({ student, batches, instruments, onSave, onCancel, initialProspectId }) => {
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
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [prospects, setProspects] = useState<any[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'prospect' | 'form' | 'batches'>(student ? 'form' : 'prospect');
  const [prospectSearch, setProspectSearch] = useState('');

  useEffect(() => {
    apiGet('/api/fee-structures/branches')
      .then(data => {
        const branchList = data.branches || [];
        setBranches(branchList);
        const main = branchList.find((b: any) => b.code === 'main');
        if (main) setSelectedBranchId(main.id);
      })
      .catch(() => { });
  }, []);

  const resolveFee = async (instrumentId: string, grade: string, payType: PaymentType) => {
    const branchId = selectedBranchId;
    if (!branchId) return;
    const isVocal = VOCAL_INSTRUMENTS.includes(instruments.find(i => String(i.id) === instrumentId)?.name || '');
    const isTrial = payType === 'trial';

    let resolveGrade: string;
    let classesCount: number;
    if (isTrial) {
      resolveGrade = 'Initial';
      classesCount = 4;
    } else if (payType === 'pbel_4' || payType === 'pbel_8') {
      resolveGrade = 'Fixed';
      classesCount = 8;
    } else {
      resolveGrade = isVocal ? 'Fixed' : grade;
      classesCount = 24;
    }

    try {
      const data = await apiGet(
        `/api/fee-structures/resolve?branch_id=${branchId}&instrument_id=${instrumentId}` +
        `&trinity_grade=${encodeURIComponent(resolveGrade)}&classes_count=${classesCount}&is_trial=${isTrial}`
      );
      const monthlyFee = data.fee_structure.fee_amount;
      const displayFee = payType === 'pbel_4' ? Math.round(monthlyFee * 0.53) : monthlyFee;
      setInstrFees(prev => ({ ...prev, [instrumentId]: { fee_amount: displayFee, fee_structure_id: data.fee_structure.id } }));
    } catch {
      setInstrFees(prev => ({ ...prev, [instrumentId]: null }));
    }
  };

  useEffect(() => {
    if (!student) {
      apiGet('/api/prospects')
        .then(res => setProspects(res.prospects || []))
        .catch(() => { });
    }
  }, [student]);

  useEffect(() => {
    if (initialProspectId && prospects.length > 0) {
      handleProspectSelect(initialProspectId);
    }
  }, [initialProspectId, prospects]);

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

  const handleDay1Change = (instrKey: string, batchId: string) => {
    const instrBatchIds = new Set(batches.filter(b => String(b.instrument_id) === instrKey).map(b => String(b.id)));
    const others = selectedBatches.filter(s => !instrBatchIds.has(String(s.batch_id)));
    const day2 = selectedBatches.filter(s => instrBatchIds.has(String(s.batch_id)))[1];
    if (!batchId) { setSelectedBatches(others); return; }
    const settings = instrumentSettings[instrKey] || { payment_frequency: 'quarterly' as PaymentType, enrollment_date: new Date().toISOString().split('T')[0] };
    const isVocal = VOCAL_INSTRUMENTS.includes(instruments.find(i => String(i.id) === instrKey)?.name || '');
    const grade = isVocal ? 'Fixed' : (instrGrades[instrKey] || 'Initial');
    if (!instrFees[instrKey]) resolveFee(instrKey, grade, settings.payment_frequency);
    const newDay1: EnrollmentSelection = { batch_id: batchId, payment_frequency: settings.payment_frequency, enrollment_date: settings.enrollment_date, trinity_grade: grade, fee_structure_id: instrFees[instrKey]?.fee_structure_id };
    const newInstrBatches: EnrollmentSelection[] = [newDay1];
    if (day2 && String(day2.batch_id) !== batchId) newInstrBatches.push(day2);
    setSelectedBatches([...others, ...newInstrBatches]);
  };

  const handleDay2Change = (instrKey: string, batchId: string) => {
    const instrBatchIds = new Set(batches.filter(b => String(b.instrument_id) === instrKey).map(b => String(b.id)));
    const others = selectedBatches.filter(s => !instrBatchIds.has(String(s.batch_id)));
    const day1 = selectedBatches.filter(s => instrBatchIds.has(String(s.batch_id)))[0];
    if (!day1) return;
    if (!batchId) { setSelectedBatches([...others, day1]); return; }
    const settings = instrumentSettings[instrKey] || { payment_frequency: 'quarterly' as PaymentType, enrollment_date: new Date().toISOString().split('T')[0] };
    const isVocal = VOCAL_INSTRUMENTS.includes(instruments.find(i => String(i.id) === instrKey)?.name || '');
    const grade = isVocal ? 'Fixed' : (instrGrades[instrKey] || 'Initial');
    const newDay2: EnrollmentSelection = { batch_id: batchId, payment_frequency: settings.payment_frequency, enrollment_date: settings.enrollment_date, trinity_grade: grade, fee_structure_id: instrFees[instrKey]?.fee_structure_id };
    setSelectedBatches([...others, day1, newDay2]);
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

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setInstrFees({});
    setInstrPayTypes({});
    setInstrumentSettings(prev => {
      const reset: typeof prev = {};
      Object.keys(prev).forEach(k => { reset[k] = { ...prev[k], payment_frequency: 'quarterly' }; });
      return reset;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const feeTotal = selectedInstrumentIds.reduce((sum, id) => sum + (instrFees[id]?.fee_amount || 0), 0);
    let creditsTotal = 0;

    // Deduplicate batches by instrument to avoid double counting credits
    const uniqueInstrumentsMap = new Map();
    selectedBatches.forEach(b => {
      const batchObj = batches.find(db => String(db.id) === String(b.batch_id));
      if (batchObj?.instrument_id) {
        uniqueInstrumentsMap.set(String(batchObj.instrument_id), b);
      }
    });

    Array.from(uniqueInstrumentsMap.values()).forEach(b => {
      const type = (b.payment_frequency || 'monthly').toLowerCase();
      if (type === 'pbel_4' || type === 'trial') creditsTotal += 4;
      else if (type === 'pbel_8' || type === 'monthly') creditsTotal += 8;
      else if (type === 'quarterly') creditsTotal += 24;
      else if (type === 'half_yearly') creditsTotal += 48;
      else if (type === 'yearly') creditsTotal += 96;
    });

    onSave(formData, selectedBatches, selectedProspectId, feeTotal, creditsTotal);
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

          {/* Branch Selector */}
          {branches.length > 1 && (
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Branch</label>
              <div className="flex gap-2 flex-wrap">
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => handleBranchChange(branch.id)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${selectedBranchId === branch.id
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-orange-400'
                      }`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                    className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition ${isSelected && isLegacy
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

      {/* Step 3: Schedule — Day 1 + Day 2 batch dropdowns per instrument */}
      {activeTab === 'batches' && (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-xs text-slate-500">For each instrument, select a Day 1 batch (required) and optionally a Day 2 batch. Max 2 batches per instrument.</p>

          {selectedInstrumentIds.map(instrId => {
            const instrument = instruments.find(i => String(i.id) === instrId);
            if (!instrument) return null;
            const instrKey = instrId;
            const isVocal = VOCAL_INSTRUMENTS.includes(instrument.name);
            const settings = instrumentSettings[instrKey] || { payment_frequency: 'quarterly' as PaymentType, enrollment_date: new Date().toISOString().split('T')[0] };
            const currentGrade = instrGrades[instrKey] || 'Initial';
            const feeInfo = instrFees[instrKey];
            const instrBatches = batches.filter(b => String(b.instrument_id) === instrKey);
            const instrBatchIds = new Set(instrBatches.map(b => String(b.id)));
            const currentInstrSelections = selectedBatches.filter(s => instrBatchIds.has(String(s.batch_id)));
            const day1BatchId = currentInstrSelections[0] ? String(currentInstrSelections[0].batch_id) : '';
            const day2BatchId = currentInstrSelections[1] ? String(currentInstrSelections[1].batch_id) : '';

            return (
              <div key={instrId} className="rounded-xl border-2 border-slate-200 overflow-hidden">
                {/* Instrument header */}
                <div className={`px-4 py-2.5 flex items-center justify-between ${instrument.is_deprecated ? 'bg-amber-700' : 'bg-slate-800'} text-white`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{instrument.name}</span>
                    {instrument.is_deprecated && (
                      <span className="text-[10px] font-semibold bg-amber-900 border border-amber-500 rounded px-1.5 py-0.5">Legacy</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-300">{currentInstrSelections.length}/2 batches</span>
                </div>

                <div className="p-3 space-y-3">
                  {/* Level + Package row */}
                  <div className="flex flex-wrap gap-2 items-end">
                    {!isVocal && (
                      <div className="flex-1 min-w-[110px]">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Level</label>
                        <select
                          value={currentGrade}
                          onChange={e => handleGradeChange(instrKey, e.target.value)}
                          className="w-full text-sm px-2 py-1.5 rounded-lg border border-slate-300 focus:border-orange-500 outline-none bg-white"
                        >
                          {TRINITY_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex-1 min-w-[110px]">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Package</label>
                      {(() => {
                        const isPbel = branches.find(b => b.id === selectedBranchId)?.code === 'pbel';
                        const opts: Array<{ type: PaymentType; label: string }> = isPbel
                          ? [
                            { type: 'trial', label: 'Trial' },
                            { type: 'pbel_4', label: '4-Class' },
                            { type: 'pbel_8', label: '8-Class' },
                          ]
                          : [
                            { type: 'trial', label: 'Trial' },
                            { type: 'quarterly', label: 'Quarterly' },
                          ];
                        return (
                          <div className="flex gap-1.5">
                            {opts.map(({ type: pt, label }) => (
                              <button
                                key={pt}
                                type="button"
                                onClick={() => handleInstrumentSettingChange(instrKey, 'payment_frequency', pt)}
                                className={`flex-1 px-2 py-1.5 rounded-lg border-2 text-xs font-semibold transition text-center ${settings.payment_frequency === pt ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-orange-400'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    {feeInfo && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-green-600 font-medium">Fee:</span>
                        <span className="text-green-800 font-bold">₹{feeInfo.fee_amount.toLocaleString()}</span>
                      </span>
                    )}
                    {feeInfo === null && (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">No fee configured</span>
                    )}
                  </div>

                  {instrBatches.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No batches available for this instrument.</p>
                  ) : (
                    <>
                      {/* Day 1 batch */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Day 1 Batch <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={day1BatchId}
                          onChange={e => handleDay1Change(instrKey, e.target.value)}
                          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:border-orange-500 outline-none bg-white"
                        >
                          <option value="">— Select Day 1 batch —</option>
                          {instrBatches.map(b => (
                            <option key={b.id} value={String(b.id)}>
                              {b.recurrence}{(b as any).teacher_name ? ` · ${(b as any).teacher_name}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Day 2 batch */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Day 2 Batch <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <select
                          value={day2BatchId}
                          onChange={e => handleDay2Change(instrKey, e.target.value)}
                          disabled={!day1BatchId}
                          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:border-orange-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          <option value="">— None —</option>
                          {instrBatches
                            .filter(b => String(b.id) !== day1BatchId)
                            .map(b => (
                              <option key={b.id} value={String(b.id)}>
                                {b.recurrence}{(b as any).teacher_name ? ` · ${(b as any).teacher_name}` : ''}
                              </option>
                            ))}
                        </select>
                        {!day1BatchId && <p className="text-xs text-slate-400 mt-1">Select Day 1 batch first</p>}
                      </div>
                    </>
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

          {/* Summary */}
          {selectedBatches.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-orange-800 mb-2">Weekly Schedule</p>
              {selectedBatches.map((sel, _idx) => {
                const b = batches.find(bb => String(bb.id) === String(sel.batch_id));
                const inst = b ? instruments.find(i => String(i.id) === String(b.instrument_id)) : null;
                const instrBatchIds2 = new Set(batches.filter(bb => String(bb.instrument_id) === String(b?.instrument_id)).map(bb => String(bb.id)));
                const instrSelections = selectedBatches.filter(s => instrBatchIds2.has(String(s.batch_id)));
                const dayLabel = instrSelections.indexOf(sel) === 0 ? 'Day 1' : 'Day 2';
                return (
                  <div key={String(sel.batch_id)} className="text-xs text-orange-700 flex items-center gap-2 mb-1">
                    <span className="font-semibold bg-orange-200 text-orange-800 rounded px-1.5 py-0.5">{dayLabel}</span>
                    <span className="font-medium">{inst?.name}</span>
                    <span>·</span>
                    <span>{b?.recurrence}</span>
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
