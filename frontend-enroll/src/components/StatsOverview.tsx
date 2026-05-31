import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LineChart, Line,
} from 'recharts';
import { Student, PaymentRecord } from '../types';
import { apiGet } from '../api';

interface DashboardStats {
  intentful_users_count: number;
  inactive_students_last_6_months: number;
  active_teachers_count: number;
  inactive_teachers_last_6_months: number;
  current_month_expenses: number;
  monthly_student_trend: { label: string; count: number }[];
  monthly_inactive_trend: { label: string; count: number }[];
}

interface StatsProps {
  students: Student[];
  prospectsCount: number;
  payments: PaymentRecord[];
  dashboardStats: DashboardStats | null;
  onNavigate?: (tab: 'stats' | 'students' | 'attendance' | 'payments' | 'teachers') => void;
}

const StatCard: React.FC<{
  title: string;
  value: string;
  color: string;
  sub?: string;
  onClick?: () => void;
}> = ({ title, value, color, sub, onClick }) => (
  <div
    className={`${color} p-5 rounded-xl text-white ${onClick ? 'cursor-pointer transform transition-transform hover:scale-105' : ''}`}
    onClick={onClick}
  >
    <h3 className="text-xs font-semibold opacity-80 uppercase tracking-wide mb-2">{title}</h3>
    <p className="text-3xl font-bold">{value}</p>
    {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
  </div>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6">{title}</h2>
);

const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      <option value="all">All</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

const BRANCH_LABELS: Record<string, string> = {
  hsm_main: 'HSM Main',
  pbel_city: 'PBEL City',
};

const EmptyChart: React.FC<{ message?: string }> = ({ message = 'No data' }) => (
  <div className="h-full flex items-center justify-center text-slate-400 text-sm">{message}</div>
);

// Returns "Jun '25 – Jun '26" style label for a rolling window ending now.
function rollingRangeLabel(monthsBack: number): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const fmt = (d: Date) =>
    d.toLocaleString('default', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2);
  return `${fmt(start)} – ${fmt(now)}`;
}

