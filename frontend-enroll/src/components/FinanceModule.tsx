import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost } from '../api';
import { Student, Batch, PaymentRecord, Instrument } from '../types';
import { Teacher, Expense, FeeStructure, MonthlyBudget } from './FinanceModule/types';
import OverviewTab from './FinanceModule/OverviewTab';
import ExpensesTab from './FinanceModule/ExpensesTab';
import BudgetTab from './FinanceModule/BudgetTab';
import PayslipsTab from './FinanceModule/PayslipsTab';
import FeeRatesTab from './FinanceModule/FeeRatesTab';

interface FinanceModuleProps {
  students: Student[];
  batches: Batch[];
  payments: PaymentRecord[];
  instruments: Instrument[];
}

const FinanceModule: React.FC<FinanceModuleProps> = ({ students, batches, payments, instruments }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'budget' | 'payslips' | 'fee-rates'>('overview');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [_loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

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

  const calculateStatsForMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);

    const realRevenue = payments
      .filter(p => {
        const d = new Date(p.timestamp);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

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

    let teacherExpense = 0;
    teachers.forEach(teacher => {
      if (!teacher.is_active) return;

      if (teacher.payout_type === 'fixed') {
        teacherExpense += teacher.rate;
      } else if (teacher.payout_type === 'per_student_monthly') {
        let studentCount = 0;
        const teacherBatchIds = batches
          .filter(b => String(b.teacher_id) === String(teacher.id))
          .map(b => String(b.id));

        students.forEach(s => {
          if ((s as any).is_active === false) return;
          const sBatches = (s as any).batches || [];
          const hasBatch = sBatches.some((sb: any) => teacherBatchIds.includes(String(sb.batch_id)));
          if (hasBatch) studentCount++;
        });

        teacherExpense += (studentCount * teacher.rate);
      }
    });

    const fixedCosts = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = teacherExpense + fixedCosts;
    const projectedProfit = projectedRevenue - totalExpenses;
    const realizedProfit = realRevenue - totalExpenses;

    return { realRevenue, projectedRevenue, teacherExpense, fixedCosts, totalExpenses, projectedProfit, realizedProfit };
  };

  const stats = useMemo(() => calculateStatsForMonth(selectedMonth), [selectedMonth, payments, students, batches, teachers, expenses, fees]);

  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = -6; i <= 5; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthStr = d.toISOString().slice(0, 7);
      const monthLabel = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const monthStats = calculateStatsForMonth(monthStr);
      data.push({ name: monthLabel, month: monthStr, ...monthStats });
    }
    return data;
  }, [payments, students, batches, teachers, expenses, fees]);

  const budgetComparison = useMemo(() => {
    const budget = budgets.find(b => b.month === selectedMonth) || {
      month: selectedMonth,
      revenueTarget: 0,
      expenseLimits: {}
    };

    const actualsByCategory: Record<string, number> = {};
    actualsByCategory['Teacher Payouts'] = stats.teacherExpense;

    const [year, month] = selectedMonth.split('-').map(Number);
    expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .forEach(e => {
        actualsByCategory[e.category] = (actualsByCategory[e.category] || 0) + e.amount;
      });

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
        variance: budgeted - actual,
        percent: budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0
      };
    });

    return {
      revenue: {
        budgeted: budget.revenueTarget,
        actual: stats.realRevenue,
        variance: stats.realRevenue - budget.revenueTarget
      },
      expenses: expenseRows,
      budgetObject: budget
    };
  }, [selectedMonth, budgets, stats, expenses]);

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

  const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Finance Module</h2>
          <p className="text-slate-600">Track revenue, expenses, and profitability</p>
        </div>
        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex bg-slate-100 p-1 rounded-lg w-max min-w-full md:w-auto">
            {(['overview', 'expenses', 'budget', 'payslips', 'fee-rates'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap capitalize transition ${
                  activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'fee-rates' ? 'Fee Rates' : tab}
              </button>
            ))}
          </div>
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

      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          chartData={chartData}
          selectedMonth={selectedMonth}
          formatCurrency={formatCurrency}
        />
      )}

      {activeTab === 'expenses' && (
        <ExpensesTab
          expenses={expenses}
          selectedMonth={selectedMonth}
          newExpense={newExpense}
          onNewExpenseChange={setNewExpense}
          onAddExpense={handleAddExpense}
          onDeleteExpense={handleDeleteExpense}
          formatCurrency={formatCurrency}
        />
      )}

      {activeTab === 'budget' && (
        <BudgetTab
          budgetComparison={budgetComparison}
          saving={saving}
          onUpdateBudget={handleUpdateBudget}
          onSaveBudget={handleSaveBudget}
          formatCurrency={formatCurrency}
        />
      )}

      {activeTab === 'payslips' && (
        <PayslipsTab
          teachers={teachers}
          selectedMonth={selectedMonth}
        />
      )}

      {activeTab === 'fee-rates' && (
        <FeeRatesTab />
      )}
    </div>
  );
};

export default FinanceModule;
