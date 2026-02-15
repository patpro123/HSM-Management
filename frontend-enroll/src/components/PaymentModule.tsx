import React, { useState, useEffect } from 'react';
import { apiPost, apiPut, apiGet } from '../api';
import { Student, PaymentRecord, PaymentFrequency } from '../types';

interface PaymentModuleProps {
  students: Student[];
  payments: PaymentRecord[];
  onRefresh: () => void;
}

const PaymentModule: React.FC<PaymentModuleProps> = ({ students, payments, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    payment_method: 'cash',
    payment_for: 'tuition',
    notes: '',
    payment_frequency: 'monthly' as PaymentFrequency,
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (formData.student_id) {
      const fetchStatus = async () => {
        setLoadingStatus(true);
        try {
          const data = await apiGet(`/api/payments/status/${formData.student_id}`);
          setPaymentStatus(data);
        } catch (error) {
          console.error('Error fetching payment status:', error);
        } finally {
          setLoadingStatus(false);
        }
      };
      fetchStatus();
    } else {
      setPaymentStatus(null);
    }
  }, [formData.student_id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calculateClassCredits = (frequency: string | PaymentFrequency): number => {
    const lower = (frequency || '').toLowerCase();
    if (lower.includes('monthly')) return 8;
    if (lower.includes('quarterly')) return 24;
    if (lower.includes('half')) return 48;
    if (lower.includes('yearly')) return 96;
    return 0;
  };

  const handleEdit = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    const meta = (payment as any).metadata || {};
    setFormData({
      student_id: payment.student_id,
      amount: String(payment.amount),
      payment_method: (payment as any).method || 'cash',
      payment_for: meta.payment_for || 'tuition',
      notes: meta.notes || (payment as any).notes || '',
      payment_frequency: meta.payment_frequency || 'monthly',
      payment_date: new Date(payment.timestamp).toISOString().split('T')[0]
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_id || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingPayment) {
        await apiPut(`/api/payments/${editingPayment.id}`, {
          payment_date: formData.payment_date,
          notes: formData.notes,
          payment_method: formData.payment_method,
          payment_for: formData.payment_for
        });
        alert('Payment updated successfully!');
      } else {
        const classCredits = calculateClassCredits(formData.payment_frequency);
        
        await apiPost('/api/payments', {
          ...formData,
          student_id: formData.student_id,
          amount: parseFloat(formData.amount),
          class_credits: classCredits
        });
        alert('Payment recorded successfully!');
      }

      setShowAddModal(false);
      setEditingPayment(null);
      setFormData({
        student_id: '',
        amount: '',
        payment_method: 'cash',
        payment_for: 'tuition',
        notes: '',
        payment_frequency: 'monthly' as PaymentFrequency,
        payment_date: new Date().toISOString().split('T')[0]
      });
      onRefresh();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment');
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesStudent = filterStudent === 'all' || String(p.student_id) === String(filterStudent);
    if (!matchesStudent) return false;

    if (startDate || endDate) {
      const paymentDate = new Date(p.timestamp).toISOString().split('T')[0];
      if (startDate && paymentDate < startDate) return false;
      if (endDate && paymentDate > endDate) return false;
    }
    return true;
  });

  const totalRevenue = payments.reduce((acc, p) => acc + parseFloat(String(p.amount || '0')), 0);
  const filteredRevenue = filteredPayments.reduce((acc, p) => acc + parseFloat(String(p.amount || '0')), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-xl text-white shadow-lg">
          <p className="text-sm font-semibold opacity-90">Total Revenue</p>
          <p className="text-3xl font-bold mt-2">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">{payments.length} transactions</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
          <p className="text-sm font-semibold opacity-90">Filtered Revenue</p>
          <p className="text-3xl font-bold mt-2">₹{filteredRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">{filteredPayments.length} transactions</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-xl text-white shadow-lg">
          <p className="text-sm font-semibold opacity-90">Avg. Payment</p>
          <p className="text-3xl font-bold mt-2">
            ₹{payments.length > 0 ? Math.round(totalRevenue / payments.length).toLocaleString() : '0'}
          </p>
          <p className="text-xs opacity-75 mt-2">Per transaction</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 w-full flex flex-col md:flex-row gap-4">
          <select
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            className="w-full md:w-64 px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          >
            <option value="all">All Students</option>
            {students.map(student => (
              <option key={student.id || (student as any).student_id} value={student.id || (student as any).student_id}>
                {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
              </option>
            ))}
          </select>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 md:w-40 px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              placeholder="Start Date"
            />
            <span className="text-slate-400 font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 md:w-40 px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              placeholder="End Date"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingPayment(null);
            setShowAddModal(true);
          }}
          className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg hover:shadow-xl whitespace-nowrap"
        >
          + Record Payment
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Student</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Classes / Due</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">For</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Notes</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                    No payments recorded yet. Add a payment to get started.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(payment => {
                  const student = students.find(s => (s.id || (s as any).student_id) === payment.student_id);
                  const meta = (payment as any).metadata || {};
                  const frequency = meta.payment_frequency || meta.payment_type || '';
                  const instrument = meta.instrument || '';
                  const classesCount = calculateClassCredits(frequency);
                  
                  // Calculate due date based on 2 classes per week
                  let dueDate = '-';
                  if (classesCount > 0) {
                    const weeks = classesCount / 2;
                    const date = new Date(payment.timestamp);
                    date.setDate(date.getDate() + (weeks * 7));
                    dueDate = date.toLocaleDateString();
                  }

                  return (
                    <tr key={payment.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(payment.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">
                          {student ? (student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown') : 'Unknown'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-emerald-600">₹{parseFloat(String(payment.amount || '0')).toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <span className="font-semibold text-indigo-700">{classesCount > 0 ? `${classesCount} classes` : '-'}</span>
                          <div className="text-xs text-slate-500">Due: {dueDate}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {instrument && <span className="block font-medium text-slate-800">{instrument}</span>}
                        <span className="capitalize">{frequency || meta.payment_for || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{meta.notes || payment.notes || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleEdit(payment)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">{editingPayment ? 'Edit Payment' : 'Record Payment'}</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Student *</label>
                <select
                  name="student_id"
                  value={formData.student_id}
                  onChange={handleInputChange}
                  required
                  disabled={!!editingPayment}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                >
                  <option value="">-- Select a student --</option>
                  {students.map(student => (
                    <option key={student.id || (student as any).student_id} value={student.id || (student as any).student_id}>
                      {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              {formData.student_id && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Student Status</h4>
                  {loadingStatus ? (
                    <div className="text-sm text-slate-500">Loading status...</div>
                  ) : paymentStatus ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="block text-slate-500 text-xs">Classes Left</span>
                        <span className={`font-bold text-lg ${paymentStatus.classes_remaining <= 2 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {paymentStatus.classes_remaining}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs">Last Payment</span>
                        {paymentStatus.last_payment ? (
                          <div>
                            <span className="font-medium">₹{paymentStatus.last_payment.amount}</span>
                            <span className="text-slate-400 mx-1">•</span>
                            <span>{new Date(paymentStatus.last_payment.timestamp).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No history</span>
                        )}
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs">Next Due</span>
                        <span className={paymentStatus.is_overdue ? 'text-red-600 font-medium' : 'text-slate-700'}>
                          {paymentStatus.expected_start_date ? new Date(paymentStatus.expected_start_date).toLocaleDateString() : '-'}
                          {paymentStatus.is_overdue && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1 rounded">Overdue</span>}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">No status data available</div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Date *</label>
                  <input
                    type="date"
                    name="payment_date"
                    value={formData.payment_date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Amount (₹) *</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingPayment}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method *</label>
                  <select
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Payment For</label>
                  <select
                    name="payment_for"
                    value={formData.payment_for}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  >
                    <option value="tuition">Tuition Fee</option>
                    <option value="registration">Registration</option>
                    <option value="exam">Exam Fee</option>
                    <option value="materials">Materials</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Frequency</label>
                  <select
                    name="payment_frequency"
                    value={formData.payment_frequency}
                    onChange={handleInputChange}
                    disabled={!!editingPayment}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  >
                    <option value="monthly">Monthly (8 classes)</option>
                    <option value="quarterly">Quarterly (24 classes)</option>
                    <option value="half_yearly">Half-Yearly (48 classes)</option>
                    <option value="yearly">Yearly (96 classes)</option>
                  </select>
                </div>
              </div>

              {!editingPayment && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-sm text-indigo-800">
                    <strong>Class Credits:</strong> {calculateClassCredits(formData.payment_frequency as PaymentFrequency)} classes will be added
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder="Additional notes (optional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  {editingPayment ? '💾 Update Payment' : '💰 Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentModule;
