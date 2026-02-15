import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { Student, Batch, PaymentRecord, Instrument } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';

interface Teacher {
  id: string;
  name: string;
  payout_type: 'per_student_monthly' | 'fixed';
  rate: number;
  is_active: boolean;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}

interface FeeStructure {
  [instrumentId: string]: {
    monthly: number;
    quarterly: number;
  };
}

interface MonthlyBudget {
  month: string;
  revenueTarget: number;
  expenseLimits: {
    [category: string]: number;
  };
}

interface FinanceModuleProps {
  students: Student[];
  batches: Batch[];
  payments: PaymentRecord[];
  instruments: Instrument[];
}

const FinanceModule: React.FC<FinanceModuleProps> = ({ students, batches, payments, instruments }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'budget'>('overview');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fees, setFees] = useState<FeeStructure>({});
  const [newExpense, setNewExpense] = useState({ category: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    fetchFinanceData();
  }, [instruments]);

  const fetchFinanceData = async () => {
    try {
      const [expensesData, feesData, budgetsData] = await Promise.all([
        apiGet('/api/finance/expenses').catch(() => ({ expenses: [] })),
        apiGet('/api/finance/fees').catch(() => ({ fees: {} })),
        apiGet('/api/finance/budgets').catch(() => ({ budgets: [] }))
      ]);

      setExpenses(expensesData.expenses || []);
      setBudgets(budgetsData.budgets || []);
      
      // Initialize fees with defaults if empty, otherwise use API data
      const loadedFees = feesData.fees || {};
      const initialFees: FeeStructure = { ...loadedFees };
      instruments.forEach(inst => {
        if (!initialFees[inst.id]) {
          initialFees[inst.id] = { monthly: 2000, quarterly: 5000 };
        }
      });
      setFees(initialFees);
    } catch (err) {
      console.error('Error fetching finance data:', err);
    }
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/teachers');
      setTeachers(data.teachers || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Calculations ---

  const calculateStatsForMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    
    // 1. Real Revenue (from Payments)
    const realRevenue = payments
      .filter(p => {
        const d = new Date(p.timestamp);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

    // 2. Projected Revenue (from Enrollments)
    // We assume accrual basis: Quarterly fee is split over 3 months for projection
    let projectedRevenue = 0;
    students.forEach(student => {
      if ((student as any).is_active === false) return;
      const studentBatches = (student as any).batches || [];
      
      studentBatches.forEach((b: any) => {
        const instId = b.instrument_id;
        const feeStruct = fees[instId] || { monthly: 0, quarterly: 0 };
        
        if (b.payment_frequency === 'quarterly') {
          projectedRevenue += feeStruct.quarterly / 3;
        } else {
          projectedRevenue += feeStruct.monthly;
        }
      });
    });

    // 3. Teacher Expenses
    let teacherExpense = 0;
    teachers.forEach(teacher => {
      if (!teacher.is_active) return;
      
      if (teacher.payout_type === 'fixed') {
        teacherExpense += teacher.rate;
      } else if (teacher.payout_type === 'per_student_monthly') {
        // Count students enrolled in batches assigned to this teacher
        let studentCount = 0;
        // Get all batch IDs for this teacher
        const teacherBatchIds = batches
          .filter(b => String(b.teacher_id) === String(teacher.id))
          .map(b => String(b.id));
        
        // Count active students in these batches
        students.forEach(s => {
          if ((s as any).is_active === false) return;
          const sBatches = (s as any).batches || [];
          const hasBatch = sBatches.some((sb: any) => teacherBatchIds.includes(String(sb.batch_id)));
          if (hasBatch) studentCount++;
        });

        teacherExpense += (studentCount * teacher.rate);
      }
    });

    // 4. Fixed Costs
    const fixedCosts = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = teacherExpense + fixedCosts;
    const projectedProfit = projectedRevenue - totalExpenses;
    const realizedProfit = realRevenue - totalExpenses;

    return {
      realRevenue,
      projectedRevenue,
      teacherExpense,
      fixedCosts,
      totalExpenses,
      projectedProfit,
      realizedProfit
    };
  };

  const stats = useMemo(() => calculateStatsForMonth(selectedMonth), [selectedMonth, payments, students, batches, teachers, expenses, fees]);

  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    // Generate last 6 months and next 5 months (12 months total)
    for (let i = -6; i <= 5; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      const monthStats = calculateStatsForMonth(monthStr);
      
      data.push({
        name: monthLabel,
        month: monthStr,
        ...monthStats
      });
    }
    return data;
  }, [payments, students, batches, teachers, expenses, fees]);

  const budgetComparison = useMemo(() => {
    const budget = budgets.find(b => b.month === selectedMonth) || {
      month: selectedMonth,
      revenueTarget: 0,
      expenseLimits: {}
    };

    // Aggregate actual expenses by category
    const actualsByCategory: Record<string, number> = {};
    
    // 1. Teacher Payouts
    actualsByCategory['Teacher Payouts'] = stats.teacherExpense;

    // 2. Fixed Expenses
    const [year, month] = selectedMonth.split('-').map(Number);
    expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .forEach(e => {
        actualsByCategory[e.category] = (actualsByCategory[e.category] || 0) + e.amount;
      });

    // Merge categories from budget and actuals
    const allCategories = Array.from(new Set([
      ...Object.keys(budget.expenseLimits),
      ...Object.keys(actualsByCategory)
    ])).sort();

    const expenseRows = allCategories.map(cat => {
      const budgeted = budget.expenseLimits[cat] || 0;
      const actual = actualsByCategory[cat] || 0;
      return {
        category: cat,
        budgeted,
        actual,
        variance: budgeted - actual, // Positive means under budget (good for expenses)
        percent: budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0
      };
    });

    return {
      revenue: {
        budgeted: budget.revenueTarget,
        actual: stats.realRevenue,
        variance: stats.realRevenue - budget.revenueTarget // Positive means over budget (good for revenue)
      },
      expenses: expenseRows,
      budgetObject: budget
    };
  }, [selectedMonth, budgets, stats, expenses]);

  // --- Handlers ---

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.category || !newExpense.amount) return;
    
    const expense: Expense = {
      id: Date.now().toString(),
      category: newExpense.category,
      amount: parseFloat(newExpense.amount),
      date: newExpense.date,
      notes: newExpense.notes
    };
    
    setExpenses([...expenses, expense]);
    setNewExpense({ category: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleUpdateBudget = (field: string, value: number, category?: string) => {
    const current = budgetComparison.budgetObject;
    const newBudget = { ...current };
    
    if (category) {
      newBudget.expenseLimits = { ...newBudget.expenseLimits, [category]: value };
    } else if (field === 'revenueTarget') {
      newBudget.revenueTarget = value;
    }

    setBudgets(prev => {
      const filtered = prev.filter(b => b.month !== selectedMonth);
      return [...filtered, newBudget];
    });
  };

  const handleSaveBudget = async () => {
    try {
      setSaving(true);
      const budgetToSave = budgets.find(b => b.month === selectedMonth);
      if (budgetToSave) {
        await apiPost('/api/finance/budgets', budgetToSave);
        alert(`Budget for ${selectedMonth} saved successfully!`);
      }
    } catch (err) {
      console.error('Failed to save budget:', err);
      alert('Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  // --- Render Helpers ---
  const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Finance Module</h2>
          <p className="text-slate-600">Track revenue, expenses, and profitability</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(['overview', 'expenses', 'budget'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${
                activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 w-fit">
        <span className="text-sm font-semibold text-slate-600">Period:</span>
        <input 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="outline-none text-slate-900 font-medium bg-transparent"
        />
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
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
              <p className="text-xs text-slate-400 mt-1">Teachers + Fixed Costs</p>
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

              {/* Expense Breakdown (Existing Pie Chart) */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Expense Breakdown ({selectedMonth})</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Teacher Payouts', value: stats.teacherExpense },
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
                <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Teacher Payouts</p>
                    <p className="font-bold text-slate-800">{formatCurrency(stats.teacherExpense)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fixed Costs</p>
                    <p className="font-bold text-slate-800">{formatCurrency(stats.fixedCosts)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Fixed Costs for {selectedMonth}</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses
                  .filter(e => e.date.startsWith(selectedMonth))
                  .map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{expense.category}</td>
                    <td className="px-6 py-4 text-slate-600">{expense.date}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{expense.notes || '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.filter(e => e.date.startsWith(selectedMonth)).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No expenses recorded for this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 h-fit">
            <h3 className="font-bold text-slate-800 mb-4">Add New Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <input 
                  type="text" 
                  placeholder="e.g. Rent, Electricity"
                  value={newExpense.category}
                  onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={newExpense.amount}
                  onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                <input 
                  type="date" 
                  value={newExpense.date}
                  onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea 
                  rows={2}
                  value={newExpense.notes}
                  onChange={e => setNewExpense({...newExpense, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
                Add Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Budget Tab */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          {/* Revenue Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Revenue Budget</h3>
              <button onClick={handleSaveBudget} disabled={saving} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50">Save Budget</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Revenue</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400">₹</span>
                  <input 
                    type="number" 
                    value={budgetComparison.budgetObject.revenueTarget || ''}
                    onChange={e => handleUpdateBudget('revenueTarget', parseFloat(e.target.value) || 0)}
                    className="pl-6 pr-3 py-2 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Actual Revenue</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(budgetComparison.revenue.actual)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Variance</p>
                <p className={`text-xl font-bold ${budgetComparison.revenue.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {budgetComparison.revenue.variance >= 0 ? '+' : ''}{formatCurrency(budgetComparison.revenue.variance)}
                </p>
              </div>
            </div>
            <div className="mt-4 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min((budgetComparison.revenue.actual / (budgetComparison.revenue.budgeted || 1)) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1 text-right">
              {Math.round((budgetComparison.revenue.actual / (budgetComparison.revenue.budgeted || 1)) * 100)}% of target
            </p>
          </div>

          {/* Expenses Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Expense Budget vs Actual</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">Budget</th>
                  <th className="px-6 py-3 text-right">Actual</th>
                  <th className="px-6 py-3 text-right">Variance</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgetComparison.expenses.map((row) => (
                  <tr key={row.category} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{row.category}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block w-24">
                        <span className="absolute left-2 top-1.5 text-slate-400 text-xs">₹</span>
                        <input 
                          type="number" 
                          value={row.budgeted || ''}
                          onChange={e => handleUpdateBudget('expense', parseFloat(e.target.value) || 0, row.category)}
                          className="pl-5 pr-2 py-1 w-full text-right text-sm border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">{formatCurrency(row.actual)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.variance >= 0 ? '+' : ''}{formatCurrency(row.variance)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        row.actual > row.budgeted && row.budgeted > 0 ? 'bg-red-100 text-red-800' : 
                        row.actual > 0 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {row.budgeted > 0 ? `${row.percent}%` : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
                {budgetComparison.expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No expenses recorded or budgeted for this month.</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-800">
                <tr>
                  <td className="px-6 py-4">Total Expenses</td>
                  <td className="px-6 py-4 text-right">
                    {formatCurrency(budgetComparison.expenses.reduce((sum, r) => sum + r.budgeted, 0))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {formatCurrency(budgetComparison.expenses.reduce((sum, r) => sum + r.actual, 0))}
                  </td>
                  <td className={`px-6 py-4 text-right ${
                    budgetComparison.expenses.reduce((sum, r) => sum + r.variance, 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(budgetComparison.expenses.reduce((sum, r) => sum + r.variance, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceModule;