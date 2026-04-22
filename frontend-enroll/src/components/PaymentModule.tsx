import React, { useState, useEffect, useMemo } from 'react';
import { apiPost, apiPut, apiGet } from '../api';
import { Student, PaymentRecord, Batch, Instrument } from '../types';

interface Package {
  id: string;
  name: string;
  classes_count: number;
  price: number;
  instrument_id: string;
  instrument_name: string;
}

const PAGE_SIZE = 10;

interface PaymentModuleProps {
  students: Student[];
  payments: PaymentRecord[];
  batches: Batch[];
  instruments: Instrument[];
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
    location: 'hsm',
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [paymentBatchId, setPaymentBatchId] = useState<string>('');
  const [studentBatches, setStudentBatches] = useState<Array<{ batch_id: string; instrument: string; instrument_id: string; recurrence: string }>>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [packageLoading, setPackageLoading] = useState(false);
  const [useCustomPackage, setUseCustomPackage] = useState(false);
  const [customClasses, setCustomClasses] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  // Filters
  const [searchName, setSearchName] = useState('');
  const [filterInstrument, setFilterInstrument] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Enrollments for cross-referencing student → instrument/teacher
  const [enrollments, setEnrollments] = useState<any[]>([]);

  useEffect(() => {
    apiGet('/api/enrollments').then(d => setEnrollments(d.enrollments || [])).catch(() => {});
  }, []);

  // enrollments API returns one row per student with a nested `batches` array:
  // { student_id, name, batches: [{ batch_id, instrument, instrument_id, teacher, teacher_id, ... }] }

