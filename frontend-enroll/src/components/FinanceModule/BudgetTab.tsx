import React from 'react';
import { BudgetComparison } from './types';

interface BudgetTabProps {
  budgetComparison: BudgetComparison;
  saving: boolean;
  onUpdateBudget: (field: string, value: number, category?: string) => void;
  onSaveBudget: () => void;
  formatCurrency: (val: number) => string;
}

const BudgetTab: React.FC<BudgetTabProps> = ({
  budgetComparison,
  saving,
  onUpdateBudget,
  onSaveBudget,
  formatCurrency,
}) => {
  return (
    <div className="space-y-6">
      {/* Revenue Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Revenue Budget</h3>
          <button
            onClick={onSaveBudget}
            disabled={saving}
            className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            Save Budget
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Target Revenue</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400">₹</span>
              <input
                type="number"
                value={budgetComparison.budgetObject.revenueTarget || ''}
                onChange={e => onUpdateBudget('revenueTarget', parseFloat(e.target.value) || 0)}
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
                      onChange={e => onUpdateBudget('expense', parseFloat(e.target.value) || 0, row.category)}
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
  );
};

export default BudgetTab;
