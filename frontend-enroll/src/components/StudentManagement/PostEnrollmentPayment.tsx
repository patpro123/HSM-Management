import React, { useState } from 'react';
import { apiPost } from '../../api';

// One instrument the student has just enrolled in, with the package chosen for it
export interface PaymentItem {
  instrumentId: string;
  instrumentName: string;
  batchId: number | string;
  paymentFrequency: string;
  fee: number; // 0 when no fee is configured
  credits: number;
  location: 'hsm' | 'pbel';
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
];

const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-sm';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1';

// Amount and classes start as the package's own values and can be overwritten
const packageValues = (item: PaymentItem) => ({
  paymentFor: 'tuition',
  amount: item.fee ? String(item.fee) : '',
  classes: String(item.credits),
  notes: '',
});

interface PostEnrollmentPaymentProps {
  studentId: string;
  studentName: string;
  items: PaymentItem[];
  onPaymentRecorded: () => void;
  onFinish: (message: string) => void;
}

const PostEnrollmentPayment: React.FC<PostEnrollmentPaymentProps> = ({ studentId, studentName, items, onPaymentRecorded, onFinish }) => {
  const [paidIds, setPaidIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(items[0].instrumentId);
  const [fields, setFields] = useState(() => packageValues(items[0]));
  const [method, setMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [skipPayment, setSkipPayment] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const unpaid = items.filter(i => !paidIds.includes(i.instrumentId));
  const current = unpaid.find(i => i.instrumentId === selectedId) || unpaid[0];

  const amount = parseFloat(fields.amount) || 0;
  const classes = Number(fields.classes || 0);
  const isTuition = fields.paymentFor === 'tuition';
  const incomplete = skipPayment
    ? !skipReason.trim()
    : amount <= 0 || !Number.isInteger(classes) || classes < 0 || !paymentDate;

  const selectInstrument = (item: PaymentItem) => {
    setSelectedId(item.instrumentId);
    setFields(packageValues(item));
    setMessage(null);
  };

  const changePaymentFor = (paymentFor: string) => {
    // Registration, exam fees etc. have no package fee and add no classes
    setFields(paymentFor === 'tuition'
      ? { ...packageValues(current), notes: fields.notes }
      : { ...fields, paymentFor, amount: isTuition ? '' : fields.amount, classes: isTuition ? '0' : fields.classes });
  };

  const handleSubmit = async () => {
    if (incomplete) return;
    if (skipPayment) {
      onFinish(`Enrollment saved. Payment deferred — ${skipReason}`);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiPost('/api/payments', {
        student_id: studentId,
        amount,
        class_credits: classes,
        batch_id: current.batchId,
        payment_method: method,
        payment_for: fields.paymentFor,
        payment_frequency: isTuition
          ? (current.paymentFrequency === 'quarterly' ? 'quarterly' : 'monthly')
          : undefined,
        notes: fields.notes,
        payment_date: paymentDate,
        location: current.location,
      });
      onPaymentRecorded();

      // Only a tuition payment settles the instrument
      const stillUnpaid = isTuition ? unpaid.filter(i => i.instrumentId !== current.instrumentId) : unpaid;
      if (stillUnpaid.length === 0) {
        onFinish('Enrollment and payment recorded successfully!');
        return;
      }
      if (isTuition) setPaidIds(prev => [...prev, current.instrumentId]);
      const next = isTuition ? stillUnpaid[0] : current;
      setSelectedId(next.instrumentId);
      setFields(packageValues(next));
      setMessage({
        text: `₹${amount.toLocaleString()} recorded for ${current.instrumentName}. Tuition pending: ${stillUnpaid.map(i => i.instrumentName).join(', ')}.`,
        isError: false,
      });
    } catch (error) {
      console.error('Payment recording failed:', error);
      setMessage({
        text: `Payment recording failed: ${error instanceof Error ? error.message : String(error)}. The enrollment is saved.`,
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-green-50 border-b border-green-200 rounded-t-xl px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
          <div>
            <p className="font-bold text-green-800">Enrollment Confirmed!</p>
            <p className="text-sm text-green-700">{studentName} enrolled successfully.</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Record Payment</h3>
            {items.length > 1 && <p className="text-sm text-slate-500">One instrument per payment.</p>}
          </div>

          {message && (
            <div className={`px-3 py-2 rounded-lg text-sm border ${message.isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-2">
            {items.map(item => {
              const isPaid = paidIds.includes(item.instrumentId);
              const isSelected = !isPaid && current.instrumentId === item.instrumentId;
              return (
                <label
                  key={item.instrumentId}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 text-sm ${isPaid
                    ? 'border-green-200 bg-green-50'
                    : isSelected ? 'border-orange-500 bg-orange-50 cursor-pointer' : 'border-slate-200 cursor-pointer hover:border-orange-300'}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payInstrument"
                      checked={isSelected}
                      disabled={isPaid || saving}
                      onChange={() => selectInstrument(item)}
                    />
                    <span className="font-semibold text-slate-800">{item.instrumentName}</span>
                    <span className="text-xs text-slate-500">{item.credits} classes</span>
                    {isPaid && <span className="text-xs font-semibold text-green-700">✓ Paid</span>}
                  </span>
                  <span className="font-bold text-slate-900">{item.fee ? `₹${item.fee.toLocaleString()}` : 'No fee set'}</span>
                </label>
              );
            })}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipPayment}
              onChange={e => { setSkipPayment(e.target.checked); setSkipReason(''); }}
              className="w-4 h-4 text-orange-500 rounded"
            />
            <span className="text-sm font-medium text-slate-700">
              {paidIds.length > 0 ? 'Defer the remaining payment — collect later' : 'Defer payment — collect later'}
            </span>
          </label>

          {skipPayment ? (
            <div>
              <label className={labelClass}>Reason for deferring <span className="text-red-500">*</span></label>
              <textarea
                value={skipReason}
                onChange={e => setSkipReason(e.target.value)}
                placeholder="e.g. Parent will pay by end of week..."
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Amount (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fields.amount}
                    onChange={e => setFields({ ...fields, amount: e.target.value })}
                    placeholder="Any amount"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Classes to credit</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={fields.classes}
                    onChange={e => setFields({ ...fields, classes: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              {isTuition && current.fee > 0 && amount > 0 && amount !== current.fee && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Amount differs from the package fee of ₹{current.fee.toLocaleString()}. Classes are not
                  recalculated, so check the number of classes to credit.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Payment For</label>
                  <select value={fields.paymentFor} onChange={e => changePaymentFor(e.target.value)} className={inputClass}>
                    <option value="tuition">Tuition Fee</option>
                    <option value="registration">Registration</option>
                    <option value="exam">Exam Fee</option>
                    <option value="materials">Materials</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Payment Date</label>
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Payment Method</label>
                <div className="flex gap-2 flex-wrap">
                  {PAYMENT_METHODS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMethod(value)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${method === value ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-orange-400'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes (optional)</label>
                <input
                  type="text"
                  value={fields.notes}
                  onChange={e => setFields({ ...fields, notes: e.target.value })}
                  placeholder="Transaction ID, reference..."
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || incomplete}
            className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Processing...' : skipPayment ? 'Save & Defer Payment' : `Record ${current.instrumentName} Payment · ₹${amount.toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostEnrollmentPayment;
