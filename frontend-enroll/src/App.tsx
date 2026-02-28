
import React, { useState, useEffect } from 'react';
import StudentProfile from './pages/StudentProfile';
import {
  Student,
  Batch,
  AttendanceRecord,
  PaymentRecord,
  BatchAssignment,
  Instrument
} from './types';
import { API_BASE_URL } from './config';
import { getCurrentUser, login, logout, handleOAuthCallback, isAuthenticated, setToken } from './auth';
import { apiGet } from './api';
import StatsOverview from './components/StatsOverview';
// @ts-ignore - Explicitly import .tsx to avoid resolving to the legacy .jsx file
import AttendanceDashboard from './components/AttendanceDashboard';
import StudentHub from './components/StudentHub';
import TeacherManagement from './components/TeacherManagement';
import UserManagement from './components/UserManagement';
import EnrollmentForm from './components/EnrollmentForm';
import PaymentModule from './components/PaymentModule';
import FinanceModule from './components/FinanceModule';
import Teacher360View from './components/Teacher360View';
import hsmLogo from './images/hsmLogo.jpg';
import LandingPage from './components/LandingPage';
import NotificationsPanel from './components/NotificationsPanel';

const App: React.FC = () => {
  // Add new profile page states
  const [activeTab, setActiveTab] = useState<'stats' | 'students' | 'attendance' | 'payments' | 'teachers' | 'users' | 'student-profile' | 'teacher-profile' | 'enrollment'>(
    getCurrentUser()?.roles?.includes('admin') ? 'stats' : getCurrentUser()?.roles?.includes('teacher') ? 'teacher-profile' : 'student-profile'
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [enrollments, setEnrollments] = useState<BatchAssignment[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(getCurrentUser());
  const [authChecked, setAuthChecked] = useState(false);
  const [bypassedUser, setBypassedUser] = useState<any>(null);

  // Handle OAuth callback on mount
  useEffect(() => {
    // Check backend config for OAuth bypass
    fetch(`${API_BASE_URL}/api/auth/config`)
      .then(res => res.json())
      .then(data => {
        if (data.authDisabled && data.user) {
          // In local dev mode with auth bypassed, we simply save the user.
          // We don't auto-login here so the landing page still shows!
          setBypassedUser(data.user);
          setAuthChecked(true);
        } else {
          // Normal OAuth flow
          if (handleOAuthCallback()) {
            setUser(getCurrentUser());
          }
          setAuthChecked(true);
        }
      })
      .catch(() => {
        setAuthChecked(true);
      });
  }, []);

  // On login/profile change, set default tab by role
  useEffect(() => {
    if (user) {
      const isAdminRole = user.roles.includes('admin');
      const isTeacherRole = !isAdminRole && user.roles.includes('teacher');
      if (isAdminRole && (activeTab === 'student-profile' || activeTab === 'teacher-profile')) {
        setActiveTab('stats');
      }
      if (isTeacherRole && activeTab !== 'teacher-profile') {
        setActiveTab('teacher-profile');
      }
      if (!isAdminRole && !isTeacherRole && activeTab !== 'student-profile') {
        setActiveTab('student-profile');
      }
    }
  }, [user, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = getCurrentUser();
      const isAdminOrTeacher = currentUser && (currentUser.roles.includes('admin') || currentUser.roles.includes('teacher'));

      // For admin/teacher: fetch all data
      // For student/parent: fetch only essential data they have access to
      if (isAdminOrTeacher) {
        // Fetch all data in parallel using authenticated API calls
        // We catch errors individually so one failure doesn't break the entire dashboard
        const [studentsData, batchesData, instrumentsData, paymentsData, attendanceData, prospectsData] = await Promise.all([
          apiGet('/api/enrollments').catch(e => { console.error('Enrollments fetch failed', e); return { enrollments: [] }; }),
          apiGet('/api/batches').catch(e => { console.error('Batches fetch failed', e); return { batches: [] }; }),
          apiGet('/api/instruments').catch(e => { console.error('Instruments fetch failed', e); return { instruments: [] }; }),
          apiGet('/api/payments').catch(e => { console.error('Payments fetch failed', e); return { payments: [] }; }),
          apiGet('/api/attendance').catch(e => { console.error('Attendance fetch failed', e); return { attendance: [] }; }),
          apiGet('/api/prospects').catch(e => { console.error('Prospects fetch failed', e); return { prospects: [] }; }),
        ]);

        setStudents(studentsData.enrollments || []);
        setBatches(batchesData.batches || []);
        setInstruments(instrumentsData.instruments || []);
        setPayments(paymentsData.payments || []);
        setAttendance(attendanceData.attendance || []);
        setProspects(prospectsData.prospects || []);
      } else {
        // For student/parent users, fetch only what they need and have access to
        try {
          // Try to fetch students (they might have limited access)
          const studentsData = await apiGet('/api/students');
          setStudents(studentsData.students || []);
        } catch (error) {
          console.warn('Could not fetch students data:', error);
          setStudents([]);
        }

        // Set empty arrays for data they don't have access to
        setBatches([]);
        setInstruments([]);
        setPayments([]);
        setAttendance([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err instanceof Error && err.message.includes('401')) {
        setError('Session expired. Please login again.');
        setTimeout(() => login(API_BASE_URL), 2000);
      } else {
        setError('Failed to load data. Please check if the backend server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data if authenticated
    if (authChecked && isAuthenticated()) {
      fetchData();
    } else if (authChecked) {
      setLoading(false);
    }
  }, [authChecked, user]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false); // Close mobile menu when tab changes
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    // Will trigger login screen to show since isAuthenticated() will return false
    window.location.href = '/';
  };

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isAuthenticated()) {
    return (
      <LandingPage
        onLogin={() => {
          if (bypassedUser) {
            // Dev mode bypass: Login instantly with dummy user
            const fakePayload = {
              userId: bypassedUser.id,
              email: bypassedUser.email,
              name: bypassedUser.name,
              roles: bypassedUser.roles,
              exp: Math.floor(Date.now() / 1000) + 86400 // 1 day expiry
            };
            const fakeToken = ['header', btoa(JSON.stringify(fakePayload)), 'signature'].join('.');
            setToken(fakeToken);
            setUser(bypassedUser);
          } else {
            // Production: trigger actual OAuth flow
            login(API_BASE_URL);
          }
        }}
      />
    );
  }

  // Main app UI
  const isAdmin = user && user.roles.includes('admin');
  const isTeacherOnly = user && !isAdmin && user.roles.includes('teacher');
  const isStudentOrParent = user && !isAdmin && !isTeacherOnly && (user.roles.includes('student') || user.roles.includes('parent'));

  // Menu items by role
  const menuItems = isAdmin
    ? [
      { key: 'stats', label: 'Dashboard' },
      { key: 'students', label: 'Students' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'payments', label: 'Payments' },
      { key: 'finance', label: 'Finance' },
      { key: 'teachers', label: 'Teachers' },
      { key: 'users', label: 'Users' },
    ]
    : isTeacherOnly
      ? [
        { key: 'teacher-profile', label: 'My Profile' },
      ]
      : [
        { key: 'student-profile', label: 'My Profile' },
      ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar Navigation (always visible, but menu items filtered) */}
      <>
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
            {menuItems.map(item => (
              <li key={item.key}>
                <button
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeTab === item.key ? 'bg-orange-600 text-white' : 'hover:bg-slate-800 text-slate-200'}`}
                  onClick={() => {
                    setActiveTab(item.key as typeof activeTab);
                    setMobileMenuOpen(false);
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6 border-t border-slate-800">
            {user && (
              <div className="px-4 py-3 mb-3 text-xs text-slate-400">
                <div className="font-semibold mb-1">{user.name || user.email}</div>
                <div className="text-slate-500">{user.roles.join(', ')}</div>
              </div>
            )}
            {isAuthenticated() && (
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 rounded-lg transition-colors font-medium text-slate-300 hover:bg-red-900 hover:text-white flex items-center gap-2"
              >
                <span>🚪</span>
                <span>Logout</span>
              </button>
            )}
            <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">
              Hyderabad School of Music
            </div>
          </div>
        </nav>
      </>

      <main className="flex-1 overflow-y-auto max-h-screen md:ml-0 flex flex-col bg-slate-50">

        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 ml-12 md:ml-0">
              {menuItems.find(item => item.key === activeTab)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && <NotificationsPanel onNavigation={(path) => handleTabChange(path as any)} />}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-700">{user?.name || user?.email}</span>
              <span className="text-xs text-slate-500 capitalize">{user?.roles[0]}</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-10">
          {/* Main content by tab */}
          {isAdmin ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
              {activeTab === 'stats' && (
                <StatsOverview
                  students={students.filter(s => (s as any).is_active !== false)}
                  prospectsCount={prospects.length}
                  attendance={attendance}
                  payments={payments}
                  onNavigate={setActiveTab}
                />
              )}
              {activeTab === 'students' && (
                <StudentHub
                  students={students}
                  batches={batches}
                  instruments={instruments}
                  prospects={prospects}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'attendance' && (
                <AttendanceDashboard
                  batches={batches}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'payments' && (
                <PaymentModule
                  students={students}
                  payments={payments}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'finance' && (
                <FinanceModule
                  students={students}
                  batches={batches}
                  payments={payments}
                  instruments={instruments}
                />
              )}
              {activeTab === 'teachers' && (
                <TeacherManagement
                  instruments={instruments}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'users' && (
                <UserManagement />
              )}
              {activeTab === 'enrollment' && (
                <EnrollmentForm
                  students={students}
                  batches={batches}
                  instruments={instruments}
                  onRefresh={fetchData}
                />
              )}
            </div>
          ) : isTeacherOnly ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
              {activeTab === 'teacher-profile' && (
                <Teacher360View selfView isModal={false} />
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
              {activeTab === 'student-profile' && (
                <StudentProfile />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
