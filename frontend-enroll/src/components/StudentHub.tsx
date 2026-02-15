import React, { useState } from 'react';
import StudentManagement from './StudentManagement.tsx';
import TodaysClasses from './TodaysClasses';
import { Student, Batch, Instrument } from '../types';

interface StudentHubProps {
  students: Student[];
  batches: Batch[];
  instruments: Instrument[];
  onRefresh: () => void;
}

const StudentHub: React.FC<StudentHubProps> = ({ students, batches, instruments, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'today'>('all');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Students
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'today' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today's Classes
          </button>
        </div>
      </div>

      {activeTab === 'all' ? (
        <StudentManagement 
          students={students}
          batches={batches}
          instruments={instruments}
          onRefresh={onRefresh}
        />
      ) : (
        <TodaysClasses 
          students={students}
          batches={batches}
        />
      )}
    </div>
  );
};

export default StudentHub;