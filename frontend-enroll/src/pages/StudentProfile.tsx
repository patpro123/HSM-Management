import React, { useState, useEffect } from 'react';
import Student360View from '../components/Student360View';
import { getCurrentUser } from '../auth';
import { apiGet } from '../api';

interface LinkedStudent {
  student_id: string;
  student_name: string;
  relationship: string;
}

const StudentProfile: React.FC = () => {
  const user = getCurrentUser();
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    apiGet('/api/auth/profile')
      .then(data => {
        const linked: LinkedStudent[] = data.user?.linkedStudents || [];
        if (linked.length > 0) {
          setLinkedStudents(linked);
          setSelectedId(linked[0].student_id);
        }
      })
      .catch(() => {});
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h2>
          <p className="text-gray-600">Please log in to view your student profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Student Portal</h1>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {user.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
          </div>
        </div>

        {linkedStudents.length > 1 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 flex gap-2 flex-wrap">
            {linkedStudents.map(s => (
              <button
                key={s.student_id}
                onClick={() => setSelectedId(s.student_id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
                  selectedId === s.student_id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {s.student_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {selectedId ? (
          <Student360View studentId={selectedId} hidePayments />
        ) : (
          <Student360View selfMode hidePayments />
        )}
      </main>
    </div>
  );
};

export default StudentProfile;
