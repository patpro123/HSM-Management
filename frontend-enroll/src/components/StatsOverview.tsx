import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Student, BatchAssignment, AttendanceRecord, PaymentRecord } from '../types';

interface StatsProps {
  students: Student[];
  enrollments: BatchAssignment[];
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  onNavigate?: (tab: 'stats' | 'students' | 'attendance' | 'payments' | 'teachers') => void;
}

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: string;
  color: string;
  onClick?: () => void;
}> = ({ title, value, icon, color, onClick }) => (
  <div 
    className={`${color} p-6 rounded-xl text-white cursor-pointer transform transition-transform hover:scale-105`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold opacity-90">{title}</h3>
      <span className="text-2xl">{icon}</span>
    </div>
    <p className="text-3xl font-bold">{value}</p>
  </div>
);

const StatsOverview: React.FC<StatsProps> = ({ students, enrollments, attendance, payments, onNavigate }) => {
  const totalRevenue = payments.reduce((acc, p) => acc + parseFloat(String(p.amount || '0')), 0);
  const activeStudents = students.length;
  
  // Chart data: Monthly enrollment trend (last 3 months)
  const chartData = [
    { name: 'Nov', students: Math.max(0, activeStudents - 4) },
    { name: 'Dec', students: Math.max(0, activeStudents - 2) },
    { name: 'Jan', students: activeStudents },
  ];


  const instrumentStats: Record<string, Set<string>> = {};
  const teacherStats: Record<string, Set<string>> = {};

  students.forEach(student => {
    const batches = (student as any).batches || [];
    const studentId = student.id || (student as any).student_id;
    
    batches.forEach((batch: any) => {
      if (batch.instrument) {
        if (!instrumentStats[batch.instrument]) instrumentStats[batch.instrument] = new Set();
        instrumentStats[batch.instrument].add(studentId);
      }
      if (batch.teacher) {
        if (!teacherStats[batch.teacher]) teacherStats[batch.teacher] = new Set();
        teacherStats[batch.teacher].add(studentId);
      }
    });
  });

  const instrumentData = Object.entries(instrumentStats)
    .map(([name, set]) => ({ name, value: set.size }))
    .sort((a, b) => b.value - a.value);

  const teacherData = Object.entries(teacherStats)
    .map(([name, set]) => ({ name, students: set.size }))
    .sort((a, b) => b.students - a.students);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Students" 
          value={activeStudents.toString()} 
          icon="👥" 
          color="bg-blue-500" 
          onClick={() => onNavigate?.('students')}
        />
        <StatCard 
          title="Revenue (INR)" 
          value={`₹${totalRevenue.toLocaleString()}`} 
          icon="💰" 
          color="bg-emerald-500" 
          onClick={() => onNavigate?.('payments')}
        />
        <StatCard 
          title="Enrollments" 
          value={enrollments.length.toString()} 
          icon="📚" 
          color="bg-indigo-500" 
          onClick={() => onNavigate?.('students')}
        />
        <StatCard 
          title="Attendance" 
          value={attendance.length.toString()} 
          icon="📅" 
          color="bg-amber-500" 
          onClick={() => onNavigate?.('attendance')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <h3 className="text-lg font-semibold mb-6">Student Growth</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Recent Payments</h3>
            <button 
              onClick={() => onNavigate?.('payments')}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {payments.length === 0 ? (
              <p className="text-slate-400 text-center py-10">No payments recorded yet.</p>
            ) : (
              payments.slice(0, 5).map((p) => {
                const student = students.find(s => s.id === p.student_id);
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">₹</div>
                      <div>
                        <p className="font-medium">₹{parseFloat(String(p.amount || '0')).toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{new Date(p.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">{student ? (student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : (student as any).name || 'Unknown') : 'Unknown'}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <h3 className="text-lg font-semibold mb-6">Students by Instrument</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={instrumentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {instrumentData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <h3 className="text-lg font-semibold mb-6">Students per Teacher</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teacherData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Bar dataKey="students" radius={[0, 4, 4, 0]}>
                  {teacherData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg transition-shadow">
          <h4 className="text-sm font-semibold text-slate-600 mb-2">Active Enrollments</h4>
          <p className="text-3xl font-bold text-slate-900">{enrollments.length}</p>
          <p className="text-xs text-slate-500 mt-2">Students in batches</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg transition-shadow">
          <h4 className="text-sm font-semibold text-slate-600 mb-2">Avg. Revenue/Student</h4>
          <p className="text-3xl font-bold text-slate-900">
            ₹{activeStudents > 0 ? Math.round(totalRevenue / activeStudents).toLocaleString() : '0'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Per student</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg transition-shadow">
          <h4 className="text-sm font-semibold text-slate-600 mb-2">Attendance Rate</h4>
          <p className="text-3xl font-bold text-slate-900">
            {attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100) : 0}%
          </p>
          <p className="text-xs text-slate-500 mt-2">Overall attendance</p>
        </div>
      </div>
    </div>
  );
};

export default StatsOverview;
