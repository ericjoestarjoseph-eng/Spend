import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, X, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import {
  CategoryName,
  LearnedRule,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types/finance';
import { classifyTransaction } from '../engine/categorizer';
import { CATEGORIES, EXPENSE_CATEGORIES, formatINR } from '../utils/formatters';

interface TransactionDrawerProps {
  isOpen: boolean;
  editingTransaction: Transaction | null;
  learnedRules: LearnedRule[];
  defaultDate: string;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    description: string;
    amount: number;
    date: string;
    type: TransactionType;
    category: CategoryName;
    predictedCategory: CategoryName;
    confidence: number;
    needsReview: boolean;
    manuallyCorrected: boolean;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Credit Card',
  'Debit Card',
  'NetBanking',
  'Cash',
];

const QUICK_PRESETS: Array<{ label: string; description: string; type: TransactionType; amount: number; method: PaymentMethod }> = [
  { label: 'Swiggy Order', description: 'Swiggy Dinner Order', type: 'expense', amount: 480, method: 'UPI' },
  { label: 'Uber Commute', description: 'Uber Cab Ride', type: 'expense', amount: 320, method: 'UPI' },
  { label: 'Blinkit Groceries', description: 'Blinkit Daily Groceries', type: 'expense', amount: 740, method: 'UPI' },
  { label: 'Broadband Bill', description: 'JioFiber Broadband Plan', type: 'expense', amount: 1179, method: 'UPI' },
  { label: 'Salary / Stipend', description: 'Monthly Stipend Credit', type: 'income', amount: 15000, method: 'NetBanking' },
];

export function TransactionDrawer({
  isOpen,
  editingTransaction,
  learnedRules,
  defaultDate,
  onClose,
  onSave,
}: TransactionDrawerProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState<CategoryName>('Food and Dining');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDescription(editingTransaction.description);
      setAmountStr(String(editingTransaction.amount));
      setDate(editingTransaction.date);
      setCategory(editingTransaction.category);
      setCategoryTouched(true);
      setPaymentMethod(editingTransaction.paymentMethod);
      setNotes(editingTransaction.notes ?? '');
    } else {
      setType('expense');
      setDescription('');
      setAmountStr('');
      setDate(defaultDate);
      setCategory('Other');
      setCategoryTouched(false);
      setPaymentMethod('UPI');
      setNotes('');
    }
  }, [isOpen, editingTransaction, defaultDate]);

  const prediction = useMemo(() => {
    return classifyTransaction(description, type, learnedRules);
  }, [description, type, learnedRules]);

  useEffect(() => {
    if (!categoryTouched) {
      setCategory(prediction.category);
    }
  }, [prediction.category, categoryTouched]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const availableCategories =
    type === 'income'
      ? (['Income', 'Other'] as CategoryName[])
      : EXPENSE_CATEGORIES;

  const parsedAmount = Number(amountStr);
  const isAmountValid = !Number.isNaN(parsedAmount) && parsedAmount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 2) {
      setError('Please enter a clear merchant or transaction description.');
      return;
    }
    if (!isAmountValid) {
      setError('Please enter a valid positive amount in INR.');
      return;
    }
    if (!date) {
      setError('Please select a transaction date.');
      return;
    }

    const manuallyCorrected = category !== prediction.category;
    onSave({
      id: editingTransaction?.id,
      description: trimmedDesc,
      amount: Math.round(parsedAmount * 100) / 100,
      date,
      type,
      category,
      predictedCategory: prediction.category,
      confidence: prediction.confidence,
      needsReview: manuallyCorrected ? false : prediction.needsReview,
      manuallyCorrected,
      paymentMethod,
      notes: notes.trim() || undefined,
    });
  };

  const applyPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    setType(preset.type);
    setDescription(preset.description);
    setAmountStr(String(preset.amount));
    setPaymentMethod(preset.method);
    setCategoryTouched(false);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="tx-drawer-title" className="text-lg font-semibold text-slate-900">
              {editingTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              AI auto-categorizes merchants as you type and learns from corrections.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
            aria-label="Close transaction drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Segmented Type Selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Transaction Type
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setType('expense');
                    setCategoryTouched(false);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    type === 'expense'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('income');
                    setCategory('Income');
                    setCategoryTouched(false);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    type === 'income'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                  Income
                </button>
              </div>
            </div>

            {/* Quick Presets (only when creating new) */}
            {!editingTransaction && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Quick Entry Presets</span>
                  <span className="text-[11px] text-slate-400">One-click fill</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-teal-600 hover:bg-teal-50/60 hover:text-teal-800 whitespace-nowrap shrink-0"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="tx-desc" className="mb-1.5 block text-xs font-medium text-slate-700">
                Merchant / Description
              </label>
              <input
                id="tx-desc"
                type="text"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., Swiggy Lunch Order, Uber Airport, BESCOM Bill"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                autoFocus
              />

              {/* Live AI Prediction Strip */}
              <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                  <span className="truncate text-xs text-slate-700">
                    Predicted:{' '}
                    <strong className="font-semibold text-slate-900">{prediction.category}</strong>
                    {prediction.matchedSignals.length > 0 && (
                      <span className="text-slate-500">
                        {' '}
                        · {prediction.matchedSignals[0]}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`font-mono text-[11px] font-medium tabular-nums ${
                      prediction.confidence >= 0.75 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {Math.round(prediction.confidence * 100)}% conf
                  </span>
                  {category !== prediction.category && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategory(prediction.category);
                        setCategoryTouched(false);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-teal-700 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-teal-800 whitespace-nowrap"
                    >
                      <Check className="h-3 w-3" />
                      Apply
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tx-amount" className="mb-1.5 block text-xs font-medium text-slate-700">
                  Amount (INR)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-medium text-slate-500">
                    ₹
                  </span>
                  <input
                    id="tx-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={amountStr}
                    onChange={(e) => {
                      setAmountStr(e.target.value);
                      setError(null);
                    }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-8 pr-3.5 font-mono text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                  />
                </div>
                {isAmountValid && (
                  <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                    {formatINR(parsedAmount, parsedAmount % 1 !== 0)}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="tx-date" className="mb-1.5 block text-xs font-medium text-slate-700">
                  Transaction Date
                </label>
                <input
                  id="tx-date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                />
              </div>
            </div>

            {/* Category & Payment Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tx-cat" className="mb-1.5 block text-xs font-medium text-slate-700">
                  Category
                </label>
                <select
                  id="tx-cat"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as CategoryName);
                    setCategoryTouched(true);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                >
                  {availableCategories.map((catName) => {
                    const meta = CATEGORIES.find((c) => c.name === catName);
                    return (
                      <option key={catName} value={catName}>
                        {meta?.name ?? catName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="tx-method" className="mb-1.5 block text-xs font-medium text-slate-700">
                  Payment Method
                </label>
                <select
                  id="tx-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label htmlFor="tx-notes" className="mb-1.5 block text-xs font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="tx-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context such as split bill details, project reimbursement, or receipt ref..."
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              {editingTransaction ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
