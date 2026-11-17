import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AnomalyAlert,
  CategoryName,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  CATEGORIES,
  exportTransactionsToCsv,
  formatDateShort,
  formatINR,
  formatMonthLabel,
  getMonthKey,
} from '../utils/formatters';

interface TransactionsViewProps {
  transactions: Transaction[];
  selectedMonth: string;
  anomalies: AnomalyAlert[];
  initialCategoryFilter: CategoryName | 'ALL';
  onClearInitialCategoryFilter: () => void;
  onOpenAdd: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onInlineCategoryChange: (id: string, newCategory: CategoryName) => void;
}

export function TransactionsView({
  transactions,
  selectedMonth,
  anomalies,
  initialCategoryFilter,
  onClearInitialCategoryFilter,
  onOpenAdd,
  onEdit,
  onDelete,
  onInlineCategoryChange,
}: TransactionsViewProps) {
  const [search, setSearch] = useState('');
  const [scopeMonth, setScopeMonth] = useState<'selected' | 'all'>('selected');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryName | 'ALL'>(
    initialCategoryFilter
  );
  const [flagFilter, setFlagFilter] = useState<'all' | 'review' | 'anomaly'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>(
    'date_desc'
  );

  // Sync if user navigated from Category Doughnut
  const activeCategoryFilter =
    initialCategoryFilter !== 'ALL' ? initialCategoryFilter : categoryFilter;

  const activeAnomalyIds = useMemo(
    () => new Set(anomalies.filter((a) => a.status === 'active').map((a) => a.transactionId)),
    [anomalies]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => {
        if (scopeMonth === 'selected' && getMonthKey(t.date) !== selectedMonth) return false;
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (activeCategoryFilter !== 'ALL' && t.category !== activeCategoryFilter) return false;
        if (flagFilter === 'review' && !(t.needsReview && !t.manuallyCorrected)) return false;
        if (flagFilter === 'anomaly' && !activeAnomalyIds.has(t.id)) return false;
        if (
          q &&
          !t.description.toLowerCase().includes(q) &&
          !t.category.toLowerCase().includes(q) &&
          !(t.notes ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
        if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
        if (sortBy === 'amount_desc') return b.amount - a.amount;
        return a.amount - b.amount;
      });
  }, [
    transactions,
    scopeMonth,
    selectedMonth,
    typeFilter,
    activeCategoryFilter,
    flagFilter,
    search,
    sortBy,
    activeAnomalyIds,
  ]);

  const summary = useMemo(() => {
    const income = filtered
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expense = filtered
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header Summary Strip */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-8">
          <div>
            <span className="block text-[11px] font-medium text-slate-500">
              Showing {filtered.length} transactions
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {scopeMonth === 'selected' ? formatMonthLabel(selectedMonth) : 'All Historical Months'}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-6 font-mono text-sm tabular-nums">
            <div>
              <span className="block font-sans text-[11px] text-slate-500">Filtered Income</span>
              <span className="font-semibold text-emerald-700">+{formatINR(summary.income)}</span>
            </div>
            <div>
              <span className="block font-sans text-[11px] text-slate-500">Filtered Expenses</span>
              <span className="font-semibold text-slate-900">-{formatINR(summary.expense)}</span>
            </div>
            <div>
              <span className="block font-sans text-[11px] text-slate-500">Net Cashflow</span>
              <span
                className={`font-semibold ${
                  summary.net >= 0 ? 'text-teal-700' : 'text-rose-700'
                }`}
              >
                {formatINR(summary.net)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              exportTransactionsToCsv(
                filtered,
                `smartspend_ledger_${scopeMonth === 'selected' ? selectedMonth : 'all'}.csv`
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export Filtered CSV
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            New Transaction
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Search */}
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant, note, category..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Month Scope */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setScopeMonth('selected')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                scopeMonth === 'selected' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setScopeMonth('all')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                scopeMonth === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All Months
            </button>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            {(['all', 'expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  typeFilter === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Category Select */}
          <select
            aria-label="Filter by category"
            value={activeCategoryFilter}
            onChange={(e) => {
              onClearInitialCategoryFilter();
              setCategoryFilter(e.target.value as CategoryName | 'ALL');
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-700 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Review / Anomaly Filter */}
          <select
            aria-label="Filter by review status"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value as 'all' | 'review' | 'anomaly')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="review">Needs Category Review</option>
            <option value="anomaly">Flagged Unusual Spend</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            aria-label="Sort transactions"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-700 focus:outline-none"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-900">
              No transactions match your current filters
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try switching to All Months, clearing the search query, or logging a new expense.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                  setFlagFilter('all');
                  setCategoryFilter('ALL');
                  onClearInitialCategoryFilter();
                }}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={onOpenAdd}
                className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
              >
                + Add Transaction
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 pl-6 pr-3">Date</th>
                  <th className="px-3 py-3">Description & Notes</th>
                  <th className="px-3 py-3">Category (Inline Edit)</th>
                  <th className="px-3 py-3">Method · Source</th>
                  <th className="px-3 py-3 text-right">Classification</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="py-3 pl-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((tx) => {
                  const isAnom = activeAnomalyIds.has(tx.id);
                  return (
                    <tr key={tx.id} className="group transition-colors hover:bg-slate-50/80">
                      <td className="py-2.5 pl-6 pr-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateShort(tx.date)}
                      </td>
                      <td className="px-3 py-2.5 max-w-[320px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-slate-900">
                            {tx.description}
                          </span>
                          {isAnom && (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-rose-700">
                              <AlertTriangle className="h-3 w-3" />
                              Unusual
                            </span>
                          )}
                        </div>
                        {tx.notes && (
                          <p className="truncate text-xs text-slate-400">{tx.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          aria-label={`Category for ${tx.description}`}
                          value={tx.category}
                          onChange={(e) =>
                            onInlineCategoryChange(tx.id, e.target.value as CategoryName)
                          }
                          className={`rounded-md border px-2 py-1 text-xs font-medium focus:border-teal-700 focus:outline-none ${
                            tx.needsReview && !tx.manuallyCorrected
                              ? 'border-amber-300 bg-amber-50/50 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {(tx.type === 'income'
                            ? CATEGORIES.filter((c) => c.type === 'income' || c.name === 'Other')
                            : CATEGORIES.filter((c) => c.type === 'expense')
                          ).map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {tx.paymentMethod}
                        <span className="mx-1.5 text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="capitalize">
                          {tx.source === 'csv_import' ? 'CSV' : tx.source}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        {tx.manuallyCorrected ? (
                          <span className="text-teal-700">User verified</span>
                        ) : tx.needsReview ? (
                          <span className="font-medium text-amber-700">
                            Review ({Math.round(tx.confidence * 100)}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Sparkles className="h-3 w-3 text-teal-700" />
                            {Math.round(tx.confidence * 100)}%
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono text-sm font-medium tabular-nums whitespace-nowrap ${
                          tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatINR(tx.amount)}
                      </td>
                      <td className="py-2.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(tx)}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                            aria-label={`Edit ${tx.description}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(tx.id)}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                            aria-label={`Delete ${tx.description}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
