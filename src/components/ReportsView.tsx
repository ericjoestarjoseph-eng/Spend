import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { Download } from 'lucide-react';
import { AnomalyAlert, CategoryName, Transaction } from '../types/finance';
import {
  downloadCsvFile,
  escapeCsvCell,
  exportTransactionsToCsv,
  formatCompactINR,
  formatINR,
  formatMonthLabel,
  formatMonthShort,
  getCategoryColor,
  getMonthKey,
  getPreviousMonthKey,
} from '../utils/formatters';
import { ChartCanvas } from './charts/ChartCanvas';

interface ReportsViewProps {
  transactions: Transaction[];
  selectedMonth: string;
  availableMonths: string[];
  anomalies: AnomalyAlert[];
  onSelectMonth: (month: string) => void;
}

export function ReportsView({
  transactions,
  selectedMonth,
  availableMonths,
  anomalies,
  onSelectMonth,
}: ReportsViewProps) {
  const prevMonth = useMemo(() => getPreviousMonthKey(selectedMonth), [selectedMonth]);

  const currentTxs = useMemo(
    () => transactions.filter((t) => getMonthKey(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );
  const prevTxs = useMemo(
    () => transactions.filter((t) => getMonthKey(t.date) === prevMonth),
    [transactions, prevMonth]
  );

  const summary = useMemo(() => {
    const income = currentTxs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expenses = currentTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const netBalance = income - expenses;
    const savingsRate = income > 0 ? Math.round((netBalance / income) * 100) : 0;

    const prevExpenses = prevTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    return { income, expenses, netBalance, savingsRate, prevExpenses };
  }, [currentTxs, prevTxs]);

  const categoryComparison = useMemo(() => {
    const curMap = new Map<CategoryName, number>();
    const prevMap = new Map<CategoryName, number>();

    for (const t of currentTxs) {
      if (t.type !== 'expense') continue;
      curMap.set(t.category, (curMap.get(t.category) ?? 0) + t.amount);
    }
    for (const t of prevTxs) {
      if (t.type !== 'expense') continue;
      prevMap.set(t.category, (prevMap.get(t.category) ?? 0) + t.amount);
    }

    const cats = new Set([...curMap.keys(), ...prevMap.keys()]);
    return Array.from(cats)
      .map((category) => {
        const current = curMap.get(category) ?? 0;
        const previous = prevMap.get(category) ?? 0;
        const diff = current - previous;
        const share = summary.expenses > 0 ? Math.round((current / summary.expenses) * 100) : 0;
        return {
          category,
          current,
          previous,
          diff,
          share,
          color: getCategoryColor(category),
        };
      })
      .sort((a, b) => b.current - a.current);
  }, [currentTxs, prevTxs, summary.expenses]);

  const monthAnomalies = useMemo(
    () => anomalies.filter((a) => getMonthKey(a.transaction.date) === selectedMonth),
    [anomalies, selectedMonth]
  );

  // Month-over-Month Category Bar Chart
  const comparisonChartConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const topRows = categoryComparison.slice(0, 8);
    return {
      type: 'bar',
      data: {
        labels: topRows.map((r) => r.category),
        datasets: [
          {
            label: formatMonthShort(prevMonth),
            data: topRows.map((r) => r.previous),
            backgroundColor: '#CBD5E1',
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.65,
          },
          {
            label: formatMonthShort(selectedMonth),
            data: topRows.map((r) => r.current),
            backgroundColor: '#0F766E',
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
  }, [categoryComparison, prevMonth, selectedMonth]);

  const handleExportMonthlySummaryCsv = () => {
    const lines: Array<Array<string | number>> = [
      ['SmartSpend Monthly Financial Report', formatMonthLabel(selectedMonth)],
      [],
      ['Metric', 'Value (INR)'],
      ['Total Income', summary.income.toFixed(2)],
      ['Total Expenses', summary.expenses.toFixed(2)],
      ['Net Balance', summary.netBalance.toFixed(2)],
      ['Savings Rate (%)', `${summary.savingsRate}%`],
      ['Unusual Spending Alerts', monthAnomalies.length],
      [],
      ['Category', `Current (${selectedMonth})`, `Previous (${prevMonth})`, 'Change (INR)', 'Share (%)'],
      ...categoryComparison.map((r) => [
        r.category,
        r.current.toFixed(2),
        r.previous.toFixed(2),
        r.diff.toFixed(2),
        `${r.share}%`,
      ]),
    ];

    const csv = lines.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
    downloadCsvFile(`smartspend_report_${selectedMonth}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      {/* Report Controls Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <label htmlFor="report-month-select" className="block text-[11px] font-medium text-slate-500">
              Reporting Month
            </label>
            <select
              id="report-month-select"
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="mt-0.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="h-9 w-px bg-slate-200" />
          <div className="text-xs text-slate-500">
            Comparing against <strong className="text-slate-800">{formatMonthLabel(prevMonth)}</strong> ·{' '}
            {currentTxs.length} ledger records
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportTransactionsToCsv(currentTxs, `smartspend_transactions_${selectedMonth}.csv`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export Month Transactions
          </button>
          <button
            type="button"
            onClick={handleExportMonthlySummaryCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export Summary CSV
          </button>
        </div>
      </div>

      {/* 4 Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Income</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {formatINR(summary.income)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Expenses</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(summary.expenses)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Net Balance</p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              summary.netBalance >= 0 ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            {formatINR(summary.netBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Savings Rate</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {summary.savingsRate}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {monthAnomalies.length} unusual spend alert{monthAnomalies.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Month-over-Month Category Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Month-over-Month Category Comparison
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Side-by-side expenditure variance between {formatMonthLabel(prevMonth)} and{' '}
            {formatMonthLabel(selectedMonth)}
          </p>
        </div>
        <ChartCanvas
          config={comparisonChartConfig}
          height={290}
          ariaLabel="Month-over-month category comparison bar chart"
        />
      </div>

      {/* Category Variance Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            Category Expenditure Breakdown
          </h3>
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
              <th className="py-2.5 pl-6 pr-3">Category</th>
              <th className="px-3 py-2.5 text-right">{formatMonthShort(selectedMonth)}</th>
              <th className="px-3 py-2.5 text-right">{formatMonthShort(prevMonth)}</th>
              <th className="px-3 py-2.5 text-right">MoM Change</th>
              <th className="py-2.5 pl-3 pr-6 text-right">Share of Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {categoryComparison.map((row) => (
              <tr key={row.category} className="hover:bg-slate-50/60">
                <td className="py-2.5 pl-6 pr-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-xs"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium text-slate-900">{row.category}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                  {formatINR(row.current)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-500 tabular-nums">
                  {formatINR(row.previous)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono text-xs font-medium tabular-nums ${
                    row.diff > 0
                      ? 'text-rose-700'
                      : row.diff < 0
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  {row.diff === 0 ? '—' : `${row.diff > 0 ? '+' : ''}${formatINR(row.diff)}`}
                </td>
                <td className="py-2.5 pl-3 pr-6 text-right font-mono text-xs text-slate-600 tabular-nums">
                  {row.share}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
