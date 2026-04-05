import React from 'react';
import { Expense } from './types';

interface ExpensesTabProps {
  expenses: Expense[];
  selectedMonth: string;
  newExpense: { category: string; amount: string; date: string; notes: string };
  onNewExpenseChange: (updated: { category: string; amount: string; date: string; notes: string }) => void;
  onAddExpense: (e: React.FormEvent) => void;
  onDeleteExpense: (id: string) => void;
  formatCurrency: (val: number) => string;
}

const ExpensesTab: React.FC<ExpensesTabProps> = ({
  expenses,
  selectedMonth,
  newExpense,
  onNewExpenseChange,
  onAddExpense,
  onDeleteExpense,
  formatCurrency,
}) => {
  return (
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
                    onClick={() => onDeleteExpense(expense.id)}
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
        <form onSubmit={onAddExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
            <input
              type="text"
              placeholder="e.g. Rent, Electricity"
              value={newExpense.category}
              onChange={e => onNewExpenseChange({ ...newExpense, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount</label>
            <input
              type="number"
              placeholder="0.00"
              value={newExpense.amount}
              onChange={e => onNewExpenseChange({ ...newExpense, amount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={newExpense.date}
              onChange={e => onNewExpenseChange({ ...newExpense, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea
              rows={2}
              value={newExpense.notes}
              onChange={e => onNewExpenseChange({ ...newExpense, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
            Add Expense
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExpensesTab;
