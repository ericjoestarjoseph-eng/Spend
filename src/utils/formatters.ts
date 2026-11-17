import { CategoryMeta, CategoryName, Transaction } from '../types/finance';

export const CATEGORIES: CategoryMeta[] = [
  { name: 'Food and Dining', type: 'expense', color: '#0F766E', shortLabel: 'Food & Dining' },
  { name: 'Housing', type: 'expense', color: '#1E293B', shortLabel: 'Housing' },
  { name: 'Transportation', type: 'expense', color: '#0284C7', shortLabel: 'Transport' },
  { name: 'Shopping', type: 'expense', color: '#D97706', shortLabel: 'Shopping' },
  { name: 'Bills and Utilities', type: 'expense', color: '#475569', shortLabel: 'Utilities' },
  { name: 'Entertainment', type: 'expense', color: '#7C3AED', shortLabel: 'Entertainment' },
  { name: 'Healthcare', type: 'expense', color: '#DC2626', shortLabel: 'Healthcare' },
  { name: 'Education', type: 'expense', color: '#2563EB', shortLabel: 'Education' },
  { name: 'Travel', type: 'expense', color: '#059669', shortLabel: 'Travel' },
  { name: 'Personal Care', type: 'expense', color: '#DB2777', shortLabel: 'Personal Care' },
  { name: 'Other', type: 'expense', color: '#94A3B8', shortLabel: 'Other' },
  { name: 'Income', type: 'income', color: '#16A34A', shortLabel: 'Income' },
];

export const EXPENSE_CATEGORIES: CategoryName[] = CATEGORIES
  .filter((c) => c.type === 'expense')
  .map((c) => c.name);

export function getCategoryColor(category: CategoryName): string {
  return CATEGORIES.find((c) => c.name === category)?.color ?? '#94A3B8';
}

export function formatINR(amount: number, showDecimals = false): string {
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(absVal);
  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatCompactINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatMonthShort(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
  });
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function getPreviousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const prev = new Date(y, m - 2, 1);
  const py = prev.getFullYear();
  const pm = String(prev.getMonth() + 1).padStart(2, '0');
  return `${py}-${pm}`;
}

export function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTransactionsToCsv(transactions: Transaction[], filename: string): void {
  const headers = [
    'Date',
    'Description',
    'Category',
    'Type',
    'Amount (INR)',
    'Payment Method',
    'Source',
    'AI Confidence',
    'Notes',
  ];
  const rows = transactions.map((t) => [
    t.date,
    t.description,
    t.category,
    t.type,
    t.amount.toFixed(2),
    t.paymentMethod,
    t.source,
    `${Math.round(t.confidence * 100)}%`,
    t.notes ?? '',
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  downloadCsvFile(filename, csv);
}
