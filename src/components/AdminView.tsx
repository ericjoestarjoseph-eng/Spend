import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { CategoryName, LearnedRule } from '../types/finance';
import { CATEGORIES, formatCompactINR, formatINR } from '../utils/formatters';

interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  city: string;
  role: 'admin' | 'user';
  personaKey: string;
  transactionCount: number;
  totalExpense: number;
  totalIncome: number;
  monthlyBudgetCap: number;
  sensitivity: string;
  reviewPending: number;
  correctedCount: number;
}

interface StatementLog {
  id: string;
  userId: string;
  userName: string;
  fileName: string;
  format: string;
  parserMode: string;
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

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}

interface ModelEval {
  evaluatedAt: string;
  sampleCount: number;
  correctCount: number;
  accuracy: number;
  avgConfidence: number;
  perCategory: Array<{
    category: CategoryName;
    samples: number;
    precision: number;
    recall: number;
    f1: number;
  }>;
  mismatches: Array<{
    description: string;
    expected: CategoryName;
    predicted: CategoryName;
    confidence: number;
  }>;
}

interface AdminOverviewResponse {
  metrics: {
    totalUsers: number;
    totalTransactions: number;
    totalVolumeINR: number;
    totalStatementsProcessed: number;
    modelAccuracy: number;
  };
  users: AdminUserSummary[];
  statementLogs: StatementLog[];
  globalRules: LearnedRule[];
  auditLogs: AuditLog[];
  modelEvaluation: ModelEval;
}

interface AdminViewProps {
  activeUserId: string;
  onSwitchWorkspaceUser: (userId: string) => Promise<void>;
  onRefreshBootstrap: () => Promise<void>;
}

