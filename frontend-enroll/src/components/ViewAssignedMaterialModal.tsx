import { useEffect, useState } from 'react';
import { apiGet, apiDelete } from '../api';
import { getCurrentUser } from '../auth';

interface AssignedAttachment {
  id: string;
  file_storage_id: string | null;
  label: string | null;
  public_url: string | null;
  file_name: string | null;
  mime_type: string | null;
}

interface AssignedMaterial {
  id: string;
  student_name: string;
  title: string;
  instructions: string | null;
  assigned_by: string;
  assigned_by_user_id: string | null;
  created_at: string;
  status: string;
  theory_prompt_text: string | null;
  theory_prompt_storage_id: string | null;
  instrument_name: string | null;
  session_date: string | null;
  attachments: AssignedAttachment[];
}

interface ViewAssignedMaterialModalProps {
  assignmentIds: string[];
  onClose: () => void;
  onDeleted?: () => void;
}

function AssignmentCard({ assignment, canDelete, onDelete }: {
  assignment: AssignedMaterial;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  return (
  <div className="border border-gray-200 rounded-xl p-4 space-y-3">
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</p>
      <p className="text-sm text-gray-800 font-medium">{assignment.title}</p>
    </div>

    {assignment.instructions && (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Instructions</p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.instructions}</p>
      </div>
    )}

    {(assignment.theory_prompt_text || assignment.theory_prompt_storage_id) && (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Theory Task</p>
        {assignment.theory_prompt_text && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.theory_prompt_text}</p>
        )}
        {assignment.theory_prompt_storage_id && (
          <a
            href={`/api/files/${assignment.theory_prompt_storage_id}/stream`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium mt-1"
          >
            📎 View music sheet
          </a>
        )}
      </div>
    )}

    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Attachments {assignment.attachments.length > 0 ? `(${assignment.attachments.length})` : ''}
      </p>
      {assignment.attachments.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No files attached.</p>
      ) : (
        <div className="space-y-1">
          {assignment.attachments.map(att => (
            att.file_storage_id && att.public_url ? (
              <a
                key={att.id}
                href={att.public_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <span className="text-gray-700 truncate flex-1">{att.file_name || att.label || 'Attachment'}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{att.mime_type || ''}</span>
              </a>
            ) : (
              <div
                key={att.id}
                className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm"
                title="This file failed to upload and is not available. Try assigning it again."
              >
                <span className="text-red-700 truncate flex-1">{att.label || 'Attachment'}</span>
                <span className="text-xs text-red-500 flex-shrink-0 ml-2">⚠ Upload failed</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>

    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
      <p className="text-xs text-gray-400">
        Assigned by {assignment.assigned_by} on {new Date(assignment.created_at).toLocaleString('en-IN')}
      </p>
      {canDelete && (
        <button
          onClick={() => onDelete(assignment.id)}
          className="text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0 ml-2"
        >
          Delete
        </button>
      )}
    </div>
  </div>
  );
}

export default function ViewAssignedMaterialModal({ assignmentIds, onClose, onDeleted }: ViewAssignedMaterialModalProps) {
  const [assignments, setAssignments] = useState<AssignedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.roles?.includes('admin') ?? false;

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all(assignmentIds.map(id => apiGet(`/api/homework/${id}`).then((res: any) => res.assignment)))
      .then(setAssignments)
      .catch((err: any) => setError(err.message || 'Failed to load assignments'))
      .finally(() => setLoading(false));
  }, [assignmentIds]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assigned material? Any attached files will also be permanently removed from Drive.')) return;
    try {
      await apiDelete(`/api/homework/${id}`);
      const remaining = assignments.filter(a => a.id !== id);
      setAssignments(remaining);
      onDeleted?.();
      if (remaining.length === 0) onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete assignment');
    }
  };

  const header = assignments[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h3 className="font-bold text-gray-900">
              Assigned Material {assignments.length > 1 ? `(${assignments.length})` : ''}
            </h3>
            {header && (
              <p className="text-sm text-gray-500 mt-0.5">
                {header.student_name}
                {header.instrument_name ? ` · ${header.instrument_name}` : ''}
                {header.session_date ? ` · ${new Date(header.session_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-400 italic">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  canDelete={isAdmin || (!!currentUser?.id && currentUser.id === a.assigned_by_user_id)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
