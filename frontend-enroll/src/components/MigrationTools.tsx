import { useState } from 'react';
import { apiGet, apiPut } from '../api';

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
  batches: BatchSlot[];
  payment: PaymentInfo | null;
}

export default function MigrationTools() {
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // edit key: `${student_id}:${instrument_id}`
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [paymentDateVal, setPaymentDateVal] = useState('');

  const [editingClasses, setEditingClasses] = useState<string | null>(null);
  const [classesVal, setClassesVal] = useState('');

  // Set when non-backfill record needs overwrite confirmation
  const [confirmingOverwrite, setConfirmingOverwrite] = useState<string | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchData = async () => {
    if (search.trim().length < 2) {
      showMessage('error', 'Enter at least 2 characters to search.');
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await apiGet(`/api/migration/data?search=${encodeURIComponent(search.trim())}`);
      setRecords(data);
    } catch (err: unknown) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const editKey = (rec: MigrationRecord) => `${rec.student_id}:${rec.instrument_id}`;

  const startEditPayment = (rec: MigrationRecord) => {
    if (!rec.payment) return;
    setEditingPayment(editKey(rec));
    setEditingClasses(null);
    setConfirmingOverwrite(null);
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
    } catch (err: unknown) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to update payment date');
    }
  };

  const startEditClasses = (rec: MigrationRecord) => {
    setEditingClasses(editKey(rec));
    setEditingPayment(null);
    setConfirmingOverwrite(null);
    setClassesVal(String(rec.classes_remaining));
  };

  const cancelEditClasses = () => {
    setEditingClasses(null);
    setClassesVal('');
    setConfirmingOverwrite(null);
  };

  const saveClasses = async (rec: MigrationRecord, force = false) => {
    const val = parseInt(classesVal, 10);
    if (isNaN(val) || val < 0) {
      showMessage('error', 'Classes remaining must be a non-negative number');
      return;
    }
    // If not backfill and not yet force-confirmed, show inline warning
    if (!rec.payment?.is_backfill && !force) {
      setConfirmingOverwrite(editKey(rec));
      return;
    }
    try {
      await apiPut('/api/migration/classes', {
        student_id: rec.student_id,
        instrument_id: rec.instrument_id,
        classes_remaining: val,
        force: true,
      });
      showMessage('success', 'Classes remaining updated');
      setEditingClasses(null);
      setConfirmingOverwrite(null);
      fetchData();
    } catch (err: unknown) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to update classes remaining');
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

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search student name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
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
        <p className="text-gray-500">Searching...</p>
      ) : !hasSearched ? (
        <p className="text-gray-400 text-sm">Enter a student name to search.</p>
      ) : records.length === 0 ? (
        <p className="text-gray-500">No matching students found.</p>
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
                <th className="px-4 py-3 border-b">Classes Remaining</th>
                <th className="px-4 py-3 border-b">Batch Slots</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const key = editKey(rec);
                const isConfirming = confirmingOverwrite === key;
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

                    {/* Classes Remaining */}
                    <td className="px-4 py-3">
                      {editingClasses === key ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={classesVal}
                              onChange={(e) => setClassesVal(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                            />
                            <button
                              onClick={() => saveClasses(rec)}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditClasses}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                          {isConfirming && (
                            <div className="bg-yellow-50 border border-yellow-300 rounded p-2 text-xs text-yellow-800 max-w-xs">
                              <p className="font-medium mb-1">
                                This is a live student record (not a backfill). Overwriting will change active class credits.
                              </p>
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => saveClasses(rec, true)}
                                  className="bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                                >
                                  Yes, overwrite
                                </button>
                                <button
                                  onClick={cancelEditClasses}
                                  className="text-gray-600 hover:text-gray-800 underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {rec.classes_remaining}
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
