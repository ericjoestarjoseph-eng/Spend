export type CategoryName =
  | 'Food and Dining'
  | 'Transportation'
  | 'Shopping'
  | 'Entertainment'
  | 'Healthcare'
  | 'Education'
  | 'Bills and Utilities'
  | 'Housing'
  | 'Travel'
  | 'Personal Care'
  | 'Income'
  | 'Other';

export type TransactionType = 'expense' | 'income';

export type TransactionSource = 'manual' | 'csv_import' | 'seed';

export type PaymentMethod = 'UPI' | 'Debit Card' | 'Credit Card' | 'NetBanking' | 'Cash';

export interface Transaction {
  id: string;
  userId: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: CategoryName;
  predictedCategory: CategoryName;
  confidence: number; // 0 to 1
  needsReview: boolean;
  manuallyCorrected: boolean;
  paymentMethod: PaymentMethod;
  notes?: string;
  source: TransactionSource;
  createdAt: string;
}

export interface CategoryMeta {
  name: CategoryName;
  type: TransactionType;
  color: string;
  shortLabel: string;
}

export interface BudgetConfig {
  overallMonthlyLimit: number;
  alertThresholdPercent: number; // e.g. 80
  categoryLimits: Partial<Record<CategoryName, number>>;
}

export type AnomalySensitivity = 'conservative' | 'balanced' | 'sensitive';

export interface AnomalyAlert {
  id: string;
  transactionId: string;
  transaction: Transaction;
  categoryBaselineAvg: number;
  categoryStdDev: number;
  ratioToBaseline: number;
  zScore: number;
  anomalyScore: number; // 0 to 1
  reason: string;
  severity: 'moderate' | 'high';
  status: 'active' | 'dismissed';
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  city: string;
  avatarUrl?: string;
  personaKey: 'professional' | 'student' | 'custom';
  role?: 'admin' | 'user';
}

export type NavTab =
  | 'overview'
  | 'transactions'
  | 'import'
  | 'budgets'
  | 'anomalies'
  | 'reports'
  | 'admin';

export interface LearnedRule {
  pattern: string;
  category: CategoryName;
  updatedAt: string;
}

export interface CsvMappedRow {
  rowIndex: number;
  rawDate: string;
  rawDescription: string;
  rawAmount: string;
  parsedDate: string | null;
  parsedAmount: number | null;
  parsedType: TransactionType;
  paymentMethod: PaymentMethod;
  predictedCategory: CategoryName;
  confidence: number;
  needsReview: boolean;
  isValid: boolean;
  validationError?: string;
  isDuplicate: boolean;
  include: boolean;
}

export interface AiParsedStatementRow {
  rowIndex: number;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: CategoryName;
  paymentMethod: PaymentMethod;
  confidence: number;
  needsReview: boolean;
  isDuplicate: boolean;
  include: boolean;
  notes?: string;
}

export interface AiParsedStatementResult {
  bankOrSource: string;
  statementPeriod: string;
  insights: string[];
  transactions: AiParsedStatementRow[];
}
