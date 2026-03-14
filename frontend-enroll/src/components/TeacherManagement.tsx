import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { Instrument } from '../types';
import Teacher360View from './Teacher360View';
import PhoneLink from './PhoneLink';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  role: string;
  payout_type: 'per_student_monthly' | 'fixed';
  rate: number;
  is_active: boolean;
  batch_count: number;
  created_at: string;
  metadata?: {
    email?: string;
  };
}

interface Batch {
  id: string;
  instrument_id: string;
  instrument_name: string;
  teacher_id: string | null;
  recurrence: string;
  start_time: string;
  end_time: string;
  capacity: number;
}

interface TeacherManagementProps {
  instruments: Instrument[];
  onRefresh: () => void;
}

export default function TeacherManagement({ instruments, onRefresh }: TeacherManagementProps) {
  const [view, setView] = useState<'teachers' | 'batches' | 'attendance'>('teachers');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const [teacherBatches, setTeacherBatches] = useState<Record<string, Batch[]>>({});
  const [teacherStudents, setTeacherStudents] = useState<Record<string, any[]>>({});
  const [show360Modal, setShow360Modal] = useState(false);
  const [selected360Teacher, setSelected360Teacher] = useState<Teacher | null>(null);

  // Teacher Attendance state
  const [attendanceTeacherId, setAttendanceTeacherId] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [scheduledBatches, setScheduledBatches] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState<string | null>(null);
  // Extra/unscheduled class state
  const [numExtraBatches, setNumExtraBatches] = useState<number>(1);
  const [extraBatchSelections, setExtraBatchSelections] = useState<string[]>(['']);
  const [extraReasonPreset, setExtraReasonPreset] = useState<string>('');
  const [extraNotes, setExtraNotes] = useState<string>('');

  // Form state for teacher
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    phone: '',
    email: '',
    payout_type: 'per_student_monthly' as 'per_student_monthly' | 'fixed',
    rate: 0,
    is_active: true
  });

  // Form state for batch
  const [batchForm, setBatchForm] = useState({
    instrument_id: '',
    teacher_id: '',
    dayTimings: [
      { day: '', start_time: '', end_time: '' }
    ],
    capacity: 8
  });

  useEffect(() => {
    fetchTeachers();
    fetchBatches();
  }, []);

  useEffect(() => {
    if (view === 'attendance') fetchTeacherAttendance(attendanceDate);
  }, [view, attendanceDate]);

  // Reset extra-class form when teacher or date changes
  useEffect(() => {
    setNumExtraBatches(1);
    setExtraBatchSelections(['']);
    setExtraReasonPreset('');
    setExtraNotes('');
  }, [attendanceTeacherId, attendanceDate]);

  function handleNumExtraBatchesChange(maxOptions: number, n: number) {
    const clamped = Math.max(1, Math.min(maxOptions, n));
    setNumExtraBatches(clamped);
    setExtraBatchSelections(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push('');
      return next.slice(0, clamped);
    });
  }

  async function fetchTeacherAttendance(date: string) {
    try {
      setAttendanceLoading(true);
      const data = await apiGet(`/api/teachers/attendance?date=${date}`);
      setScheduledBatches(data.batches || []);
    } catch (err) {
      console.error('Error fetching teacher attendance:', err);
      setError('Failed to load attendance for this date');
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function markTeacherAttendance(batch: any, status: 'conducted' | 'not_conducted') {
    setAttendanceSaving(batch.batch_id);
    try {
      await apiPost('/api/teachers/attendance', {
        teacher_id: batch.teacher_id,
        batch_id: batch.batch_id,
        session_date: attendanceDate,
        status
      });
      setScheduledBatches(prev =>
        prev.map(b => b.batch_id === batch.batch_id ? { ...b, status } : b)
      );
    } catch (err) {
      console.error('Error marking attendance:', err);
      setError('Failed to save attendance');
    } finally {
      setAttendanceSaving(null);
    }
  }

  async function markAllTeacherAttendance(batches: any[], status: 'conducted' | 'not_conducted') {
    for (const batch of batches) {
      setAttendanceSaving(batch.batch_id);
      try {
        await apiPost('/api/teachers/attendance', {
          teacher_id: batch.teacher_id,
          batch_id: batch.batch_id,
          session_date: attendanceDate,
          status
        });
      } catch (err) {
        console.error('Error marking attendance:', err);
        setError('Failed to save attendance for one or more batches');
        setAttendanceSaving(null);
        return;
      }
    }
    setAttendanceSaving(null);
    setScheduledBatches(prev =>
      prev.map(b => batches.some(mb => mb.batch_id === b.batch_id) ? { ...b, status } : b)
    );
  }

  async function markExtraAttendance(status: 'conducted' | 'not_conducted') {
    if (!attendanceTeacherId) return;
    const validSelections = extraBatchSelections.filter(Boolean);
    if (validSelections.length === 0) return;
    const notes = [extraReasonPreset, extraNotes].filter(Boolean).join(' — ');

    for (const batchId of validSelections) {
      setAttendanceSaving(batchId);
      try {
        await apiPost('/api/teachers/attendance', {
          teacher_id: attendanceTeacherId,
          batch_id: batchId,
          session_date: attendanceDate,
          status,
          notes: notes || null
        });
      } catch (err) {
        console.error('Error marking extra attendance:', err);
        setError('Failed to save attendance');
        setAttendanceSaving(null);
        return;
      }
    }
    setAttendanceSaving(null);
    setSuccess(`Attendance marked for ${validSelections.length} batch${validSelections.length !== 1 ? 'es' : ''}.`);
    setNumExtraBatches(1);
    setExtraBatchSelections(['']);
    setExtraReasonPreset('');
    setExtraNotes('');
    await fetchTeacherAttendance(attendanceDate);
  }

  async function fetchTeachers() {
    try {
      setLoading(true);
      const data = await apiGet('/api/teachers');
      setTeachers(data.teachers || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }

  async function fetchBatches() {
    try {
      const data = await apiGet('/api/batches');
      setBatches(data.batches || []);
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  }

  function openAddModal() {
    setTeacherForm({
      name: '',
      phone: '',
      email: '',
      payout_type: 'per_student_monthly',
      rate: 0,
      is_active: true
    });
    setShowAddModal(true);
  }

  function openEditModal(teacher: Teacher) {
    setSelectedTeacher(teacher);
    setTeacherForm({
      name: teacher.name,
      phone: teacher.phone || '',
      email: teacher.metadata?.email || '',
      payout_type: teacher.payout_type,
      rate: teacher.rate || 0,
      is_active: teacher.is_active
    });
    setShowEditModal(true);
  }

  function openBatchModal() {
    setBatchForm({
      instrument_id: String(instruments[0]?.id || ''),
      teacher_id: '',
      dayTimings: [
        { day: '', start_time: '', end_time: '' }
      ],
      capacity: 8
    });
    setShowBatchModal(true);
  }

  function openEditBatchModal(batch: Batch) {
    // Parse recurrence to extract day timings
    const dayTimings = parseBatchRecurrence(batch.recurrence);
    setSelectedBatch(batch);
    setBatchForm({
      instrument_id: batch.instrument_id,
      teacher_id: batch.teacher_id || '',
      dayTimings: dayTimings.length > 0 ? dayTimings : [{ day: '', start_time: '', end_time: '' }],
      capacity: batch.capacity
    });
    setShowEditBatchModal(true);
  }

  function parseBatchRecurrence(recurrence: string) {
    // Parse "MON 17:00-18:00, WED 18:00-19:00" format
    const parts = recurrence.split(',').map(p => p.trim());
    return parts.map(part => {
      const match = part.match(/^([A-Z]{3})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (match) {
        return { day: match[1], start_time: match[2], end_time: match[3] };
      }
      return { day: '', start_time: '', end_time: '' };
    }).filter(dt => dt.day);
  }

  async function fetchTeacherBatches(teacherId: string) {
    try {
      const data = await apiGet(`/api/teachers/${teacherId}/batches`);
      setTeacherBatches(prev => ({ ...prev, [teacherId]: data.batches || [] }));
    } catch (err) {
      console.error('Error fetching teacher batches:', err);
    }
  }

  async function fetchTeacherStudents(teacherId: string) {
    try {
      const data = await apiGet(`/api/teachers/${teacherId}/students`);
      setTeacherStudents(prev => ({ ...prev, [teacherId]: data.students || [] }));
    } catch (err) {
      console.error('Error fetching teacher students:', err);
    }
  }

  function toggleTeacherExpand(teacherId: string) {
    if (expandedTeacher === teacherId) {
      setExpandedTeacher(null);
    } else {
      setExpandedTeacher(teacherId);
      if (!teacherBatches[teacherId]) {
        fetchTeacherBatches(teacherId);
      }
      if (!teacherStudents[teacherId]) {
        fetchTeacherStudents(teacherId);
      }
    }
  }

  async function handleAddTeacher() {
    if (!teacherForm.name.trim()) {
      setError('Teacher name is required');
      return;
    }

    try {
      await apiPost('/api/teachers', teacherForm);
      
      setSuccess('Teacher added successfully!');
      setShowAddModal(false);
      fetchTeachers();
      onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding teacher:', err);
      setError('Failed to add teacher');
    }
  }

  async function handleUpdateTeacher() {
    if (!selectedTeacher) return;

    try {
      await apiPut(`/api/teachers/${selectedTeacher.id}`, teacherForm);
      
      setSuccess('Teacher updated successfully!');
      setShowEditModal(false);
      setSelectedTeacher(null);
      fetchTeachers();
      onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating teacher:', err);
      setError('Failed to update teacher');
    }
  }

  async function handleCreateBatch() {
    if (!batchForm.instrument_id) {
      setError('Instrument is required');
      return;
    }

    // Validate at least one day timing is filled
    const validTimings = batchForm.dayTimings.filter(dt => dt.day && dt.start_time && dt.end_time);
    if (validTimings.length === 0) {
      setError('At least one day with timings is required');
      return;
    }

    try {
      // Create recurrence string: "MON 17:00-18:00, WED 18:00-19:00"
      const recurrence = validTimings.map(dt => 
        `${dt.day} ${dt.start_time}-${dt.end_time}`
      ).join(', ');

      const batchData = {
        instrument_id: batchForm.instrument_id,
        teacher_id: batchForm.teacher_id || null,
        recurrence: recurrence,
        start_time: validTimings[0].start_time,
        end_time: validTimings[0].end_time,
        capacity: batchForm.capacity
      };

      await apiPost('/api/batches', batchData);
      
      setSuccess('Batch created successfully!');
      setShowBatchModal(false);
      fetchBatches();
      fetchTeachers();
      onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating batch:', err);
      setError('Failed to create batch');
    }
  }

  async function handleUpdateBatch() {
    if (!selectedBatch) return;

    const validTimings = batchForm.dayTimings.filter(dt => dt.day && dt.start_time && dt.end_time);
    if (validTimings.length === 0) {
      setError('At least one day with timings is required');
      return;
    }

    try {
      const recurrence = validTimings.map(dt => 
        `${dt.day} ${dt.start_time}-${dt.end_time}`
      ).join(', ');

      const batchData = {
        teacher_id: batchForm.teacher_id || null,
        recurrence: recurrence,
        start_time: validTimings[0].start_time,
        end_time: validTimings[0].end_time,
        capacity: batchForm.capacity
      };

      await apiPut(`/api/batches/${selectedBatch.id}`, batchData);
      
      setSuccess('Batch updated successfully!');
      setShowEditBatchModal(false);
      setSelectedBatch(null);
      fetchBatches();
      fetchTeachers();
      // Refresh expanded teacher batches if any
      if (expandedTeacher) {
        fetchTeacherBatches(expandedTeacher);
      }
      onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating batch:', err);
      setError('Failed to update batch');
    }
  }

  async function handleDeleteTeacher(id: string) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    try {
      await apiDelete(`/api/teachers/${id}`);
      setSuccess('Teacher deleted successfully');
      fetchTeachers();
      onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete teacher');
    }
  }

  async function handleDeleteBatch(id: string) {
    if (!confirm('Are you sure you want to delete this batch?')) return;
    try {
      await apiDelete(`/api/batches/${id}`);
      setSuccess('Batch deleted successfully');
      fetchBatches();
      onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete batch');
    }
  }

  const activeTeachers = teachers.filter(t => t.is_active);
  const inactiveTeachers = teachers.filter(t => !t.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {view === 'teachers' ? 'Teacher Management' : view === 'batches' ? 'Batch Management' : 'Teacher Attendance'}
          </h2>
          <p className="text-slate-600 mt-1">Manage teachers, pay packages, and batch assignments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openBatchModal}
            className="px-4 py-2 bg-white text-orange-600 border-2 border-orange-500 rounded-lg hover:bg-orange-50 transition-colors font-medium"
          >
            + Create Batch
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-colors font-medium shadow-lg shadow-orange-500/30"
          >
            + Add Teacher
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-700 font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setView('teachers')}
          className={`bg-gradient-to-br from-orange-500 to-amber-500 text-white p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.02] ${view === 'teachers' ? 'ring-4 ring-orange-200' : 'opacity-90'}`}
        >
          <h3 className="text-sm font-medium opacity-90">Active Teachers</h3>
          <p className="text-4xl font-bold mt-2">{activeTeachers.length}</p>
        </div>
        <div
          onClick={() => setView('batches')}
          className={`bg-gradient-to-br from-blue-500 to-indigo-500 text-white p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.02] ${view === 'batches' ? 'ring-4 ring-blue-200' : 'opacity-90'}`}
        >
          <h3 className="text-sm font-medium opacity-90">Total Batches</h3>
          <p className="text-4xl font-bold mt-2">{batches.length}</p>
        </div>
        <div
          onClick={() => setView('attendance')}
          className={`bg-gradient-to-br from-violet-500 to-purple-600 text-white p-6 rounded-xl shadow-lg cursor-pointer transition-transform hover:scale-[1.02] ${view === 'attendance' ? 'ring-4 ring-violet-200' : 'opacity-90'}`}
        >
          <h3 className="text-sm font-medium opacity-90">Mark Attendance</h3>
          <p className="text-lg font-bold mt-3">Today's Sessions</p>
          <p className="text-xs mt-1 opacity-75">Record which classes were conducted</p>
        </div>
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-slate-600">Loading teachers...</p>
        </div>
      ) : view === 'teachers' ? (
        <div className="space-y-6">
          {/* Active Teachers */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Active Teachers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTeachers.map(teacher => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onEdit={() => openEditModal(teacher)}
                  onDelete={() => handleDeleteTeacher(teacher.id)}
                  onView360={() => { setSelected360Teacher(teacher); setShow360Modal(true); }}
                  isExpanded={expandedTeacher === teacher.id}
                  onToggleExpand={() => toggleTeacherExpand(teacher.id)}
                  batches={teacherBatches[teacher.id] || []}
                  students={teacherStudents[teacher.id]}
                  onEditBatch={openEditBatchModal}
                />
              ))}
              {activeTeachers.length === 0 && (
                <div className="col-span-3 text-center py-12 text-slate-500">
                  No active teachers found. Add your first teacher!
                </div>
              )}
            </div>
          </div>

          {/* Inactive Teachers */}
          {inactiveTeachers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-500 mb-4">Inactive Teachers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveTeachers.map(teacher => (
                  <TeacherCard
                    key={teacher.id}
                    teacher={teacher}
                    onEdit={() => openEditModal(teacher)}
                    onDelete={() => handleDeleteTeacher(teacher.id)}
                    onView360={() => { setSelected360Teacher(teacher); setShow360Modal(true); }}
                    isExpanded={expandedTeacher === teacher.id}
                    onToggleExpand={() => toggleTeacherExpand(teacher.id)}
                    batches={teacherBatches[teacher.id] || []}
                    students={teacherStudents[teacher.id]}
                    onEditBatch={openEditBatchModal}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : view === 'batches' ? (
        /* Batches View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="py-3 px-4 font-semibold">Instrument</th>
                  <th className="py-3 px-4 font-semibold">Teacher</th>
                  <th className="py-3 px-4 font-semibold">Schedule</th>
                  <th className="py-3 px-4 font-semibold">Time</th>
                  <th className="py-3 px-4 font-semibold">Capacity</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map(batch => (
                  <tr key={batch.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {batch.instrument_name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {batch.teacher_name || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{batch.recurrence}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {batch.start_time?.slice(0, 5)} - {batch.end_time?.slice(0, 5)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{batch.capacity}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditBatchModal(batch)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">No batches found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ── ATTENDANCE VIEW ── */}
      {view === 'attendance' && (() => {
        const selectedAttTeacher = teachers.find(t => t.id === attendanceTeacherId) || null;
        const teacherScheduledBatches = scheduledBatches.filter(b => b.teacher_id === attendanceTeacherId);
        const teacherBatchOptions = batches.filter(b => b.teacher_id === attendanceTeacherId);
        const formattedDate = attendanceDate
          ? new Date(attendanceDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : '';

        return (
          <div className="space-y-4">
            {/* Teacher + Date selectors */}
            <div className="flex items-center gap-4 bg-violet-50 border border-violet-100 rounded-xl p-4 flex-wrap gap-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-violet-700 whitespace-nowrap">Teacher:</label>
                <select
                  value={attendanceTeacherId}
                  onChange={e => setAttendanceTeacherId(e.target.value)}
                  className="px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                >
                  <option value="">Select teacher…</option>
                  {teachers.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-violet-700 whitespace-nowrap">Date:</label>
                <input
                  type="date"
                  value={attendanceDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>
              {formattedDate && (
                <span className="text-xs text-violet-500 ml-auto hidden sm:block">{formattedDate}</span>
              )}
            </div>

            {/* Prompt to select teacher */}
            {!attendanceTeacherId && (
              <div className="text-center py-12 border rounded-xl border-dashed border-slate-200 text-slate-400">
                <p className="text-lg font-medium">Select a teacher above</p>
                <p className="text-sm mt-1">Pick a teacher and date to view or mark their attendance.</p>
              </div>
            )}

            {/* Teacher selected: loading */}
            {attendanceTeacherId && attendanceLoading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500"></div>
                <p className="mt-3 text-slate-500 text-sm">Loading…</p>
              </div>
            )}

            {/* Teacher selected, not loading: show scheduled batches OR unscheduled warning */}
            {attendanceTeacherId && !attendanceLoading && (
              <>
                {teacherScheduledBatches.length > 0 ? (
                  /* ── Scheduled batches: mark conducted / not conducted ── */
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap gap-3 justify-between items-center">
                      <span className="text-sm font-semibold text-slate-600">
                        {teacherScheduledBatches.length} class{teacherScheduledBatches.length !== 1 ? 'es' : ''} scheduled for {selectedAttTeacher?.name} on {formattedDate}
                      </span>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-2">
                          <button
                            disabled={attendanceSaving !== null}
                            onClick={() => markAllTeacherAttendance(teacherScheduledBatches, 'conducted')}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-wait transition-colors"
                          >
                            Mark All Conducted
                          </button>
                          <button
                            disabled={attendanceSaving !== null}
                            onClick={() => markAllTeacherAttendance(teacherScheduledBatches, 'not_conducted')}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-wait transition-colors"
                          >
                            Mark All Not Conducted
                          </button>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Conducted</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Not Conducted</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span> Unmarked</span>
                        </div>
                      </div>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                          <th className="py-3 px-4">Instrument</th>
                          <th className="py-3 px-4">Time</th>
                          <th className="py-3 px-4">Schedule</th>
                          <th className="py-3 px-4 text-center">Mark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {teacherScheduledBatches.map(b => (
                          <tr key={b.batch_id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-medium text-slate-800">{b.instrument_name}</td>
                            <td className="py-3 px-4 text-slate-600 text-sm">{b.start_time} – {b.end_time}</td>
                            <td className="py-3 px-4 text-slate-500 text-xs">{b.recurrence}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2 justify-center">
                                <button
                                  disabled={attendanceSaving === b.batch_id}
                                  onClick={() => markTeacherAttendance(b, 'conducted')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                                    b.status === 'conducted'
                                      ? 'bg-green-500 text-white border-green-500 shadow'
                                      : 'bg-white text-green-600 border-green-300 hover:bg-green-50'
                                  } ${attendanceSaving === b.batch_id ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  Conducted
                                </button>
                                <button
                                  disabled={attendanceSaving === b.batch_id}
                                  onClick={() => markTeacherAttendance(b, 'not_conducted')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                                    b.status === 'not_conducted'
                                      ? 'bg-red-500 text-white border-red-500 shadow'
                                      : 'bg-white text-red-500 border-red-300 hover:bg-red-50'
                                  } ${attendanceSaving === b.batch_id ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  Not Conducted
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ── No class scheduled: unscheduled / extra class form ── */
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">⚠️</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-amber-900">No class scheduled</h3>
                        <p className="text-amber-800 text-sm mt-1">
                          <strong>{selectedAttTeacher?.name}</strong> doesn't have a class scheduled on {formattedDate}.
                        </p>
                        <p className="text-amber-700 text-sm mt-2">
                          Do you still want to mark attendance? Select a reason below:
                        </p>

                        {/* Reason presets */}
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {['Compensation Class', 'Extra Class', 'Trial Class', 'Other'].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setExtraReasonPreset(prev => prev === preset ? '' : preset)}
                              className={`px-3 py-1 text-sm rounded-full border transition-all ${
                                extraReasonPreset === preset
                                  ? 'bg-amber-500 text-white border-amber-500 shadow'
                                  : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-100'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {/* Free-text notes */}
                        <input
                          type="text"
                          placeholder="Additional notes (e.g. replacing missed class on Feb 10)…"
                          value={extraNotes}
                          onChange={e => setExtraNotes(e.target.value)}
                          className="mt-3 w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        />

                        {/* Number of batches + batch selectors */}
                        {teacherBatchOptions.length > 0 ? (
                          <>
                            <div className="mt-3 flex items-center gap-3">
                              <label className="text-sm font-medium text-amber-800 whitespace-nowrap">
                                How many batches were conducted?
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={teacherBatchOptions.length}
                                value={numExtraBatches}
                                onChange={e => handleNumExtraBatchesChange(
                                  teacherBatchOptions.length,
                                  parseInt(e.target.value) || 1
                                )}
                                className="w-16 px-2 py-1.5 border border-amber-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                              />
                              <span className="text-xs text-amber-600">
                                (max {teacherBatchOptions.length})
                              </span>
                            </div>
                            <div className="mt-2 space-y-2">
                              {extraBatchSelections.map((batchId, idx) => (
                                <select
                                  key={idx}
                                  value={batchId}
                                  onChange={e => {
                                    const next = [...extraBatchSelections];
                                    next[idx] = e.target.value;
                                    setExtraBatchSelections(next);
                                  }}
                                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                >
                                  <option value="">Select batch {idx + 1}…</option>
                                  {teacherBatchOptions.map(b => (
                                    <option key={b.id} value={b.id}>
                                      {b.instrument_name} ({b.recurrence})
                                    </option>
                                  ))}
                                </select>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-amber-700 italic">
                            This teacher has no assigned batches. Assign a batch first before marking attendance.
                          </p>
                        )}

                        {/* Action buttons */}
                        {teacherBatchOptions.length > 0 && (() => {
                          const allSelected = extraBatchSelections.every(Boolean);
                          const canSave = extraReasonPreset && allSelected && attendanceSaving === null;
                          return (
                            <div className="flex gap-3 mt-4 flex-wrap">
                              <button
                                disabled={!canSave}
                                onClick={() => markExtraAttendance('conducted')}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
                              >
                                {attendanceSaving ? 'Saving…' : `Mark ${numExtraBatches > 1 ? `All ${numExtraBatches} ` : ''}as Conducted`}
                              </button>
                              <button
                                disabled={!canSave}
                                onClick={() => markExtraAttendance('not_conducted')}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
                              >
                                {attendanceSaving ? 'Saving…' : `Mark ${numExtraBatches > 1 ? `All ${numExtraBatches} ` : ''}as Not Conducted`}
                              </button>
                              {!extraReasonPreset && (
                                <span className="text-xs text-amber-600 self-center">Select a reason to enable marking.</span>
                              )}
                              {extraReasonPreset && !allSelected && (
                                <span className="text-xs text-amber-600 self-center">Select a batch for each row.</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Teacher 360 Modal */}
      {show360Modal && selected360Teacher && (
        <Teacher360View
          teacherId={String(selected360Teacher.id)}
          isModal
          onClose={() => { setShow360Modal(false); setSelected360Teacher(null); }}
        />
      )}

      {/* Add Teacher Modal */}
      {showAddModal && (
        <TeacherModal
          title="Add New Teacher"
          form={teacherForm}
          setForm={setTeacherForm}
          onSave={handleAddTeacher}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Teacher Modal */}
      {showEditModal && (
        <TeacherModal
          title="Edit Teacher"
          form={teacherForm}
          setForm={setTeacherForm}
          onSave={handleUpdateTeacher}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTeacher(null);
          }}
        />
      )}

      {/* Create Batch Modal */}
      {showBatchModal && (
        <BatchModal
          form={batchForm}
          setForm={setBatchForm}
          instruments={instruments}
          teachers={activeTeachers}
          onSave={handleCreateBatch}
          onClose={() => setShowBatchModal(false)}
        />
      )}

      {/* Edit Batch Modal */}
      {showEditBatchModal && selectedBatch && (
        <BatchModal
          form={batchForm}
          setForm={setBatchForm}
          instruments={instruments}
          teachers={activeTeachers}
          onSave={handleUpdateBatch}
          onClose={() => {
            setShowEditBatchModal(false);
            setSelectedBatch(null);
          }}
          isEdit={true}
          batchInstrument={selectedBatch.instrument_name}
        />
      )}
    </div>
  );
}

// Teacher Card Component
function TeacherCard({
  teacher,
  onEdit,
  onDelete,
  onView360,
  isExpanded,
  onToggleExpand,
  batches,
  students,
  onEditBatch
}: {
  teacher: Teacher;
  onEdit: () => void;
  onDelete: () => void;
  onView360: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  batches: Batch[];
  students?: any[];
  onEditBatch?: (batch: Batch) => void;
}) {
  const getPayTypeLabel = (type: string) => {
    if (type === 'per_student_monthly') return 'Per Student/Month';
    if (type === 'fixed') return 'Fixed Salary';
    return type.replace('_', ' ');
  };

  return (
    <div className={`bg-white rounded-lg border-2 transition-all hover:shadow-lg ${
      teacher.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {teacher.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{teacher.name}</h3>
              <p className="text-sm text-slate-500"><PhoneLink phone={teacher.phone} fallback="No phone" /></p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onView360}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              360
            </button>
            <button
              onClick={onEdit}
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 font-medium text-sm"
            >
              Delete
            </button>
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Pay Type:</span>
            <span className="font-medium">{getPayTypeLabel(teacher.payout_type)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Rate:</span>
            <span className="font-medium">₹{teacher.rate.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Batches:</span>
            <span className="font-medium">{teacher.batch_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Status:</span>
            <span className={`font-medium ${teacher.is_active ? 'text-green-600' : 'text-slate-400'}`}>
              {teacher.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {teacher.batch_count > 0 && (
          <button
            onClick={onToggleExpand}
            className="w-full mt-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 border-t border-slate-200 transition-colors"
          >
            {isExpanded ? '▼ Hide Details' : '▶ View Batches & Students'}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50">
          {/* Batches sub-section */}
          {batches.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Assigned Batches</h4>
              <div className="space-y-2">
                {batches.map(batch => (
                  <div key={batch.id} className="bg-white rounded p-3 border border-slate-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 text-sm">{batch.instrument_name}</div>
                        <div className="text-xs text-slate-600 mt-1">{batch.recurrence}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-500">Cap: {batch.capacity}</div>
                        {onEditBatch && (
                          <button
                            onClick={() => onEditBatch(batch)}
                            className="text-orange-600 hover:text-orange-700 text-xs font-medium px-2 py-1 rounded hover:bg-orange-50"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students sub-section */}
          <div className={`p-4 ${batches.length > 0 ? 'border-t border-slate-200' : ''}`}>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Enrolled Students
              {students !== undefined && (
                <span className="ml-2 text-xs font-normal text-slate-500">({students.length})</span>
              )}
            </h4>
            {students === undefined ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-orange-400"></div>
                Loading…
              </div>
            ) : students.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active students enrolled.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {students.map(s => (
                  <div key={s.id} className="bg-white rounded p-2 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.instrument} · {s.recurrence}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500"><PhoneLink phone={s.phone || s.guardian_contact} fallback="" /></div>
                      {s.classes_remaining !== null && (
                        <div className="text-xs text-orange-600 font-medium">{s.classes_remaining} cls left</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Teacher Modal Component
function TeacherModal({ 
  title, 
  form, 
  setForm, 
  onSave, 
  onClose 
}: { 
  title: string;
  form: any;
  setForm: (form: any) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-slate-900 mb-4">{title}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Teacher name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="teacher@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payout Type *</label>
            <select
              value={form.payout_type}
              onChange={e => setForm({ ...form, payout_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="per_student_monthly">Per Student Per Month</option>
              <option value="fixed">Fixed Salary</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rate (₹) * {form.payout_type === 'per_student_monthly' ? 'per student per month' : 'per month (fixed)'}
            </label>
            <input
              type="number"
              value={form.rate}
              onChange={e => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="0"
              min="0"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
              Active Teacher
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-colors font-medium shadow-lg"
          >
            Save Teacher
          </button>
        </div>
      </div>
    </div>
  );
}

// Batch Modal Component
function BatchModal({
  form,
  setForm,
  instruments,
  teachers,
  onSave,
  onClose,
  isEdit = false,
  batchInstrument
}: {
  form: any;
  setForm: (form: any) => void;
  instruments: Instrument[];
  teachers: Teacher[];
  onSave: () => void;
  onClose: () => void;
  isEdit?: boolean;
  batchInstrument?: string;
}) {
  const addDayTiming = () => {
    setForm({
      ...form,
      dayTimings: [...form.dayTimings, { day: '', start_time: '', end_time: '' }]
    });
  };

  const removeDayTiming = (index: number) => {
    if (form.dayTimings.length > 1) {
      setForm({
        ...form,
        dayTimings: form.dayTimings.filter((_: any, i: number) => i !== index)
      });
    }
  };

  const updateDayTiming = (index: number, field: 'day' | 'start_time' | 'end_time', value: string) => {
    const newDayTimings = [...form.dayTimings];
    newDayTimings[index][field] = value;
    setForm({ ...form, dayTimings: newDayTimings });
  };

  const dayOptions = [
    { value: 'MON', label: 'Monday' },
    { value: 'TUE', label: 'Tuesday' },
    { value: 'WED', label: 'Wednesday' },
    { value: 'THU', label: 'Thursday' },
    { value: 'FRI', label: 'Friday' },
    { value: 'SAT', label: 'Saturday' },
    { value: 'SUN', label: 'Sunday' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-slate-900 mb-4">
          {isEdit ? 'Edit Batch' : 'Create New Batch'}
        </h3>
        
        <div className="space-y-4">
          {isEdit ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Instrument</label>
              <div className="text-slate-900 font-medium">{batchInstrument}</div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instrument *</label>
              <select
                value={form.instrument_id}
                onChange={e => setForm({ ...form, instrument_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select instrument</option>
                {instruments.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teacher</label>
            <select
              value={form.teacher_id}
              onChange={e => setForm({ ...form, teacher_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">No teacher assigned</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Day & Timings *</h4>
              <button
                type="button"
                onClick={addDayTiming}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
              >
                + Add Day
              </button>
            </div>
            
            <div className="space-y-3">
              {form.dayTimings.map((dayTiming: any, index: number) => (
                <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
                        <select
                          value={dayTiming.day}
                          onChange={e => updateDayTiming(index, 'day', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Select day</option>
                          {dayOptions.map(day => (
                            <option key={day.value} value={day.value}>{day.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={dayTiming.start_time}
                            onChange={e => updateDayTiming(index, 'start_time', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">End Time</label>
                          <input
                            type="time"
                            value={dayTiming.end_time}
                            onChange={e => updateDayTiming(index, 'end_time', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                    {form.dayTimings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDayTiming(index)}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Each day can have different timings. Add multiple days for classes held on different days.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Capacity *</label>
            <input
              type="number"
              value={form.capacity}
              onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 8 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="8"
              min="1"
            />
          </div>

          {!isEdit && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                <strong>Batch Summary:</strong> {
                  (() => {
                    const validDays = form.dayTimings.filter((dt: any) => dt.day && dt.start_time && dt.end_time);
                    return validDays.length > 0 
                      ? `Creating 1 batch with ${validDays.length} day${validDays.length > 1 ? 's' : ''}`
                      : 'No valid day timings added yet';
                  })()
                }
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-colors font-medium shadow-lg"
          >
            {isEdit ? 'Update Batch' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}
