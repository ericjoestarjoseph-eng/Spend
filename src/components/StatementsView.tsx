import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  AiParsedStatementResult,
  AiParsedStatementRow,
  CategoryName,
  CsvMappedRow,
  LearnedRule,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types/finance';
import { classifyTransaction } from '../engine/categorizer';
import { SAMPLE_BANK_CSV } from '../data/seedData';
import { CATEGORIES, downloadCsvFile, formatINR } from '../utils/formatters';

interface StatementsViewProps {
  existingTransactions: Transaction[];
  learnedRules: LearnedRule[];
  userId: string;
  onImportConfirm: (
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
  ) => Promise<void>;
}

const SAMPLE_STATEMENT_TEXT = `HDFC BANK SAVINGS ACCOUNT STATEMENT (NOV 01, 2026 - NOV 17, 2026)
Account Holder: Arjun Mehta | Branch: Indiranagar, Bengaluru
02/11/2026  UPI-SWIGGY-ORDER-883921       Debit   Rs. 645.00
05/11/2026  UPI-UBER INDIA SYSTEMS        Debit   Rs. 390.00
07/11/2026  NEFT CR-FREELANCE DESIGN FEE  Credit  Rs. 14,500.00
10/11/2026  BESCOM ELECTRICITY ONLINE     Debit   Rs. 2,140.00
12/11/2026  AMAZON PAY INDIA RETAIL       Debit   Rs. 3,299.00
14/11/2026  APOLLO PHARMACY BENGALURU     Debit   Rs. 760.00
16/11/2026  UPI-BOOKMYSHOW PVR IMAX       Debit   Rs. 840.00`;

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  }
  return rows;
}

function normalizeDateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function StatementsView({
  existingTransactions,
  learnedRules,
  userId,
  onImportConfirm,
}: StatementsViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'ai' | 'csv'>('ai');

  // Shared status
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // AI Statement Parser state
  const [rawPasteText, setRawPasteText] = useState('');
  const [aiFileName, setAiFileName] = useState<string | null>(null);
  const [aiFileFormat, setAiFileFormat] = useState<'pdf' | 'image' | 'text' | 'csv'>('text');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiResult, setAiResult] = useState<AiParsedStatementResult | null>(null);
  const [aiRows, setAiRows] = useState<AiParsedStatementRow[]>([]);

  // CSV Column Mapper state
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState(0);
  const [descCol, setDescCol] = useState(1);
  const [amountCol, setAmountCol] = useState(2);
  const [typeCol, setTypeCol] = useState(3);
  const [methodCol, setMethodCol] = useState(4);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<number, CategoryName>>({});
  const [includeOverrides, setIncludeOverrides] = useState<Record<number, boolean>>({});

  const existingKeys = useMemo(() => {
    return new Set(
      existingTransactions.map(
        (t) => `${t.date}|${Math.round(t.amount * 100)}|${t.description.trim().toLowerCase()}`
      )
    );
  }, [existingTransactions]);

  // Run AI Statement Parser API
  const runAiStatementParse = async (payload: {
    fileName: string;
    format: 'pdf' | 'image' | 'text' | 'csv';
    mimeType?: string;
    base64Data?: string;
    rawText?: string;
  }) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsParsingAi(true);
    setAiFileName(payload.fileName);
    setAiFileFormat(payload.format);

    try {
      const res = await fetch('/api/statements/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Data: payload.base64Data,
          rawText: payload.rawText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze statement.');
      }

      const parsed = data as AiParsedStatementResult;
      setAiResult(parsed);
      setAiRows(parsed.transactions ?? []);
      if ((parsed.transactions ?? []).length === 0) {
        setErrorMsg(
          'The statement was read, but no individual transaction rows could be identified.'
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Statement parsing failed.');
      setAiResult(null);
      setAiRows([]);
    } finally {
      setIsParsingAi(false);
    }
  };

  // Load CSV into structured mapper
  const loadCsvIntoMapper = (name: string, content: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCategoryOverrides({});
    setIncludeOverrides({});
    const matrix = parseCsvLines(content);
    if (matrix.length < 2) {
      setErrorMsg('CSV file must include a header row and at least one transaction row.');
      return;
    }
    const headers = matrix[0];
    setCsvFileName(name);
    setRawHeaders(headers);
    setRawRows(matrix.slice(1));

    const lower = headers.map((h) => h.toLowerCase());
    const findIdx = (patterns: string[], fallback: number) => {
      const found = lower.findIndex((h) => patterns.some((p) => h.includes(p)));
      return found >= 0 ? found : Math.min(fallback, headers.length - 1);
    };
    setDateCol(findIdx(['date', 'txn date', 'posted'], 0));
    setDescCol(findIdx(['description', 'narration', 'merchant', 'particulars'], 1));
    setAmountCol(findIdx(['amount', 'amt', 'value', 'debit'], 2));
    setTypeCol(lower.findIndex((h) => h.includes('type') || h.includes('dr/cr')));
    setMethodCol(lower.findIndex((h) => h.includes('method') || h.includes('mode')));
  };

  const handleUniversalFile = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.csv') && mode === 'csv') {
      const text = await file.text();
      loadCsvIntoMapper(file.name, text);
      return;
    }

    if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
      const text = await file.text();
      await runAiStatementParse({
        fileName: file.name,
        format: lowerName.endsWith('.csv') ? 'csv' : 'text',
        rawText: text,
      });
      return;
    }

    if (lowerName.endsWith('.pdf')) {
      const base64Data = await fileToBase64(file);
      await runAiStatementParse({
        fileName: file.name,
        format: 'pdf',
        mimeType: 'application/pdf',
        base64Data,
      });
      return;
    }

    if (
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp')
    ) {
      const base64Data = await fileToBase64(file);
      await runAiStatementParse({
        fileName: file.name,
        format: 'image',
        mimeType: file.type || 'image/png',
        base64Data,
      });
      return;
    }

    setErrorMsg('Unsupported file format. Upload PDF, PNG/JPG/WEBP, CSV, or TXT.');
  };

  // CSV mapped preview rows
  const mappedCsvRows = useMemo<CsvMappedRow[]>(() => {
    return rawRows.map((cells, idx) => {
      const rawDate = cells[dateCol] ?? '';
      const rawDescription = cells[descCol] ?? '';
      const rawAmount = cells[amountCol] ?? '';
      const rawType = typeCol >= 0 ? (cells[typeCol] ?? '').toLowerCase() : '';
      const rawMethod = methodCol >= 0 ? (cells[methodCol] ?? '') : 'UPI';

      const parsedDate = normalizeDateInput(rawDate);
      const cleanedAmount = Number(rawAmount.replace(/[₹,\s]/g, ''));
      const hasValidAmount = !Number.isNaN(cleanedAmount) && cleanedAmount !== 0;

      const parsedType: TransactionType =
        rawType.includes('income') || rawType.includes('credit') || rawType === 'cr'
          ? 'income'
          : 'expense';

      const absAmount = hasValidAmount ? Math.abs(cleanedAmount) : null;
      const isValid = Boolean(
        parsedDate && rawDescription.trim().length > 1 && absAmount && absAmount > 0
      );
      let validationError: string | undefined;
      if (!parsedDate) validationError = 'Invalid date (YYYY-MM-DD or DD/MM/YYYY)';
      else if (rawDescription.trim().length <= 1) validationError = 'Missing description';
      else if (!absAmount || absAmount <= 0) validationError = 'Invalid numeric amount';

      const dupKey =
        parsedDate && absAmount
          ? `${parsedDate}|${Math.round(absAmount * 100)}|${rawDescription.trim().toLowerCase()}`
          : '';
      const isDuplicate = Boolean(dupKey && existingKeys.has(dupKey));

      const prediction = classifyTransaction(rawDescription, parsedType, learnedRules);
      const overriddenCat = categoryOverrides[idx];
      const finalCategory = overriddenCat ?? prediction.category;

      const defaultInclude = isValid && !isDuplicate;
      const include = idx in includeOverrides ? includeOverrides[idx] && isValid : defaultInclude;

      const validMethods: PaymentMethod[] = [
        'UPI',
        'Debit Card',
        'Credit Card',
        'NetBanking',
        'Cash',
      ];
      const paymentMethod: PaymentMethod = validMethods.includes(rawMethod as PaymentMethod)
        ? (rawMethod as PaymentMethod)
        : 'UPI';

      return {
        rowIndex: idx,
        rawDate,
        rawDescription,
        rawAmount,
        parsedDate,
        parsedAmount: absAmount,
        parsedType,
        paymentMethod,
        predictedCategory: finalCategory,
        confidence: overriddenCat ? 1 : prediction.confidence,
        needsReview: overriddenCat ? false : prediction.needsReview,
        isValid,
        validationError,
        isDuplicate,
        include,
      };
    });
  }, [
    rawRows,
    dateCol,
    descCol,
    amountCol,
    typeCol,
    methodCol,
    existingKeys,
    learnedRules,
    categoryOverrides,
    includeOverrides,
  ]);

  const aiSummary = useMemo(() => {
    const selected = aiRows.filter((r) => r.include);
    const income = selected
      .filter((r) => r.type === 'income')
      .reduce((s, r) => s + r.amount, 0);
    const expense = selected
      .filter((r) => r.type === 'expense')
      .reduce((s, r) => s + r.amount, 0);
    const duplicates = aiRows.filter((r) => r.isDuplicate).length;
    return { selectedCount: selected.length, income, expense, net: income - expense, duplicates };
  }, [aiRows]);

  const handleConfirmAiImport = async () => {
    const selected = aiRows.filter((r) => r.include);
    if (selected.length === 0) return;

    setIsImporting(true);
    const now = new Date().toISOString();
    const newTxs: Transaction[] = selected.map((r, i) => ({
      id: `stmt_${Date.now()}_${i}`,
      userId,
      description: r.description,
      amount: r.amount,
      date: r.date,
      type: r.type,
      category: r.category,
      predictedCategory: r.category,
      confidence: r.confidence,
      needsReview: r.needsReview,
      manuallyCorrected: false,
      paymentMethod: r.paymentMethod,
      notes: r.notes,
      source: 'csv_import',
      createdAt: now,
    }));

    try {
      await onImportConfirm(newTxs, {
        fileName: aiFileName || 'pasted_statement.txt',
        format: aiFileFormat === 'csv' ? 'csv' : aiFileFormat,
        parserMode: 'ai_gemini',
        totalExtracted: aiRows.length,
        duplicatesSkipped: aiRows.filter((r) => r.isDuplicate && !r.include).length,
        statementPeriod: aiResult?.statementPeriod,
        bankOrSource: aiResult?.bankOrSource,
      });
      setSuccessMsg(
        `Saved ${newTxs.length} categorized transactions from ${
          aiResult?.bankOrSource || 'your statement'
        } into your ledger and logged the import.`
      );
      setAiResult(null);
      setAiRows([]);
      setRawPasteText('');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmCsvImport = async () => {
    const toImport = mappedCsvRows.filter((r) => r.include && r.parsedDate && r.parsedAmount);
    if (toImport.length === 0) return;

    setIsImporting(true);
    const now = new Date().toISOString();
    const newTxs: Transaction[] = toImport.map((r, i) => ({
      id: `imp_${Date.now()}_${i}`,
      userId,
      description: r.rawDescription.trim(),
      amount: r.parsedAmount!,
      date: r.parsedDate!,
      type: r.parsedType,
      category: r.predictedCategory,
      predictedCategory: r.predictedCategory,
      confidence: r.confidence,
      needsReview: r.needsReview,
      manuallyCorrected: r.rowIndex in categoryOverrides,
      paymentMethod: r.paymentMethod,
      source: 'csv_import',
      createdAt: now,
    }));

    try {
      await onImportConfirm(newTxs, {
        fileName: csvFileName || 'statement.csv',
        format: 'csv',
        parserMode: 'csv_mapper',
        totalExtracted: mappedCsvRows.length,
        duplicatesSkipped: mappedCsvRows.filter((r) => r.isDuplicate && !r.include).length,
        bankOrSource: 'CSV Statement Upload',
      });
      setSuccessMsg(`Imported ${newTxs.length} transactions into your ledger.`);
      setRawRows([]);
      setRawHeaders([]);
      setCsvFileName(null);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Bank & UPI Statement Processor
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Upload PDFs, screenshots, text statements, or CSV exports to extract, categorize, and
            analyze your finances.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              mode === 'ai' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-700" />
            AI Universal Statement Parser (PDF / Image / Text)
          </button>
          <button
            type="button"
            onClick={() => setMode('csv')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              mode === 'csv' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-600" />
            Structured CSV Column Mapper
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={mode === 'csv' ? '.csv,text/csv' : '.pdf,.png,.jpg,.jpeg,.webp,.csv,.txt'}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUniversalFile(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {mode === 'ai' ? (
        <>
          {/* Upload + Paste Split */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-6 rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">
                1. Upload Statement File (PDF, Screenshot, CSV, TXT)
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Supports HDFC, ICICI, SBI, Axis, Kotak PDFs, GPay/PhonePe screenshots, or raw exports.
              </p>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleUniversalFile(f);
                }}
                className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center transition-colors hover:border-teal-600 hover:bg-teal-50/30"
              >
                {isParsingAi ? (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
                    <p className="mt-3 text-sm font-medium text-slate-800">
                      Extracting transactions & insights from {aiFileName}...
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Classifying merchants across all 12 SmartSpend categories
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-teal-700" />
                    <p className="mt-2.5 text-sm font-medium text-slate-800">
                      Drop PDF, statement image, or CSV here
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Processed securely server-side · Automatic duplicate detection
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                    >
                      Browse Statement File
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="col-span-6 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    2. Or Paste Raw Bank / UPI Statement Text
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRawPasteText(SAMPLE_STATEMENT_TEXT)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Load Sample Text
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Copy rows directly from netbanking, PDF viewer, or SMS alerts.
                </p>
                <textarea
                  rows={7}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder="Paste lines such as: 12/11/2026 UPI-SWIGGY Debit Rs. 480.00..."
                  className="mt-3 w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={isParsingAi || rawPasteText.trim().length < 10}
                  onClick={() =>
                    void runAiStatementParse({
                      fileName: 'pasted_statement.txt',
                      format: 'text',
                      rawText: rawPasteText,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isParsingAi ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Analyze Statement Text
                </button>
              </div>
            </div>
          </div>

          {/* AI Statement Analysis Output & Review */}
          {aiResult && aiRows.length > 0 && (
            <div className="space-y-5">
              {/* Statement Summary + Insights */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-5 rounded-xl border border-slate-200 bg-white p-6">
                  <p className="text-xs font-medium text-slate-500">Statement Detected</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    {aiResult.bankOrSource}
                  </h3>
                  <p className="text-xs text-slate-500">{aiResult.statementPeriod}</p>

                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 font-mono tabular-nums">
                    <div>
                      <span className="block font-sans text-[11px] text-slate-500">Credits</span>
                      <span className="text-sm font-semibold text-emerald-700">
                        +{formatINR(aiSummary.income)}
                      </span>
                    </div>
                    <div>
                      <span className="block font-sans text-[11px] text-slate-500">Debits</span>
                      <span className="text-sm font-semibold text-slate-900">
                        -{formatINR(aiSummary.expense)}
                      </span>
                    </div>
                    <div>
                      <span className="block font-sans text-[11px] text-slate-500">Net Flow</span>
                      <span
                        className={`text-sm font-semibold ${
                          aiSummary.net >= 0 ? 'text-teal-700' : 'text-rose-700'
                        }`}
                      >
                        {formatINR(aiSummary.net)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-span-7 rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Statement Financial Insights
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    {aiResult.insights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Extracted Transactions Review Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Extracted Transactions Review ({aiRows.length} rows)
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {aiSummary.selectedCount} selected to save · {aiSummary.duplicates} duplicate
                      matches skipped by default
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isImporting || aiSummary.selectedCount === 0}
                    onClick={() => void handleConfirmAiImport()}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:bg-slate-300"
                  >
                    {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Save {aiSummary.selectedCount} Transactions to Ledger
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 pl-6 pr-2">Save</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Description</th>
                        <th className="px-3 py-2.5">Category</th>
                        <th className="px-3 py-2.5">Method</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="py-2.5 pl-3 pr-6 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {aiRows.map((row, idx) => (
                        <tr
                          key={`${row.date}_${idx}`}
                          className={row.isDuplicate ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'}
                        >
                          <td className="py-2.5 pl-6 pr-2">
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={(e) =>
                                setAiRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, include: e.target.checked } : r
                                  )
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-teal-700"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {row.description}
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={row.category}
                              onChange={(e) =>
                                setAiRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          category: e.target.value as CategoryName,
                                          confidence: 1,
                                          needsReview: false,
                                        }
                                      : r
                                  )
                                )
                              }
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-teal-700 focus:outline-none"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{row.paymentMethod}</td>
                          <td className="px-3 py-2.5">
                            {row.isDuplicate ? (
                              <span className="font-medium text-amber-700">Duplicate</span>
                            ) : (
                              <span className="font-mono text-slate-600 tabular-nums">
                                {Math.round(row.confidence * 100)}% conf
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 pl-3 pr-6 text-right font-mono font-medium tabular-nums whitespace-nowrap ${
                              row.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {row.type === 'income' ? '+' : '-'}
                            {formatINR(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Structured CSV Mode */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-8 rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Upload Structured CSV Export
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Map custom bank CSV columns directly, validate rows, and skip duplicate records.
              </p>

              <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center">
                <FileSpreadsheet className="h-7 w-7 text-teal-700" />
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {csvFileName ? `Loaded: ${csvFileName}` : 'Choose a .csv statement file'}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                  >
                    Browse CSV File
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      loadCsvIntoMapper('sample_hdfc_upi_nov2026.csv', SAMPLE_BANK_CSV)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Load Sample Bank CSV
                  </button>
                </div>
              </div>
            </div>

            <div className="col-span-4 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">CSV Template</h3>
                <p className="mt-1.5 text-xs text-slate-500">
                  Download a ready-to-use CSV template with Date, Description, Amount, Type, and
                  PaymentMethod columns.
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadCsvFile('smartspend_template.csv', SAMPLE_BANK_CSV)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5" />
                Download Sample CSV Template
              </button>
            </div>
          </div>

          {rawHeaders.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Column Mapping & Preview
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {mappedCsvRows.filter((r) => r.include).length} ready to import ·{' '}
                      {mappedCsvRows.filter((r) => r.isDuplicate).length} duplicate ·{' '}
                      {mappedCsvRows.filter((r) => !r.isValid).length} invalid
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isImporting || mappedCsvRows.filter((r) => r.include).length === 0}
                    onClick={() => void handleConfirmCsvImport()}
                    className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:bg-slate-300"
                  >
                    Import {mappedCsvRows.filter((r) => r.include).length} Transactions
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-3">
                  {[
                    { label: 'Date Column', val: dateCol, set: setDateCol, optional: false },
                    { label: 'Description Column', val: descCol, set: setDescCol, optional: false },
                    { label: 'Amount Column', val: amountCol, set: setAmountCol, optional: false },
                    { label: 'Type Column', val: typeCol, set: setTypeCol, optional: true },
                    { label: 'Method Column', val: methodCol, set: setMethodCol, optional: true },
                  ].map((m) => (
                    <div key={m.label}>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        {m.label}
                      </label>
                      <select
                        value={m.val}
                        onChange={(e) => m.set(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        {m.optional && <option value={-1}>Not mapped</option>}
                        {rawHeaders.map((h, i) => (
                          <option key={`${h}_${i}`} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 pl-6 pr-2">Include</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5">Predicted Category</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="py-2.5 pl-3 pr-6 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {mappedCsvRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={
                          !row.isValid
                            ? 'bg-rose-50/40'
                            : row.isDuplicate
                            ? 'bg-amber-50/40'
                            : 'hover:bg-slate-50/70'
                        }
                      >
                        <td className="py-2.5 pl-6 pr-2">
                          <input
                            type="checkbox"
                            disabled={!row.isValid}
                            checked={row.include}
                            onChange={(e) =>
                              setIncludeOverrides((prev) => ({
                                ...prev,
                                [row.rowIndex]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-teal-700"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 tabular-nums">
                          {row.parsedDate ?? row.rawDate}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {row.rawDescription}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.isValid ? (
                            <select
                              value={row.predictedCategory}
                              onChange={(e) =>
                                setCategoryOverrides((prev) => ({
                                  ...prev,
                                  [row.rowIndex]: e.target.value as CategoryName,
                                }))
                              }
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {!row.isValid ? (
                            <span className="font-medium text-rose-700">{row.validationError}</span>
                          ) : row.isDuplicate ? (
                            <span className="font-medium text-amber-700">Duplicate</span>
                          ) : (
                            <span className="text-emerald-700">Ready</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-3 pr-6 text-right font-mono font-medium tabular-nums">
                          {row.parsedAmount ? formatINR(row.parsedAmount) : row.rawAmount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
