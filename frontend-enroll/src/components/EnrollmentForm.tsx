import React, { useState, useEffect } from 'react';
import { apiPut, apiPost, apiGet } from '../api';
import { Student, Batch, Instrument } from '../types';

interface EnrollmentFormProps {
  students: Student[];
  batches: Batch[];
  instruments: Instrument[];
  onRefresh: () => void;
}

const TRINITY_GRADES = [
  'Initial', 'Grade 1', 'Grade 2', 'Grade 3',
  'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
];

type PaymentType = 'trial' | 'quarterly' | 'pbel_4' | 'pbel_8';

interface EnrollmentItem {
  batch_id: number;
  instrument_id: string | number;
  payment_type: PaymentType;
  trinity_grade: string;
  fee_structure_id?: string;
}

interface EnrollmentData {
  student_id: number | null;
  enrollments: EnrollmentItem[];
}

interface PaymentFormData {
  method: 'cash' | 'upi' | 'bank_transfer';
  notes: string;
  skipPayment: boolean;
  skipReason: string;
}

const VOCAL_INSTRUMENTS = ['Hindustani Vocals', 'Carnatic Vocals'];

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ students, batches, instruments, onRefresh }) => {
  const [step, setStep] = useState(1);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData>({ student_id: null, enrollments: [] });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Per-instrument grade and payment type (controls shown at instrument level)
  const [instrGrades, setInstrGrades] = useState<Record<string, string>>({});
  const [instrPayTypes, setInstrPayTypes] = useState<Record<string, PaymentType>>({});
  const [instrFees, setInstrFees] = useState<Record<string, { fee_amount: number; fee_structure_id: string } | null>>({});

  const [branches, setBranches] = useState<Array<{id: string; name: string; code: string}>>([]);
  const [mainBranchId, setMainBranchId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Payment step state
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    method: 'cash',
    notes: '',
    skipPayment: false,
    skipReason: '',
  });

  useEffect(() => {
    apiGet('/api/fee-structures/branches')
      .then(data => {
        const branchList = data.branches || [];
        setBranches(branchList);
        const main = branchList.find((b: any) => b.code === 'main');
        if (main) {
          setMainBranchId(main.id);
          setSelectedBranchId(main.id);
        }
      })
      .catch(() => {});
  }, []);

  const isVocalInstrument = (instrumentId: string | number) =>
    VOCAL_INSTRUMENTS.includes(instruments.find(i => String(i.id) === String(instrumentId))?.name || '');

  const resolveFee = async (instrumentId: string | number, grade: string, payType: PaymentType) => {
    const branchId = selectedBranchId;
    if (!branchId) return;
    const instrKey = String(instrumentId);
    const isTrial = payType === 'trial';
    const isVocal = isVocalInstrument(instrumentId);

    let resolveGrade: string;
    let classesCount: number;
    if (isTrial) {
      resolveGrade = 'Initial';
      classesCount = 4;
    } else if (payType === 'pbel_4') {
      resolveGrade = 'Fixed';
      classesCount = 4;
    } else if (payType === 'pbel_8') {
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
      const resolved = { fee_amount: data.fee_structure.fee_amount, fee_structure_id: data.fee_structure.id };
      setInstrFees(prev => ({ ...prev, [instrKey]: resolved }));
      setEnrollmentData(prev => ({
        ...prev,
        enrollments: prev.enrollments.map(e =>
          String(e.instrument_id) === instrKey
            ? { ...e, fee_structure_id: resolved.fee_structure_id, payment_type: payType, trinity_grade: resolveGrade }
            : e
        )
      }));
    } catch {
      setInstrFees(prev => ({ ...prev, [instrKey]: null }));
    }
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setEnrollmentData(prev => ({ ...prev, enrollments: [] }));
    setInstrGrades({});
    setInstrPayTypes({});
    setInstrFees({});
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setEnrollmentData({ student_id: student.id as number, enrollments: [] });
    setInstrGrades({});
    setInstrPayTypes({});
    setInstrFees({});
    setSelectedBranchId(mainBranchId);
    setStep(2);
  };

  const makeEnrollmentItem = (batchId: number, instrumentId: string | number): EnrollmentItem => {
    const instrKey = String(instrumentId);
    const grade = instrGrades[instrKey] || 'Initial';
    const payType = instrPayTypes[instrKey] || 'quarterly';
    const feeResolved = instrFees[instrKey];
    return {
      batch_id: batchId,
      instrument_id: instrumentId,
      payment_type: payType,
      trinity_grade: isVocalInstrument(instrumentId) ? 'Fixed' : grade,
      fee_structure_id: feeResolved?.fee_structure_id,
    };
  };

  const handleDay1Change = (instrumentId: string | number, batchId: string) => {
    const instrKey = String(instrumentId);
    const others = enrollmentData.enrollments.filter(e => String(e.instrument_id) !== instrKey);
    const day2 = enrollmentData.enrollments.filter(e => String(e.instrument_id) === instrKey)[1];
    if (!batchId) {
      setEnrollmentData({ ...enrollmentData, enrollments: others });
      setInstrFees(prev => { const { [instrKey]: _, ...rest } = prev; return rest; });
      return;
    }
    const batchIdNum = Number(batchId);
    if (!instrFees[instrKey]) resolveFee(instrumentId, instrGrades[instrKey] || 'Initial', instrPayTypes[instrKey] || 'quarterly');
    const day1 = makeEnrollmentItem(batchIdNum, instrumentId);
    const newEnrollments = [day1];
    if (day2 && day2.batch_id !== batchIdNum) newEnrollments.push(day2);
    setEnrollmentData({ ...enrollmentData, enrollments: [...others, ...newEnrollments] });
  };

  const handleDay2Change = (instrumentId: string | number, batchId: string) => {
    const instrKey = String(instrumentId);
    const others = enrollmentData.enrollments.filter(e => String(e.instrument_id) !== instrKey);
    const day1 = enrollmentData.enrollments.filter(e => String(e.instrument_id) === instrKey)[0];
    if (!day1) return;
    if (!batchId) {
      setEnrollmentData({ ...enrollmentData, enrollments: [...others, day1] });
      return;
    }
    const batchIdNum = Number(batchId);
    const day2 = makeEnrollmentItem(batchIdNum, instrumentId);
    setEnrollmentData({ ...enrollmentData, enrollments: [...others, day1, day2] });
  };

  const handleGradeChange = (instrumentId: string | number, grade: string) => {
    const instrKey = String(instrumentId);
    setInstrGrades(prev => ({ ...prev, [instrKey]: grade }));
    const payType = instrPayTypes[instrKey] || 'quarterly';
    // Update all selected enrollments for this instrument
    setEnrollmentData(prev => ({
      ...prev,
      enrollments: prev.enrollments.map(e =>
        String(e.instrument_id) === instrKey ? { ...e, trinity_grade: grade } : e
      )
    }));
    resolveFee(instrumentId, grade, payType);
  };

  const handlePayTypeChange = (instrumentId: string | number, payType: PaymentType) => {
    const instrKey = String(instrumentId);
    setInstrPayTypes(prev => ({ ...prev, [instrKey]: payType }));
    const grade = instrGrades[instrKey] || 'Initial';
    // Update all selected enrollments for this instrument
    setEnrollmentData(prev => ({
      ...prev,
      enrollments: prev.enrollments.map(e =>
        String(e.instrument_id) === instrKey ? { ...e, payment_type: payType } : e
      )
    }));
    resolveFee(instrumentId, grade, payType);
  };

  const totalAmount = enrollmentData.enrollments.reduce((sum, e) => {
    const fee = instrFees[String(e.instrument_id)];
    return sum + (fee?.fee_amount || 0);
  }, 0);

  const handleEnrollmentSubmit = async () => {
    if (!enrollmentData.student_id || enrollmentData.enrollments.length === 0) return;
    setSubmitting(true);
    try {
      const batches = enrollmentData.enrollments.map(e => ({
        batch_id: e.batch_id,
        payment_frequency: e.payment_type,
        trinity_grade: e.trinity_grade,
        fee_structure_id: e.fee_structure_id || null,
        enrolled_on: new Date().toISOString(),
      }));
      await apiPut(`/api/students/${enrollmentData.student_id}`, { batches });
      setStep(4);
    } catch (error: any) {
      console.error('Enrollment failed:', error);
      alert(`Enrollment failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (paymentForm.skipPayment && !paymentForm.skipReason.trim()) {
      alert('Please provide a reason for skipping payment.');
      return;
    }
    setSubmitting(true);
    try {
      if (!paymentForm.skipPayment) {
        await apiPost('/api/payments', {
          student_id: String(enrollmentData.student_id),
          amount: totalAmount,
          payment_method: paymentForm.method,
          payment_for: 'tuition',
          notes: paymentForm.notes,
          payment_frequency: enrollmentData.enrollments.some(e => e.payment_type === 'quarterly') ? 'quarterly' : 'monthly',
          payment_date: new Date().toISOString().split('T')[0],
        });
      }
      // Reset the whole form
      setStep(1);
      setSelectedStudent(null);
      setEnrollmentData({ student_id: null, enrollments: [] });
      setSearchTerm('');
      setInstrGrades({});
      setInstrPayTypes({});
      setInstrFees({});
      setPaymentForm({ method: 'cash', notes: '', skipPayment: false, skipReason: '' });
      onRefresh();
      alert(paymentForm.skipPayment
        ? `Enrollment saved. Payment deferred (${paymentForm.skipReason}).`
        : 'Enrollment and payment recorded successfully!');
    } catch (error: any) {
      console.error('Payment failed:', error);
      alert(`Payment recording failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const fullName = student.first_name && student.last_name
      ? `${student.first_name} ${student.last_name}`
      : (student as any).name || '';
    return fullName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const batchesByInstrument = instruments
    .filter(instrument => !instrument.is_deprecated)
    .map(instrument => ({
      instrument,
      batches: batches.filter(batch => batch.instrument_id === instrument.id)
    }))
    .filter(group => group.batches.length > 0);

  const getStudentDisplayName = (student: Student) =>
    student.first_name && student.last_name
      ? `${student.first_name} ${student.last_name}`
      : (student as any).name || 'Unknown';

  const getStudentInitials = (student: Student) => {
    if (student.first_name && student.last_name)
      return `${student.first_name[0]}${student.last_name[0]}`;
    const name = (student as any).name || 'N A';
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.substring(0, 2).toUpperCase();
  };

  const stepLabels = ['Select Student', 'Select Batches', 'Confirm', 'Record Payment'];

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
        {stepLabels.map((label, idx) => {
          const stepNum = idx + 1;
          return (
            <React.Fragment key={stepNum}>
              <div className={`flex items-center gap-2 ${step >= stepNum ? 'text-indigo-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= stepNum ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
                  {step > stepNum ? '✓' : stepNum}
                </div>
                <span className="font-semibold text-sm hidden sm:block">{label}</span>
              </div>
              {idx < stepLabels.length - 1 && <div className="w-8 h-1 bg-slate-200 hidden sm:block" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Student Selection */}
      {step === 1 && (
        <div>
          {/* Branch Selector */}
          {branches.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Branch</label>
              <div className="flex gap-3 flex-wrap">
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => handleBranchChange(branch.id)}
                    className={`px-5 py-2.5 rounded-lg border-2 font-semibold text-sm transition ${
                      selectedBranchId === branch.id
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-xl font-bold text-slate-800 mb-4">Select a Student</h3>
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none mb-6"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map(student => (
              <div
                key={student.id}
                onClick={() => handleStudentSelect(student)}
                className="p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold">
                    {getStudentInitials(student)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{getStudentDisplayName(student)}</p>
                    <p className="text-xs text-slate-500">{student.email || (student as any).metadata?.email || 'No email'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Batch & Package Selection */}
      {step === 2 && selectedStudent && (
        <div>
          {/* Selected student banner */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-lg">
                {getStudentInitials(selectedStudent)}
              </div>
              <div>
                <p className="font-bold text-slate-900">{getStudentDisplayName(selectedStudent)}</p>
                <p className="text-sm text-slate-600">{selectedStudent.email || (selectedStudent as any).metadata?.email || 'No email'}</p>
                {branches.length > 1 && (
                  <span className="inline-block mt-1 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded px-2 py-0.5">
                    {branches.find(b => b.id === selectedBranchId)?.name || 'Branch'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { setStep(1); setSelectedStudent(null); setEnrollmentData({ student_id: null, enrollments: [] }); }}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
            >
              Change
            </button>
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-2">Select Instrument & Package</h3>
          <p className="text-sm text-slate-500 mb-6">For each instrument, set the student's level (in consultation with the teacher) and choose a package before selecting the batch time.</p>

          <div className="space-y-6">
            {batchesByInstrument.map(({ instrument, batches: instrBatches }) => {
              const instrKey = String(instrument.id);
              const isVocal = VOCAL_INSTRUMENTS.includes(instrument.name);
              const currentGrade = instrGrades[instrKey] || 'Initial';
              const currentPayType = instrPayTypes[instrKey] || 'quarterly';
              const feeInfo = instrFees[instrKey];
              const hasSelectedBatch = enrollmentData.enrollments.some(e => String(e.instrument_id) === instrKey);

              return (
                <div key={instrument.id} className={`rounded-xl border-2 transition ${hasSelectedBatch ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'} p-5`}>
                  <h4 className="text-lg font-bold text-slate-800 mb-4">
                    {instrument.name}
                  </h4>

                  {/* Student Level (Trinity Grade) — non-vocal only */}
                  {!isVocal && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Student's Level
                        <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">Confirm with teacher</span>
                      </label>
                      <select
                        value={currentGrade}
                        onChange={e => handleGradeChange(instrument.id, e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white w-full max-w-xs"
                      >
                        {TRINITY_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Package Type */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Package</label>
                    {(() => {
                      const isPbel = branches.find(b => b.id === selectedBranchId)?.code === 'pbel';
                      const packageOptions: Array<{ type: PaymentType; label: string; sub: string }> = isPbel
                        ? [
                            { type: 'trial',  label: 'Trial Session',    sub: '4 classes · 2 weeks' },
                            { type: 'pbel_4', label: '4-Class Package',  sub: '4 classes · ₹1,600' },
                            { type: 'pbel_8', label: '8-Class Package',  sub: '8 classes · ₹2,990' },
                          ]
                        : [
                            { type: 'trial',     label: 'Trial Session',      sub: '4 classes · 2 weeks' },
                            { type: 'quarterly', label: 'Quarterly Package',   sub: '24 classes · 3 months' },
                          ];
                      return (
                        <div className="flex gap-3 flex-wrap">
                          {packageOptions.map(({ type: pt, label, sub }) => (
                            <button
                              key={pt}
                              type="button"
                              onClick={() => handlePayTypeChange(instrument.id, pt)}
                              className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition flex flex-col items-start gap-0.5 min-w-[140px] ${
                                currentPayType === pt
                                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                              }`}
                            >
                              <span>{label}</span>
                              <span className={`text-xs font-normal ${currentPayType === pt ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {sub}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Resolved Fee */}
                  <div className="mb-4">
                    {feeInfo ? (
                      <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm">
                        <span className="text-green-600 font-medium">Fee:</span>
                        <span className="text-green-800 font-bold text-base">₹{feeInfo.fee_amount.toLocaleString()}</span>
                        <span className="text-green-600">
                          for {currentPayType === 'quarterly' ? '24' : currentPayType === 'pbel_8' ? '8' : '4'} classes
                        </span>
                      </div>
                    ) : feeInfo === null ? (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        No fee configured for this combination — check Fee Rates in Finance.
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">Select a package to see the fee.</div>
                    )}
                  </div>

                  {/* Day 1 + Day 2 batch dropdowns */}
                  {instrBatches.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No batches available for this instrument.</p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          Day 1 Batch <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={enrollmentData.enrollments.filter(e => String(e.instrument_id) === instrKey)[0]?.batch_id?.toString() || ''}
                          onChange={e => handleDay1Change(instrument.id, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white text-sm"
                        >
                          <option value="">— Select Day 1 batch —</option>
                          {instrBatches.map(batch => (
                            <option key={batch.id} value={String(batch.id)}>
                              {(batch as any).recurrence || `${batch.day_of_week} ${batch.start_time}–${batch.end_time}`}
                              {(batch as any).teacher_name ? ` · ${(batch as any).teacher_name}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          Day 2 Batch <span className="text-slate-400 font-normal text-xs">(optional)</span>
                        </label>
                        {(() => {
                          const day1Id = enrollmentData.enrollments.filter(e => String(e.instrument_id) === instrKey)[0]?.batch_id?.toString() || '';
                          const day2Id = enrollmentData.enrollments.filter(e => String(e.instrument_id) === instrKey)[1]?.batch_id?.toString() || '';
                          return (
                            <select
                              value={day2Id}
                              onChange={e => handleDay2Change(instrument.id, e.target.value)}
                              disabled={!day1Id}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                              <option value="">— None —</option>
                              {instrBatches
                                .filter(b => String(b.id) !== day1Id)
                                .map(batch => (
                                  <option key={batch.id} value={String(batch.id)}>
                                    {(batch as any).recurrence || `${batch.day_of_week} ${batch.start_time}–${batch.end_time}`}
                                    {(batch as any).teacher_name ? ` · ${(batch as any).teacher_name}` : ''}
                                  </option>
                                ))}
                            </select>
                          );
                        })()}
                        {!enrollmentData.enrollments.some(e => String(e.instrument_id) === instrKey) && (
                          <p className="text-xs text-slate-400 mt-1">Select Day 1 batch first</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-8">
            <button onClick={() => setStep(1)} className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={enrollmentData.enrollments.length === 0}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              Review Enrollment
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && selectedStudent && (
        <div>
          <h3 className="text-xl font-bold text-slate-800 mb-6">Confirm Enrollment</h3>

          <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xl">
                {getStudentInitials(selectedStudent)}
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{getStudentDisplayName(selectedStudent)}</p>
                <p className="text-slate-600 text-sm">{selectedStudent.email || (selectedStudent as any).metadata?.email || 'No email'}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              {enrollmentData.enrollments.map(enrollment => {
                const batch = batches.find(b => Number(b.id) === enrollment.batch_id);
                if (!batch) return null;
                const instrument = instruments.find(i => String(i.id) === String(batch.instrument_id));
                const feeInfo = instrFees[String(enrollment.instrument_id)];

                return (
                  <div key={batch.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900">{instrument?.name}</p>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {batch.day_of_week} · {batch.start_time}–{batch.end_time}
                        </p>
                        <p className="text-sm text-slate-600">
                          Level: <span className="font-medium">{enrollment.trinity_grade === 'Fixed' ? 'Standard' : enrollment.trinity_grade}</span>
                        </p>
                        <p className="text-sm text-indigo-600 font-semibold mt-1">
                          {enrollment.payment_type === 'trial' ? 'Trial Session (4 classes)'
                            : enrollment.payment_type === 'pbel_4' ? '4-Class Package (PBEL)'
                            : enrollment.payment_type === 'pbel_8' ? '8-Class Package (PBEL)'
                            : 'Quarterly Package (24 classes)'}
                        </p>
                      </div>
                      <div className="text-right">
                        {feeInfo ? (
                          <p className="text-lg font-bold text-slate-900">₹{feeInfo.fee_amount.toLocaleString()}</p>
                        ) : (
                          <p className="text-sm text-amber-600">Fee TBD</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Total */}
              {totalAmount > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <span className="font-bold text-slate-800 text-lg">Total Due</span>
                  <span className="font-bold text-indigo-700 text-xl">₹{totalAmount.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep(2)} className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition">
              Back
            </button>
            <button
              onClick={handleEnrollmentSubmit}
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg disabled:bg-slate-400"
            >
              {submitting ? 'Saving...' : 'Confirm Enrollment'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Record Payment */}
      {step === 4 && selectedStudent && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-lg">✓</div>
            <div>
              <p className="font-bold text-green-800">Enrollment Confirmed!</p>
              <p className="text-sm text-green-700">{getStudentDisplayName(selectedStudent)} has been enrolled successfully.</p>
            </div>
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-2">Record Payment</h3>
          <p className="text-sm text-slate-500 mb-6">Collect payment now or record a reason if payment is deferred.</p>

          {/* Amount Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
            <h4 className="font-semibold text-slate-700 mb-3">Amount Due</h4>
            {enrollmentData.enrollments.map(enrollment => {
              const batch = batches.find(b => Number(b.id) === enrollment.batch_id);
              const instrument = instruments.find(i => String(i.id) === String(enrollment.instrument_id));
              const feeInfo = instrFees[String(enrollment.instrument_id)];
              return (
                <div key={enrollment.batch_id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="font-medium text-slate-800">{instrument?.name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {enrollment.payment_type === 'trial' ? 'Trial (4 cls)'
                        : enrollment.payment_type === 'pbel_4' ? 'PBEL (4 cls)'
                        : enrollment.payment_type === 'pbel_8' ? 'PBEL (8 cls)'
                        : 'Quarterly (24 cls)'}
                      {batch ? ` · ${batch.day_of_week}` : ''}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">
                    {feeInfo ? `₹${feeInfo.fee_amount.toLocaleString()}` : '—'}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="font-bold text-slate-800">Total</span>
              <span className="font-bold text-indigo-700 text-xl">₹{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Skip Toggle */}
          <label className="flex items-center gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={paymentForm.skipPayment}
              onChange={e => setPaymentForm({ ...paymentForm, skipPayment: e.target.checked, skipReason: '' })}
              className="w-5 h-5 text-indigo-600 rounded"
            />
            <span className="font-medium text-slate-700">Defer payment — collect later</span>
          </label>

          {paymentForm.skipPayment ? (
            /* Skip reason */
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Reason for deferring payment <span className="text-red-500">*</span>
              </label>
              <textarea
                value={paymentForm.skipReason}
                onChange={e => setPaymentForm({ ...paymentForm, skipReason: e.target.value })}
                placeholder="e.g. Parent will pay by end of week, UPI not available today..."
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none"
              />
            </div>
          ) : (
            /* Payment form */
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
                <div className="flex gap-3 flex-wrap">
                  {(['cash', 'upi', 'bank_transfer'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, method: m })}
                      className={`px-5 py-2 rounded-lg border-2 font-semibold text-sm transition ${
                        paymentForm.method === m
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {m === 'cash' ? 'Cash' : m === 'upi' ? 'UPI' : 'Bank Transfer'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Transaction ID, reference, etc."
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                />
              </div>
            </div>
          )}

          <button
            onClick={handlePaymentSubmit}
            disabled={submitting || (paymentForm.skipPayment && !paymentForm.skipReason.trim())}
            className="w-full px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Processing...'
              : paymentForm.skipPayment
                ? 'Save & Skip Payment'
                : `Record Payment · ₹${totalAmount.toLocaleString()}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default EnrollmentForm;
