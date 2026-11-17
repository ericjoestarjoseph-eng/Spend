import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { AlertTriangle, Check, CheckCircle2 } from 'lucide-react';
import { BudgetConfig, CategoryName, Transaction } from '../types/finance';
import {
  EXPENSE_CATEGORIES,
  formatCompactINR,
  formatINR,
  formatMonthLabel,
  getMonthKey,
} from '../utils/formatters';
import { ChartCanvas } from './charts/ChartCanvas';

interface BudgetsViewProps {
  transactions: Transaction[];
  selectedMonth: string;
  budgets: BudgetConfig;
  onUpdateBudgets: (next: BudgetConfig) => void;
}

export function BudgetsView({
  transactions,
  selectedMonth,
  budgets,
  onUpdateBudgets,
}: BudgetsViewProps) {
  const [overallInput, setOverallInput] = useState(String(budgets.overallMonthlyLimit));
  const [thresholdInput, setThresholdInput] = useState(String(budgets.alertThresholdPercent));
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const cat of EXPENSE_CATEGORIES) {
      map[cat] = budgets.categoryLimits[cat] ? String(budgets.categoryLimits[cat]) : '';
    }
    return map;
  });
  const [savedNotice, setSavedNotice] = useState(false);

  const monthExpenses = useMemo(
    () =>
      transactions.filter(
        (t) => getMonthKey(t.date) === selectedMonth && t.type === 'expense'
      ),
    [transactions, selectedMonth]
  );

  const spentByCategory = useMemo(() => {
    const map = new Map<CategoryName, number>();
    for (const t of monthExpenses) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return map;
  }, [monthExpenses]);

  const totalSpent = useMemo(
    () => monthExpenses.reduce((s, t) => s + t.amount, 0),
    [monthExpenses]
  );

  const overallPct =
    budgets.overallMonthlyLimit > 0
      ? Math.round((totalSpent / budgets.overallMonthlyLimit) * 100)
      : 0;

  const thresholdAlerts = useMemo(() => {
    const list: Array<{ category: string; pct: number; spent: number; limit: number; level: 'over' | 'warn' }> = [];
    if (overallPct >= budgets.alertThresholdPercent) {
      list.push({
        category: 'Overall Monthly Budget',
        pct: overallPct,
        spent: totalSpent,
        limit: budgets.overallMonthlyLimit,
        level: overallPct >= 100 ? 'over' : 'warn',
      });
    }
    for (const cat of EXPENSE_CATEGORIES) {
      const limit = budgets.categoryLimits[cat];
      if (!limit || limit <= 0) continue;
      const spent = spentByCategory.get(cat) ?? 0;
      const pct = Math.round((spent / limit) * 100);
      if (pct >= budgets.alertThresholdPercent) {
        list.push({
          category: cat,
          pct,
          spent,
          limit,
          level: pct >= 100 ? 'over' : 'warn',
        });
      }
    }
    return list;
  }, [budgets, overallPct, totalSpent, spentByCategory]);

  // Budget vs Actual Grouped Bar Chart
  const chartConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const activeCats = EXPENSE_CATEGORIES.filter(
      (cat) => (budgets.categoryLimits[cat] ?? 0) > 0 || (spentByCategory.get(cat) ?? 0) > 0
    );

    return {
      type: 'bar',
      data: {
        labels: activeCats,
        datasets: [
          {
            label: 'Allocated Budget',
            data: activeCats.map((cat) => budgets.categoryLimits[cat] ?? 0),
            backgroundColor: '#CBD5E1',
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.65,
          },
          {
            label: 'Actual Spent',
            data: activeCats.map((cat) => spentByCategory.get(cat) ?? 0),
            backgroundColor: activeCats.map((cat) => {
              const limit = budgets.categoryLimits[cat] ?? 0;
              const spent = spentByCategory.get(cat) ?? 0;
              if (limit > 0 && spent > limit) return '#DC2626';
              if (limit > 0 && (spent / limit) * 100 >= budgets.alertThresholdPercent) {
                return '#D97706';
              }
              return '#0F766E';
            }),
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.65,
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
              font: { family: 'DM Sans', size: 12 },
              color: '#475569',
            },
          },
          tooltip: {
            backgroundColor: '#0F172A',
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
            ticks: { color: '#475569', font: { family: 'DM Sans', size: 11 } },
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
  }, [budgets, spentByCategory]);

  const handleSaveAll = () => {
    const parsedOverall = Math.max(1000, Number(overallInput) || budgets.overallMonthlyLimit);
    const parsedThreshold = Math.min(99, Math.max(50, Number(thresholdInput) || 80));
    const nextCategoryLimits: Partial<Record<CategoryName, number>> = {};

    for (const cat of EXPENSE_CATEGORIES) {
      const val = Number(categoryInputs[cat]);
      if (!Number.isNaN(val) && val > 0) {
        nextCategoryLimits[cat] = Math.round(val);
      }
    }

    onUpdateBudgets({
      overallMonthlyLimit: Math.round(parsedOverall),
      alertThresholdPercent: Math.round(parsedThreshold),
      categoryLimits: nextCategoryLimits,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Overall Cap + Threshold Alerts */}
      <div className="grid grid-cols-12 gap-6">
        {/* Overall Monthly Budget Card */}
        <div className="col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Overall Monthly Budget
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatMonthLabel(selectedMonth)} spending cap and alert sensitivity
              </p>
            </div>
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                overallPct >= 100
                  ? 'text-rose-700'
                  : overallPct >= budgets.alertThresholdPercent
                  ? 'text-amber-700'
                  : 'text-teal-700'
              }`}
            >
              {overallPct}% utilized
            </span>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-2xl font-semibold text-slate-900">
                {formatINR(totalSpent)}
              </span>
              <span className="text-xs text-slate-500">
                of {formatINR(budgets.overallMonthlyLimit)} cap
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  overallPct >= 100
                    ? 'bg-rose-600'
                    : overallPct >= budgets.alertThresholdPercent
                    ? 'bg-amber-500'
                    : 'bg-teal-700'
                }`}
                style={{ width: `${Math.min(100, overallPct)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Monthly Cap (INR)
              </label>
              <input
                type="number"
                min="1000"
                step="500"
                value={overallInput}
                onChange={(e) => setOverallInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Alert Threshold (%)
              </label>
              <input
                type="number"
                min="50"
                max="99"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Threshold Alerts Panel */}
        <div className="col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Budget Threshold Alerts
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Triggered automatically when spending crosses {budgets.alertThresholdPercent}% of
                allocated limits
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
            >
              {savedNotice ? <Check className="h-3.5 w-3.5" /> : null}
              {savedNotice ? 'Budgets Saved' : 'Save Budget Changes'}
            </button>
          </div>

          {thresholdAlerts.length === 0 ? (
            <div className="mt-5 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  All budgets are within safe limits
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  No categories have crossed your {budgets.alertThresholdPercent}% threshold in{' '}
                  {formatMonthLabel(selectedMonth)}.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {thresholdAlerts.map((item) => (
                <div key={item.category} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle
                      className={`h-4 w-4 shrink-0 ${
                        item.level === 'over' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-900">{item.category}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {item.level === 'over' ? 'Exceeded limit' : 'Approaching limit'}
                      </span>
                    </div>
                  </div>
                  <div className="font-mono text-xs tabular-nums">
                    <span className="font-semibold text-slate-900">{formatINR(item.spent)}</span>
                    <span className="text-slate-400"> / {formatINR(item.limit)}</span>
                    <span
                      className={`ml-2 font-semibold ${
                        item.level === 'over' ? 'text-rose-700' : 'text-amber-700'
                      }`}
                    >
                      ({item.pct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Budget vs Actual Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Budget Allocation vs. Actual Expenditure
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Green bars indicate healthy utilization · Amber indicates ≥{budgets.alertThresholdPercent}% · Red indicates over budget
          </p>
        </div>
        <ChartCanvas
          config={chartConfig}
          height={290}
          ariaLabel="Budget allocation versus actual expenditure bar chart"
        />
      </div>

      {/* Category Budget Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Category Monthly Limits
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Adjust monthly allocations per category and click Save Budget Changes
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {savedNotice ? 'Saved ✓' : 'Apply Limits'}
          </button>
        </div>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
              <th className="py-2.5 pl-6 pr-3">Category</th>
              <th className="px-3 py-2.5 text-right">Actual Spent</th>
              <th className="px-3 py-2.5 text-right">Monthly Limit (INR)</th>
              <th className="px-3 py-2.5">Utilization</th>
              <th className="py-2.5 pl-3 pr-6 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {EXPENSE_CATEGORIES.map((cat) => {
              const spent = spentByCategory.get(cat) ?? 0;
              const limit = Number(categoryInputs[cat]) || 0;
              const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
              const remaining = limit > 0 ? limit - spent : null;

              return (
                <tr key={cat} className="hover:bg-slate-50/60">
                  <td className="py-2.5 pl-6 pr-3 font-medium text-slate-900">{cat}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm text-slate-900 tabular-nums">
                    {formatINR(spent)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="number"
                      min="0"
                      step="250"
                      aria-label={`Monthly limit for ${cat}`}
                      value={categoryInputs[cat] ?? ''}
                      onChange={(e) =>
                        setCategoryInputs((prev) => ({ ...prev, [cat]: e.target.value }))
                      }
                      placeholder="No limit"
                      className="w-32 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-right font-mono text-xs text-slate-900 tabular-nums focus:border-teal-700 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2.5 w-64">
                    {limit > 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 100
                                ? 'bg-rose-600'
                                : pct >= budgets.alertThresholdPercent
                                ? 'bg-amber-500'
                                : 'bg-teal-700'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {pct}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Unbudgeted</span>
                    )}
                  </td>
                  <td
                    className={`py-2.5 pl-3 pr-6 text-right font-mono text-xs font-medium tabular-nums ${
                      remaining === null
                        ? 'text-slate-400'
                        : remaining < 0
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {remaining === null ? '—' : formatINR(remaining)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
