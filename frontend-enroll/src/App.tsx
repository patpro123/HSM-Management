
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
import DevSwitcher from './components/DevSwitcher';
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
  const [activeTab, setActiveTab] = useState<'stats' | 'students' | 'attendance' | 'payments' | 'finance' | 'teachers' | 'users' | 'student-profile' | 'teacher-profile' | 'enrollment'>(
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [user, setUser] = useState(getCurrentUser());
  const [authChecked, setAuthChecked] = useState(false);
  const [bypassedUser, setBypassedUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [devProfile, setDevProfile] = useState<'admin' | 'teacher' | 'student'>('admin');
  const [devOverride, setDevOverride] = useState<{ email: string; name: string } | null>(null);

  // Handle OAuth callback on mount
  useEffect(() => {
    // Check for OAuth error params first (e.g. not_provisioned, auth_failed)
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setAuthError(errorParam);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check backend config for OAuth bypass
    fetch(`${API_BASE_URL}/api/auth/config`)
      .then(res => res.json())
      .then(data => {
        if (data.authDisabled && data.user) {
          // In local dev mode with auth bypassed, we simply save the user.
          // We don't auto-login here so the landing page still shows!
          setBypassedUser(data.user);
          setDevProfile(data.profile || 'admin');
          setDevOverride(data.devOverride || null);
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
    setMoreMenuOpen(false); // Close mobile menu when tab changes
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    // Will trigger login screen to show since isAuthenticated() will return false
    window.location.href = '/';
  };

  // Dev-only: switch profile without server restart or page reload
  const handleDevSwitched = (newUser: any) => {
    const fakePayload = {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      roles: newUser.roles,
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
    const fakeToken = ['header', btoa(JSON.stringify(fakePayload)), 'signature'].join('.');
    setToken(fakeToken);
    setBypassedUser(newUser);
    setDevProfile(newUser.roles.includes('admin') ? 'admin' : newUser.roles.includes('teacher') ? 'teacher' : 'student');
    const isDefaultUser = ['1111', '2222', '3333'].some(p => newUser.id.startsWith(p));
    setDevOverride(isDefaultUser ? null : { email: newUser.email, name: newUser.name });
    setUser(newUser); // triggers fetchData via useEffect
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
      <>
        <LandingPage
          authError={authError ?? undefined}
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
        {bypassedUser && (
          <DevSwitcher
            currentProfile={devProfile}
            currentOverride={devOverride}
            onSwitched={handleDevSwitched}
          />
        )}
      </>
    );
  }

  // Main app UI
  const isAdmin = user && user.roles.includes('admin');
  const isTeacherOnly = user && !isAdmin && user.roles.includes('teacher');
  const isStudentOrParent = user && !isAdmin && !isTeacherOnly && (user.roles.includes('student') || user.roles.includes('parent'));

  // Menu items by role
  const menuItems = isAdmin
    ? [
      { key: 'stats', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { key: 'students', label: 'Students', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { key: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { key: 'payments', label: 'Payments', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
      { key: 'finance', label: 'Finance', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { key: 'teachers', label: 'Teachers', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
      { key: 'users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    ]
    : isTeacherOnly
      ? [
        { key: 'teacher-profile', label: 'My Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
        { key: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      ]
      : [
        { key: 'student-profile', label: 'My Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
      ];

  const PRIMARY_TAB_COUNT = 4;
  const primaryTabs = menuItems.slice(0, PRIMARY_TAB_COUNT);
  const moreTabs = menuItems.slice(PRIMARY_TAB_COUNT);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar Navigation — desktop only */}
      <nav className="hidden md:flex fixed md:relative w-64 h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-6 flex-shrink-0 flex-col z-50">
          <div className="flex flex-col items-center gap-4 mb-8 text-center">
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
                  onClick={() => setActiveTab(item.key as typeof activeTab)}
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

      <main className="flex-1 overflow-y-auto max-h-screen md:ml-0 flex flex-col bg-slate-50 pb-16 md:pb-0">

        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
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
                  batches={batches}
                  instruments={instruments}
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
              {activeTab === 'attendance' && (
                <AttendanceDashboard
                  batches={batches}
                  onRefresh={fetchData}
                />
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
      {bypassedUser && (
        <DevSwitcher
          currentProfile={devProfile}
          currentOverride={devOverride}
          onSwitched={handleDevSwitched}
        />
      )}

      {/* Bottom Tab Bar — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primaryTabs.map(item => (
          <button
            key={item.key}
            onClick={() => handleTabChange(item.key as typeof activeTab)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors ${activeTab === item.key ? 'text-orange-500' : 'text-slate-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
        {moreTabs.length > 0 && (
          <button
            onClick={() => setMoreMenuOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors ${moreTabs.some(t => t.key === activeTab) ? 'text-orange-500' : 'text-slate-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            More
          </button>
        )}
      </nav>

      {/* More Sheet — mobile only */}
      {moreMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-40 z-50"
            onClick={() => setMoreMenuOpen(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="space-y-1">
              {moreTabs.map(item => (
                <button
                  key={item.key}
                  onClick={() => { handleTabChange(item.key as typeof activeTab); setMoreMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left ${activeTab === item.key ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              {user && (
                <div className="px-4 py-2 mb-2">
                  <div className="font-semibold text-sm text-slate-700">{user.name || user.email}</div>
                  <div className="text-xs text-slate-400 capitalize">{user.roles.join(', ')}</div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
