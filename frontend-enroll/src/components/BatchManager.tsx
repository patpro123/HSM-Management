import React, { useState, useEffect, useCallback } from 'react';
import { Instrument, BatchBoardColumn, BatchBoardStudent, MoveStudentResult } from '../types';
import { apiGet, apiPost } from '../api';

interface BatchManagerProps {
  instruments: Instrument[];
}

function formatPhoneForWa(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

function buildWaLink(phone: string | null, message: string): string | null {
  const num = formatPhoneForWa(phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

// ─── WhatsApp Sync Modal ─────────────────────────────────────────────────────

interface WhatsAppModalProps {
  result: MoveStudentResult;
  onClose: () => void;
}

function WhatsAppSyncModal({ result, onClose }: WhatsAppModalProps) {
  const { student, from_batch, to_batch } = result;
  const phone = student.phone || student.guardian_contact;

  const inviteLink = to_batch.whatsapp_group_link;
  const leaveLink = from_batch.whatsapp_group_link;

  const inviteWaLink = inviteLink
    ? buildWaLink(phone, `Hi ${student.name}, you've been moved to a new batch. Please join the new WhatsApp group: ${inviteLink}`)
    : null;
  const leaveWaLink = leaveLink
    ? buildWaLink(phone, `Hi ${student.name}, you've been moved out of the previous batch. Please leave the old WhatsApp group. Thank you!`)
    : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Student Moved</h3>
            <p className="text-sm text-slate-500">
              {student.name} → {to_batch.recurrence}
            </p>
          </div>
        </div>

        {phone && (
          <div className="bg-slate-50 rounded-lg px-4 py-2 mb-4 text-sm text-slate-600">
            Phone: <span className="font-medium text-slate-800">{phone}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* New batch actions */}
          {inviteLink ? (
            <div className="border border-green-200 rounded-lg p-3 bg-green-50">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">New Batch Group</p>
              <p className="text-xs text-green-800 mb-2 break-all">{inviteLink}</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => navigator.clipboard.writeText(inviteLink)}
                  className="text-xs px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 font-medium"
                >
                  Copy Link
                </button>
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 font-medium"
                >
                  Open Link
                </a>
                {inviteWaLink && (
                  <a
                    href={inviteWaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Send Invite via WhatsApp
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <p className="text-xs text-slate-500">No WhatsApp group set for the new batch. You can add one in the Batch settings.</p>
            </div>
          )}

          {/* Old batch leave reminder */}
          {leaveLink && (
            <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Previous Batch Group</p>
              {leaveWaLink ? (
                <a
                  href={leaveWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium inline-block"
                >
                  Send Leave Reminder via WhatsApp
                </a>
              ) : (
                <p className="text-xs text-amber-700">No phone number — remind manually to leave the old group.</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Student Card ────────────────────────────────────────────────────────────

interface StudentCardProps {
  student: BatchBoardStudent;
  batchId: string;
  isSelected: boolean;
  isMoving: boolean;
  onSelect: (student: BatchBoardStudent, batchId: string) => void;
  onDragStart: (e: React.DragEvent, student: BatchBoardStudent, batchId: string) => void;
}

function StudentCard({ student, batchId, isSelected, isMoving, onSelect, onDragStart }: StudentCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, student, batchId)}
      onClick={() => onSelect(student, batchId)}
      className={`
        group flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer select-none
        transition-all duration-150
        ${isSelected
          ? 'bg-blue-50 border-blue-400 shadow-sm ring-2 ring-blue-300'
          : 'bg-white border-slate-200 hover:border-orange-300 hover:shadow-sm'
        }
        ${isMoving ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isSelected && (
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        <span className="text-sm font-medium text-slate-800 truncate">{student.student_name}</span>
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
        student.classes_remaining <= 2 ? 'bg-red-100 text-red-700' :
        student.classes_remaining <= 4 ? 'bg-amber-100 text-amber-700' :
        'bg-slate-100 text-slate-500'
      }`}>
        {student.classes_remaining}
      </span>
    </div>
  );
}

// ─── Batch Column ────────────────────────────────────────────────────────────

interface BatchColumnProps {
  column: BatchBoardColumn;
  isDragOver: boolean;
  isMoveTarget: boolean;
  selectedStudentFromBatch: string | null;
  movingEnrollmentBatchId: string | null;
  onDragOver: (e: React.DragEvent, batchId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, batchId: string) => void;
  onColumnTap: (batchId: string) => void;
  onStudentSelect: (student: BatchBoardStudent, batchId: string) => void;
  onStudentDragStart: (e: React.DragEvent, student: BatchBoardStudent, batchId: string) => void;
  selectedStudent: { student: BatchBoardStudent; fromBatchId: string } | null;
}

function BatchColumn({
  column, isDragOver, isMoveTarget, selectedStudentFromBatch,
  movingEnrollmentBatchId, onDragOver, onDragLeave, onDrop,
  onColumnTap, onStudentSelect, onStudentDragStart, selectedStudent
}: BatchColumnProps) {
  const isFull = column.students.length >= column.capacity;
  const canReceive = isMoveTarget && !isFull && selectedStudentFromBatch !== column.id;

  return (
    <div
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
      onClick={() => onColumnTap(column.id)}
      className={`
        flex-shrink-0 w-72 rounded-xl border-2 flex flex-col transition-all duration-150
        ${isDragOver && !isFull ? 'border-orange-400 bg-orange-50 shadow-md' : ''}
        ${canReceive ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200 cursor-pointer' : ''}
        ${!isDragOver && !canReceive ? 'border-slate-200 bg-white' : ''}
      `}
    >
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 leading-tight">{column.recurrence}</p>
            {column.teacher_name && (
              <p className="text-xs text-slate-500 mt-0.5">{column.teacher_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {column.whatsapp_group_link && (
              <a
                href={column.whatsapp_group_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Open WhatsApp group"
                className="text-green-600 hover:text-green-700"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isFull ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {column.students.length}/{column.capacity}
            </span>
          </div>
        </div>
        {canReceive && (
          <p className="mt-2 text-xs text-blue-600 font-semibold text-center">Tap to move here</p>
        )}
        {isFull && selectedStudent && selectedStudent.fromBatchId !== column.id && (
          <p className="mt-1 text-xs text-red-500 font-medium text-center">Full</p>
        )}
      </div>

      {/* Student List */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-96">
        {column.students.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No students</p>
        ) : (
          column.students.map((student) => (
            <StudentCard
              key={student.enrollment_batch_id}
              student={student}
              batchId={column.id}
              isSelected={selectedStudent?.student.enrollment_batch_id === student.enrollment_batch_id}
              isMoving={movingEnrollmentBatchId === student.enrollment_batch_id}
              onSelect={onStudentSelect}
              onDragStart={onStudentDragStart}
            />
          ))
        )}
        {isDragOver && !isFull && (
          <div className="border-2 border-dashed border-orange-300 rounded-lg py-3 text-center text-xs text-orange-500 font-medium">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Batch Manager (main) ─────────────────────────────────────────────────────

export default function BatchManager({ instruments }: BatchManagerProps) {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>('');
  const [columns, setColumns] = useState<BatchBoardColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedStudent, setDraggedStudent] = useState<{ student: BatchBoardStudent; fromBatchId: string } | null>(null);
  const [dragOverBatchId, setDragOverBatchId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ student: BatchBoardStudent; fromBatchId: string } | null>(null);
  const [movingEnrollmentBatchId, setMovingEnrollmentBatchId] = useState<string | null>(null);
  const [whatsappModal, setWhatsappModal] = useState<MoveStudentResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchBoard = useCallback(async (instrumentId: string) => {
    setLoading(true);
    setError(null);
    setSelectedStudent(null);
    try {
      const data = await apiGet(`/api/batches/instrument/${instrumentId}/board`);
      setColumns(data.batches || []);
    } catch (err) {
      setError('Failed to load batches. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedInstrumentId) {
      fetchBoard(selectedInstrumentId);
    } else {
      setColumns([]);
    }
  }, [selectedInstrumentId, fetchBoard]);

  const moveStudent = useCallback(async (
    enrollmentBatchId: string,
    fromBatchId: string,
    toBatchId: string
  ) => {
    setMovingEnrollmentBatchId(enrollmentBatchId);

    // Optimistic update
    const prevColumns = columns;
    setColumns(prev => {
      const studentToMove = prev.find(c => c.id === fromBatchId)?.students.find(s => s.enrollment_batch_id === enrollmentBatchId);
      if (!studentToMove) return prev;
      return prev.map(col => {
        if (col.id === fromBatchId) return { ...col, students: col.students.filter(s => s.enrollment_batch_id !== enrollmentBatchId) };
        if (col.id === toBatchId) return { ...col, students: [...col.students, studentToMove] };
        return col;
      });
    });

    setSelectedStudent(null);

    try {
      const result: MoveStudentResult = await apiPost('/api/batches/move-student', {
        enrollment_batch_id: enrollmentBatchId,
        from_batch_id: fromBatchId,
        to_batch_id: toBatchId
      });
      setWhatsappModal(result);
    } catch (err: unknown) {
      // Revert on failure
      setColumns(prevColumns);
      const message = err instanceof Error ? err.message : 'Failed to move student';
      showToast(message);
    } finally {
      setMovingEnrollmentBatchId(null);
    }
  }, [columns, showToast]);

  // ── Drag and Drop handlers ──
  const handleDragStart = useCallback((e: React.DragEvent, student: BatchBoardStudent, batchId: string) => {
    setDraggedStudent({ student, fromBatchId: batchId });
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, batchId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBatchId(batchId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverBatchId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toBatchId: string) => {
    e.preventDefault();
    setDragOverBatchId(null);
    if (!draggedStudent || draggedStudent.fromBatchId === toBatchId) { setDraggedStudent(null); return; }
    const targetCol = columns.find(c => c.id === toBatchId);
    if (targetCol && targetCol.students.length >= targetCol.capacity) {
      showToast('Target batch is at full capacity');
      setDraggedStudent(null);
      return;
    }
    moveStudent(draggedStudent.student.enrollment_batch_id, draggedStudent.fromBatchId, toBatchId);
    setDraggedStudent(null);
  }, [draggedStudent, columns, moveStudent, showToast]);

  // ── Mobile tap handlers ──
  const handleStudentSelect = useCallback((student: BatchBoardStudent, batchId: string) => {
    setSelectedStudent(prev => {
      if (prev?.student.enrollment_batch_id === student.enrollment_batch_id) return null; // deselect
      return { student, fromBatchId: batchId };
    });
  }, []);

  const handleColumnTap = useCallback((toBatchId: string) => {
    if (!selectedStudent || selectedStudent.fromBatchId === toBatchId) return;
    const targetCol = columns.find(c => c.id === toBatchId);
    if (!targetCol) return;
    if (targetCol.students.length >= targetCol.capacity) {
      showToast('Target batch is at full capacity');
      return;
    }
    moveStudent(selectedStudent.student.enrollment_batch_id, selectedStudent.fromBatchId, toBatchId);
  }, [selectedStudent, columns, moveStudent, showToast]);

  const activeInstrument = instruments.find(i => String(i.id) === selectedInstrumentId);

  return (
    <div className="flex flex-col h-full">
      {/* Header + Instrument Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800">Batch Manager</h2>
          <p className="text-sm text-slate-500 mt-0.5">Move students between batches. Drag on desktop, tap to select on mobile.</p>
        </div>
        <select
          value={selectedInstrumentId}
          onChange={e => setSelectedInstrumentId(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-slate-800 font-medium min-w-[180px]"
        >
          <option value="">Select instrument</option>
          {instruments.filter(i => !i.is_deprecated).map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {!selectedInstrumentId && (
        <div className="flex-1 flex items-center justify-center text-center py-20">
          <div>
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <p className="text-slate-400 font-medium">Select an instrument to view its batches</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading batches…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {/* Board */}
      {!loading && selectedInstrumentId && !error && (
        columns.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-20 text-center">
            <div>
              <p className="text-slate-400 font-medium">No batches found for {activeInstrument?.name}</p>
              <p className="text-sm text-slate-400 mt-1">Create batches in the Teachers tab first.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
              {columns.map(column => (
                <BatchColumn
                  key={column.id}
                  column={column}
                  isDragOver={dragOverBatchId === column.id}
                  isMoveTarget={!!selectedStudent && selectedStudent.fromBatchId !== column.id}
                  selectedStudentFromBatch={selectedStudent?.fromBatchId ?? null}
                  movingEnrollmentBatchId={movingEnrollmentBatchId}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onColumnTap={handleColumnTap}
                  onStudentSelect={handleStudentSelect}
                  onStudentDragStart={handleDragStart}
                  selectedStudent={selectedStudent}
                />
              ))}
            </div>
          </div>
        )
      )}

      {/* Mobile floating bar */}
      {selectedStudent && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 z-40">
          <div className="bg-blue-600 text-white rounded-xl px-4 py-3 shadow-xl flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Moving: {selectedStudent.student.student_name}</p>
              <p className="text-xs text-blue-200">Tap a batch column to move here</p>
            </div>
            <button
              onClick={() => setSelectedStudent(null)}
              className="flex-shrink-0 text-blue-200 hover:text-white font-bold text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-white ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* WhatsApp sync modal */}
      {whatsappModal && (
        <WhatsAppSyncModal
          result={whatsappModal}
          onClose={() => setWhatsappModal(null)}
        />
      )}
    </div>
  );
}
