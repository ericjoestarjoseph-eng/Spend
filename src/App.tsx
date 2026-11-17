/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  ListOrdered,
  PiggyBank,
  Plus,
  Settings2,
  Shield,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  AnomalySensitivity,
  BudgetConfig,
  CategoryName,
  LearnedRule,
  NavTab,
  Transaction,
  UserAccount,
} from './types/finance';
import {
  DEMO_USERS,
  PROFESSIONAL_BUDGET,
  getSeedTransactions,
} from './data/seedData';
import { detectAnomalies } from './engine/anomalyDetector';
import { formatMonthLabel, getMonthKey } from './utils/formatters';
import { OverviewView } from './components/OverviewView';
import { TransactionsView } from './components/TransactionsView';
import { StatementsView } from './components/StatementsView';
import { BudgetsView } from './components/BudgetsView';
import { AnomaliesView } from './components/AnomaliesView';
import { ReportsView } from './components/ReportsView';
import { AdminView } from './components/AdminView';
import { TransactionDrawer } from './components/TransactionDrawer';
import { AuthModal } from './components/AuthModal';

interface WorkspaceState {
  user: UserAccount;
  transactions: Transaction[];
  budgets: BudgetConfig;
  learnedRules: LearnedRule[];
  dismissedAnomalyIds: string[];
  sensitivity: AnomalySensitivity;
  selectedMonth: string;
}

