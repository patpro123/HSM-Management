import React, { useState, useEffect } from 'react';
import { Student, Batch, Instrument } from '../types';
import { apiDelete, apiGet, apiPost } from '../api';
import { authenticatedFetch, getCurrentUser } from '../auth';
import { API_BASE_URL } from '../config';
import Student360View from './Student360View';
import StudentDetails, { EnrollmentSelection } from './StudentDetails';
import ProspectModal from './ProspectModal';
import StudentFilters from './StudentManagement/StudentFilters';
import StudentCardGrid from './StudentManagement/StudentCardGrid';
import StudentTableView from './StudentManagement/StudentTableView';
import ProspectList from './StudentManagement/ProspectList';

interface StudentManagementProps {
  students: Student[];
  batches: Batch[];
  instruments: Instrument[];
  prospects: any[];
  onRefresh: () => void;
  enrollProspectId?: string | null;
  onEnrollProspectHandled?: () => void;
}

const AGE_BUCKETS = [
  { key: 'fresh', label: 'Fresh', range: '0–7d', dot: '🟢', color: 'bg-green-100 text-green-700 border-green-200', maxDays: 7 },
  { key: 'followup', label: 'Follow Up', range: '8–14d', dot: '🟡', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', maxDays: 14 },
  { key: 'warm', label: 'Warm', range: '15–30d', dot: '🟠', color: 'bg-orange-100 text-orange-700 border-orange-200', maxDays: 30 },
  { key: 'cold', label: 'Cold', range: '30+d', dot: '🔴', color: 'bg-red-100 text-red-700 border-red-200', maxDays: Infinity },
];

const getAgeDays = (createdAt: string) =>
  Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);

const getAgeBucket = (days: number) =>
  AGE_BUCKETS.find(b => days <= b.maxDays) || AGE_BUCKETS[3];

