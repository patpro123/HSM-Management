
import React, { useState, useEffect } from 'react';
import { 
  Student, 
  Batch, 
  AttendanceRecord, 
  PaymentRecord, 
  BatchAssignment,
  Instrument
} from './types';
import { API_BASE_URL } from './config';
import StatsOverview from './components/StatsOverview';
import StudentManagement from './components/StudentManagement';
import TeacherManagement from './components/TeacherManagement';
// @ts-ignore - JSX component
import AttendanceTab from './components/Attendance/AttendanceTab';
import PaymentModule from './components/PaymentModule';
import hsmLogo from './images/hsmLogo.jpg';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stats' | 'students' | 'attendance' | 'payments' | 'teachers'>('stats');
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [enrollments, setEnrollments] = useState<BatchAssignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [studentsRes, batchesRes, instrumentsRes, paymentsRes, attendanceRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/students`),
        fetch(`${API_BASE_URL}/api/batches`),
        fetch(`${API_BASE_URL}/api/instruments`),
        fetch(`${API_BASE_URL}/api/payments`),
        fetch(`${API_BASE_URL}/api/attendance`)
      ]);

      if (!studentsRes.ok || !batchesRes.ok || !instrumentsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [studentsData, batchesData, instrumentsData, paymentsData, attendanceData] = await Promise.all([
        studentsRes.json(),
        batchesRes.json(),
        instrumentsRes.json(),
        paymentsRes.json(),
        attendanceRes.json()
      ]);

      setStudents(studentsData.students || []);
      setBatches(batchesData.batches || []);
      setInstruments(instrumentsData.instruments || []);
      setPayments(paymentsData.payments || []);
      setAttendance(attendanceData.attendance || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please check if the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false); // Close mobile menu when tab changes
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg shadow-lg hover:shadow-xl transition"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop Overlay for Mobile */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={`
        fixed md:relative
        w-64 h-full
        bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 
        text-white p-6 
        flex-shrink-0 flex flex-col
        transition-transform duration-300 ease-in-out
        z-50
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col items-center gap-4 mb-8 text-center">
          {/* Close button for mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden self-end p-2 text-slate-400 hover:text-white transition"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="w-full bg-white rounded-xl overflow-hidden p-3 flex items-center justify-center shadow-lg">
            <img 
              src={hsmLogo} 
              alt="HSM Logo" 
              className="w-full h-auto object-contain"
            />
          </div>
          <h1 className="text-sm font-black tracking-widest text-orange-400 uppercase mt-2">HSM Admin Portal</h1>
        </div>
        <ul className="space-y-2 flex-1">
          <li>
            <button onClick={() => handleTabChange('stats')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'stats' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              📊 <span className="ml-2">Overview</span>
            </button>
          </li>
          <li>
            <button onClick={() => handleTabChange('students')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'students' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              👥 <span className="ml-2">Students</span>
            </button>
          </li>
          <li>
            <button onClick={() => handleTabChange('attendance')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'attendance' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              📅 <span className="ml-2">Attendance</span>
            </button>
          </li>
          <li>
            <button onClick={() => handleTabChange('payments')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'payments' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              💳 <span className="ml-2">Payments</span>
            </button>
          </li>
          <li>
            <button onClick={() => handleTabChange('teachers')} className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'teachers' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              👨‍🏫 <span className="ml-2">Teachers</span>
            </button>
          </li>
        </ul>
        <div className="mt-auto pt-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center border-t border-slate-800">
          Hyderabad School of Music
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto max-h-screen md:ml-0">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 mt-16 md:mt-0">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 capitalize">{activeTab.replace('-', ' ')}</h2>
            <p className="text-slate-500 font-medium italic">"Unleash the <span className="text-red-500 not-italic font-bold">MUSICIAN</span> in you"</p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-slate-600">Loading...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-800 font-semibold mb-2">⚠️ Error</p>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
            {activeTab === 'stats' && (
              <StatsOverview 
                students={students}
                enrollments={enrollments}
                attendance={attendance}
                payments={payments}
                onNavigate={setActiveTab}
              />
            )}
          
            {activeTab === 'students' && (
              <StudentManagement 
                students={students}
                batches={batches}
                instruments={instruments}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceTab />
            )}

            {activeTab === 'payments' && (
              <PaymentModule 
                students={students}
                payments={payments}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'teachers' && (
              <TeacherManagement
                instruments={instruments}
                onRefresh={fetchData}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
