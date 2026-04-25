export interface Teacher {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  payout_type: 'per_student_monthly' | 'fixed';
  rate: number;
  is_active: boolean;
}

export type TrinityGrade =
  | 'Initial' | 'Grade 1' | 'Grade 2' | 'Grade 3' | 'Grade 4'
  | 'Grade 5' | 'Grade 6' | 'Grade 7' | 'Grade 8' | 'Fixed';

export const TRINITY_GRADES: TrinityGrade[] = [
  'Initial','Grade 1','Grade 2','Grade 3','Grade 4',
  'Grade 5','Grade 6','Grade 7','Grade 8'
];

export interface InstrumentGradeRate {
  id?: string;
  instrument_id: string;
  instrument_name: string;
  trinity_grade: TrinityGrade;
  rate_per_student: number;
}

export interface TeacherGradeRateOverride {
  id?: string;
  instrument_id: string;
  instrument_name: string;
  trinity_grade: TrinityGrade;
  rate_per_student: number;
}

export interface PayslipStudent {
  student_id: string;
  student_name: string;
  instrument_id: string;
  instrument_name: string;
  trinity_grade: TrinityGrade;
  enrollment_date: string;
  classes_attended: number;
  status: 'billable' | 'deferred' | 'excluded';
  rate: number;
  subtotal: number;
}

export interface PayslipBatchAttendance {
  batch_id: string;
  recurrence: string;
  attendance: { conducted: number; not_conducted: number };
}

export interface PayslipInstrument {
  instrument_id: string;
  instrument_name: string;
  is_vocal: boolean;
  batches: PayslipBatchAttendance[];
  students: PayslipStudent[];
  billable_count: number;
  instrument_subtotal: number;
}

export interface TeacherPayslip {
  teacher: {
    id: string;
    name: string;
    phone: string;
    email: string;
    payout_type: 'fixed' | 'per_student_monthly';
    rate: number;
  };
  period: { month: string; start: string; end: string };
  instruments: PayslipInstrument[];
  summary: {
    total_payable: number;
    fixed_salary: number | null;
    per_student_total: number | null;
    deferred_count: number;
    excluded_count: number;
    billable_count: number;
  };
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
