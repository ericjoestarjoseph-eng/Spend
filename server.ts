import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  appendAudit,
  evaluateCategorizerModel,
  readDb,
  writeDb,
} from './server/store.ts';
import type {
  AnomalySensitivity,
  BudgetConfig,
  CategoryName,
  PaymentMethod,
  Transaction,
  TransactionType,
} from './src/types/finance.ts';
import {
  PROFESSIONAL_BUDGET,
  STUDENT_BUDGET,
  getSeedTransactions,
} from './src/data/seedData.ts';
import {
  classifyTransaction,
  extractMerchantPattern,
} from './src/engine/categorizer.ts';

const PORT = Number(process.env.PORT) || 3000;

const VALID_CATEGORIES: CategoryName[] = [
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
  'Income',
  'Other',
];

const VALID_METHODS: PaymentMethod[] = [
  'UPI',
  'Debit Card',
  'Credit Card',
  'NetBanking',
  'Cash',
];

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Bootstrap entire workspace state
  app.get('/api/bootstrap', (_req, res) => {
    const db = readDb();
    const activeWorkspace =
      db.workspaces[db.activeUserId] ?? Object.values(db.workspaces)[0];
    res.json({
      activeUserId: activeWorkspace.user.id,
      workspace: activeWorkspace,
      users: Object.values(db.workspaces).map((w) => w.user),
      globalRules: db.globalRules,
    });
  });

  // Switch active user / persona
  app.post('/api/auth/switch', (req, res) => {
    const { userId } = req.body as { userId?: string };
    const db = readDb();
    if (!userId || !db.workspaces[userId]) {
      res.status(404).json({ error: 'Workspace user not found.' });
      return;
    }
    db.activeUserId = userId;
    appendAudit(
      db,
      db.workspaces[userId].user.name,
      'Switched Active Workspace',
      `Activated ${db.workspaces[userId].user.roleLabel} profile`
    );
    writeDb(db);
    res.json({
      activeUserId: userId,
      workspace: db.workspaces[userId],
      users: Object.values(db.workspaces).map((w) => w.user),
      globalRules: db.globalRules,
    });
  });

  // Register new custom user
  app.post('/api/auth/register', (req, res) => {
    const { name, email, roleLabel, city } = req.body as {
      name?: string;
      email?: string;
      roleLabel?: string;
      city?: string;
    };
    if (!name || name.trim().length < 2 || !email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid name and email are required.' });
      return;
    }

    const db = readDb();
    const userId = `usr_${Date.now()}`;
    const cleanRole = roleLabel?.trim() || 'Young Professional';
    const cleanCity = city?.trim() || 'India';

    db.workspaces[userId] = {
      user: {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        roleLabel: cleanRole,
        city: cleanCity,
        personaKey: 'custom',
        role: 'user',
      },
      transactions: [],
      budgets: cleanRole === 'College Student' ? STUDENT_BUDGET : PROFESSIONAL_BUDGET,
      learnedRules: [],
      dismissedAnomalyIds: [],
      sensitivity: 'balanced',
      selectedMonth: '2026-11',
    };
    db.activeUserId = userId;
    appendAudit(db, name.trim(), 'User Registered', `Created new account (${email.trim()})`);
    writeDb(db);

    res.status(201).json({
      activeUserId: userId,
      workspace: db.workspaces[userId],
      users: Object.values(db.workspaces).map((w) => w.user),
      globalRules: db.globalRules,
    });
  });

  // Reset user workspace to seed dataset
  app.post('/api/users/:userId/reset', (req, res) => {
    const { userId } = req.params;
    const db = readDb();
    const ws = db.workspaces[userId];
    if (!ws) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const persona = ws.user.personaKey === 'student' ? 'student' : 'professional';
    ws.transactions =
      ws.user.personaKey === 'custom'
        ? []
        : getSeedTransactions(persona).map((t) => ({ ...t, userId }));
    ws.budgets = persona === 'student' ? STUDENT_BUDGET : PROFESSIONAL_BUDGET;
    ws.learnedRules = [];
    ws.dismissedAnomalyIds = [];
    ws.sensitivity = 'balanced';
    ws.selectedMonth = '2026-11';

    appendAudit(db, ws.user.name, 'Workspace Reset', `Reset transactions for ${ws.user.name}`);
    writeDb(db);
    res.json({ workspace: ws });
  });

  // Update active selectedMonth
  app.put('/api/workspace/:userId/month', (req, res) => {
    const { userId } = req.params;
    const { selectedMonth } = req.body as { selectedMonth?: string };
    const db = readDb();
    const ws = db.workspaces[userId];
    if (!ws || !selectedMonth) {
      res.status(400).json({ error: 'Invalid user or month.' });
      return;
    }
    ws.selectedMonth = selectedMonth;
    writeDb(db);
    res.json({ selectedMonth });
  });

  // Add single transaction
  app.post('/api/transactions', (req, res) => {
    const { userId, transaction } = req.body as {
      userId?: string;
      transaction?: Omit<Transaction, 'id' | 'userId' | 'createdAt'>;
    };
    const db = readDb();
    const ws = userId ? db.workspaces[userId] : undefined;
    if (!ws || !transaction) {
      res.status(400).json({ error: 'Missing userId or transaction payload.' });
      return;
    }

    const created: Transaction = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: ws.user.id,
      createdAt: new Date().toISOString(),
    };

    if (created.manuallyCorrected) {
      const pattern = extractMerchantPattern(created.description);
      if (pattern.length >= 3) {
        ws.learnedRules = [
          { pattern, category: created.category, updatedAt: created.createdAt },
          ...ws.learnedRules.filter((r) => r.pattern !== pattern),
        ];
      }
    }

    ws.transactions.unshift(created);
    ws.selectedMonth = created.date.slice(0, 7);
    writeDb(db);
    res.status(201).json({ transaction: created, workspace: ws });
  });

  // Update single transaction (including inline category correction)
  app.put('/api/transactions/:id', (req, res) => {
    const { id } = req.params;
    const { userId, updates } = req.body as {
      userId?: string;
      updates?: Partial<Transaction>;
    };
    const db = readDb();
    const ws = userId ? db.workspaces[userId] : undefined;
    if (!ws || !updates) {
      res.status(400).json({ error: 'Missing userId or updates payload.' });
      return;
    }

    const target = ws.transactions.find((t) => t.id === id);
    if (!target) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    Object.assign(target, updates);

    if (updates.category && updates.manuallyCorrected) {
      const pattern = extractMerchantPattern(target.description);
      if (pattern.length >= 3) {
        ws.learnedRules = [
          { pattern, category: updates.category, updatedAt: new Date().toISOString() },
          ...ws.learnedRules.filter((r) => r.pattern !== pattern),
        ];
      }
    }

    writeDb(db);
    res.json({ transaction: target, workspace: ws });
  });

  // Delete single transaction
  app.delete('/api/transactions/:id', (req, res) => {
    const { id } = req.params;
    const userId = String(req.query.userId ?? '');
    const db = readDb();
    const ws = db.workspaces[userId];
    if (!ws) {
      res.status(404).json({ error: 'User workspace not found.' });
      return;
    }
    ws.transactions = ws.transactions.filter((t) => t.id !== id);
    ws.dismissedAnomalyIds = ws.dismissedAnomalyIds.filter((d) => d !== id);
    writeDb(db);
    res.json({ workspace: ws });
  });

  // Batch import transactions + record statement ingestion log
  app.post('/api/transactions/batch', (req, res) => {
    const {
      userId,
      transactions,
      statementMeta,
    } = req.body as {
      userId?: string;
      transactions?: Transaction[];
      statementMeta?: {
        fileName: string;
        format: 'csv' | 'pdf' | 'image' | 'text';
        parserMode: 'ai_gemini' | 'csv_mapper';
        totalExtracted: number;
        duplicatesSkipped: number;
        statementPeriod?: string;
        bankOrSource?: string;
      };
    };

    const db = readDb();
    const ws = userId ? db.workspaces[userId] : undefined;
    if (!ws || !Array.isArray(transactions)) {
      res.status(400).json({ error: 'Invalid batch import payload.' });
      return;
    }

    const normalized = transactions.map((t, i) => ({
      ...t,
      id: t.id || `imp_${Date.now()}_${i}`,
      userId: ws.user.id,
    }));

    ws.transactions = [...normalized, ...ws.transactions];
    if (normalized[0]?.date) {
      ws.selectedMonth = normalized[0].date.slice(0, 7);
    }

    if (statementMeta) {
      const avgConfidence =
        normalized.length > 0
          ? Number(
              (
                normalized.reduce((s, t) => s + (t.confidence ?? 0.9), 0) / normalized.length
              ).toFixed(2)
            )
          : 0;

      db.statementLogs.unshift({
        id: `stmt_${Date.now()}`,
        userId: ws.user.id,
        userName: ws.user.name,
        fileName: statementMeta.fileName,
        format: statementMeta.format,
        parserMode: statementMeta.parserMode,
        totalExtracted: statementMeta.totalExtracted,
        importedCount: normalized.length,
        duplicatesSkipped: statementMeta.duplicatesSkipped,
        avgConfidence,
        statementPeriod: statementMeta.statementPeriod,
        bankOrSource: statementMeta.bankOrSource,
        status: 'completed',
        createdAt: new Date().toISOString(),
      });

      appendAudit(
        db,
        ws.user.name,
        'Statement Imported',
        `Imported ${normalized.length} transactions from ${statementMeta.fileName} (${statementMeta.format.toUpperCase()})`
      );
    }

    writeDb(db);
    res.status(201).json({ workspace: ws, importedCount: normalized.length });
  });

  // Update budgets
  app.put('/api/budgets/:userId', (req, res) => {
    const { userId } = req.params;
    const budgets = req.body as BudgetConfig;
    const db = readDb();
    const ws = db.workspaces[userId];
    if (!ws) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    ws.budgets = budgets;
    appendAudit(
      db,
      ws.user.name,
      'Budgets Updated',
      `Monthly cap set to ₹${budgets.overallMonthlyLimit.toLocaleString('en-IN')}`
    );
    writeDb(db);
    res.json({ workspace: ws });
  });

  // Update anomaly preferences (sensitivity & dismissed IDs)
  app.put('/api/anomalies/:userId', (req, res) => {
    const { userId } = req.params;
    const { sensitivity, dismissedAnomalyIds } = req.body as {
      sensitivity?: AnomalySensitivity;
      dismissedAnomalyIds?: string[];
    };
    const db = readDb();
    const ws = db.workspaces[userId];
    if (!ws) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (sensitivity) ws.sensitivity = sensitivity;
    if (Array.isArray(dismissedAnomalyIds)) ws.dismissedAnomalyIds = dismissedAnomalyIds;
    writeDb(db);
    res.json({ workspace: ws });
  });

  // Real AI Statement Parser (PDF, Images, Raw Text, Messy CSV) powered by Gemini
  app.post('/api/statements/parse', async (req, res) => {
    const {
      userId,
      fileName,
      mimeType,
      base64Data,
      rawText,
    } = req.body as {
      userId?: string;
      fileName?: string;
      mimeType?: string;
      base64Data?: string;
      rawText?: string;
    };

    const db = readDb();
    const ws = userId ? db.workspaces[userId] : db.workspaces[db.activeUserId];

    if (!base64Data && (!rawText || rawText.trim().length < 10)) {
      res.status(400).json({
        error: 'Please provide a statement file (PDF, image, CSV, TXT) or paste statement text.',
      });
      return;
    }

    try {
      const ai = getGeminiClient();

      const systemInstruction = `You are a precision Indian bank, UPI, and credit-card statement parser for SmartSpend.
Extract every individual financial transaction from the provided statement accurately.
Rules:
1. Convert all dates to ISO YYYY-MM-DD format. If the year is missing, infer from statement period or use 2026.
2. Amounts must always be positive numbers in INR.
3. Determine type strictly: "expense" for debits/withdrawals/UPI payments/purchases, "income" for credits/salary/stipends/refunds/deposits.
4. Classify each transaction into ONLY one of these exact categories: ${VALID_CATEGORIES.join(', ')}.
5. Set paymentMethod to one of: ${VALID_METHODS.join(', ')}.
6. Set confidence from 0.0 to 1.0 reflecting how unambiguous the merchant and category are.
7. Provide 3 to 5 concise, quantitative financial insights summarizing spending concentration, cashflow balance, and notable high-value items in the statement.
8. Ignore opening/closing balance summary rows as transactions—only extract actual transactions.`;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (base64Data && mimeType) {
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
        parts.push({
          text: `Parse all transactions and produce statement summary & insights from this uploaded statement (${fileName || 'statement'}).`,
        });
      } else {
        parts.push({
          text: `Parse all transactions and produce statement summary & insights from the following bank/UPI statement text:\n\n${rawText}`,
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bankOrSource: {
                type: Type.STRING,
                description: 'Detected bank, wallet, or card issuer name (e.g. HDFC Bank, SBI, ICICI Credit Card, PhonePe UPI).',
              },
              statementPeriod: {
                type: Type.STRING,
                description: 'Human readable statement period (e.g. Nov 01 – Nov 17, 2026).',
              },
              insights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 5 concrete quantitative insights about spending and cashflow in this statement.',
              },
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                    description: { type: Type.STRING, description: 'Clean merchant or narration description' },
                    amount: { type: Type.NUMBER, description: 'Positive INR numeric amount' },
                    type: { type: Type.STRING, description: 'expense or income' },
                    category: { type: Type.STRING, description: 'One of the 12 exact SmartSpend categories' },
                    paymentMethod: { type: Type.STRING, description: 'UPI, Debit Card, Credit Card, NetBanking, or Cash' },
                    confidence: { type: Type.NUMBER, description: '0.0 to 1.0' },
                    notes: { type: Type.STRING, description: 'Optional brief context or reference' },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        bankOrSource?: string;
        statementPeriod?: string;
        insights?: string[];
        transactions?: Array<{
          date?: string;
          description?: string;
          amount?: number;
          type?: string;
          category?: string;
          paymentMethod?: string;
          confidence?: number;
          notes?: string;
        }>;
      };

      const combinedRules = [...(ws?.learnedRules ?? []), ...db.globalRules];
      const existingKeys = new Set(
        (ws?.transactions ?? []).map(
          (t) => `${t.date}|${Math.round(t.amount * 100)}|${t.description.trim().toLowerCase()}`
        )
      );

      const extractedRows = (parsed.transactions ?? [])
        .filter((item) => item && item.description && typeof item.amount === 'number' && item.amount > 0)
        .map((item, idx) => {
          const cleanDate =
            item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
              ? item.date
              : '2026-11-17';
          const cleanDesc = String(item.description).trim();
          const cleanType: TransactionType =
            String(item.type).toLowerCase() === 'income' ? 'income' : 'expense';
          const cleanAmount = Math.round(Math.abs(Number(item.amount)) * 100) / 100;

          // Refine with local learned rules if present
          const ruleMatch = classifyTransaction(cleanDesc, cleanType, combinedRules);
          const aiCategory = VALID_CATEGORIES.includes(item.category as CategoryName)
            ? (item.category as CategoryName)
            : ruleMatch.category;

          const finalCategory =
            ruleMatch.matchedSignals.some((s) => s.startsWith('learned:'))
              ? ruleMatch.category
              : aiCategory;

          const finalMethod = VALID_METHODS.includes(item.paymentMethod as PaymentMethod)
            ? (item.paymentMethod as PaymentMethod)
            : 'UPI';

          const rawConf = typeof item.confidence === 'number' ? item.confidence : ruleMatch.confidence;
          const confidence = Math.min(0.99, Math.max(0.4, Number(rawConf.toFixed(2))));

          const dupKey = `${cleanDate}|${Math.round(cleanAmount * 100)}|${cleanDesc.toLowerCase()}`;
          const isDuplicate = existingKeys.has(dupKey);

          return {
            rowIndex: idx,
            date: cleanDate,
            description: cleanDesc,
            amount: cleanAmount,
            type: cleanType,
            category: finalCategory,
            paymentMethod: finalMethod,
            confidence,
            needsReview: confidence < 0.75,
            isDuplicate,
            include: !isDuplicate,
            notes: item.notes,
          };
        });

      res.json({
        bankOrSource: parsed.bankOrSource || 'Uploaded Statement',
        statementPeriod: parsed.statementPeriod || 'Detected Period',
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        transactions: extractedRows,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse statement via Gemini API.';
      if (ws) {
        db.statementLogs.unshift({
          id: `stmt_err_${Date.now()}`,
          userId: ws.user.id,
          userName: ws.user.name,
          fileName: fileName || 'pasted_statement.txt',
          format: mimeType?.includes('pdf')
            ? 'pdf'
            : mimeType?.startsWith('image/')
            ? 'image'
            : 'text',
          parserMode: 'ai_gemini',
          totalExtracted: 0,
          importedCount: 0,
          duplicatesSkipped: 0,
          avgConfidence: 0,
          status: 'failed',
          errorMessage: message,
          createdAt: new Date().toISOString(),
        });
        writeDb(db);
      }
      res.status(500).json({ error: message });
    }
  });

  // ---------------- ADMIN API ROUTES ----------------
  app.get('/api/admin/overview', (_req, res) => {
    const db = readDb();
    const workspaces = Object.values(db.workspaces);

    const userSummaries = workspaces.map((ws) => {
      const totalExpense = ws.transactions
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
      const totalIncome = ws.transactions
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);
      const reviewPending = ws.transactions.filter(
        (t) => t.needsReview && !t.manuallyCorrected
      ).length;
      const correctedCount = ws.transactions.filter((t) => t.manuallyCorrected).length;

      return {
        id: ws.user.id,
        name: ws.user.name,
        email: ws.user.email,
        roleLabel: ws.user.roleLabel,
        city: ws.user.city,
        role: ws.user.role,
        personaKey: ws.user.personaKey,
        transactionCount: ws.transactions.length,
        totalExpense,
        totalIncome,
        monthlyBudgetCap: ws.budgets.overallMonthlyLimit,
        sensitivity: ws.sensitivity,
        reviewPending,
        correctedCount,
      };
    });

    const totalTransactions = workspaces.reduce(
      (s, ws) => s + ws.transactions.length,
      0
    );
    const totalVolumeINR = workspaces.reduce(
      (s, ws) => s + ws.transactions.reduce((acc, t) => acc + t.amount, 0),
      0
    );
    const modelEvaluation = evaluateCategorizerModel(db.globalRules);

    res.json({
      metrics: {
        totalUsers: workspaces.length,
        totalTransactions,
        totalVolumeINR,
        totalStatementsProcessed: db.statementLogs.length,
        modelAccuracy: modelEvaluation.accuracy,
      },
      users: userSummaries,
      statementLogs: db.statementLogs,
      globalRules: db.globalRules,
      auditLogs: db.auditLogs,
      modelEvaluation,
    });
  });

  app.put('/api/admin/users/:userId/role', (req, res) => {
    const { userId } = req.params;
    const { role } = req.body as { role?: 'admin' | 'user' };
    const db = readDb();
    const ws = db.workspaces[userId];
    if (!ws || (role !== 'admin' && role !== 'user')) {
      res.status(400).json({ error: 'Invalid user or role.' });
      return;
    }
    ws.user.role = role;
    appendAudit(
      db,
      'Admin Console',
      'Role Updated',
      `Set ${ws.user.name} permission level to ${role.toUpperCase()}`
    );
    writeDb(db);
    res.json({ ok: true, user: ws.user });
  });

  app.post('/api/admin/rules', (req, res) => {
    const { pattern, category } = req.body as {
      pattern?: string;
      category?: CategoryName;
    };
    if (!pattern || pattern.trim().length < 2 || !category || !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Provide a merchant pattern (min 2 chars) and valid category.' });
      return;
    }
    const db = readDb();
    const cleanPattern = pattern.trim().toLowerCase();
    db.globalRules = [
      { pattern: cleanPattern, category, updatedAt: new Date().toISOString() },
      ...db.globalRules.filter((r) => r.pattern !== cleanPattern),
    ];
    appendAudit(
      db,
      'Admin Console',
      'Global Rule Added',
      `Mapped "${cleanPattern}" → ${category}`
    );
    writeDb(db);
    res.status(201).json({ globalRules: db.globalRules });
  });

  app.delete('/api/admin/rules', (req, res) => {
    const pattern = String(req.query.pattern ?? '').toLowerCase();
    const db = readDb();
    db.globalRules = db.globalRules.filter((r) => r.pattern !== pattern);
    appendAudit(db, 'Admin Console', 'Global Rule Removed', `Deleted rule "${pattern}"`);
    writeDb(db);
    res.json({ globalRules: db.globalRules });
  });

  app.delete('/api/admin/statements/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const target = db.statementLogs.find((s) => s.id === id);
    db.statementLogs = db.statementLogs.filter((s) => s.id !== id);
    if (target) {
      appendAudit(
        db,
        'Admin Console',
        'Ingestion Log Cleared',
        `Removed log entry for ${target.fileName}`
      );
    }
    writeDb(db);
    res.json({ statementLogs: db.statementLogs });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartSpend full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
