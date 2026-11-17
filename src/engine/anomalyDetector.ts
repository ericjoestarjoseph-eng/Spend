import { AnomalyAlert, AnomalySensitivity, CategoryName, Transaction } from '../types/finance';
import { formatINR } from '../utils/formatters';

interface SensitivityParams {
  zThreshold: number;
  ratioThreshold: number;
  minExcessAmount: number;
}

const SENSITIVITY_MAP: Record<AnomalySensitivity, SensitivityParams> = {
  conservative: { zThreshold: 2.6, ratioThreshold: 3.0, minExcessAmount: 3500 },
  balanced: { zThreshold: 2.0, ratioThreshold: 2.35, minExcessAmount: 1800 },
  sensitive: { zThreshold: 1.55, ratioThreshold: 1.85, minExcessAmount: 900 },
};

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Evaluates historical category-level baselines and Isolation-Forest-inspired
 * statistical deviation scores to identify unusual personal spending behavior.
 * Explicitly distinguishes spending anomalies from fraud.
 */
export function detectAnomalies(
  transactions: Transaction[],
  sensitivity: AnomalySensitivity,
  dismissedIds: string[]
): AnomalyAlert[] {
  const params = SENSITIVITY_MAP[sensitivity];
  const expenses = transactions.filter(
    (t) => t.type === 'expense' && t.category !== 'Housing'
  );

  // Group expenses by category to establish historical baselines
  const byCategory = new Map<CategoryName, Transaction[]>();
  for (const tx of expenses) {
    const arr = byCategory.get(tx.category) ?? [];
    arr.push(tx);
    byCategory.set(tx.category, arr);
  }

  const alerts: AnomalyAlert[] = [];

  for (const [category, catTxs] of byCategory.entries()) {
    if (catTxs.length < 3) continue;

    // Sort amounts to compute trimmed baseline (excluding extreme top outlier if enough points)
    const amounts = catTxs.map((t) => t.amount).sort((a, b) => a - b);
    const baselinePool = amounts.length >= 5 ? amounts.slice(0, amounts.length - 1) : amounts;
    const mean = computeMean(baselinePool);
    const stdDev = Math.max(computeStdDev(baselinePool, mean), mean * 0.28);

    // Also compute IQR fence
    const q1 = baselinePool[Math.floor(baselinePool.length * 0.25)];
    const q3 = baselinePool[Math.floor(baselinePool.length * 0.75)];
    const iqrFence = q3 + 1.5 * Math.max(q3 - q1, mean * 0.2);

    for (const tx of catTxs) {
      if (mean <= 0) continue;
      const ratio = tx.amount / mean;
      const zScore = (tx.amount - mean) / stdDev;
      const excess = tx.amount - mean;

      const exceedsZ = zScore >= params.zThreshold;
      const exceedsRatio = ratio >= params.ratioThreshold;
      const exceedsIqr = tx.amount > iqrFence;

      if ((exceedsZ || (exceedsRatio && exceedsIqr)) && excess >= params.minExcessAmount) {
        const rawScore = Math.min(0.99, Math.max(0.55, 0.45 + zScore * 0.14 + (ratio - 1.5) * 0.08));
        const anomalyScore = Number(rawScore.toFixed(2));
        const severity: 'moderate' | 'high' =
          ratio >= params.ratioThreshold * 1.35 || zScore >= params.zThreshold + 1.0
            ? 'high'
            : 'moderate';

        const isDismissed = dismissedIds.includes(tx.id);
        alerts.push({
          id: `anom_${tx.id}`,
          transactionId: tx.id,
          transaction: tx,
          categoryBaselineAvg: Math.round(mean),
          categoryStdDev: Math.round(stdDev),
          ratioToBaseline: Number(ratio.toFixed(1)),
          zScore: Number(zScore.toFixed(2)),
          anomalyScore,
          reason: `${formatINR(tx.amount)} is ${ratio.toFixed(1)}× above your ${category} baseline average of ${formatINR(Math.round(mean))} (z = +${zScore.toFixed(1)}σ).`,
          severity,
          status: isDismissed ? 'dismissed' : 'active',
        });
      }
    }
  }

  // Sort most severe & most recent first
  return alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    if (b.anomalyScore !== a.anomalyScore) return b.anomalyScore - a.anomalyScore;
    return b.transaction.date.localeCompare(a.transaction.date);
  });
}
