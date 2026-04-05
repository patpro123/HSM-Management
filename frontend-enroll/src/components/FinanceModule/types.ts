export interface Teacher {
  id: string;
  name: string;
  payout_type: 'per_student_monthly' | 'fixed';
  rate: number;
  is_active: boolean;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface FeeStructure {
  [instrumentId: string]: {
    monthly: number;
    quarterly: number;
  };
}

export interface MonthlyBudget {
  month: string;
  revenueTarget: number;
  expenseLimits: {
    [category: string]: number;
  };
}

export interface MonthStats {
  realRevenue: number;
  projectedRevenue: number;
  teacherExpense: number;
  fixedCosts: number;
  totalExpenses: number;
  projectedProfit: number;
  realizedProfit: number;
}

export interface BudgetComparison {
  revenue: {
    budgeted: number;
    actual: number;
    variance: number;
  };
  expenses: Array<{
    category: string;
    budgeted: number;
    actual: number;
    variance: number;
    percent: number;
  }>;
  budgetObject: MonthlyBudget;
}