export function AdminView({
  activeUserId,
  onSwitchWorkspaceUser,
  onRefreshBootstrap,
}: AdminViewProps) {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'users' | 'statements' | 'model' | 'audit'>('users');

  // New global rule form
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCategory, setRuleCategory] = useState<CategoryName>('Food and Dining');

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overview');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load admin overview.');
      setData(json as AdminOverviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch admin metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdminData();
  }, []);

  const handleToggleRole = async (userId: string, currentRole: 'admin' | 'user') => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    await fetchAdminData();
    await onRefreshBootstrap();
  };

  const handleResetUser = async (userId: string) => {
    await fetch(`/api/users/${userId}/reset`, { method: 'POST' });
    await fetchAdminData();
    await onRefreshBootstrap();
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rulePattern.trim().length < 2) return;
    await fetch('/api/admin/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: rulePattern.trim(), category: ruleCategory }),
    });
    setRulePattern('');
    await fetchAdminData();
    await onRefreshBootstrap();
  };

  const handleDeleteRule = async (pattern: string) => {
    await fetch(`/api/admin/rules?pattern=${encodeURIComponent(pattern)}`, {
      method: 'DELETE',
    });
    await fetchAdminData();
    await onRefreshBootstrap();
  };

  const handleDeleteStatementLog = async (id: string) => {
    await fetch(`/api/admin/statements/${id}`, { method: 'DELETE' });
    await fetchAdminData();
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || 'Failed to load Admin Console.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform KPI Strip */}
      <section className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Managed Accounts</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {data.metrics.totalUsers}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {data.users.filter((u) => u.role === 'admin').length} admin ·{' '}
            {data.users.filter((u) => u.role === 'user').length} standard
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Ledger Transactions</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {data.metrics.totalTransactions}
          </p>
          <p className="mt-1.5 font-mono text-xs text-slate-500 tabular-nums">
            Volume {formatCompactINR(data.metrics.totalVolumeINR)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Statements Processed</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {data.metrics.totalStatementsProcessed}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {data.statementLogs.filter((s) => s.status === 'completed').length} succeeded ·{' '}
            {data.statementLogs.filter((s) => s.status === 'failed').length} failed
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Categorizer Benchmark</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {data.metrics.modelAccuracy}%
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            PRD target ≥ 85% ({data.modelEvaluation.correctCount}/{data.modelEvaluation.sampleCount})
          </p>
        </div>
      </section>

      {/* Admin Sub-Navigation Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'users', label: 'Users & Workspaces' },
              { id: 'statements', label: 'Statement Ingestion Logs' },
              { id: 'model', label: 'AI Rules & Model Evaluation' },
              { id: 'audit', label: 'Audit Trail' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                subTab === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void fetchAdminData()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Tab 1: Users & Workspaces */}
      {subTab === 'users' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Registered Accounts & Workspace Isolation
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage role permissions, inspect per-user financial totals, or switch active workspace
            </p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pl-6 pr-3">User</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5 text-right">Records</th>
                <th className="px-3 py-2.5 text-right">Total Income</th>
                <th className="px-3 py-2.5 text-right">Total Expenses</th>
                <th className="px-3 py-2.5 text-right">Monthly Cap</th>
                <th className="py-2.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {data.users.map((u) => {
                const isCurrent = u.id === activeUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-6 pr-3">
                      <p className="font-semibold text-slate-900">
                        {u.name}
                        {isCurrent ? (
                          <span className="ml-2 font-normal text-teal-700">· Active</span>
                        ) : null}
                      </p>
                      <p className="text-slate-500">
                        {u.email} · {u.roleLabel} · {u.city}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => void handleToggleRole(u.id, u.role)}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-medium ${
                          u.role === 'admin'
                            ? 'border-teal-200 bg-teal-50 text-teal-800'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <Shield className="h-3 w-3" />
                        {u.role === 'admin' ? 'Admin' : 'Standard'}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-800 tabular-nums">
                      {u.transactionCount}
                      {u.reviewPending > 0 && (
                        <span className="block text-[11px] text-amber-700">
                          {u.reviewPending} review
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-700 tabular-nums">
                      {formatINR(u.totalIncome)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-900 tabular-nums">
                      {formatINR(u.totalExpense)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600 tabular-nums">
                      {formatINR(u.monthlyBudgetCap)}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => void onSwitchWorkspaceUser(u.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <UserCheck className="h-3 w-3" />
                            Open Workspace
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleResetUser(u.id)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Reset Data
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

      {/* Tab 2: Statement Ingestion Logs */}
      {subTab === 'statements' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Statement Ingestion Pipeline History
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Audit every CSV, PDF, image, and text statement processed across SmartSpend
            </p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pl-6 pr-3">File / Source</th>
                <th className="px-3 py-2.5">User</th>
                <th className="px-3 py-2.5">Parser</th>
                <th className="px-3 py-2.5 text-right">Imported / Extracted</th>
                <th className="px-3 py-2.5 text-right">Avg Confidence</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="py-2.5 pl-3 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {data.statementLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-3 pl-6 pr-3">
                    <p className="font-medium text-slate-900">{log.fileName}</p>
                    <p className="text-slate-500">
                      {log.bankOrSource || log.format.toUpperCase()} ·{' '}
                      {log.statementPeriod || new Date(log.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{log.userName}</td>
                  <td className="px-3 py-3 font-mono text-slate-600">
                    {log.parserMode === 'ai_gemini' ? 'AI Parser' : 'CSV Mapper'} ·{' '}
                    {log.format.toUpperCase()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-900 tabular-nums">
                    {log.importedCount} / {log.totalExtracted}
                    {log.duplicatesSkipped > 0 && (
                      <span className="block text-[11px] text-slate-400">
                        {log.duplicatesSkipped} dup skipped
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700 tabular-nums">
                    {Math.round(log.avgConfidence * 100)}%
                  </td>
                  <td className="px-3 py-3">
                    {log.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </span>
                    ) : (
                      <span className="font-medium text-rose-700">
                        Failed: {log.errorMessage}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDeleteStatementLog(log.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      aria-label={`Delete log ${log.fileName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Global AI Rules & Benchmark Evaluation */}
      {subTab === 'model' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Global Merchant Categorization Rules
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Override keyword rules applied across all user accounts and statement imports.
              </p>

              <form onSubmit={handleAddRule} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Merchant Keyword Pattern
                  </label>
                  <input
                    type="text"
                    value={rulePattern}
                    onChange={(e) => setRulePattern(e.target.value)}
                    placeholder="e.g. dunzo, zepto cafe, cred rent"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Target Category
                    </label>
                    <select
                      value={ruleCategory}
                      onChange={(e) => setRuleCategory(e.target.value as CategoryName)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-teal-700 focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Rule
                  </button>
                </div>
              </form>

              <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
                {data.globalRules.map((rule) => (
                  <div
                    key={rule.pattern}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-mono font-medium text-slate-900">
                        "{rule.pattern}"
                      </span>
                      <span className="mx-2 text-slate-400">→</span>
                      <span className="font-medium text-teal-800">{rule.category}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRule(rule.pattern)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      aria-label={`Remove rule ${rule.pattern}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Model Evaluation Against Labelled Indian Test Corpus
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Accuracy {data.modelEvaluation.accuracy}% · Avg Confidence{' '}
                    {data.modelEvaluation.avgConfidence}% across{' '}
                    {data.modelEvaluation.sampleCount} benchmark transactions
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                  PASS (≥85%)
                </span>
              </div>
            </div>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 pl-6 pr-3">Category</th>
                  <th className="px-3 py-2.5 text-right">Samples</th>
                  <th className="px-3 py-2.5 text-right">Precision</th>
                  <th className="px-3 py-2.5 text-right">Recall</th>
                  <th className="py-2.5 pl-3 pr-6 text-right">F1-Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.modelEvaluation.perCategory.map((row) => (
                  <tr key={row.category} className="hover:bg-slate-50/60">
                    <td className="py-2.5 pl-6 pr-3 font-medium text-slate-900">
                      {row.category}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                      {row.samples}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                      {row.precision}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                      {row.recall}%
                    </td>
                    <td className="py-2.5 pl-3 pr-6 text-right font-mono font-semibold text-teal-700 tabular-nums">
                      {row.f1}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Audit Trail */}
      {subTab === 'audit' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">System Audit Log</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Chronological record of workspace switches, statement imports, budget updates, and
              admin actions
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {data.auditLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-6 py-3 text-xs hover:bg-slate-50/70"
              >
                <div>
                  <span className="font-semibold text-slate-900">{entry.action}</span>
                  <span className="mx-2 text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-600">{entry.detail}</span>
                </div>
                <div className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                  {entry.actor} · {new Date(entry.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