const StudentManagement: React.FC<StudentManagementProps> = ({ students: propStudents, batches, instruments, prospects, onRefresh, enrollProspectId, onEnrollProspectHandled }) => {
  const [successBanner, setSuccessBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [students, setStudents] = useState<Student[]>(propStudents || []);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [filterInstruments, setFilterInstruments] = useState<(string | number)[]>([]);
  const [filterBatches, setFilterBatches] = useState<(string | number)[]>([]);
  const [filterTeacher, setFilterTeacher] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [filterType, setFilterType] = useState<'permanent' | 'prospect'>('permanent');
  const [prospectList, setProspectList] = useState<any[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [ageFilter, setAgeFilter] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [paymentStep, setPaymentStep] = useState<{ studentId: string; studentName: string; amount: number } | null>(null);
  const [paymentForm, setPaymentForm] = useState({ method: 'cash', notes: '', skipPayment: false, skipReason: '' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedStudentId, setSelectedStudentId] = useState<string | number | null>(null);
  const [initialProspectId, setInitialProspectId] = useState<string | null>(null);

  useEffect(() => {
    setStudents(propStudents || []);
  }, [propStudents]);

  useEffect(() => {
    if (enrollProspectId) {
      setEditingStudent(null);
      setInitialProspectId(enrollProspectId);
      setShowAddModal(true);
      onEnrollProspectHandled?.();
    }
  }, [enrollProspectId]);

  useEffect(() => {
    apiGet('/api/teachers').then(res => setTeachers(res.teachers || []));
  }, []);

  useEffect(() => {
    const relevantBatchIds = batches
      .filter(b => filterInstruments.includes(b.instrument_id))
      .map(b => b.id);
    setFilterBatches(prev => prev.filter(id => relevantBatchIds.includes(id as any)));
  }, [filterInstruments, batches]);

  useEffect(() => {
    if (filterType === 'prospect') {
      apiGet('/api/prospects?include_inactive=true')
        .then(res => setProspectList(res.prospects || []))
        .catch(err => console.error('Failed to fetch prospects', err));
    }
  }, [filterType]);

  const user = getCurrentUser();
  const userEmail = user?.email?.toLowerCase();
  const isAdmin = user && user.roles.includes('admin');
  const isTeacherOnly = user && !isAdmin && user?.roles.includes('teacher');
  const isReadonly = isTeacherOnly;

  console.log('StudentManagement Debug:');
  console.log('- Logged in user:', user);
  console.log('- User email (lowercase):', userEmail);
  console.log('- Is admin:', isAdmin);
  console.log('- User roles:', user?.roles);
  console.log('- Total students received:', students.length);
  console.log('- Instruments received:', instruments?.length, instruments);
  console.log('- Batches received:', batches?.length, batches);

  const filteredStudents = students.filter(student => {
    const studentBatches = (student as any).batches || [];
    const isActive = (student as any).is_active !== false;

    if (filterStatus !== 'all') {
      if (filterStatus === 'active' && !isActive) return false;
      if (filterStatus === 'inactive' && isActive) return false;
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const nameMatch = ((student as any).name || '').toLowerCase().includes(lowerSearch);
      const emailMatch = (student.email || ((student as any).metadata?.email) || '').toLowerCase().includes(lowerSearch);
      if (!nameMatch && !emailMatch) return false;
    }

    if (!isAdmin && !isTeacherOnly) {
      const email = (student.email || (student as any).metadata?.email || '').toLowerCase();
      if (!userEmail || email !== userEmail) return false;
    }

    if (!isActive) return true;

    if (filterInstruments.length > 0) {
      const hasInstrument = studentBatches.some((batch: any) => batch.instrument_id && filterInstruments.includes(batch.instrument_id));
      if (!hasInstrument) return false;
    }

    if (filterBatches.length > 0) {
      const hasBatch = studentBatches.some((batch: any) => batch.batch_id && filterBatches.includes(batch.batch_id));
      if (!hasBatch) return false;
    }

    if (filterTeacher !== 'all') {
      const hasTeacher = studentBatches.some((batch: any) => batch.teacher_id && String(batch.teacher_id) === filterTeacher);
      if (!hasTeacher) return false;
    }

    return true;
  });

  console.log('- Filtered students count:', filteredStudents.length);

  const displayedProspects = prospectList
    .filter(p => {
      if (filterStatus === 'active') return p.is_active !== false;
      if (filterStatus === 'inactive') return p.is_active === false;
      return true;
    })
    .filter(p => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.metadata?.email || '').toLowerCase().includes(q);
    })
    .filter(p => {
      if (!ageFilter) return true;
      return getAgeBucket(getAgeDays(p.created_at)).key === ageFilter;
    })
    .filter(p => {
      if (locationFilter === 'all') return true;
      return (p.metadata?.location || '') === locationFilter;
    });

  const relevantBatches = batches.filter(b => filterInstruments.includes(b.instrument_id));

  const handlePaymentSubmit = async () => {
    if (!paymentStep) return;
    if (paymentForm.skipPayment && !paymentForm.skipReason.trim()) {
      alert('Please provide a reason for deferring payment.');
      return;
    }
    setSavingPayment(true);
    try {
      if (!paymentForm.skipPayment) {
        await apiPost('/api/payments', {
          student_id: paymentStep.studentId,
          amount: paymentStep.amount,
          payment_method: paymentForm.method,
          payment_for: 'tuition',
          notes: paymentForm.notes,
          payment_date: new Date().toISOString().split('T')[0],
        });
      }
      setPaymentStep(null);
      setSuccessBanner(paymentForm.skipPayment
        ? `Enrollment saved. Payment deferred — ${paymentForm.skipReason}`
        : 'Enrollment and payment recorded successfully!');
      onRefresh();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch {
      alert('Payment recording failed. Enrollment was saved.');
      setPaymentStep(null);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    setShowAddModal(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setShowAddModal(true);
  };

  const handleSaveStudent = async (formData: any, selectedBatches: EnrollmentSelection[], prospectId?: string, feeTotal?: number) => {
    if (!editingStudent && selectedBatches.length === 0) {
      setErrorBanner('Please select at least one batch. A student must be enrolled in a batch.');
      setTimeout(() => setErrorBanner(''), 3000);
      return;
    }

    try {
      let url = '/api/students';
      let method = 'POST';

      if (editingStudent) {
        const studentId = editingStudent.id || (editingStudent as any)?.student_id;
        if (!studentId) {
          setErrorBanner('Cannot update: student ID is missing.');
          return;
        }
        url = `/api/students/${studentId}`;
        method = 'PUT';
      } else if (prospectId) {
        url = `/api/students/${prospectId}`;
        method = 'PUT';
      }

      const backendData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        email: formData.email || null,
        date_of_birth: formData.date_of_birth || null,
        dob: formData.date_of_birth || null,
        phone: formData.phone,
        guardian_name: formData.guardian_name || null,
        guardian_contact: formData.guardian_name || null,
        guardian_phone: formData.guardian_phone || null,
        address: formData.address || null,
        metadata: {
          email: formData.email || null,
          address: formData.address || null,
          guardian_name: formData.guardian_name || null,
          guardian_phone: formData.guardian_phone || null
        },
        batches: selectedBatches.map(batch => {
          const batchObj = batches.find(b => String(b.id) === String(batch.batch_id));
          return {
            batch_id: batch.batch_id,
            instrument_id: batchObj?.instrument_id || null,
            payment_frequency: batch.payment_frequency,
            trinity_grade: batch.trinity_grade || 'Initial',
            enrolled_on: batch.enrollment_date || new Date(),
            fee_structure_id: (batch as any).fee_structure_id || null
          };
        })
      };

      console.log('🚀 [StudentManagement] Sending payload:', { url, method, backendData });

      const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendData)
      });

      if (response.ok) {
        const responseData = await response.json().catch(() => ({}));
        const savedId = String(responseData.student?.id || editingStudent?.id || (editingStudent as any)?.student_id || prospectId || '');
        const savedName = `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'Student';
        setShowAddModal(false);
        onRefresh();
        if (!editingStudent && savedId && (feeTotal || 0) > 0) {
          // New enrollment — show payment step
          setPaymentStep({ studentId: savedId, studentName: savedName, amount: feeTotal || 0 });
          setPaymentForm({ method: 'cash', notes: '', skipPayment: false, skipReason: '' });
        } else {
          setSuccessBanner('Student saved successfully!');
          setTimeout(() => setSuccessBanner(''), 3000);
        }
      } else {
        console.error('❌ [StudentManagement] Save failed:', response.status, response.statusText);
        try {
          const errorBody = await response.text();
          console.error('❌ [StudentManagement] Error body:', errorBody);
        } catch (e) {
          console.error('❌ [StudentManagement] Could not read error body');
        }
        setErrorBanner(`Failed to save student: ${response.statusText}`);
        setTimeout(() => setErrorBanner(''), 3000);
      }
    } catch (error) {
      console.error('❌ [StudentManagement] Exception saving student:', error);
      setErrorBanner('Error saving student');
      setTimeout(() => setErrorBanner(''), 3000);
    }
  };

  const handleDeleteStudent = async (id: number | string) => {
    if (!confirm('Are you sure you want to delete this student? This will also remove their enrollments.')) return;
    try {
      await apiDelete(`/api/students/${id}`);
      setSuccessBanner('Student deleted successfully!');
      onRefresh();
      setTimeout(() => setSuccessBanner(''), 3000);
    } catch (error) {
      console.error('Error deleting student:', error);
      setErrorBanner('Error deleting student');
      setTimeout(() => setErrorBanner(''), 3000);
    }
  };

  const handleRestoreStudent = async (id: number | string) => {
    if (!confirm('Are you sure you want to restore this student?')) return;
    try {
      await apiPost(`/api/students/${id}/restore`, {});
      setSuccessBanner('Student restored successfully!');
      onRefresh();
      setTimeout(() => setSuccessBanner(''), 3000);
    } catch (error) {
      setErrorBanner('Error restoring student');
    }
  };

  return (
    <div className="space-y-6">
      {successBanner && (
        <div className="mb-4 px-4 py-3 bg-green-100 text-green-800 rounded-lg font-semibold text-center">
          {successBanner}
        </div>
      )}
      {errorBanner && (
        <div className="mb-4 px-4 py-3 bg-red-100 text-red-800 rounded-lg font-semibold text-center">
          {errorBanner}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 w-full md:w-auto">
          <input
            type="text"
            placeholder="🔍 Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`px-4 py-2 rounded-md font-medium transition ${viewMode === 'card' ? 'bg-white text-orange-600 shadow' : 'text-slate-600 hover:text-slate-900'}`}
            >
              📇 Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-md font-medium transition ${viewMode === 'table' ? 'bg-white text-orange-600 shadow' : 'text-slate-600 hover:text-slate-900'}`}
            >
              📊 Table
            </button>
          </div>
          {!isReadonly && (
            <button
              onClick={handleAddStudent}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg hover:shadow-xl"
            >
              + Add Student
            </button>
          )}
        </div>
      </div>

      <StudentFilters
        filterType={filterType}
        filterStatus={filterStatus}
        filterTeacher={filterTeacher}
        filterInstruments={filterInstruments}
        filterBatches={filterBatches}
        instruments={instruments}
        batches={batches}
        teachers={teachers}
        prospects={prospects}
        relevantBatches={relevantBatches}
        onFilterTypeChange={(type) => { setFilterType(type); setAgeFilter(null); }}
        onFilterStatusChange={setFilterStatus}
        onFilterTeacherChange={setFilterTeacher}
        onInstrumentToggle={(id) => setFilterInstruments(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
        onBatchToggle={(id) => setFilterBatches(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
        onClearInstruments={() => setFilterInstruments([])}
        onClearBatches={() => setFilterBatches([])}
      />

      {filterType === 'prospect' && (
        <ProspectList
          prospectList={prospectList}
          displayedProspects={displayedProspects}
          ageFilter={ageFilter}
          ageBuckets={AGE_BUCKETS}
          getAgeDays={getAgeDays}
          getAgeBucket={getAgeBucket}
          onAgeFilterChange={(key) => { setAgeFilter(key); }}
          onSelectProspect={setSelectedProspect}
          locationFilter={locationFilter}
          onLocationFilterChange={setLocationFilter}
        />
      )}

      {filterType === 'permanent' && viewMode === 'card' && (
        <StudentCardGrid
          students={filteredStudents}
          isReadonly={!!isReadonly}
          onView360={setSelectedStudentId}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          onRestore={handleRestoreStudent}
        />
      )}

      {filterType === 'permanent' && viewMode === 'table' && (
        <StudentTableView
          students={filteredStudents}
          isReadonly={!!isReadonly}
          onView360={setSelectedStudentId}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          onRestore={handleRestoreStudent}
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h2>
            </div>
            <StudentDetails
              student={editingStudent}
              batches={batches}
              instruments={instruments}
              onSave={handleSaveStudent}
              onCancel={() => { setShowAddModal(false); setInitialProspectId(null); }}
              initialProspectId={initialProspectId}
            />
          </div>
        </div>
      )}

      {/* Post-enrollment payment modal */}
      {paymentStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-green-50 border-b border-green-200 rounded-t-xl px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
              <div>
                <p className="font-bold text-green-800">Enrollment Confirmed!</p>
                <p className="text-sm text-green-700">{paymentStep.studentName} enrolled successfully.</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">Record Payment</h3>
                <p className="text-sm text-slate-500">Total due: <span className="font-bold text-slate-800">₹{paymentStep.amount.toLocaleString()}</span></p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentForm.skipPayment}
                  onChange={e => setPaymentForm(f => ({ ...f, skipPayment: e.target.checked, skipReason: '' }))}
                  className="w-4 h-4 text-orange-500 rounded"
                />
                <span className="text-sm font-medium text-slate-700">Defer payment — collect later</span>
              </label>

              {paymentForm.skipPayment ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Reason for deferring <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={paymentForm.skipReason}
                    onChange={e => setPaymentForm(f => ({ ...f, skipReason: e.target.value }))}
                    placeholder="e.g. Parent will pay by end of week..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none resize-none text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
                    <div className="flex gap-2 flex-wrap">
                      {(['cash', 'upi', 'bank_transfer'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentForm(f => ({ ...f, method: m }))}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${paymentForm.method === m ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-orange-400'}`}
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
                      onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Transaction ID, reference..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-sm"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handlePaymentSubmit}
                disabled={savingPayment || (paymentForm.skipPayment && !paymentForm.skipReason.trim())}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {savingPayment ? 'Processing...' : paymentForm.skipPayment ? 'Save & Defer Payment' : `Record Payment · ₹${paymentStep.amount.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStudentId && (
        <Student360View
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          isModal={true}
          hidePayments={!!isReadonly}
        />
      )}

      {selectedProspect && (
        <ProspectModal
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdated={updated => {
            setProspectList(prev => prev.map(p => p.id === updated.id ? updated : p));
            setSelectedProspect(updated);
          }}
        />
      )}
    </div>
  );
};

export default StudentManagement;
