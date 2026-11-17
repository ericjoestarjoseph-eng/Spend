import fs from 'node:fs';
import path from 'node:path';
import type {
  AnomalySensitivity,
  BudgetConfig,
  CategoryName,
  LearnedRule,
  Transaction,
  UserAccount,
} from '../src/types/finance.ts';
import {
  DEMO_USERS,
  PROFESSIONAL_BUDGET,
  STUDENT_BUDGET,
  getSeedTransactions,
} from '../src/data/seedData.ts';
import { classifyTransaction } from '../src/engine/categorizer.ts';

export interface StatementIngestionLog {
  id: string;
  userId: string;
  userName: string;
  fileName: string;
  format: 'csv' | 'pdf' | 'image' | 'text';
  parserMode: 'ai_gemini' | 'csv_mapper';
  totalExtracted: number;
  importedCount: number;
  duplicatesSkipped: number;
  avgConfidence: number;
  statementPeriod?: string;
  bankOrSource?: string;
  status: 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface UserWorkspaceData {
  user: UserAccount & { role: 'admin' | 'user' };
  transactions: Transaction[];
  budgets: BudgetConfig;
  learnedRules: LearnedRule[];
  dismissedAnomalyIds: string[];
  sensitivity: AnomalySensitivity;
  selectedMonth: string;
}

export interface ServerDatabase {
  activeUserId: string;
  workspaces: Record<string, UserWorkspaceData>;
  globalRules: LearnedRule[];
  statementLogs: StatementIngestionLog[];
  auditLogs: AuditLogEntry[];
}

const DB_FILE = path.resolve(process.cwd(), 'smartspend-db.json');

function createInitialDatabase(): ServerDatabase {
  const proUser: UserAccount & { role: 'admin' | 'user' } = {
    ...DEMO_USERS.professional,
    role: 'admin',
  };
  const studentUser: UserAccount & { role: 'admin' | 'user' } = {
    ...DEMO_USERS.student,
    role: 'user',
  };

  const now = new Date().toISOString();

  return {
    activeUserId: proUser.id,
    workspaces: {
      [proUser.id]: {
        user: proUser,
        transactions: getSeedTransactions('professional'),
        budgets: PROFESSIONAL_BUDGET,
        learnedRules: [],
        dismissedAnomalyIds: [],
        sensitivity: 'balanced',
        selectedMonth: '2026-11',
      },
      [studentUser.id]: {
        user: studentUser,
        transactions: getSeedTransactions('student'),
        budgets: STUDENT_BUDGET,
        learnedRules: [],
        dismissedAnomalyIds: [],
        sensitivity: 'balanced',
        selectedMonth: '2026-11',
      },
    },
    globalRules: [
      { pattern: 'swiggy instamart', category: 'Food and Dining', updatedAt: now },
      { pattern: 'bescom', category: 'Bills and Utilities', updatedAt: now },
      { pattern: 'nobroker', category: 'Housing', updatedAt: now },
    ],
    statementLogs: [
      {
        id: 'stmt_seed_1',
        userId: proUser.id,
        userName: proUser.name,
        fileName: 'hdfc_savings_jun_nov_2026.csv',
        format: 'csv',
        parserMode: 'csv_mapper',
        totalExtracted: 56,
        importedCount: 56,
        duplicatesSkipped: 0,
        avgConfidence: 0.94,
        statementPeriod: 'Jun 2026 – Nov 2026',
        bankOrSource: 'HDFC Bank Savings',
        status: 'completed',
        createdAt: '2026-11-16T09:30:00.000Z',
      },
      {
        id: 'stmt_seed_2',
        userId: studentUser.id,
        userName: studentUser.name,
        fileName: 'sbi_upi_aug_nov_2026.csv',
        format: 'csv',
        parserMode: 'csv_mapper',
        totalExtracted: 30,
        importedCount: 30,
        duplicatesSkipped: 0,
        avgConfidence: 0.93,
        statementPeriod: 'Aug 2026 – Nov 2026',
        bankOrSource: 'SBI Youth Account',
        status: 'completed',
        createdAt: '2026-11-16T11:15:00.000Z',
      },
    ],
    auditLogs: [
      {
        id: 'aud_1',
        actor: 'Arjun Mehta',
        action: 'Workspace Initialized',
        detail: 'Seeded Indian personal finance ledger and baseline anomaly thresholds',
        createdAt: '2026-11-16T09:30:00.000Z',
      },
    ],
  };
}

export function readDb(): ServerDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ServerDatabase;
      if (parsed && parsed.workspaces && parsed.activeUserId) {
        return parsed;
      }
    }
  } catch {
    // Re-seed if corrupted
  }
  const initial = createInitialDatabase();
  writeDb(initial);
  return initial;
}

