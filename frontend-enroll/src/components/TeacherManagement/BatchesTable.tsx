interface Batch {
  id: string;
  instrument_id: string;
  instrument_name: string;
  teacher_id: string | null;
  recurrence: string;
  start_time: string;
  end_time: string;
  capacity: number;
  teacher_name?: string;
}

interface BatchesTableProps {
  batches: Batch[];
  onEditBatch: (batch: Batch) => void;
  onDeleteBatch: (id: string) => void;
}

export default function BatchesTable({ batches, onEditBatch, onDeleteBatch }: BatchesTableProps) {
  return (
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
                  {(batch as any).teacher_name || 'Unassigned'}
                </td>
                <td className="py-3 px-4 text-slate-600">{batch.recurrence}</td>
                <td className="py-3 px-4 text-slate-600">
                  {batch.start_time?.slice(0, 5)} - {batch.end_time?.slice(0, 5)}
                </td>
                <td className="py-3 px-4 text-slate-600">{batch.capacity}</td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => onEditBatch(batch)}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteBatch(batch.id)}
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
  );
}
