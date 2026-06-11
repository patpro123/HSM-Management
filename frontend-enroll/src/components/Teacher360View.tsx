import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';
import { Teacher360Data } from '../types';
import PhoneLink from './PhoneLink';
import TeacherStudentList from './TeacherStudentList';
import BulkHomeworkPanel from './BulkHomeworkPanel';
import TeacherPTMTab from './TeacherPTMTab';

interface Teacher360ViewProps {
  teacherId?: string;
  selfView?: boolean;   // if true, resolves own teacher_id via /api/teachers/me/360
  onClose?: () => void;
  isModal?: boolean;
}

type TabType = 'profile' | 'attendance' | 'payout' | 'students' | 'homework' | 'ptm';

const PAYOUT_TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixed Monthly Salary',
  per_student_monthly: 'Per Student Monthly Base',
};

const Teacher360View: React.FC<Teacher360ViewProps> = ({
  teacherId,
  selfView = false,
  onClose,
  isModal = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [data, setData] = useState<Teacher360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(teacherId || null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        let id = resolvedId;

        if (selfView && !id) {
          const meRes = await apiGet('/api/teachers/me/360');
          id = meRes.teacher_id;
          setResolvedId(id);
        }

        if (!id) {
          setError('No teacher ID available.');
          return;
        }

        const result = await apiGet(`/api/teachers/${id}/360`);
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load teacher profile.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [teacherId, selfView]);

  useEffect(() => {
    if (activeTab !== 'students' || !resolvedId || studentsLoading || students.length > 0) return;
    setStudentsLoading(true);
    apiGet(`/api/teachers/${resolvedId}/students`)
      .then((res: any) => setStudents(res.students || []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }, [activeTab, resolvedId]);

  const attendanceRate = data
    ? data.attendance.summary.current_month_expected > 0
      ? Math.round((data.attendance.summary.current_month_sessions / data.attendance.summary.current_month_expected) * 100)
      : 100
    : 0;

  const rowColor = (conducted: number, expected: number) => {
    if (expected === 0) return '';
    const delta = expected - conducted;
    if (delta <= 0) return 'bg-green-50';
    if (delta === 1) return 'bg-amber-50';
    return 'bg-red-50';
  };

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const TAB_ICONS: Record<TabType, React.ReactNode> = {
    profile: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />,
    students: <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />,
    attendance: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />,
    payout: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />,
    homework: <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />,
    ptm: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />,
  };
  const TAB_LABELS: Record<TabType, string> = {
    profile: 'Profile',
    students: 'My Students',
    attendance: 'Attendance',
    payout: 'Payout',
    homework: 'Homework',
    ptm: 'PTM',
  };
  const visibleTabs = (['profile', 'students', 'attendance', ...(selfView ? [] : ['payout']), 'homework', 'ptm'] as TabType[]);

  const content = (
    <div className={`bg-white ${isModal ? 'rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col' : 'min-h-screen'}`}>

      {/* Header */}
      <div className="p-6 border-b flex justify-between items-start bg-gray-50 rounded-t-lg">
        <div>
          {loading ? (
            <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
          ) : error ? (
            <h2 className="text-xl text-red-600">Error loading profile</h2>
          ) : data ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow">
                  {data.profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{data.profile.name}</h2>
                  <p className="text-gray-500 text-sm">{data.profile.email || data.profile.phone || 'Teacher'}</p>
                </div>
                <span className={`ml-2 px-2 py-1 text-xs rounded-full font-medium ${data.profile.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {data.profile.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </>
          ) : null}
        </div>
        {isModal && onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-8 text-center text-red-500">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <>
          {/* Tabs — mobile: icon card grid | desktop: horizontal bar */}
          <div className="sm:hidden grid grid-cols-2 gap-2 p-3 border-b bg-gray-50">
            {visibleTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-200'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  {TAB_ICONS[tab]}
                </svg>
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex border-b px-4">
            {visibleTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`mr-6 py-3 text-sm font-medium whitespace-nowrap flex-none border-b-2 transition-colors ${activeTab === tab
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className={`p-6 ${isModal ? 'overflow-y-auto flex-1' : ''}`}>

            {/* ── PROFILE TAB ── */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Info card */}
                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                    <h3 className="font-semibold text-lg mb-4 text-gray-800">{selfView ? 'Contact Info' : 'Contact & Payout'}</h3>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Phone</dt>
                        <dd className="font-medium"><PhoneLink phone={data.profile.phone} fallback="N/A" /></dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Email</dt>
                        <dd className="font-medium">{data.profile.email || 'N/A'}</dd>
                      </div>
                      {!selfView && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Payout Type</dt>
                            <dd className="font-medium">{PAYOUT_TYPE_LABELS[data.profile.payout_type] || data.profile.payout_type}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Rate</dt>
                            <dd className="font-medium text-green-700">₹{data.profile.rate.toLocaleString('en-IN')}</dd>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Active Batches</dt>
                        <dd className="font-medium">{data.profile.batch_count}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* This month quick stats */}
                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                    <h3 className="font-semibold text-lg mb-4 text-gray-800">This Month</h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white p-3 rounded shadow-sm border-l-4 border-blue-500">
                        <div className="text-2xl font-bold text-gray-800">{data.attendance.summary.current_month_sessions}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Conducted</div>
                      </div>
                      <div className="bg-white p-3 rounded shadow-sm border-l-4 border-gray-300">
                        <div className="text-2xl font-bold text-gray-800">{data.attendance.summary.current_month_expected}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Expected</div>
                      </div>
                      <div className={`bg-white p-3 rounded shadow-sm border-l-4 ${attendanceRate >= 90 ? 'border-green-500' : attendanceRate >= 75 ? 'border-amber-500' : 'border-red-500'}`}>
                        <div className="text-2xl font-bold text-gray-800">{attendanceRate}%</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Rate</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Batches */}
                {data.profile.batches.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-800">Assigned Batches</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.profile.batches.map(b => (
                        <div key={b.id} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-orange-600">{b.instrument_name}</h4>
                              <p className="text-sm text-gray-500 mt-1">{b.recurrence}</p>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-semibold text-gray-700">{b.active_students} / {b.capacity}</div>
                              <div className="text-xs text-gray-400">students</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── MY STUDENTS TAB ── */}
            {activeTab === 'students' && (
              <div>
                {studentsLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                    Loading students…
                  </div>
                ) : resolvedId ? (
                  <TeacherStudentList students={students} />
                ) : null}
              </div>
            )}

            {/* ── HOMEWORK TAB ── */}
            {activeTab === 'homework' && resolvedId && (
              <BulkHomeworkPanel mode="teacher" teacherId={resolvedId} />
            )}

            {/* ── PTM TAB ── */}
            {activeTab === 'ptm' && resolvedId && (
              <TeacherPTMTab teacherId={resolvedId} />
            )}

            {/* ── ATTENDANCE TAB ── */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-sm text-blue-600 font-medium">Sessions This Month</div>
                    <div className="text-3xl font-bold text-blue-800 mt-1">{data.attendance.summary.current_month_sessions}</div>
                    <div className="text-xs text-blue-500 mt-1">of {data.attendance.summary.current_month_expected} expected</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <div className="text-sm text-purple-600 font-medium">Total Sessions (12mo)</div>
                    <div className="text-3xl font-bold text-purple-800 mt-1">{data.attendance.summary.total_sessions_conducted}</div>
                  </div>
                  <div className={`p-4 rounded-lg border ${attendanceRate >= 90 ? 'bg-green-50 border-green-100' : attendanceRate >= 75 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                    <div className={`text-sm font-medium ${attendanceRate >= 90 ? 'text-green-600' : attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>Attendance Rate</div>
                    <div className={`text-3xl font-bold mt-1 ${attendanceRate >= 90 ? 'text-green-800' : attendanceRate >= 75 ? 'text-amber-800' : 'text-red-800'}`}>{attendanceRate}%</div>
                    <div className={`text-xs mt-1 ${attendanceRate >= 90 ? 'text-green-500' : attendanceRate >= 75 ? 'text-amber-500' : 'text-red-500'}`}>this month</div>
                  </div>
                </div>

                {/* Monthly breakdown */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-800">Monthly Breakdown</h3>
                  {data.attendance.monthly_breakdown.length === 0 ? (
                    <p className="text-gray-500 italic text-sm">No attendance data found.</p>
                  ) : (
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Expected</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Conducted</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {data.attendance.monthly_breakdown.map(row => {
                            const delta = row.conducted - row.expected;
                            return (
                              <tr key={row.month} className={rowColor(row.conducted, row.expected)}>
                                <td className="py-3 pl-4 pr-3 text-sm font-medium text-gray-800">{formatMonth(row.month)}</td>
                                <td className="px-3 py-3 text-center text-sm text-gray-600">{row.expected}</td>
                                <td className="px-3 py-3 text-center text-sm font-semibold text-gray-800">{row.conducted}</td>
                                <td className="px-3 py-3 text-center text-sm">
                                  <span className={`font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {delta >= 0 ? `+${delta}` : delta}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PAYOUT TAB ── */}
            {activeTab === 'payout' && (
              <div className="space-y-6">
                {/* Projected payout hero */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white p-6 rounded-xl shadow-lg">
                    <div className="text-sm font-medium opacity-90">Projected Payout — This Month</div>
                    <div className="text-4xl font-bold mt-2">₹{data.payout.projected.amount.toLocaleString('en-IN')}</div>
                    <div className="text-sm mt-2 opacity-80">{data.payout.projected.basis}</div>
                    <div className="text-xs mt-1 opacity-60 uppercase tracking-wide">{PAYOUT_TYPE_LABELS[data.payout.projected.model] || data.payout.projected.model}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl">
                    <div className="text-sm text-emerald-600 font-medium">Total Paid (All Time)</div>
                    <div className="text-4xl font-bold text-emerald-800 mt-2">₹{data.payout.total_paid.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-emerald-500 mt-2">{data.payout.history.length} payment records</div>
                  </div>
                </div>

                {/* Payout history table */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-800">Payment History</h3>
                  {data.payout.history.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic text-sm border rounded-lg">
                      No payout records found.
                    </div>
                  ) : (
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                            <th className="px-3 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Classes</th>
                            <th className="px-3 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount Paid</th>
                            <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                            <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {data.payout.history.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-800">{p.period}</td>
                              <td className="px-3 py-4 text-center text-sm text-gray-600">{p.linked_classes_count || '—'}</td>
                              <td className="px-3 py-4 text-right text-sm font-semibold text-gray-900">₹{parseFloat(String(p.amount)).toLocaleString('en-IN')}</td>
                              <td className="px-3 py-4 text-sm">
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize">
                                  {p.method || 'N/A'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-sm text-gray-500">
                                {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

export default Teacher360View;