  // student_id → instrument names (from actual batch enrollments)
  const studentInstrumentMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    enrollments.forEach(enrollment => {
      const key = String(enrollment.student_id);
      const instrNames = (enrollment.batches || [])
        .map((b: any) => b.instrument as string)
        .filter(Boolean);
      map[key] = [...new Set<string>(instrNames)];
    });
    return map;
  }, [enrollments]);

  // student_id → teacher names (from actual batch enrollments)
  const studentTeacherMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    enrollments.forEach(enrollment => {
      const key = String(enrollment.student_id);
      const teacherNames = (enrollment.batches || [])
        .map((b: any) => b.teacher as string)
        .filter(Boolean);
      map[key] = [...new Set<string>(teacherNames)];
    });
    return map;
  }, [enrollments]);

  // Unique teacher names from actual student enrollments (only teachers with students)
  const allTeachers = useMemo(() => {
    const names: string[] = [];
    enrollments.forEach(enrollment => {
      (enrollment.batches || []).forEach((b: any) => {
        if (b.teacher && !names.includes(b.teacher)) names.push(b.teacher);
      });
    });
    return names.sort();
  }, [enrollments]);

  // Unique instrument names from actual student enrollments (only instruments with students)
  const allInstruments = useMemo(() => {
    const names: string[] = [];
    enrollments.forEach(enrollment => {
      (enrollment.batches || []).forEach((b: any) => {
        if (b.instrument && !names.includes(b.instrument)) names.push(b.instrument);
      });
    });
    return names.sort();
  }, [enrollments]);

  useEffect(() => {
    if (formData.student_id) {
      const fetchStatusAndBatches = async () => {
        setLoadingStatus(true);
        try {
          const [statusData, enrollmentsData] = await Promise.all([
            apiGet(`/api/payments/status/${formData.student_id}`),
            apiGet(`/api/enrollments`)
          ]);
          setPaymentStatus(statusData);

          // Build per-instrument batch list for this student
          // enrollments API: one row per student, with nested batches array
          const studentEnrollment = (enrollmentsData.enrollments || [])
            .find((e: any) => String(e.student_id) === String(formData.student_id));
          const studentEnrollmentBatches = (studentEnrollment?.batches || []).map((b: any) => ({
            batch_id: b.batch_id,
            instrument: b.instrument || 'Unknown',
            instrument_id: b.instrument_id || '',
            recurrence: b.batch_recurrence || ''
          }));
          setStudentBatches(studentEnrollmentBatches);

          // Auto-select instrument if only one
          if (studentEnrollmentBatches.length === 1) {
            setPaymentBatchId(studentEnrollmentBatches[0].batch_id);
            setSelectedInstrumentId(studentEnrollmentBatches[0].instrument_id);
          } else {
            setPaymentBatchId('');
            setSelectedInstrumentId('');
          }
          setSelectedPackageId('');
          setAvailablePackages([]);
        } catch (error) {
          console.error('Error fetching payment status:', error);
        } finally {
          setLoadingStatus(false);
        }
      };
      fetchStatusAndBatches();
    } else {
      setPaymentStatus(null);
      setStudentBatches([]);
      setPaymentBatchId('');
      setSelectedInstrumentId('');
      setSelectedPackageId('');
      setAvailablePackages([]);
    }
  }, [formData.student_id]);

  useEffect(() => {
    if (!selectedInstrumentId) {
      setAvailablePackages([]);
      setSelectedPackageId('');
      return;
    }
    setPackageLoading(true);
    const loc = formData.location;
    const url = `/api/packages?instrument_id=${selectedInstrumentId}${loc ? `&location=${loc}` : ''}`;
    apiGet(url)
      .then((d: { packages: Package[] }) => {
        setAvailablePackages(d.packages || []);
        setSelectedPackageId('');
      })
      .catch(() => setAvailablePackages([]))
      .finally(() => setPackageLoading(false));
  }, [selectedInstrumentId, formData.location]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    const meta = (payment as any).metadata || {};
    setFormData({
      student_id: String(payment.student_id),
      amount: String(payment.amount),
      payment_method: (payment as any).method || 'cash',
      payment_for: meta.payment_for || 'tuition',
      notes: meta.notes || (payment as any).notes || '',
      location: meta.location || 'hsm',
      payment_date: new Date(payment.timestamp).toISOString().split('T')[0]
    });
    setSelectedInstrumentId('');
    setSelectedPackageId('');
    setAvailablePackages([]);
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
        let classCredits: number;
        let packageId: string | undefined;
        let amount: number;

        if (useCustomPackage) {
          classCredits = parseInt(customClasses) || 0;
          amount = parseFloat(customAmount) || parseFloat(formData.amount) || 0;
          packageId = undefined;
        } else {
          const selectedPkg = availablePackages.find(p => p.id === selectedPackageId);
          classCredits = selectedPkg?.classes_count ?? 0;
          amount = parseFloat(formData.amount);
          packageId = selectedPackageId || undefined;
        }

        await apiPost('/api/payments', {
          student_id: formData.student_id,
          amount,
          payment_method: formData.payment_method,
          payment_for: formData.payment_for,
          notes: formData.notes,
          payment_date: formData.payment_date,
          package_id: packageId,
          location: formData.location,
          class_credits: classCredits,
          batch_id: paymentBatchId || undefined
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
        location: 'hsm',
        payment_date: new Date().toISOString().split('T')[0]
      });
      setSelectedInstrumentId('');
      setSelectedPackageId('');
      setAvailablePackages([]);
      setUseCustomPackage(false);
      setCustomClasses('');
      setCustomAmount('');
      onRefresh();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment');
    }
  };

  const getStudentName = (p: PaymentRecord): string => {
    const student = students.find(s => String(s.id || (s as any).student_id) === String(p.student_id));
    if (!student) return '';
    return student.first_name && student.last_name
      ? `${student.first_name} ${student.last_name}`
      : (student as any).name || '';
  };

  const filteredPayments = useMemo(() => {
    const lowerSearch = searchName.toLowerCase().trim();
    return payments.filter(p => {
      const sid = String(p.student_id);

      if (filterStudent !== 'all' && sid !== String(filterStudent)) return false;

      if (lowerSearch && !getStudentName(p).toLowerCase().includes(lowerSearch)) return false;

      if (filterInstrument !== 'all') {
        const studentInstruments = studentInstrumentMap[sid] || [];
        if (!studentInstruments.some(i => i === filterInstrument)) return false;
      }

      if (filterTeacher !== 'all') {
        const studentTeachers = studentTeacherMap[sid] || [];
        if (!studentTeachers.some(t => t === filterTeacher)) return false;
      }

      if (startDate || endDate) {
        const paymentDate = new Date(p.timestamp).toISOString().split('T')[0];
        if (startDate && paymentDate < startDate) return false;
        if (endDate && paymentDate > endDate) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, filterStudent, searchName, filterInstrument, filterTeacher, startDate, endDate, studentInstrumentMap, studentTeacherMap]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchName, filterStudent, filterInstrument, filterTeacher, startDate, endDate]);

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

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Student name search */}
          <input
            type="text"
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            placeholder="Search by student name..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
          />
          {/* Stream / Instrument filter */}
          <select
            value={filterInstrument}
            onChange={e => setFilterInstrument(e.target.value)}
            className="md:w-48 px-3 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
          >
            <option value="all">All Streams</option>
            {allInstruments.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {/* Teacher filter */}
          <select
            value={filterTeacher}
            onChange={e => setFilterTeacher(e.target.value)}
            className="md:w-48 px-3 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
          >
            <option value="all">All Teachers</option>
            {allTeachers.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {/* Date range */}
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="flex-1 md:w-40 px-3 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
            />
            <span className="text-slate-400 font-medium text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="flex-1 md:w-40 px-3 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
            />
          </div>
          {/* Clear filters */}
          {(searchName || filterInstrument !== 'all' || filterTeacher !== 'all' || filterStudent !== 'all' || startDate || endDate) && (
            <button
              onClick={() => { setSearchName(''); setFilterInstrument('all'); setFilterTeacher('all'); setFilterStudent('all'); setStartDate(''); setEndDate(''); }}
              className="text-sm text-slate-500 hover:text-slate-800 underline whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => { setEditingPayment(null); setShowAddModal(true); }}
            className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow hover:shadow-md whitespace-nowrap text-sm"
          >
            + Record Payment
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Student</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Stream / Teacher</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Classes / Due</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Notes</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                    {filteredPayments.length === 0 && payments.length > 0
                      ? 'No payments match your filters.'
                      : 'No payments recorded yet. Add a payment to get started.'}
                  </td>
                </tr>
              ) : (
                paginatedPayments.map(payment => {
                  const sid = String(payment.student_id);
                  const meta = (payment as any).metadata || {};
                  const creditsFromMeta = meta.credits_bought ? parseInt(String(meta.credits_bought)) : 0;
                  const instrList = meta.instrument_name
                    ? [meta.instrument_name]
                    : studentInstrumentMap[sid] || (meta.instrument ? [meta.instrument] : []);
                  const teacherList = studentTeacherMap[sid] || [];
                  const locationLabel = meta.location === 'pbel' ? 'PBEL City' : meta.location === 'hsm' ? 'HSM' : null;

                  return (
                    <tr key={payment.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {new Date(payment.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{getStudentName(payment) || 'Unknown'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          {instrList.length > 0
                            ? instrList.map(i => <span key={i} className="block text-sm font-medium text-slate-800">{i}</span>)
                            : <span className="text-sm text-slate-400">—</span>}
                          {teacherList.length > 0
                            ? teacherList.map(t => <span key={t} className="block text-xs text-slate-500">{t}</span>)
                            : null}
                          {locationLabel && <span className="block text-xs text-slate-400">{locationLabel}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-emerald-600">₹{parseFloat(String(payment.amount || '0')).toLocaleString()}</p>
                        <p className="text-xs text-slate-400 capitalize">{meta.payment_for || 'tuition'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-indigo-700 text-sm">
                          {creditsFromMeta > 0 ? `${creditsFromMeta} classes` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm max-w-[180px] truncate">{meta.notes || payment.notes || '-'}</td>
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

        {/* Pagination */}
        {filteredPayments.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-500">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length} payments
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...'
                    ? <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-sm">…</span>
                    : <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition ${currentPage === p ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-white'}`}
                      >{p}</button>
                )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
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

              {!editingPayment && formData.student_id && (
                <div className="space-y-4">
                  {/* Stream selector */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Stream *</label>
                    <select
                      value={paymentBatchId}
                      onChange={e => {
                        const batch = studentBatches.find(b => b.batch_id === e.target.value);
                        setPaymentBatchId(e.target.value);
                        setSelectedInstrumentId(batch?.instrument_id ?? '');
                        setSelectedPackageId('');
                      }}
                      required={!editingPayment}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    >
                      <option value="">-- Select stream --</option>
                      {studentBatches.map(b => (
                        <option key={b.batch_id} value={b.batch_id}>
                          {b.instrument}{b.recurrence ? ` (${b.recurrence})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location selector */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Location *</label>
                    <select
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    >
                      <option value="hsm">HSM Main</option>
                      <option value="pbel">PBEL City</option>
                    </select>
                  </div>

                  {/* Package selector */}
                  {selectedInstrumentId && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-700">Package *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomPackage(v => !v);
                            setSelectedPackageId('');
                            setCustomClasses('');
                            setCustomAmount('');
                            setFormData(prev => ({ ...prev, amount: '' }));
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                        >
                          {useCustomPackage ? 'Use package list' : "Can't find package? Enter manually"}
                        </button>
                      </div>

                      {useCustomPackage ? (
                        <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs text-amber-700 font-medium">Manual override — enter classes and amount directly</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Classes to credit *</label>
                              <input
                                type="number"
                                value={customClasses}
                                onChange={e => setCustomClasses(e.target.value)}
                                min="1"
                                required
                                placeholder="e.g. 8"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Amount (₹) *</label>
                              <input
                                type="number"
                                value={customAmount}
                                onChange={e => {
                                  setCustomAmount(e.target.value);
                                  setFormData(prev => ({ ...prev, amount: e.target.value }));
                                }}
                                min="0"
                                required
                                placeholder="e.g. 2000"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
                              />
                            </div>
                          </div>
                          {customClasses && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-800">
                              <strong>{customClasses} classes</strong> will be credited
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {packageLoading ? (
                            <p className="text-sm text-slate-400">Loading packages...</p>
                          ) : (
                            <select
                              value={selectedPackageId}
                              onChange={e => {
                                setSelectedPackageId(e.target.value);
                                const pkg = availablePackages.find(p => p.id === e.target.value);
                                if (pkg) setFormData(prev => ({ ...prev, amount: String(pkg.price) }));
                              }}
                              required={!editingPayment && !useCustomPackage}
                              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                            >
                              <option value="">-- Select package --</option>
                              {availablePackages.map(pkg => (
                                <option key={pkg.id} value={pkg.id}>
                                  {pkg.name} — {pkg.classes_count} classes · ₹{pkg.price}
                                </option>
                              ))}
                            </select>
                          )}
                          {selectedPackageId && availablePackages.find(p => p.id === selectedPackageId) && (
                            <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-800">
                              <strong>{availablePackages.find(p => p.id === selectedPackageId)!.classes_count} classes</strong> will be credited
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {formData.student_id && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Student Status</h4>
                  {loadingStatus ? (
                    <div className="text-sm text-slate-500">Loading status...</div>
                  ) : paymentStatus ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="block text-slate-500 text-xs">Classes Left (Total)</span>
                        <span className={`font-bold text-lg ${paymentStatus.classes_remaining <= 2 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {paymentStatus.classes_remaining}
                        </span>
                        {paymentStatus.instrument_breakdown && Object.keys(paymentStatus.instrument_breakdown).length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(paymentStatus.instrument_breakdown as Record<string, number>).map(([inst, rem]) => (
                              <span key={inst} className={`text-xs px-2 py-0.5 rounded-full ${rem <= 1 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                {inst}: {rem}
                              </span>
                            ))}
                          </div>
                        )}
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
                {!useCustomPackage && (
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
                )}

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
