import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, RotateCcw, LogOut } from 'lucide-react';
import { UserAccount } from '../types/finance';
import { DEMO_USERS } from '../data/seedData';

interface AuthModalProps {
  isOpen: boolean;
  currentUser: UserAccount;
  onClose: () => void;
  onSwitchPersona: (persona: 'professional' | 'student') => void;
  onRegisterCustomUser: (name: string, email: string, roleLabel: string, city: string) => void;
  onResetCurrentWorkspace: () => void;
}

export function AuthModal({
  isOpen,
  currentUser,
  onClose,
  onSwitchPersona,
  onRegisterCustomUser,
  onResetCurrentWorkspace,
}: AuthModalProps) {
  const [mode, setMode] = useState<'account' | 'auth'>('account');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleLabel, setRoleLabel] = useState('Young Professional');
  const [city, setCity] = useState('Mumbai');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || email.trim().length < 5) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (authTab === 'register' && name.trim().length < 2) {
      setError('Enter your full name to create an account.');
      return;
    }

    const derivedName =
      authTab === 'register'
        ? name.trim()
        : email.split('@')[0].replace(/[._]/g, ' ');
    onRegisterCustomUser(derivedName, email.trim(), roleLabel, city.trim() || 'India');
    setMode('account');
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-6 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[520px] rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="account-modal-title" className="text-base font-semibold text-slate-900">
              {mode === 'account' ? 'Workspace & Persona Settings' : 'Sign In or Create Account'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Switch Indian user personas, manage local session, or reset seed ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close account modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === 'account' ? (
          <div className="space-y-5 p-6">
            {/* Active Profile */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-700 font-display text-sm font-semibold text-white">
                    {currentUser.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {currentUser.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {currentUser.roleLabel} · {currentUser.city} · {currentUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode('auth')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Switch / Auth
              </button>
            </div>

            {/* PRD Persona Switcher */}
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700">
                Switch PRD Demo Persona
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(['professional', 'student'] as const).map((key) => {
                  const persona = DEMO_USERS[key];
                  const active = currentUser.personaKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onSwitchPersona(key);
                        onClose();
                      }}
                      className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition-colors ${
                        active
                          ? 'border-teal-700 bg-teal-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">
                          {persona.name}
                        </span>
                        {active && <UserCheck className="h-4 w-4 text-teal-700" />}
                      </div>
                      <span className="mt-0.5 text-xs text-slate-500">
                        {persona.roleLabel} · {persona.city}
                      </span>
                      <span className="mt-2 font-mono text-[11px] text-slate-600 tabular-nums">
                        {key === 'professional'
                          ? '₹92,000/mo · 6-mo dataset'
                          : '₹24,500/mo · 4-mo dataset'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-teal-700" />
                <span>Data stored locally in your browser workspace</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResetCurrentWorkspace();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Demo Data
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuthSubmit} className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setError(null);
                }}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  authTab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setError(null);
                }}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  authTab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Sign In
              </button>
            </div>

            {authTab === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rohan Kulkarni"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.in"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                />
              </div>
              {authTab === 'register' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Profile Type</label>
                  <select
                    value={roleLabel}
                    onChange={(e) => setRoleLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  >
                    <option value="Young Professional">Young Professional</option>
                    <option value="College Student">College Student</option>
                    <option value="Freelancer">Freelancer</option>
                  </select>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setMode('account')}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                ← Back to Personas
              </button>
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                {authTab === 'register' ? 'Create Blank Workspace' : 'Sign In'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