export function writeDb(db: ServerDatabase): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export function appendAudit(
  db: ServerDatabase,
  actor: string,
  action: string,
  detail: string
): void {
  db.auditLogs.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actor,
    action,
    detail,
    createdAt: new Date().toISOString(),
  });
  if (db.auditLogs.length > 100) {
    db.auditLogs = db.auditLogs.slice(0, 100);
  }
}

export interface LabeledBenchmarkSample {
  description: string;
  type: 'expense' | 'income';
  expected: CategoryName;
}

const BENCHMARK_CORPUS: LabeledBenchmarkSample[] = [
  { description: 'Swiggy Instamart Groceries', type: 'expense', expected: 'Food and Dining' },
  { description: 'Zomato Late Night Biryani', type: 'expense', expected: 'Food and Dining' },
  { description: 'Blue Tokai Coffee Roasters', type: 'expense', expected: 'Food and Dining' },
  { description: 'Uber Auto Office Commute', type: 'expense', expected: 'Transportation' },
  { description: 'Namma Metro Card Recharge', type: 'expense', expected: 'Transportation' },
  { description: 'HPCL Petrol Pump Indiranagar', type: 'expense', expected: 'Transportation' },
  { description: 'Amazon India Electronics', type: 'expense', expected: 'Shopping' },
  { description: 'Myntra Apparel Order', type: 'expense', expected: 'Shopping' },
  { description: 'BookMyShow PVR IMAX Ticket', type: 'expense', expected: 'Entertainment' },
  { description: 'Netflix Monthly Subscription', type: 'expense', expected: 'Entertainment' },
  { description: 'Apollo Pharmacy Prescription', type: 'expense', expected: 'Healthcare' },
  { description: 'Thyrocare Blood Diagnostics', type: 'expense', expected: 'Healthcare' },
  { description: 'Coursera ML Course Fee', type: 'expense', expected: 'Education' },
  { description: 'Sapna Book House Textbooks', type: 'expense', expected: 'Education' },
  { description: 'BESCOM Electricity Bill Pay', type: 'expense', expected: 'Bills and Utilities' },
  { description: 'JioFiber Broadband Renewal', type: 'expense', expected: 'Bills and Utilities' },
  { description: 'NoBroker Monthly Flat Rent', type: 'expense', expected: 'Housing' },
  { description: 'IndiGo Bengaluru Delhi Flight', type: 'expense', expected: 'Travel' },
  { description: 'IRCTC Train Ticket Booking', type: 'expense', expected: 'Travel' },
  { description: 'Cult.fit Annual Gym Membership', type: 'expense', expected: 'Personal Care' },
  { description: 'TechCorp India Monthly Salary NEFT', type: 'income', expected: 'Income' },
  { description: 'Internship Stipend Credit', type: 'income', expected: 'Income' },
];

export function evaluateCategorizerModel(globalRules: LearnedRule[]) {
  const results = BENCHMARK_CORPUS.map((sample) => {
    const prediction = classifyTransaction(sample.description, sample.type, globalRules);
    return {
      description: sample.description,
      expected: sample.expected,
      predicted: prediction.category,
      confidence: prediction.confidence,
      correct: prediction.category === sample.expected,
    };
  });

  const correctCount = results.filter((r) => r.correct).length;
  const accuracy = Number(((correctCount / results.length) * 100).toFixed(1));
  const avgConfidence = Number(
    (
      (results.reduce((s, r) => s + r.confidence, 0) / results.length) *
      100
    ).toFixed(1)
  );

  // Per-category precision/recall summary
  const categories = Array.from(new Set(BENCHMARK_CORPUS.map((b) => b.expected)));
  const perCategory = categories.map((cat) => {
    const tp = results.filter((r) => r.expected === cat && r.predicted === cat).length;
    const fp = results.filter((r) => r.expected !== cat && r.predicted === cat).length;
    const fn = results.filter((r) => r.expected === cat && r.predicted !== cat).length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return {
      category: cat,
      samples: tp + fn,
      precision: Math.round(precision * 100),
      recall: Math.round(recall * 100),
      f1: Math.round(f1 * 100),
    };
  });

  return {
    evaluatedAt: new Date().toISOString(),
    sampleCount: results.length,
    correctCount,
    accuracy,
    avgConfidence,
    perCategory,
    mismatches: results.filter((r) => !r.correct),
  };
}