const FALLBACK_WORKSPACE: WorkspaceState = {
  user: { ...DEMO_USERS.professional, role: 'admin' },
  transactions: getSeedTransactions('professional'),
  budgets: PROFESSIONAL_BUDGET,
  learnedRules: [],
  dismissedAnomalyIds: [],
  sensitivity: 'balanced',
  selectedMonth: '2026-11',
};

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ListOrdered },
  { id: 'import', label: 'Statements', icon: FileSpreadsheet },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'anomalies', label: 'Anomaly Monitor', icon: AlertTriangle },
  { id: 'reports', label: 'Monthly Reports', icon: BarChart3 },
  { id: 'admin', label: 'Admin Console', icon: Shield },
];

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(FALLBACK_WORKSPACE);
  const [globalRules, setGlobalRules] = useState<LearnedRule[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<CategoryName | 'ALL'>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const refreshBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data = (await res.json()) as {
        workspace: WorkspaceState;
        globalRules: LearnedRule[];
      };
      if (data.workspace) {
        setWorkspace(data.workspace);
        setGlobalRules(data.globalRules ?? []);
      }
    } finally {
      setBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    void refreshBootstrap();
  }, [refreshBootstrap]);

  const combinedRules = useMemo(
    () => [...workspace.learnedRules, ...globalRules],
    [workspace.learnedRules, globalRules]
  );

  const availableMonths = useMemo(() => {
    const set = new Set<string>(['2026-11']);
    for (const t of workspace.transactions) {
      set.add(getMonthKey(t.date));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [workspace.transactions]);

  const activeMonth = availableMonths.includes(workspace.selectedMonth)
    ? workspace.selectedMonth
    : availableMonths[0] || '2026-11';

  const anomalies = useMemo(
    () =>
      detectAnomalies(
        workspace.transactions,
        workspace.sensitivity,
        workspace.dismissedAnomalyIds
      ),
    [workspace.transactions, workspace.sensitivity, workspace.dismissedAnomalyIds]
  );

  const activeAnomalyCount = useMemo(
    () => anomalies.filter((a) => a.status === 'active').length,
    [anomalies]
  );

  const reviewQueueCount = useMemo(
    () =>
      workspace.transactions.filter((t) => t.needsReview && !t.manuallyCorrected).length,
    [workspace.transactions]
  );

  const handleNavigate = (tab: NavTab, categoryFilter?: CategoryName) => {
    if (categoryFilter) {
      setLedgerCategoryFilter(categoryFilter);
    } else if (tab !== 'transactions') {
      setLedgerCategoryFilter('ALL');
    }
    setActiveTab(tab);
  };

  const handleSelectMonth = async (month: string) => {
    setWorkspace((prev) => ({ ...prev, selectedMonth: month }));
    await fetch(`/api/workspace/${workspace.user.id}/month`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedMonth: month }),
    });
  };

  const handleSaveTransaction = async (payload: {
    id?: string;
    description: string;
    amount: number;
    date: string;
    type: Transaction['type'];
    category: CategoryName;
    predictedCategory: CategoryName;
    confidence: number;
    needsReview: boolean;
    manuallyCorrected: boolean;
    paymentMethod: Transaction['paymentMethod'];
    notes?: string;
  }) => {
    if (payload.id) {
      const res = await fetch(`/api/transactions/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: workspace.user.id, updates: payload }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace: WorkspaceState };
        setWorkspace(data.workspace);
      }
    } else {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: workspace.user.id,
          transaction: { ...payload, source: 'manual' },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workspace: WorkspaceState };
        setWorkspace(data.workspace);
      }
    }

    setDrawerOpen(false);
    setEditingTx(null);
  };

  const handleInlineCategoryChange = async (id: string, newCategory: CategoryName) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: workspace.user.id,
        updates: {
          category: newCategory,
          manuallyCorrected: true,
          needsReview: false,
        },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { workspace: WorkspaceState };
      setWorkspace(data.workspace);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const res = await fetch(
      `/api/transactions/${id}?userId=${encodeURIComponent(workspace.user.id)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      const data = (await res.json()) as { workspace: WorkspaceState };
      setWorkspace(data.workspace);
    }
  };

  const handleImportConfirm = async (
    newTransactions: Transaction[],
    statementMeta: {
      fileName: string;
      format: 'csv' | 'pdf' | 'image' | 'text';
      parserMode: 'ai_gemini' | 'csv_mapper';
      totalExtracted: number;
      duplicatesSkipped: number;
      statementPeriod?: string;
      bankOrSource?: string;
    }
  ) => {
    const res = await fetch('/api/transactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: workspace.user.id,
        transactions: newTransactions,
        statementMeta,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { workspace: WorkspaceState };
      setWorkspace(data.workspace);
    }
  };

  const handleUpdateBudgets = async (next: BudgetConfig) => {
    setWorkspace((prev) => ({ ...prev, budgets: next }));
    await fetch(`/api/budgets/${workspace.user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
  };

  const handleUpdateAnomalyPrefs = async (
    sensitivity?: AnomalySensitivity,
    dismissedAnomalyIds?: string[]
  ) => {
    setWorkspace((prev) => ({
      ...prev,
      sensitivity: sensitivity ?? prev.sensitivity,
      dismissedAnomalyIds: dismissedAnomalyIds ?? prev.dismissedAnomalyIds,
    }));
    await fetch(`/api/anomalies/${workspace.user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensitivity, dismissedAnomalyIds }),
    });
  };

  const handleDismissAnomaly = (transactionId: string) => {
    const next = Array.from(new Set([...workspace.dismissedAnomalyIds, transactionId]));
    void handleUpdateAnomalyPrefs(undefined, next);
  };

  const handleRestoreAnomaly = (transactionId: string) => {
    const next = workspace.dismissedAnomalyIds.filter((id) => id !== transactionId);
    void handleUpdateAnomalyPrefs(undefined, next);
  };

  const handleSwitchUserId = async (userId: string) => {
    setAvatarFailed(false);
    const res = await fetch('/api/auth/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        workspace: WorkspaceState;
        globalRules: LearnedRule[];
      };
      setWorkspace(data.workspace);
      setGlobalRules(data.globalRules ?? []);
      setActiveTab('overview');
    }
  };

  const handleSwitchPersona = async (persona: 'professional' | 'student') => {
    await handleSwitchUserId(DEMO_USERS[persona].id);
  };

  const handleRegisterCustomUser = async (
    name: string,
    email: string,
    roleLabel: string,
    city: string
  ) => {
    setAvatarFailed(false);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, roleLabel, city }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        workspace: WorkspaceState;
        globalRules: LearnedRule[];
      };
      setWorkspace(data.workspace);
      setGlobalRules(data.globalRules ?? []);
      setActiveTab('overview');
    }
  };

  const handleResetWorkspace = async () => {
    const res = await fetch(`/api/users/${workspace.user.id}/reset`, { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { workspace: WorkspaceState };
      setWorkspace(data.workspace);
    }
  };

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="flex min-h-screen min-w-[1080px] bg-slate-50 text-slate-900">
      {/* Desktop Fixed Left Sidebar (256px) */}
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white">
        <div>
          {/* Brand Wordmark */}
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-6 py-4.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              SmartSpend
            </span>
          </div>

          {/* Primary Navigation */}
          <nav className="space-y-1 px-3 py-4" aria-label="Workspace Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const count =
                item.id === 'anomalies'
                  ? activeAnomalyCount
                  : item.id === 'transactions'
                  ? reviewQueueCount
                  : 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>

                  {count > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        item.id === 'anomalies' ? 'font-semibold text-rose-600' : 'text-amber-700'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Persona Trigger */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            {workspace.user.avatarUrl && !avatarFailed ? (
              <img
                src={workspace.user.avatarUrl}
                alt={workspace.user.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 font-display text-xs font-semibold text-white">
                {workspace.user.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {workspace.user.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {workspace.user.roleLabel} · {workspace.user.city}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
          >
            <Settings2 className="h-3.5 w-3.5 text-slate-500" />
            Switch Persona / Account
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb + Month Selector on left, 2 concise actions on right */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-8 py-3.5">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap">
              {activeNavMeta.label}
            </h1>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <select
              aria-label="Select active reporting month"
              value={activeMonth}
              onChange={(e) => void handleSelectMonth(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-slate-300 focus:border-teal-700 focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('import')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Statement
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Transaction
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Viewport */}
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-8 py-6">
          {!bootstrapped ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
              <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  transactions={workspace.transactions}
                  selectedMonth={activeMonth}
                  availableMonths={availableMonths}
                  budgets={workspace.budgets}
                  anomalies={anomalies}
                  onNavigate={handleNavigate}
                  onOpenAddTransaction={() => {
                    setEditingTx(null);
                    setDrawerOpen(true);
                  }}
                  onDismissAnomaly={handleDismissAnomaly}
                  onInlineCategoryChange={handleInlineCategoryChange}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsView
                  transactions={workspace.transactions}
                  selectedMonth={activeMonth}
                  anomalies={anomalies}
                  initialCategoryFilter={ledgerCategoryFilter}
                  onClearInitialCategoryFilter={() => setLedgerCategoryFilter('ALL')}
                  onOpenAdd={() => {
                    setEditingTx(null);
                    setDrawerOpen(true);
                  }}
                  onEdit={(tx) => {
                    setEditingTx(tx);
                    setDrawerOpen(true);
                  }}
                  onDelete={handleDeleteTransaction}
                  onInlineCategoryChange={handleInlineCategoryChange}
                />
              )}

              {activeTab === 'import' && (
                <StatementsView
                  existingTransactions={workspace.transactions}
                  learnedRules={combinedRules}
                  userId={workspace.user.id}
                  onImportConfirm={handleImportConfirm}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsView
                  transactions={workspace.transactions}
                  selectedMonth={activeMonth}
                  budgets={workspace.budgets}
                  onUpdateBudgets={handleUpdateBudgets}
                />
              )}

              {activeTab === 'anomalies' && (
                <AnomaliesView
                  transactions={workspace.transactions}
                  anomalies={anomalies}
                  sensitivity={workspace.sensitivity}
                  onChangeSensitivity={(s) => void handleUpdateAnomalyPrefs(s)}
                  onDismissAlert={handleDismissAnomaly}
                  onRestoreAlert={handleRestoreAnomaly}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  transactions={workspace.transactions}
                  selectedMonth={activeMonth}
                  availableMonths={availableMonths}
                  anomalies={anomalies}
                  onSelectMonth={(m) => void handleSelectMonth(m)}
                />
              )}

              {activeTab === 'admin' && (
                <AdminView
                  activeUserId={workspace.user.id}
                  onSwitchWorkspaceUser={handleSwitchUserId}
                  onRefreshBootstrap={refreshBootstrap}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Transaction Entry & Edit Drawer */}
      <TransactionDrawer
        isOpen={drawerOpen}
        editingTransaction={editingTx}
        learnedRules={combinedRules}
        defaultDate={`${activeMonth}-17`}
        onClose={() => {
          setDrawerOpen(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
      />

      {/* Account & Persona Modal */}
      <AuthModal
        isOpen={authModalOpen}
        currentUser={workspace.user}
        onClose={() => setAuthModalOpen(false)}
        onSwitchPersona={handleSwitchPersona}
        onRegisterCustomUser={handleRegisterCustomUser}
        onResetCurrentWorkspace={handleResetWorkspace}
      />
    </div>
  );
}