const StatsOverview: React.FC<StatsProps> = ({ students, prospectsCount, payments, dashboardStats, onNavigate }) => {
  // Filters scoped only to the inactive trend chart
  const [chartBranch, setChartBranch] = useState('all');
  const [chartTeacher, setChartTeacher] = useState('all');
  const [chartInstrument, setChartInstrument] = useState('all');
  const [inactiveTrend, setInactiveTrend] = useState<{ label: string; count: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Sync from initial load and re-fetch when filters change
  useEffect(() => {
    if (!dashboardStats) return;

    // No filters — use data already in hand, no extra round-trip
    if (chartBranch === 'all' && chartTeacher === 'all' && chartInstrument === 'all') {
      setInactiveTrend(dashboardStats.monthly_inactive_trend ?? []);
      return;
    }

    const qs = new URLSearchParams();
    if (chartBranch !== 'all') qs.set('branch', chartBranch);
    if (chartTeacher !== 'all') qs.set('teacher', chartTeacher);
    if (chartInstrument !== 'all') qs.set('instrument', chartInstrument);

    setTrendLoading(true);
    apiGet(`/api/stats/inactive-trend?${qs.toString()}`)
      .then((data: any) => {
        if (data?.monthly_inactive_trend) setInactiveTrend(data.monthly_inactive_trend);
      })
      .catch(console.error)
      .finally(() => setTrendLoading(false));
  }, [chartBranch, chartTeacher, chartInstrument, dashboardStats]);

  // Filter options derived from active students' batch data
  // (best proxy for what branches/teachers/instruments exist since inactive batch links may be deleted)
  const { branchOptions, teacherOptions, instrumentOptions } = useMemo(() => {
    const branches = new Map<string, string>();
    const teachers = new Set<string>();
    const instruments = new Set<string>();
    students.forEach(s => {
      ((s as any).batches || []).forEach((b: any) => {
        if (b.branch_code) branches.set(b.branch_code, BRANCH_LABELS[b.branch_code] || b.branch_code);
        if (b.teacher) teachers.add(b.teacher);
        if (b.instrument) instruments.add(b.instrument);
      });
    });
    return {
      branchOptions: Array.from(branches.entries()).map(([value, label]) => ({ value, label })),
      teacherOptions: Array.from(teachers).sort().map(t => ({ value: t, label: t })),
      instrumentOptions: Array.from(instruments).sort().map(i => ({ value: i, label: i })),
    };
  }, [students]);

  const chartFiltersActive = chartBranch !== 'all' || chartTeacher !== 'all' || chartInstrument !== 'all';

  // Student stat cards — school-wide (unfiltered)
  const activeStudents = students.filter(s => (s as any).status === 'active').length;
  const enrolledStudents = students.length;

  // Instrument pie chart — all active students
  const instrumentData = useMemo(() => {
    const stats: Record<string, Set<string>> = {};
    students
      .filter(s => (s as any).status === 'active')
      .forEach(s => {
        const id = (s as any).student_id || s.id;
        ((s as any).batches || []).forEach((b: any) => {
          if (b.instrument) {
            if (!stats[b.instrument]) stats[b.instrument] = new Set();
            stats[b.instrument].add(id);
          }
        });
      });
    return Object.entries(stats)
      .map(([name, set]) => ({ name, value: set.size }))
      .sort((a, b) => b.value - a.value);
  }, [students]);

  // Faculty bar chart — all active students
  const teacherChartData = useMemo(() => {
    const stats: Record<string, Set<string>> = {};
    students
      .filter(s => (s as any).status === 'active')
      .forEach(s => {
        const id = (s as any).student_id || s.id;
        ((s as any).batches || []).forEach((b: any) => {
          if (b.teacher) {
            if (!stats[b.teacher]) stats[b.teacher] = new Set();
            stats[b.teacher].add(id);
          }
        });
      });
    return Object.entries(stats)
      .map(([teacher, set]) => ({ teacher, active_students: set.size }))
      .sort((a, b) => b.active_students - a.active_students);
  }, [students]);

  // Current month revenue (non-backfill payments)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthRevenue = useMemo(() =>
    payments
      .filter(p => !(p as any).metadata?.backfill && new Date(p.timestamp) >= monthStart)
      .reduce((acc, p) => acc + parseFloat(String(p.amount || '0')), 0),
    [payments]
  );

  return (
    <div className="space-y-10">

      {/* ── STUDENTS SECTION ───────────────────────────────────── */}
      <section>
        <SectionHeader title="Students" />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Active Students"
            value={activeStudents.toString()}
            color="bg-blue-500"
            onClick={() => onNavigate?.('students')}
          />
          <StatCard
            title="Enrolled Students"
            value={enrolledStudents.toString()}
            color="bg-indigo-500"
            onClick={() => onNavigate?.('students')}
          />
          <StatCard
            title="Prospects"
            value={prospectsCount.toString()}
            color="bg-purple-500"
            onClick={() => onNavigate?.('students')}
          />
          <StatCard
            title="Intentful Users"
            value={(dashboardStats?.intentful_users_count ?? '—').toString()}
            color="bg-violet-500"
          />
          <StatCard
            title="Inactivated"
            value={(dashboardStats?.inactive_students_last_6_months ?? '—').toString()}
            color="bg-rose-500"
            sub={rollingRangeLabel(6)}
          />
        </div>

        {/* Charts row 1: pie + active trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h3 className="text-base font-semibold text-slate-700 mb-4">Active Students by Instrument</h3>
            <div className="h-72 w-full">
              {instrumentData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={instrumentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={90}
                      dataKey="value"
                    >
                      {instrumentData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h3 className="text-base font-semibold text-slate-700 mb-1">Active Students — Month on Month</h3>
            <p className="text-xs text-slate-400 mb-4">School-wide · {rollingRangeLabel(12)}</p>
            <div className="h-64 w-full">
              {!dashboardStats?.monthly_student_trend?.length ? (
                <EmptyChart message="Loading…" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardStats.monthly_student_trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2}
                      activeDot={{ r: 6 }}
                      name="Active Students"
                      dot={(props: any) => {
                        const { cx, cy, index, payload } = props;
                        const isLast = index === (dashboardStats!.monthly_student_trend.length - 1);
                        return (
                          <g key={`dot-${index}`}>
                            <circle
                              cx={cx} cy={cy}
                              r={isLast ? 7 : 4}
                              fill={isLast ? '#4338ca' : '#6366f1'}
                              stroke={isLast ? '#fff' : 'none'}
                              strokeWidth={isLast ? 2 : 0}
                            />
                            {isLast && (
                              <text x={cx} y={cy - 14} textAnchor="middle" fontSize={11} fill="#4338ca" fontWeight="bold">
                                Now: {payload.count}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Charts row 2: inactivated trend with its own filters */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-700">Students Inactivated — {rollingRangeLabel(3)}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Count of students deactivated per month</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterSelect
                label="Branch"
                value={chartBranch}
                onChange={setChartBranch}
                options={branchOptions}
              />
              <FilterSelect
                label="Teacher"
                value={chartTeacher}
                onChange={setChartTeacher}
                options={teacherOptions}
              />
              <FilterSelect
                label="Instrument"
                value={chartInstrument}
                onChange={setChartInstrument}
                options={instrumentOptions}
              />
              {chartFiltersActive && (
                <button
                  onClick={() => { setChartBranch('all'); setChartTeacher('all'); setChartInstrument('all'); }}
                  className="text-xs text-rose-600 font-semibold hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="h-52 w-full">
            {trendLoading ? (
              <EmptyChart message="Loading…" />
            ) : inactiveTrend.length === 0 ? (
              <EmptyChart message="Loading…" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inactiveTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 5, fill: '#f43f5e' }}
                    activeDot={{ r: 7 }}
                    name="Inactivated Students"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ── FACULTY SECTION ────────────────────────────────────── */}
      <section>
        <SectionHeader title="Faculty" />

        <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm">
          <StatCard
            title="Active Faculty"
            value={(dashboardStats?.active_teachers_count ?? '—').toString()}
            color="bg-teal-500"
            onClick={() => onNavigate?.('teachers')}
          />
          <StatCard
            title="Inactive Faculty"
            value={(dashboardStats?.inactive_teachers_last_6_months ?? '—').toString()}
            color="bg-slate-500"
            sub={rollingRangeLabel(6)}
          />
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <h3 className="text-base font-semibold text-slate-700 mb-4">Faculty vs Active Students</h3>
          <div className="h-72 w-full">
            {teacherChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={teacherChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="teacher" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="active_students" name="Active Students" radius={[0, 4, 4, 0]}>
                    {teacherChartData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ── FINANCE SECTION ────────────────────────────────────── */}
      <section>
        <SectionHeader title="Finance — This Month" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
          <StatCard
            title="Revenue This Month"
            value={`₹${currentMonthRevenue.toLocaleString()}`}
            color="bg-emerald-500"
            onClick={() => onNavigate?.('payments')}
          />
          <StatCard
            title="Expenses This Month"
            value={`₹${(dashboardStats?.current_month_expenses ?? 0).toLocaleString()}`}
            color="bg-orange-500"
          />
        </div>
      </section>

    </div>
  );
};

export default StatsOverview;
