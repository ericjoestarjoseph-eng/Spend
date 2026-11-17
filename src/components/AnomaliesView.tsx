import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { AlertTriangle, CheckCircle2, Info, RotateCcw } from 'lucide-react';
import { AnomalyAlert, AnomalySensitivity, Transaction } from '../types/finance';
import { formatCompactINR, formatDateShort, formatINR } from '../utils/formatters';
import { ChartCanvas } from './charts/ChartCanvas';

interface AnomaliesViewProps {
  transactions: Transaction[];
  anomalies: AnomalyAlert[];
  sensitivity: AnomalySensitivity;
  onChangeSensitivity: (s: AnomalySensitivity) => void;
  onDismissAlert: (transactionId: string) => void;
  onRestoreAlert: (transactionId: string) => void;
}

export function AnomaliesView({
  transactions,
  anomalies,
  sensitivity,
  onChangeSensitivity,
  onDismissAlert,
  onRestoreAlert,
}: AnomaliesViewProps) {
  const [statusFilter, setStatusFilter] = useState<'active' | 'dismissed' | 'all'>('active');

  const filtered = useMemo(
    () =>
      anomalies.filter((a) => (statusFilter === 'all' ? true : a.status === statusFilter)),
    [anomalies, statusFilter]
  );

  const activeCount = useMemo(
    () => anomalies.filter((a) => a.status === 'active').length,
    [anomalies]
  );

  // Scatter / Deviation Chart: compares flagged anomalies against category baselines
  const scatterConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const topAnomalies = anomalies.slice(0, 8);
    return {
      type: 'bar',
      data: {
        labels: topAnomalies.map((a) =>
          a.transaction.description.length > 22
            ? `${a.transaction.description.slice(0, 20)}…`
            : a.transaction.description
        ),
        datasets: [
          {
            label: 'Category Historical Avg',
            data: topAnomalies.map((a) => a.categoryBaselineAvg),
            backgroundColor: '#CBD5E1',
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.65,
          },
          {
            label: 'Flagged Transaction',
            data: topAnomalies.map((a) => a.transaction.amount),
            backgroundColor: topAnomalies.map((a) =>
              a.status === 'dismissed'
                ? '#94A3B8'
                : a.severity === 'high'
                ? '#DC2626'
                : '#D97706'
            ),
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
  }, [anomalies]);

  return (
    <div className="space-y-6">
      {/* Info & Sensitivity Header */}
      <div className="flex items-center justify-between gap-6 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Statistical Spending Anomaly Monitor ({transactions.length} transactions analyzed)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Identifies expenses that deviate strongly from your personal category baseline (IQR +
              Z-score). Flagged entries indicate unusual spending patterns, not confirmed fraud.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-slate-600">Sensitivity:</span>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['conservative', 'balanced', 'sensitive'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onChangeSensitivity(level)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  sensitivity === level
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Baseline vs Outlier Chart */}
      {anomalies.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Flagged Amount vs. Personal Category Baseline
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Compares each flagged expense against your historical average for that category
            </p>
          </div>
          <ChartCanvas
            config={scatterConfig}
            height={260}
            ariaLabel="Flagged anomalous transactions compared to category baseline averages"
          />
        </div>
      )}

      {/* Alerts List */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900">Detected Spending Alerts</h3>
            <span className="text-xs text-slate-500">
              {activeCount} active · {anomalies.length - activeCount} dismissed
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['active', 'dismissed', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  statusFilter === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            <p className="mt-2.5 text-sm font-medium text-slate-900">
              No {statusFilter === 'all' ? '' : statusFilter} anomaly alerts at {sensitivity}{' '}
              sensitivity
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Switch to Sensitive mode or add new transactions to evaluate baseline deviations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between gap-6 px-6 py-4 transition-colors hover:bg-slate-50/70"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.status === 'dismissed'
                        ? 'text-slate-400'
                        : alert.severity === 'high'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 text-sm">
                      <span className="font-semibold text-slate-900">
                        {alert.transaction.description}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatDateShort(alert.transaction.date)}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-600">{alert.transaction.category}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{alert.reason}</p>
                    <div className="mt-1.5 flex items-center gap-4 font-mono text-[11px] text-slate-500 tabular-nums">
                      <span>Anomaly Score: {alert.anomalyScore.toFixed(2)}</span>
                      <span>Baseline Avg: {formatINR(alert.categoryBaselineAvg)}</span>
                      <span>Deviation: {alert.ratioToBaseline}×</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                    {formatINR(alert.transaction.amount)}
                  </span>
                  {alert.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => onDismissAlert(alert.transactionId)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      Dismiss Alert
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRestoreAlert(alert.transactionId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 whitespace-nowrap"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
