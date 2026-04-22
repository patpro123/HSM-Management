import { useState, useEffect } from 'react';
import { apiGet, apiPut, apiPost } from '../api';

interface Teacher {
  id: string;
  name: string;
}

interface BatchSlot {
  id: string;
  classes_remaining: number;
  payment_frequency: string;
  recurrence: string;
  start_time: string;
  end_time: string;
  teacher_name: string;
}

interface PaymentInfo {
  id: string;
  payment_date: string;
  amount: number;
  metadata: {
    instrument?: string;
    period_start?: string;
    period_end?: string;
    classes_done?: number;
    [key: string]: unknown;
  };
  is_backfill: boolean;
}

interface MigrationRecord {
  student_id: string;
  student_name: string;
  instrument_id: string;
  instrument_name: string;
  classes_remaining: number;
  package_classes_count: number | null;
  attended_since_payment: number;
  batches: BatchSlot[];
  payment: PaymentInfo | null;
}

interface MigrationToolsProps {
  onRefresh?: () => void;
}

export default function MigrationTools({ onRefresh }: MigrationToolsProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    apiGet('/api/teachers')
      .then((data: { teachers: Teacher[] }) =>
        setTeachers((data.teachers || []).sort((a, b) => a.name.localeCompare(b.name)))
      )
      .catch(() => {/* sidebar still usable without teacher list */});
  }, []);

  // edit key: `${student_id}:${instrument_id}`
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [paymentDateVal, setPaymentDateVal] = useState('');

  const [editingClasses, setEditingClasses] = useState<string | null>(null);
  const [creditsBoughtVal, setCreditsBoughtVal] = useState('');

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchData = async (teacherId = selectedTeacherId) => {
    if (!teacherId) return;
    setLoading(true);
    setHasLoaded(true);
    try {
      const data = await apiGet(`/api/migration/data?teacher_id=${encodeURIComponent(teacherId)}`);
      setRecords(data);
    } catch (err: unknown) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setRecords([]);
    setHasLoaded(false);
    setEditingClasses(null);
    setEditingPayment(null);
    if (teacherId) fetchData(teacherId);
  };

  const editKey = (rec: MigrationRecord) => `${rec.student_id}:${rec.instrument_id}`;

  const startEditPayment = (rec: MigrationRecord) => {
    if (!rec.payment) return;
    setEditingPayment(editKey(rec));
    setEditingClasses(null);
    setPaymentDateVal(new Date(rec.payment.payment_date).toISOString().split('T')[0]);
  };

  const cancelEditPayment = () => {
    setEditingPayment(null);
    setPaymentDateVal('');
  };

  const savePaymentDate = async (rec: MigrationRecord) => {
    if (!rec.payment) return;
    try {
      await apiPut(`/api/migration/payment/${rec.payment.id}`, { payment_date: paymentDateVal });
      showMessage('success', 'Payment date updated');
      setEditingPayment(null);
      fetchData();
      onRefresh?.();
    } catch (err: unknown) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to update payment date');
    }
  };

  const startEditClasses = (rec: MigrationRecord) => {
    setEditingClasses(editKey(rec));
    setEditingPayment(null);
    const existing = rec.payment?.metadata?.credits_bought;
    setCreditsBoughtVal(
      existing !== undefined ? String(existing) :
      rec.package_classes_count !== null ? String(rec.package_classes_count) :
      ''
    );
  };

  const cancelEditClasses = () => {
    setEditingClasses(null);
    setCreditsBoughtVal('');
  };

  const saveCredits = async (rec: MigrationRecord) => {
    const val = parseInt(creditsBoughtVal, 10);
    if (isNaN(val) || val < 0) {
      showMessage('error', 'Enter a valid non-negative number');
      return;
    }
    try {
      if (rec.payment) {
        await apiPut(`/api/migration/payment/${rec.payment.id}/credits`, { credits_bought: val });
      } else {
        await apiPost('/api/migration/credits', {
          student_id: rec.student_id,
          instrument_id: rec.instrument_id,
          credits_bought: val,
        });
      }
      showMessage('success', 'Credits updated');
      setEditingClasses(null);
      fetchData();
      onRefresh?.();
    } catch (err: unknown) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to update credits');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Migration Data Correction</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin only — search any student and edit classes remaining or payment date per instrument.
        </p>
      </div>

      {/* Teacher filter */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedTeacherId}
          onChange={(e) => handleTeacherChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Select a teacher...</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {loading && <span className="text-sm text-gray-500">Loading...</span>}
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading students...</p>
      ) : !hasLoaded ? (
        <p className="text-gray-400 text-sm">Select a teacher to load their students.</p>
      ) : records.length === 0 ? (
        <p className="text-gray-500">No enrolled students found for this teacher.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="px-4 py-3 border-b">Student</th>
                <th className="px-4 py-3 border-b">Instrument</th>
                <th className="px-4 py-3 border-b">Payment Date</th>
                <th className="px-4 py-3 border-b">Period</th>
                <th className="px-4 py-3 border-b">Amount</th>
                <th className="px-4 py-3 border-b">Credits Bought</th>
                <th className="px-4 py-3 border-b">Available Credits</th>
                <th className="px-4 py-3 border-b">Batch Slots</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const key = editKey(rec);
                return (
                  <tr key={key} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {rec.student_name}
                      {rec.payment?.is_backfill ? (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          backfill
                        </span>
                      ) : (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          live
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{rec.instrument_name}</td>

                    {/* Payment Date — editable only for backfill records */}
                    <td className="px-4 py-3">
                      {rec.payment?.is_backfill ? (
                        editingPayment === key ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={paymentDateVal}
                              onChange={(e) => setPaymentDateVal(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                            <button
                              onClick={() => savePaymentDate(rec)}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditPayment}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">
                              {new Date(rec.payment.payment_date).toLocaleDateString('en-IN')}
                            </span>
                            <button
                              onClick={() => startEditPayment(rec)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Edit
                            </button>
                          </div>
                        )
                      ) : rec.payment ? (
                        <span className="text-sm text-gray-500">
                          {new Date(rec.payment.payment_date).toLocaleDateString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">No payment</span>
                      )}
                    </td>

                    {/* Period */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.payment?.metadata?.period_start && rec.payment?.metadata?.period_end
                        ? `${rec.payment.metadata.period_start} → ${rec.payment.metadata.period_end}`
                        : '—'}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {rec.payment ? `₹${Number(rec.payment.amount).toLocaleString('en-IN')}` : '—'}
                    </td>

                    {/* Credits Bought */}
                    <td className="px-4 py-3">
                      {editingClasses === key ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={creditsBoughtVal}
                            onChange={(e) => setCreditsBoughtVal(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 w-20 text-sm"
                          />
                          <button
                            onClick={() => saveCredits(rec)}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditClasses}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                          {!rec.payment && (
                            <span className="text-xs text-slate-400 italic">will create new record</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {rec.payment?.metadata?.credits_bought !== undefined
                              ? String(rec.payment.metadata.credits_bought)
                              : rec.package_classes_count !== null
                                ? rec.package_classes_count
                                : '—'}
                          </span>
                          <button
                            onClick={() => startEditClasses(rec)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Available Credits — dynamic: credits_bought - total_attendance */}
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${rec.classes_remaining <= 2 ? 'text-red-600' : 'text-green-700'}`}>
                        {rec.classes_remaining}
                      </span>
                    </td>

                    {/* Batch Slots — read-only */}
                    <td className="px-4 py-3">
                      {rec.batches.length === 0 ? (
                        <span className="text-sm text-gray-400 italic">None</span>
                      ) : (
                        <div className="space-y-1">
                          {rec.batches.map((batch) => (
                            <div key={batch.id} className="text-xs text-gray-500">
                              {batch.recurrence} · {batch.teacher_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
