import React, { useState, useEffect } from 'react';
import { Student, Batch, Instrument } from '../types';
import { apiDelete, apiGet, apiPost } from '../api';
import { authenticatedFetch, getCurrentUser } from '../auth';
import { API_BASE_URL } from '../config';
import Student360View from './Student360View';
import StudentDetails, { EnrollmentSelection } from './StudentDetails';

interface StudentManagementProps {
  students: Student[];
  batches: Batch[];
  instruments: Instrument[];
  onRefresh: () => void;
}

const StudentManagement: React.FC<StudentManagementProps> = ({ students: propStudents, batches, instruments, onRefresh }) => {
  const [successBanner, setSuccessBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [students, setStudents] = useState<Student[]>(propStudents || []);
  const [teachers, setTeachers] = useState<any[]>([]);
  // Default filter to Keyboard instrument if present
  const [filterInstruments, setFilterInstruments] = useState<(string | number)[]>([]);
  const [filterBatches, setFilterBatches] = useState<(string | number)[]>([]);

  useEffect(() => {
    setStudents(propStudents || []);
  }, [propStudents]);

  const [filterTeacher, setFilterTeacher] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedStudentId, setSelectedStudentId] = useState<string | number | null>(null);

  // Fetch teachers on mount
  useEffect(() => {
    apiGet('/api/teachers').then(res => setTeachers(res.teachers || []));
  }, []);

  // Clear invalid batch filters when instruments change
  useEffect(() => {
    const relevantBatchIds = batches
      .filter(b => filterInstruments.includes(b.instrument_id))
      .map(b => b.id);

    setFilterBatches(prev => prev.filter(id => relevantBatchIds.includes(id as any)));
  }, [filterInstruments, batches]);

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
  console.log('- Instruments received:', instruments?.length, instruments);
  console.log('- Batches received:', batches?.length, batches);

  // Filter students by instrument, teacher, and search term
  const filteredStudents = students.filter(student => {
    const studentBatches = (student as any).batches || [];
    const isActive = (student as any).is_active !== false;

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'active' && !isActive) return false;
      if (filterStatus === 'inactive' && isActive) return false;
    }

    // Search term filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const nameMatch = ((student as any).name || '').toLowerCase().includes(lowerSearch);
      const emailMatch = (student.email || ((student as any).metadata?.email) || '').toLowerCase().includes(lowerSearch);
      if (!nameMatch && !emailMatch) {
        return false;
      }
    }

    // Role-based filter for non-admins
    if (!isAdmin) {
      const email = (student.email || (student as any).metadata?.email || '').toLowerCase();
      if (!userEmail || email !== userEmail) return false;
    }

    // If student is inactive, skip batch/instrument/teacher filters as they have no active enrollments
    if (!isActive) return true;

    // Instrument filter
    if (filterInstruments.length > 0) {
      const hasInstrument = studentBatches.some((batch: any) => batch.instrument_id && filterInstruments.includes(batch.instrument_id));
      if (!hasInstrument) return false;
    }

    // Batch filter
    if (filterBatches.length > 0) {
      const hasBatch = studentBatches.some((batch: any) => batch.batch_id && filterBatches.includes(batch.batch_id));
      if (!hasBatch) return false;
    }

    // Teacher filter
    if (filterTeacher !== 'all') {
      // This relies on `teacher_id` being present in the student's batch data, which will require a backend adjustment.
      const hasTeacher = studentBatches.some((batch: any) => batch.teacher_id && String(batch.teacher_id) === filterTeacher);
      if (!hasTeacher) return false;
    }

    return true; // If all filters pass, include the student
  });

  console.log('- Filtered students count:', filteredStudents.length);

  const handleAddStudent = () => {
    setEditingStudent(null);
    setShowAddModal(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setShowAddModal(true);
  };

  const handleSaveStudent = async (formData: any, selectedBatches: EnrollmentSelection[], prospectId?: string) => {
    // Validate batch selection for new students
    if (!editingStudent && selectedBatches.length === 0) {
      setErrorBanner('Please select at least one batch. A student must be enrolled in a batch.');
      setTimeout(() => setErrorBanner(''), 3000);
      return;
    }

    try {
      let url = '/api/students';
      let method = 'POST';

      if (editingStudent) {
        // Defensive: fallback to student.id if editingStudent.id is missing
        const studentId = editingStudent.id || (editingStudent as any)?.student_id;
        if (!studentId) {
          setErrorBanner('Cannot update: student ID is missing.');
          return;
        }
        url = `/api/students/${studentId}`;
        method = 'PUT';
      } else if (prospectId) {
        // If converting a prospect, hit the PUT endpoint so it upgrades them rather than creating duplicate
        url = `/api/students/${prospectId}`;
        method = 'PUT';
      }

      // Format data for backend: combine first_name + last_name into name field
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
          // Find instrument_id from batches prop
          const batchObj = batches.find(b => String(b.id) === String(batch.batch_id));
          return {
            batch_id: batch.batch_id,
            instrument_id: batchObj?.instrument_id || null,
            payment_frequency: batch.payment_frequency,
            enrolled_on: batch.enrollment_date || new Date()
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
        setShowAddModal(false);
        setSuccessBanner('Student added successfully!');
        onRefresh();
        setTimeout(() => setSuccessBanner(''), 3000);
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
    if (!confirm('Are you sure you want to delete this student? This will also remove their enrollments.')) {
      return;
    }

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

  const handleInstrumentToggle = (instrumentId: string | number) => {
    setFilterInstruments(prev =>
      prev.includes(instrumentId)
        ? prev.filter(id => id !== instrumentId)
        : [...prev, instrumentId]
    );
  };

  const handleBatchToggle = (batchId: string | number) => {
    setFilterBatches(prev =>
      prev.includes(batchId)
        ? prev.filter(id => id !== batchId)
        : [...prev, batchId]
    );
  };

  const relevantBatches = batches.filter(b => filterInstruments.includes(b.instrument_id));

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
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`px-4 py-2 rounded-md font-medium transition ${viewMode === 'card' ? 'bg-white text-orange-600 shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              📇 Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-md font-medium transition ${viewMode === 'table' ? 'bg-white text-orange-600 shadow' : 'text-slate-600 hover:text-slate-900'
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
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Status</h3>
          <div className="flex gap-4">
            {['active', 'inactive', 'all'].map(status => (
              <label key={status} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="status" checked={filterStatus === status} onChange={() => setFilterStatus(status as any)} className="text-orange-600 focus:ring-orange-500" />
                <span className="text-sm text-slate-700 capitalize">{status}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Instrument</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(instruments || []).map(inst => (
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

        {filterInstruments.length > 0 && relevantBatches.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Batch</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {relevantBatches.map(batch => (
                <label key={batch.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterBatches.includes(batch.id)}
                    onChange={() => handleBatchToggle(batch.id)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">
                    {batch.recurrence} {batch.start_time ? `(${String(batch.start_time).slice(0, 5)})` : ''}
                  </span>
                </label>
              ))}
            </div>
            {filterBatches.length > 0 && (
              <button
                onClick={() => setFilterBatches([])}
                className="mt-3 text-xs text-orange-600 hover:text-orange-800 font-medium"
              >
                Clear batch filters
              </button>
            )}
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Filter by Teacher</h3>
          <select
            value={filterTeacher}
            onChange={e => setFilterTeacher(e.target.value)}
            className="w-full md:w-64 px-4 py-2 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
          >
            <option value="all">All Teachers</option>
            {teachers.map(teacher => (
              <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
            ))}
          </select>
        </div>
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
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                      {(() => {
                        if (student.first_name && student.last_name) {
                          return `${student.first_name[0]}${student.last_name[0]}`;
                        }
                        const name = (student as any).name || 'N A';
                        const parts = name.split(' ');
                        return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.substring(0, 2).toUpperCase();
                      })()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                      </h3>
                      <p className="text-xs text-slate-500">{((student as any).metadata?.email) || student.email || 'No email'}</p>
                    </div>
                  </div>
                </div>
                {(student as any).is_active === false && (
                  <div className="mb-4">
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">Inactive</span>
                  </div>
                )}

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>📱</span>
                    <span>{student.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>👤</span>
                    <span>{((student as any).metadata?.guardian_name) || student.guardian_name || (student as any).guardian_contact || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>📞</span>
                    <span>{((student as any).metadata?.guardian_phone) || student.guardian_phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <span className="mt-1">📍</span>
                    <span className="flex-1">{((student as any).metadata?.address) || student.address || 'No address provided'}</span>
                  </div>
                </div>

                {/* Show enrolled instruments */}
                {(student as any).batches && (student as any).batches.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Instruments:</p>
                    <div className="flex flex-wrap gap-2">
                      {[...new Set((student as any).batches.map((b: any) => b.instrument).filter(Boolean))].map((instrument, idx) => (
                        <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                          {instrument}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedStudentId(student.id || (student as any).student_id)}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition"
                  >
                    View 360°
                  </button>
                  <button
                    onClick={() => handleEditStudent(student)}
                    className="flex-1 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg font-medium hover:bg-orange-100 transition"
                  >
                    ✏️ Edit
                  </button>
                  {(student as any).is_active !== false ? (
                    <button
                      onClick={() => handleDeleteStudent((student as any).student_id)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition"
                    >
                      🗑️
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestoreStudent((student as any).student_id)}
                      className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg font-medium hover:bg-green-100 transition"
                    >
                      ♻️ Restore
                    </button>
                  )}
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
                              return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.substring(0, 2).toUpperCase();
                            })()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown'}
                              {(student as any).is_active === false && (
                                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">Inactive</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{((student as any).metadata?.email) || student.email || 'No email'}</div>
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
                          <div>{((student as any).metadata?.guardian_name) || student.guardian_name || (student as any).guardian_contact || 'N/A'}</div>
                          <div className="text-xs text-slate-500">{((student as any).metadata?.guardian_phone) || student.guardian_phone || 'N/A'}</div>
                          <div className="text-xs text-slate-500">{((student as any).metadata?.address) || student.address || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(student as any).batches && (student as any).batches.length > 0 ? (
                          <div className="space-y-1">
                            {(student as any).batches.map((batch: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {batch.instrument || 'Unknown'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {batch.teacher || 'No teacher'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not enrolled</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedStudentId(student.id || (student as any).student_id)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                          >
                            360°
                          </button>
                          <button
                            onClick={() => handleEditStudent(student)}
                            className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition"
                          >
                            ✏️ Edit
                          </button>
                          {(student as any).is_active !== false ? (
                            <button
                              onClick={() => handleDeleteStudent((student as any).student_id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                            >
                              🗑️
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreStudent((student as any).student_id)}
                              className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition"
                            >
                              ♻️
                            </button>
                          )}
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

            <StudentDetails
              student={editingStudent}
              batches={batches}
              instruments={instruments}
              onSave={handleSaveStudent}
              onCancel={() => setShowAddModal(false)}
            />
          </div>
        </div>
      )}

      {selectedStudentId && (
        <Student360View
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          isModal={true}
        />
      )}
    </div>
  );
};

export default StudentManagement;
