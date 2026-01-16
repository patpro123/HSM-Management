import React, { useState } from 'react';
import { Student, PaymentRecord, PaymentFrequency } from '../types';

interface PaymentModuleProps {
  students: Student[];
  payments: PaymentRecord[];
  onRefresh: () => void;
}

const PaymentModule: React.FC<PaymentModuleProps> = ({ students, payments, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    payment_method: 'cash',
    payment_for: 'tuition',
    notes: '',
    payment_frequency: 'monthly' as PaymentFrequency
  });
  const [filterStudent, setFilterStudent] = useState<string>('all');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calculateClassCredits = (frequency: PaymentFrequency): number => {
    const credits = {
      monthly: 8,
      quarterly: 24,
      half_yearly: 48,
      yearly: 96
    };
    return credits[frequency];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_id || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const classCredits = calculateClassCredits(formData.payment_frequency);
      
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          student_id: parseInt(formData.student_id),
          amount: parseFloat(formData.amount),
          class_credits: classCredits
        })
      });

      if (response.ok) {
        alert('Payment recorded successfully!');
        setShowAddModal(false);
        setFormData({
          student_id: '',
          amount: '',
          payment_method: 'cash',
          payment_for: 'tuition',
          notes: '',
          payment_frequency: 'monthly' as PaymentFrequency
        });
        onRefresh();
      } else {
        alert('Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Error recording payment');
    }
  };

  const filteredPayments = filterStudent === 'all'
    ? payments
    : payments.filter(p => Number(p.student_id) === parseInt(filterStudent));

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
        <div className="flex-1 w-full md:w-auto">
          <select
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          >
            <option value="all">All Students</option>
            {students.map(student => (
              <option key={student.id} value={student.id}>
                {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg hover:shadow-xl"
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
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Method</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">For</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Notes</th>
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
                  const student = students.find(s => s.id === payment.student_id);
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
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                          {payment.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{payment.payment_for || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{payment.notes || '-'}</td>
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
              <h2 className="text-2xl font-bold text-slate-900">Record Payment</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Student *</label>
                <select
                  name="student_id"
                  value={formData.student_id}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                >
                  <option value="">-- Select a student --</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Amount (₹) *</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
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
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  >
                    <option value="monthly">Monthly (8 classes)</option>
                    <option value="quarterly">Quarterly (24 classes)</option>
                    <option value="half_yearly">Half-Yearly (48 classes)</option>
                    <option value="yearly">Yearly (96 classes)</option>
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm text-indigo-800">
                  <strong>Class Credits:</strong> {calculateClassCredits(formData.payment_frequency as PaymentFrequency)} classes will be added
                </p>
              </div>

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
                  💰 Record Payment
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
