import React, { useState } from 'react';
import { Student, Batch, Instrument, PaymentFrequency } from '../types';
import { apiPost, apiDelete } from '../api';
import { authenticatedFetch, getCurrentUser } from '../auth';
import { API_BASE_URL } from '../config';

interface StudentManagementProps {
  students: Student[];
  batches: Batch[];
  instruments: Instrument[];
  onRefresh: () => void;
}

interface EnrollmentSelection {
  batch_id: number | string;
  payment_frequency: PaymentFrequency;
  enrollment_date: string;
}

const StudentManagement: React.FC<StudentManagementProps> = ({ students, batches, instruments, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstruments, setFilterInstruments] = useState<(string | number)[]>([]);
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    email: '',
    phone: '',
    guardian_name: '',
    guardian_phone: '',
    address: ''
  });
  const [selectedBatches, setSelectedBatches] = useState<EnrollmentSelection[]>([]);

  // Get logged-in user from existing auth system
  const user = getCurrentUser();
  const userEmail = user?.email?.toLowerCase();
  const isAdmin = user && user.roles.includes('admin');

  // Debug logs
  console.log('StudentManagement Debug:');
  console.log('- Logged in user:', user);
  console.log('- User email (lowercase):', userEmail);
  console.log('- Is admin:', isAdmin);
  console.log('- User roles:', user?.roles);
  console.log('- Total students received:', students.length);

  // Filter students based on role:
  // - Admin users: show all students
  // - Student/Parent users: show only the student whose email matches the logged-in user's email
  const filteredStudents = students.filter(student => {
    if (isAdmin) {
      return true; // Admin sees all students
    }
    
    // For non-admin users, filter by matching email
    const metadata = (student as any).metadata || {};
    const email = (student.email || metadata.email || '').toLowerCase();
    
    console.log('- Checking student:', (student as any).name || 'Unknown');
    console.log('  - Student email:', student.email);
    console.log('  - Student metadata email:', metadata.email);
    console.log('  - Final email (lowercase):', email);
    console.log('  - Email match:', userEmail && email === userEmail);
    
    return userEmail && email === userEmail;
  });

  console.log('- Filtered students count:', filteredStudents.length);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      email: '',
      phone: '',
      guardian_name: '',
      guardian_phone: '',
      address: ''
    });
    setSelectedBatches([]);
    setShowAddModal(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    
    // Parse the backend data structure
    const name = (student as any).name || '';
    const nameParts = name.split(' ');
    const firstName = student.first_name || nameParts[0] || '';
    const lastName = student.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
    
    const metadata = (student as any).metadata || {};
    
    setFormData({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: student.date_of_birth || (student as any).dob?.split('T')[0] || '',
      email: student.email || metadata.email || '',
      phone: student.phone || '',
      guardian_name: student.guardian_name || (student as any).guardian_contact || '',
      guardian_phone: student.guardian_phone || metadata.guardian_phone || '',
      address: student.address || metadata.address || ''
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingStudent 
        ? `/api/students/${editingStudent.id}`
        : `/api/students`;
      
      const method = editingStudent ? 'PUT' : 'POST';
      
      // Format data for backend: combine first_name + last_name into name field
      const backendData = {
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        dob: formData.date_of_birth || null,
        phone: formData.phone,
        guardian_contact: formData.guardian_name || null,
        metadata: {
          email: formData.email || null,
          address: formData.address || null,
          guardian_phone: formData.guardian_phone || null
        }
      };
      
      const response = await authenticatedFetch(`${API_BASE_URL}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendData)
      });

      if (response.ok) {
        const result = await response.json();
        const studentId = editingStudent?.id || result.student?.id;
        
        // If batches are selected and we have a student ID, enroll the student
        if (selectedBatches.length > 0 && studentId) {
          await apiPost(`/api/students/${studentId}/enroll`, {
            enrollments: selectedBatches
          });
        }
        
        setShowAddModal(false);
        onRefresh();
      } else {
        alert('Failed to save student');
      }
    } catch (error) {
      console.error('Error saving student:', error);
      alert('Error saving student');
    }
  };

  const handleDeleteStudent = async (id: number | string) => {
    if (!confirm('Are you sure you want to delete this student? This will also remove their enrollments.')) {
      return;
    }

    try {
      await apiDelete(`/api/students/${id}`);
      onRefresh();
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Error deleting student');
    }
  };

  const handleInstrumentToggle = (instrumentId: string | number) => {
    setFilterInstruments(prev => 
      prev.includes(instrumentId) 
        ? prev.filter(id => id !== instrumentId)
        : [...prev, instrumentId]
    );
  };

  const handleBatchToggle = (batchId: number | string) => {
    setSelectedBatches(prev => {
      const exists = prev.find(e => String(e.batch_id) === String(batchId));
      if (exists) {
        return prev.filter(e => String(e.batch_id) !== String(batchId));
      } else {
        const today = new Date().toISOString().split('T')[0];
        return [...prev, { batch_id: batchId, payment_frequency: 'monthly' as PaymentFrequency, enrollment_date: today }];
      }
    });
  };

  const handlePaymentFrequencyChange = (batchId: number | string, frequency: PaymentFrequency) => {
    setSelectedBatches(prev =>
      prev.map(e => (String(e.batch_id) === String(batchId) ? { ...e, payment_frequency: frequency } : e))
    );
  };

  const handleEnrollmentDateChange = (batchId: number | string, date: string) => {
    setSelectedBatches(prev =>
      prev.map(e => (String(e.batch_id) === String(batchId) ? { ...e, enrollment_date: date } : e))
    );
  };

  // Group batches by instrument
  const batchesByInstrument = instruments.map(instrument => ({
    instrument,
    batches: batches.filter(batch => batch.instrument_id === instrument.id)
  })).filter(group => group.batches.length > 0);

  return (
    <div className="space-y-6">
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
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                viewMode === 'card' ? 'bg-white text-orange-600 shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📇 Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                viewMode === 'table' ? 'bg-white text-orange-600 shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Table
            </button>
          </div>
          <button
            onClick={handleAddStudent}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg hover:shadow-xl"
          >
            + Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Instruments</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {instruments.map(inst => (
            <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterInstruments.includes(inst.id)}
                onChange={() => handleInstrumentToggle(inst.id)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-sm text-slate-700">{inst.name}</span>
            </label>
          ))}
        </div>
        {filterInstruments.length > 0 && (
          <button
            onClick={() => setFilterInstruments([])}
            className="mt-3 text-xs text-orange-600 hover:text-orange-800 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Students Display */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400">
              No students found. Add a new student to get started.
            </div>
          ) : (
            filteredStudents.map(student => (
            <div key={student.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    {(() => {
                      if (student.first_name && student.last_name) {
                        return `${student.first_name[0]}${student.last_name[0]}`;
                      }
                      const name = (student as any).name || 'N A';
                      const parts = name.split(' ');
                      return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}` : name.substring(0, 2).toUpperCase();
                    })()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                    </h3>
                    <p className="text-xs text-slate-500">{student.email || ((student as any).metadata?.email) || 'No email'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <span>📱</span>
                  <span>{student.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span>👤</span>
                  <span>{student.guardian_name || (student as any).guardian_contact || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span>📞</span>
                  <span>{student.guardian_phone || ((student as any).metadata?.guardian_phone) || 'N/A'}</span>
                </div>
              </div>

              {/* Show enrolled batches */}
              {(student as any).enrollments && (student as any).enrollments.length > 0 && (
                <div className="mb-4 pb-4 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Enrolled in:</p>
                  <div className="space-y-1">
                    {(student as any).enrollments.map((enrollment: any, idx: number) => {
                      // Match batch_id from enrollment with batches (handle string comparison)
                      const batch = batches.find(b => String(b.id) === String(enrollment.batch_id));
                      const instrument = batch ? instruments.find(i => String(i.id) === String(batch.instrument_id)) : null;
                      const enrolledDate = enrollment.enrolled_on ? new Date(enrollment.enrolled_on).toLocaleDateString() : 'N/A';
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2">
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            {instrument?.name || batch?.instrument_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-slate-500">
                            Joined: {enrolledDate}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleEditStudent(student)}
                  className="flex-1 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg font-medium hover:bg-orange-100 transition"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDeleteStudent(student.id)}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      ) : (
        /* Table View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              No students found. Add a new student to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Guardian</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Enrollments</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                            {(() => {
                              if (student.first_name && student.last_name) {
                                return `${student.first_name[0]}${student.last_name[0]}`;
                              }
                              const name = (student as any).name || 'N A';
                              const parts = name.split(' ');
                              return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}` : name.substring(0, 2).toUpperCase();
                            })()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                            </div>
                            <div className="text-xs text-slate-500">{student.email || ((student as any).metadata?.email) || 'No email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          {student.phone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          <div>{student.guardian_name || (student as any).guardian_contact || 'N/A'}</div>
                          <div className="text-xs text-slate-500">{student.guardian_phone || ((student as any).metadata?.guardian_phone) || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(student as any).enrollments && (student as any).enrollments.length > 0 ? (
                          <div className="space-y-1">
                            {(student as any).enrollments.map((enrollment: any, idx: number) => {
                              const batch = batches.find(b => String(b.id) === String(enrollment.batch_id));
                              const instrument = batch ? instruments.find(i => String(i.id) === String(batch.instrument_id)) : null;
                              const enrolledDate = enrollment.enrolled_on ? new Date(enrollment.enrolled_on).toLocaleDateString() : 'N/A';
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                    {instrument?.name || batch?.instrument_name || 'Unknown'}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {enrolledDate}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not enrolled</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditStudent(student)}
                            className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Name</label>
                  <input
                    type="text"
                    name="guardian_name"
                    value={formData.guardian_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Guardian Phone</label>
                  <input
                    type="tel"
                    name="guardian_phone"
                    value={formData.guardian_phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                />
              </div>

              {/* Batch Selection Section */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-lg font-bold text-slate-800 mb-3">Enroll in Batches (Optional)</h3>
                <p className="text-sm text-slate-600 mb-4">Select the batches and payment plan for this student</p>
                
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {batchesByInstrument.map(({ instrument, batches: instrumentBatches }) => (
                    <div key={instrument.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        🎵 {instrument.name}
                      </h4>
                      <div className="space-y-2">
                        {instrumentBatches.map(batch => {
                          const isSelected = selectedBatches.some(e => String(e.batch_id) === String(batch.id));
                          const enrollment = selectedBatches.find(e => String(e.batch_id) === String(batch.id));

                          return (
                            <div
                              key={batch.id}
                              className={`p-3 rounded-lg border transition ${
                                isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleBatchToggle(batch.id)}
                                  className="mt-1 w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                                />
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-900 text-sm">Batch {batch.id}</p>
                                  <p className="text-xs text-slate-600">
                                    {batch.day_of_week} • {batch.start_time} - {batch.end_time}
                                  </p>

                                  {isSelected && (
                                    <div className="mt-2 space-y-2">
                                      <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment Date</label>
                                        <input
                                          type="date"
                                          value={enrollment?.enrollment_date || ''}
                                          onChange={(e) => handleEnrollmentDateChange(batch.id, e.target.value)}
                                          className="text-xs px-2 py-1 rounded border border-slate-300 focus:border-indigo-500 outline-none w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Frequency</label>
                                        <select
                                          value={enrollment?.payment_frequency || 'monthly'}
                                          onChange={(e) => handlePaymentFrequencyChange(batch.id, e.target.value as PaymentFrequency)}
                                          className="text-xs px-2 py-1 rounded border border-slate-300 focus:border-indigo-500 outline-none w-full"
                                        >
                                          <option value="monthly">Monthly (8 classes)</option>
                                          <option value="quarterly">Quarterly (24 classes)</option>
                                          <option value="half_yearly">Half-Yearly (48 classes)</option>
                                          <option value="yearly">Yearly (96 classes)</option>
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
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
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition shadow-lg"
                >
                  {editingStudent ? 'Save Changes' : 'Add Student & Enroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
