import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '../../api';
import { Expense, Teacher, TeacherPayslip, TeacherPayoutRecord } from './types';

interface ExpensesTabProps {
  expenses: Expense[];
  selectedMonth: string;
  newExpense: { category: string; amount: string; date: string; notes: string };
  onNewExpenseChange: (updated: { category: string; amount: string; date: string; notes: string }) => void;
  onAddExpense: (e: React.FormEvent) => void;
  onDeleteExpense: (id: string) => void;
  formatCurrency: (val: number) => string;
  teachers: Teacher[];
  onPayoutRecorded: () => void;
}

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'upi', 'cheque'];

function fmt(val: number) {
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

// ── Payslip Summary Card ──────────────────────────────────────────────────────

const PayslipSummaryCard: React.FC<{ payslip: TeacherPayslip; formatCurrency: (v: number) => string }> = ({
  payslip,
  formatCurrency,
}) => {
  const { teacher, instruments, summary } = payslip;

  const totalBatches = instruments.reduce(
    (s, inst) => s + inst.batches.reduce((bs, b) => bs + b.attendance.conducted, 0),
    0
  );

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Payment Breakdown</p>

      {/* Per-instrument breakdown */}
      {teacher.payout_type === 'per_student_monthly' ? (
        <div className="space-y-2">
          {instruments.map(inst => {
            const conducted = inst.batches.reduce((s, b) => s + b.attendance.conducted, 0);
            return (
              <div key={inst.instrument_id} className="bg-white rounded p-3 text-sm space-y-1">
                <div className="flex justify-between font-medium text-slate-800">
                  <span>{inst.instrument_name}</span>
                  <span className="text-indigo-700">{formatCurrency(inst.instrument_subtotal)}</span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>{inst.billable_count} billable student{inst.billable_count !== 1 ? 's' : ''}</span>
                  <span>{conducted} class{conducted !== 1 ? 'es' : ''} conducted</span>
                  {inst.students.filter(s => s.status === 'deferred').length > 0 && (
                    <span className="text-amber-600">
                      {inst.students.filter(s => s.status === 'deferred').length} deferred
                    </span>
                  )}
                  {inst.students.filter(s => s.status === 'excluded').length > 0 && (
                    <span className="text-slate-400">
                      {inst.students.filter(s => s.status === 'excluded').length} excluded
                    </span>
                  )}
                </div>
                {/* Per-student rate hint */}
                {inst.billable_count > 0 && (
                  <div className="text-xs text-slate-400">
                    {teacher.per_student_rate_type === 'fixed'
                      ? `${fmt(teacher.per_student_fixed_rate)} fixed rate per student`
                      : `${Math.round(teacher.payout_percentage * 100)}% of (fee − ${fmt(teacher.maintenance_amount)})`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded p-3 text-sm flex justify-between">
          <span className="text-slate-700">Fixed Monthly Salary</span>
          <span className="font-semibold text-indigo-700">{formatCurrency(summary.fixed_salary!)}</span>
        </div>
      )}

      {/* Totals row */}
      <div className="flex flex-wrap gap-4 pt-1 border-t border-indigo-100 text-xs text-slate-600">
        <span>{summary.billable_count} billable</span>
        {summary.deferred_count > 0 && <span className="text-amber-600">{summary.deferred_count} deferred</span>}
        {summary.excluded_count > 0 && <span className="text-slate-400">{summary.excluded_count} excluded</span>}
        <span>{totalBatches} total class{totalBatches !== 1 ? 'es' : ''} conducted</span>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-indigo-200">
        <span className="text-sm font-bold text-slate-700">Total Payable</span>
        <span className="text-xl font-bold text-indigo-700">{formatCurrency(summary.total_payable)}</span>
      </div>
    </div>
  );
};

// ── Pay Teacher Panel ─────────────────────────────────────────────────────────

const PayTeacherPanel: React.FC<{
  teachers: Teacher[];
  selectedMonth: string;
  formatCurrency: (v: number) => string;
  onPayoutRecorded: () => void;
}> = ({ teachers, selectedMonth, formatCurrency, onPayoutRecorded }) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [payslip, setPayslip] = useState<TeacherPayslip | null>(null);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [paymentProof, setPaymentProof] = useState<string>('');
  const [proofFileName, setProofFileName] = useState('');
  const [loadingPayslip, setLoadingPayslip] = useState(false);
  const [payslipError, setPayslipError] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payouts, setPayouts] = useState<TeacherPayoutRecord[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPayouts = useCallback(async () => {
    try {
      const data = await apiGet(`/api/finance/teacher-payouts?month=${selectedMonth}`);
      setPayouts(data.payouts || []);
    } catch {
      // non-critical
    }
  }, [selectedMonth]);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  useEffect(() => {
    if (!selectedTeacherId) {
      setPayslip(null);
      setOverrideAmount('');
      setPayslipError(false);
      return;
    }
    setLoadingPayslip(true);
    setPayslip(null);
    setPayslipError(false);
    setOverrideAmount('');
    apiGet(`/api/finance/payslip/${selectedTeacherId}?month=${selectedMonth}`)
      .then((data: TeacherPayslip) => setPayslip(data))
      .catch(() => setPayslipError(true))
      .finally(() => setLoadingPayslip(false));
  }, [selectedTeacherId, selectedMonth]);

  const calculatedAmount = payslip?.summary.total_payable ?? null;
  const effectiveAmount = overrideAmount !== '' ? parseFloat(overrideAmount) : calculatedAmount;
  const isOverriding = overrideAmount !== '' && calculatedAmount !== null && parseFloat(overrideAmount) !== calculatedAmount;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Screenshot must be under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentProof(reader.result as string);
      setProofFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const [year, month] = selectedMonth.split('-').map(Number);
  const periodStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const periodEnd   = new Date(year, month, 0).toISOString().slice(0, 10);

  const handlePay = async () => {
    if (!selectedTeacherId || effectiveAmount == null || isNaN(effectiveAmount)) return;
    if (isOverriding && !overrideReason.trim()) {
      setErrorMsg('Please provide a reason for overriding the calculated amount.');
      return;
    }
    setPaying(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiPost('/api/finance/teacher-payouts', {
        teacher_id: selectedTeacherId,
        amount: effectiveAmount,
        method,
        period_start: periodStart,
        period_end: periodEnd,
        override_reason: isOverriding ? overrideReason.trim() : undefined,
        payment_proof: paymentProof || undefined,
      });
      const teacherName = teachers.find(t => t.id === selectedTeacherId)?.name || '';
      setSuccessMsg(`Payment of ${formatCurrency(effectiveAmount)} recorded for ${teacherName}.`);
      setSelectedTeacherId('');
      setPayslip(null);
      setOverrideAmount('');
      setOverrideReason('');
      setPaymentProof('');
      setProofFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPayouts();
      onPayoutRecorded();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pay form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h3 className="font-bold text-slate-800">Pay Teacher</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Teacher</label>
            <select
              value={selectedTeacherId}
              onChange={e => setSelectedTeacherId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">— select teacher —</option>
              {teachers.filter(t => t.is_active).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading state */}
        {loadingPayslip && (
          <p className="text-sm text-slate-400 animate-pulse">Calculating payslip…</p>
        )}

        {/* Payslip failed — show warning + manual amount field */}
        {payslipError && !loadingPayslip && (
          <div className="space-y-3">
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Could not calculate the payslip automatically. Enter the amount to pay manually.
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="Enter amount"
                value={overrideAmount}
                onChange={e => setOverrideAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Payslip summary + override */}
        {payslip && !loadingPayslip && (
          <div className="space-y-4">
            <PayslipSummaryCard payslip={payslip} formatCurrency={formatCurrency} />

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Override Amount (₹)
                <span className="font-normal text-slate-400 ml-1">— leave blank to use calculated amount</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder={calculatedAmount !== null ? String(Math.round(calculatedAmount)) : ''}
                value={overrideAmount}
                onChange={e => setOverrideAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {isOverriding && (
              <div>
                <label className="block text-xs font-semibold text-amber-600 mb-1">
                  Reason for override (required)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advance deducted, bonus added…"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>
            )}

            {effectiveAmount !== null && !isNaN(effectiveAmount) && (
              <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">Amount to Pay</span>
                <span className={`text-xl font-bold ${isOverriding ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {formatCurrency(effectiveAmount)}
                  {isOverriding && <span className="text-xs font-normal text-amber-500 ml-2">(overridden)</span>}
                </span>
              </div>
            )}
          </div>
        )}

        {/* UPI screenshot upload */}
        {selectedTeacherId && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Payment Proof (optional)
              <span className="font-normal text-slate-400 ml-1">— UPI screenshot or receipt</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition"
              >
                {proofFileName ? 'Change File' : 'Upload Screenshot'}
              </button>
              {proofFileName && (
                <span className="text-xs text-emerald-600 font-medium">{proofFileName}</span>
              )}
              {paymentProof && (
                <button
                  type="button"
                  onClick={() => setViewingProof(paymentProof)}
                  className="text-xs text-indigo-600 underline"
                >
                  Preview
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {errorMsg && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">{successMsg}</div>
        )}

        <button
          onClick={handlePay}
          disabled={paying || !selectedTeacherId || effectiveAmount == null || isNaN(Number(effectiveAmount))}
          className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {paying ? 'Recording…' : 'Record Payment'}
        </button>
      </div>

      {/* Payout history for selected month */}
      {payouts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Teacher Payments — {selectedMonth}</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {payouts.map(p => (
              <div key={p.id} className="flex gap-4 px-4 py-4 hover:bg-slate-50 items-start">
                {/* Thumbnail — always reserve the column so layout is stable */}
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                  {p.payment_proof ? (
                    <button
                      onClick={() => setViewingProof(p.payment_proof!)}
                      className="w-full h-full"
                      title="Click to enlarge"
                    >
                      <img
                        src={p.payment_proof}
                        alt="Payment proof"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300 text-center leading-tight px-1">No proof</span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-slate-800">{p.teacher_name}</span>
                    <span className="font-bold text-slate-800 ml-4 shrink-0">{formatCurrency(parseFloat(p.amount))}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
                    <span className="capitalize">{p.method?.replace('_', ' ')}</span>
                    <span>·</span>
                    <span>{new Date(p.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  {p.override_reason && (
                    <p className="text-xs text-amber-600">Override: {p.override_reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proof image modal */}
      {viewingProof && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingProof(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewingProof(null)}
              className="absolute -top-8 right-0 text-white text-sm font-medium"
            >
              Close ✕
            </button>
            <img src={viewingProof} alt="Payment proof" className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main ExpensesTab ──────────────────────────────────────────────────────────

const ExpensesTab: React.FC<ExpensesTabProps> = ({
  expenses,
  selectedMonth,
  newExpense,
  onNewExpenseChange,
  onAddExpense,
  onDeleteExpense,
  formatCurrency,
  teachers,
  onPayoutRecorded,
}) => {
  const [section, setSection] = useState<'misc' | 'teachers'>('misc');

  return (
    <div className="space-y-4">
      {/* Section toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setSection('misc')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            section === 'misc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Miscellaneous Expenses
        </button>
        <button
          onClick={() => setSection('teachers')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            section === 'teachers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pay Teachers
        </button>
      </div>

      {section === 'misc' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Fixed Costs for {selectedMonth}</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses
                  .filter(e => e.date.startsWith(selectedMonth))
                  .map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{expense.category}</td>
                    <td className="px-6 py-4 text-slate-600">{expense.date}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{expense.notes || '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onDeleteExpense(expense.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.filter(e => e.date.startsWith(selectedMonth)).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No expenses recorded for this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 h-fit">
            <h3 className="font-bold text-slate-800 mb-4">Add New Expense</h3>
            <form onSubmit={onAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Rent, Electricity"
                  value={newExpense.category}
                  onChange={e => onNewExpenseChange({ ...newExpense, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newExpense.amount}
                  onChange={e => onNewExpenseChange({ ...newExpense, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={e => onNewExpenseChange({ ...newExpense, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={newExpense.notes}
                  onChange={e => onNewExpenseChange({ ...newExpense, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
                Add Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {section === 'teachers' && (
        <PayTeacherPanel
          teachers={teachers}
          selectedMonth={selectedMonth}
          formatCurrency={formatCurrency}
          onPayoutRecorded={onPayoutRecorded}
        />
      )}
    </div>
  );
};

export default ExpensesTab;
