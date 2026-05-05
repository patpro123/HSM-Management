import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { MonthStats } from './types';

interface OverviewTabProps {
  stats: MonthStats;
  chartData: any[];
  selectedMonth: string;
  formatCurrency: (val: number) => string;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ stats, chartData, selectedMonth, formatCurrency }) => {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-xl shadow-lg">
          <p className="text-sm font-medium opacity-90">Realized Profit</p>
          <p className="text-3xl font-bold mt-2">{formatCurrency(stats.realizedProfit)}</p>
          <p className="text-xs opacity-75 mt-1">Based on actual payments</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
          <p className="text-sm font-medium opacity-90">Projected Profit</p>
          <p className="text-3xl font-bold mt-2">{formatCurrency(stats.projectedProfit)}</p>
          <p className="text-xs opacity-75 mt-1">Based on active enrollments</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Revenue (Real)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.realRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">Proj: {formatCurrency(stats.projectedRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(stats.totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.actualTeacherPaid > 0 ? 'Actual paid + Fixed' : 'Projected teachers + Fixed'}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="space-y-6">
        {/* Revenue Histogram */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Revenue Trends (Projected vs Realized)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="projectedRevenue" name="Projected Revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="realRevenue" name="Realized Revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profit Line Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Profitability Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="projectedProfit" name="Projected Profit" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="realizedProfit" name="Realized Profit" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expense Breakdown Pie Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Expense Breakdown ({selectedMonth})</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: stats.actualTeacherPaid > 0 ? 'Teacher Payouts (Actual)' : 'Teacher Payouts (Projected)', value: stats.actualTeacherPaid > 0 ? stats.actualTeacherPaid : stats.teacherExpense },
                      { name: 'Fixed Costs', value: stats.fixedCosts }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#8b5cf6" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500">Teacher Payouts</p>
                  {stats.actualTeacherPaid > 0 ? (
                    <p className="text-xs text-emerald-600 font-medium">Actual paid</p>
                  ) : (
                    <p className="text-xs text-amber-500 font-medium">Projected (not yet paid)</p>
                  )}
                </div>
                <p className="font-bold text-slate-800">
                  {formatCurrency(stats.actualTeacherPaid > 0 ? stats.actualTeacherPaid : stats.teacherExpense)}
                </p>
              </div>
              {stats.actualTeacherPaid > 0 && stats.actualTeacherPaid !== stats.teacherExpense && (
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Projected</span>
                  <span>{formatCurrency(stats.teacherExpense)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                <p className="text-xs text-slate-500">Fixed Costs</p>
                <p className="font-bold text-slate-800">{formatCurrency(stats.fixedCosts)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
