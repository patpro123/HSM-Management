import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { Instrument } from '../types';
import Teacher360View from './Teacher360View';
import TeacherCard from './TeacherManagement/TeacherCard';
import TeacherModal from './TeacherManagement/TeacherModal';
import BatchModal from './TeacherManagement/BatchModal';
import BatchesTable from './TeacherManagement/BatchesTable';
import TeacherAttendanceView from './TeacherManagement/TeacherAttendanceView';

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
        instrument_id: batchForm.instrument_id,
        teacher_id: batchForm.teacher_id || null,
        recurrence,
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
        recurrence,
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
        <BatchesTable
          batches={batches}
          onEditBatch={openEditBatchModal}
          onDeleteBatch={handleDeleteBatch}
        />
      ) : null}

      {/* Attendance View */}
      {view === 'attendance' && (
        <TeacherAttendanceView
          teachers={teachers}
          batches={batches}
          attendanceTeacherId={attendanceTeacherId}
          setAttendanceTeacherId={setAttendanceTeacherId}
          attendanceDate={attendanceDate}
          setAttendanceDate={setAttendanceDate}
          scheduledBatches={scheduledBatches}
          attendanceLoading={attendanceLoading}
          attendanceSaving={attendanceSaving}
          numExtraBatches={numExtraBatches}
          extraBatchSelections={extraBatchSelections}
          extraReasonPreset={extraReasonPreset}
          extraNotes={extraNotes}
          setExtraReasonPreset={setExtraReasonPreset}
          setExtraNotes={setExtraNotes}
          handleNumExtraBatchesChange={handleNumExtraBatchesChange}
          setExtraBatchSelections={setExtraBatchSelections}
          markTeacherAttendance={markTeacherAttendance}
          markAllTeacherAttendance={markAllTeacherAttendance}
          markExtraAttendance={markExtraAttendance}
        />
      )}

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
