import React, { useMemo } from 'react';
import { Student, Batch } from '../types';

interface TodaysClassesProps {
  students: Student[];
  batches: Batch[];
}

const TodaysClasses: React.FC<TodaysClassesProps> = ({ students, batches }) => {
  const today = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayOfWeek = days[today.getDay()];
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const todaysBatches = useMemo(() => {
    return batches.filter(batch => 
      batch.recurrence && batch.recurrence.toUpperCase().includes(dayOfWeek)
    ).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  }, [batches, dayOfWeek]);

  const getStudentsForBatch = (batchId: string) => {
    return students.filter(student => 
      (student as any).batches?.some((b: any) => String(b.batch_id) === String(batchId))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Classes for {dateStr}</h3>
          <p className="text-slate-500 text-sm">View students scheduled for today's batches</p>
        </div>
        <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          {todaysBatches.length} Batches Scheduled
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {todaysBatches.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
            <p className="text-slate-500">No classes scheduled for today ({dayOfWeek}).</p>
          </div>
        ) : (
          todaysBatches.map(batch => {
            const batchStudents = getStudentsForBatch(batch.id);
            return (
              <div key={batch.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-800">{(batch as any).instrument_name || 'Instrument'}</h4>
                    <p className="text-sm text-slate-600">
                      {batch.recurrence} • {batch.start_time} - {batch.end_time} • {(batch as any).teacher_name || 'No Teacher'}
                    </p>
                  </div>
                  <button 
                    className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    onClick={() => alert('WhatsApp notification feature coming soon!')}
                  >
                    <span>📱</span> Notify Batch
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Student Name</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3">Guardian</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {batchStudents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-slate-400 text-sm">
                            No students enrolled in this batch.
                          </td>
                        </tr>
                      ) : (
                        batchStudents.map(student => (
                          <tr key={student.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium text-slate-800">{student.name}</td>
                            <td className="px-6 py-3 text-slate-600 text-sm">{student.phone}</td>
                            <td className="px-6 py-3 text-slate-600 text-sm">{student.guardian_contact}</td>
                            <td className="px-6 py-3 text-right">
                              <button 
                                className="text-green-600 hover:text-green-800 text-xs font-bold uppercase"
                                onClick={() => alert(`Notify ${student.name} via WhatsApp`)}
                              >
                                WhatsApp
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TodaysClasses;