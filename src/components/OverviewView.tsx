import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Plus,
  Upload,
} from 'lucide-react';
import {
  AnomalyAlert,
  BudgetConfig,
  CategoryName,
  NavTab,
  Transaction,
} from '../types/finance';
import {
  formatCompactINR,
  formatDateShort,
  formatINR,
  formatMonthLabel,
  formatMonthShort,
  getCategoryColor,
  getMonthKey,
  getPreviousMonthKey,
} from '../utils/formatters';
import { ChartCanvas } from './charts/ChartCanvas';

interface OverviewViewProps {
  transactions: Transaction[];
  selectedMonth: string;
  availableMonths: string[];
  budgets: BudgetConfig;
  anomalies: AnomalyAlert[];
  onNavigate: (tab: NavTab, categoryFilter?: CategoryName) => void;
  onOpenAddTransaction: () => void;
  onDismissAnomaly: (transactionId: string) => void;
  onInlineCategoryChange: (transactionId: string, newCategory: CategoryName) => void;
}

export function OverviewView({
  transactions,
  selectedMonth,
  availableMonths,
  budgets,
  anomalies,
  onNavigate,
  onOpenAddTransaction,
  onDismissAnomaly,
  onInlineCategoryChange,
}: OverviewViewProps) {
  const [trendMode, setTrendMode] = useState<'6month' | 'daily'>('6month');

  const monthTxs = useMemo(
    () =>
      transactions
        .filter((t) => getMonthKey(t.date) === selectedMonth)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, selectedMonth]
  );

  const prevMonthKey = useMemo(() => getPreviousMonthKey(selectedMonth), [selectedMonth]);
  const prevMonthTxs = useMemo(
    () => transactions.filter((t) => getMonthKey(t.date) === prevMonthKey),
    [transactions, prevMonthKey]
  );

  const totals = useMemo(() => {
    const income = monthTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const prevExpense = prevMonthTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const prevIncome = prevMonthTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const remainingBudget = budgets.overallMonthlyLimit - expense;
    const budgetUtilization =
      budgets.overallMonthlyLimit > 0
        ? Math.round((expense / budgets.overallMonthlyLimit) * 100)
        : 0;

    const expenseDeltaPct =
      prevExpense > 0 ? Math.round(((expense - prevExpense) / prevExpense) * 100) : null;
    const incomeDeltaPct =
      prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 100) : null;

    return {
      income,
      expense,
      remainingBudget,
      budgetUtilization,
      expenseDeltaPct,
      incomeDeltaPct,
    };
  }, [monthTxs, prevMonthTxs, budgets.overallMonthlyLimit]);

  const activeAnomalies = useMemo(
    () => anomalies.filter((a) => a.status === 'active'),
    [anomalies]
  );

  const reviewCount = useMemo(
    () => monthTxs.filter((t) => t.needsReview && !t.manuallyCorrected).length,
    [monthTxs]
  );

  // Category breakdown for selected month
  const categoryBreakdown = useMemo(() => {
    const map = new Map<CategoryName, { amount: number; count: number }>();
    for (const t of monthTxs) {
      if (t.type !== 'expense') continue;
      const cur = map.get(t.category) ?? { amount: 0, count: 0 };
      map.set(t.category, { amount: cur.amount + t.amount, count: cur.count + 1 });
    }
    const entries = Array.from(map.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
        color: getCategoryColor(category),
        share: totals.expense > 0 ? Math.round((data.amount / totals.expense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
    return entries;
  }, [monthTxs, totals.expense]);

  // 6-Month / Daily Cashflow Chart Config
  const trendChartConfig = useMemo<ChartConfiguration<'bar' | 'line'>>(() => {
    if (trendMode === '6month') {
      const months = [...availableMonths].sort().slice(-6);
      const labels = months.map(formatMonthShort);
      const incomeData = months.map((m) =>
        transactions
          .filter((t) => getMonthKey(t.date) === m && t.type === 'income')
          .reduce((s, t) => s + t.amount, 0)
      );
      const expenseData = months.map((m) =>
        transactions
          .filter((t) => getMonthKey(t.date) === m && t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0)
      );
      const netData = months.map((_, idx) => incomeData[idx] - expenseData[idx]);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: 'Income',
              data: incomeData,
              backgroundColor: 'rgba(22, 163, 74, 0.18)',
              borderColor: '#16A34A',
              borderWidth: 1.5,
              borderRadius: 5,
              barPercentage: 0.65,
              categoryPercentage: 0.68,
            },
            {
              type: 'bar',
              label: 'Expenses',
              data: expenseData,
              backgroundColor: '#0F766E',
              borderRadius: 5,
              barPercentage: 0.65,
              categoryPercentage: 0.68,
            },
            {
              type: 'line',
              label: 'Net Savings',
              data: netData,
              borderColor: '#0F172A',
              backgroundColor: '#0F172A',
              borderWidth: 2,
              pointRadius: 3.5,
              pointHoverRadius: 5.5,
              tension: 0.3,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                usePointStyle: true,
                pointStyle: 'rectRounded',
                font: { family: 'DM Sans', size: 12 },
                color: '#475569',
              },
            },
            tooltip: {
              backgroundColor: '#0F172A',
              titleFont: { family: 'Plus Jakarta Sans', size: 12 },
              bodyFont: { family: 'JetBrains Mono', size: 12 },
              padding: 10,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatINR(Number(ctx.raw ?? 0))}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { color: '#E2E8F0' },
              ticks: { color: '#64748B', font: { family: 'DM Sans', size: 12 } },
            },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: '#F1F5F9' },
              ticks: {
                color: '#64748B',
                font: { family: 'JetBrains Mono', size: 11 },
                callback: (val) => formatCompactINR(Number(val)),
              },
            },
          },
        },
      };
    }

    // Daily cumulative / daily bar view for selectedMonth
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 30;
    const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
    const dailySpend = new Array<number>(daysInMonth).fill(0);
    for (const tx of monthTxs) {
      if (tx.type !== 'expense') continue;
      const day = Number(tx.date.slice(8, 10));
      if (day >= 1 && day <= daysInMonth) {
        dailySpend[day - 1] += tx.amount;
      }
    }

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Daily Spend',
            data: dailySpend,
            backgroundColor: dailySpend.map((amt) =>
              amt > budgets.overallMonthlyLimit * 0.12 ? '#DC2626' : '#0F766E'
            ),
            borderRadius: 4,
            barPercentage: 0.72,
          },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 10,
            callbacks: {
              title: (items) => `${formatMonthShort(selectedMonth)} · Day ${items[0]?.label}`,
              label: (ctx) => `Spent: ${formatINR(Number(ctx.raw ?? 0))}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: '#E2E8F0' },
            ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 10 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: '#F1F5F9' },
            ticks: {
              color: '#64748B',
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (val) => formatCompactINR(Number(val)),
            },
          },
        },
      },
    };
  }, [trendMode, availableMonths, transactions, selectedMonth, monthTxs, budgets.overallMonthlyLimit]);

  // Category Doughnut Chart Config
  const doughnutConfig = useMemo<ChartConfiguration<'doughnut'>>(() => {
    const items = categoryBreakdown.slice(0, 7);
    const otherTotal = categoryBreakdown
      .slice(7)
      .reduce((s, item) => s + item.amount, 0);
    const labels = items.map((i) => i.category);
    const data = items.map((i) => i.amount);
    const colors = items.map((i) => i.color);

    if (otherTotal > 0) {
      labels.push('Other');
      data.push(otherTotal);
      colors.push('#94A3B8');
    }

    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderColor: '#FFFFFF',
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        cutout: '68%',
        onClick: (_, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const clickedCat = labels[idx] as CategoryName | undefined;
            if (clickedCat) onNavigate('transactions', clickedCat);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const val = Number(ctx.raw ?? 0);
                const pct = totals.expense > 0 ? Math.round((val / totals.expense) * 100) : 0;
                return `${ctx.label}: ${formatINR(val)} (${pct}%)`;
              },
            },
          },
        },
      },
    };
  }, [categoryBreakdown, totals.expense, onNavigate]);

  // Budget progress bars (top 5 categories with configured limits)
  const budgetRows = useMemo(() => {
    const spentByCat = new Map<CategoryName, number>();
    for (const tx of monthTxs) {
      if (tx.type !== 'expense') continue;
      spentByCat.set(tx.category, (spentByCat.get(tx.category) ?? 0) + tx.amount);
    }

    return Object.entries(budgets.categoryLimits)
      .filter(([, limit]) => typeof limit === 'number' && limit > 0)
      .map(([cat, limit]) => {
        const category = cat as CategoryName;
        const spent = spentByCat.get(category) ?? 0;
        const pct = Math.round((spent / (limit as number)) * 100);
        return { category, spent, limit: limit as number, pct };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [monthTxs, budgets.categoryLimits]);

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <h2 className="text-xl font-semibold text-slate-900">
          Start tracking your expenses in {formatMonthLabel(selectedMonth)}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Import a bank or UPI statement CSV, or manually log your first transaction to unlock
          automated categorization, budget alerts, and anomaly insights.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('import')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Import CSV Statement
          </button>
          <button
            type="button"
            onClick={onOpenAddTransaction}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Log First Transaction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip — 4 equal columns */}
      <section className="grid grid-cols-4 gap-4" aria-label="Monthly Financial Summary">
        {/* Total Income */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Income</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {formatINR(totals.income)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {totals.incomeDeltaPct !== null
                ? `${totals.incomeDeltaPct >= 0 ? '+' : ''}${totals.incomeDeltaPct}% vs last month`
                : `${monthTxs.filter((t) => t.type === 'income').length} credits this month`}
            </span>
          </div>
        </div>

        {/* Total Expenditure */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Expenditure</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {formatINR(totals.expense)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <TrendingDown
              className={`h-3.5 w-3.5 ${
                totals.expenseDeltaPct !== null && totals.expenseDeltaPct > 10
                  ? 'text-amber-600'
                  : 'text-teal-700'
              }`}
            />
            <span>
              {totals.expenseDeltaPct !== null
                ? `${totals.expenseDeltaPct >= 0 ? '+' : ''}${totals.expenseDeltaPct}% vs last month`
                : `${monthTxs.filter((t) => t.type === 'expense').length} transactions`}
            </span>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Remaining Budget</p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums ${
              totals.remainingBudget < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatINR(totals.remainingBudget)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={`font-medium tabular-nums ${
                totals.budgetUtilization >= 100
                  ? 'text-rose-700'
                  : totals.budgetUtilization >= budgets.alertThresholdPercent
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {totals.budgetUtilization}% used
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              Cap {formatCompactINR(budgets.overallMonthlyLimit)}
            </span>
          </div>
        </div>

        {/* Flagged Anomalies & Review Queue */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Alerts & Review</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {activeAnomalies.length}
            <span className="ml-1.5 font-sans text-sm font-normal text-slate-500">
              unusual
            </span>
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {reviewCount > 0 ? `${reviewCount} low-confidence` : 'All categories verified'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate(activeAnomalies.length > 0 ? 'anomalies' : 'transactions')}
              className="font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Inspect →
            </button>
          </div>
        </div>
      </section>

      {/* Primary Interactive Charts Row */}
      <section className="grid grid-cols-12 gap-6">
        {/* Cashflow & Spending Trends (7 cols) */}
        <div className="col-span-7 flex flex-col rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Income & Spending Trends
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {trendMode === '6month'
                  ? 'Monthly income, total expenses, and net savings trajectory'
                  : `Daily expenditure distribution for ${formatMonthLabel(selectedMonth)}`}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setTrendMode('6month')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  trendMode === '6month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                6-Month View
              </button>
              <button
                type="button"
                onClick={() => setTrendMode('daily')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  trendMode === 'daily'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Spend
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[290px]">
            <ChartCanvas
              config={trendChartConfig}
              height={290}
              ariaLabel="Income and spending trends chart"
            />
          </div>
        </div>

        {/* Category Breakdown Doughnut + Table (5 cols) */}
        <div className="col-span-5 flex flex-col rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Category Breakdown
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Click any slice or category to filter ledger
              </p>
            </div>
            <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
              {formatMonthShort(selectedMonth)}
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              No expenses recorded for {formatMonthLabel(selectedMonth)}.
            </div>
          ) : (
            <div className="grid grid-cols-12 items-center gap-4 flex-1">
              <div className="relative col-span-5 flex items-center justify-center">
                <ChartCanvas
                  config={doughnutConfig}
                  height={210}
                  ariaLabel="Category expenditure breakdown doughnut chart"
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-medium text-slate-500">Spent</span>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    {formatCompactINR(totals.expense)}
                  </span>
                </div>
              </div>

              <div className="col-span-7 space-y-2">
                {categoryBreakdown.slice(0, 6).map((item) => (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => onNavigate('transactions', item.category)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-xs font-medium text-slate-700">
                        {item.category}
                      </span>
                    </div>
                    <div className="ml-2 flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                      <span className="font-medium text-slate-900">
                        {formatCompactINR(item.amount)}
                      </span>
                      <span className="w-8 text-right text-slate-400">{item.share}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Secondary Row: Budget Utilization + Unusual Spending Alerts */}
      <section className="grid grid-cols-12 gap-6">
        {/* Budget Utilization (5 cols) */}
        <div className="col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Monthly Budget Utilization
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Alert threshold at {budgets.alertThresholdPercent}% of allocated limit
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Manage
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {budgetRows.map((row) => {
              const isOver = row.pct >= 100;
              const isWarn = !isOver && row.pct >= budgets.alertThresholdPercent;
              const barColor = isOver
                ? 'bg-rose-600'
                : isWarn
                ? 'bg-amber-500'
                : 'bg-teal-700';

              return (
                <div key={row.category}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{row.category}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-slate-900">{formatINR(row.spent)}</span>
                      <span className="text-slate-400">/ {formatINR(row.limit)}</span>
                      <span
                        className={`font-semibold ${
                          isOver
                            ? 'text-rose-700'
                            : isWarn
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {row.pct}%{isOver ? ' Over' : isWarn ? ' Near' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${Math.min(100, row.pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unusual Spending Alerts (7 cols) */}
        <div className="col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Unusual Spending Alerts
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Statistical deviations from your category baseline (informational, not fraud)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('anomalies')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              All Alerts ({anomalies.length})
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {activeAnomalies.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Spending is within normal historical baselines
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  No active unusual transactions detected across your recent ledger.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {activeAnomalies.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between gap-4 py-3.5 first:pt-2 last:pb-0"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertTriangle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        alert.severity === 'high' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate font-semibold text-slate-900">
                          {alert.transaction.description}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatINR(alert.transaction.amount)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{alert.reason}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDateShort(alert.transaction.date)} · {alert.transaction.category} ·{' '}
                        {alert.severity === 'high' ? 'High deviation' : 'Moderate deviation'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDismissAnomaly(alert.transactionId)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent Transactions Quick Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent Transactions · {formatMonthLabel(selectedMonth)}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Correct any AI-predicted category inline to train your personal classification rules
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
          >
            Open Full Ledger ({monthTxs.length})
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pl-6 pr-3">Date</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5 text-right">AI Confidence</th>
                <th className="py-2.5 pl-3 pr-6 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {monthTxs.slice(0, 7).map((tx) => {
                const isAnomalous = activeAnomalies.some((a) => a.transactionId === tx.id);
                return (
                  <tr key={tx.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="py-2.5 pl-6 pr-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{tx.description}</span>
                        {isAnomalous && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700">
                            <AlertTriangle className="h-3 w-3" />
                            Unusual
                          </span>
                        )}
                        {tx.needsReview && !tx.manuallyCorrected && (
                          <span className="text-[11px] font-medium text-amber-700">
                            Needs Review
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        aria-label={`Category for ${tx.description}`}
                        value={tx.category}
                        onChange={(e) =>
                          onInlineCategoryChange(tx.id, e.target.value as CategoryName)
                        }
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-teal-700 focus:outline-none"
                      >
                        {(tx.type === 'income'
                          ? ['Income', 'Other']
                          : [
                              'Food and Dining',
                              'Transportation',
                              'Shopping',
                              'Entertainment',
                              'Healthcare',
                              'Education',
                              'Bills and Utilities',
                              'Housing',
                              'Travel',
                              'Personal Care',
                              'Other',
                            ]
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {tx.paymentMethod}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                      {tx.manuallyCorrected ? (
                        <span className="text-teal-700">Verified</span>
                      ) : (
                        <span
                          className={
                            tx.confidence >= 0.75 ? 'text-slate-500' : 'font-medium text-amber-700'
                          }
                        >
                          {Math.round(tx.confidence * 100)}%
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 pl-3 pr-6 text-right font-mono text-sm font-medium tabular-nums whitespace-nowrap ${
                        tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
