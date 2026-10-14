import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Download, 
  FileCheck, 
  Layers, 
  ArrowRight,
  RefreshCw,
  Landmark
} from 'lucide-react';
import { 
  parseBankStatementFile, 
  downloadBankSampleTemplate 
} from '../../utils/bankStatementParser';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';

export default function BankStatementImportModal({ isOpen, onClose, initialBank = 'idbi' }) {
  const { saveBankStatements } = useData();
  const { showToast } = useToast();

  const [selectedBank, setSelectedBank] = useState(initialBank.toLowerCase() === 'sbi' ? 'sbi' : 'idbi');
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importMode, setImportMode] = useState('replace'); // 'replace' | 'append'
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleBankChange = (bank) => {
    setSelectedBank(bank);
    // Reset file if already uploaded so it re-parses with the correct bank rules
    if (file) {
      parseSelectedFile(file, bank);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseSelectedFile(selectedFile, selectedBank);
    }
  };

  const parseSelectedFile = async (fileToParse, bank) => {
    setIsParsing(true);
    setParseError('');
    setParsedData(null);

    try {
      const result = await parseBankStatementFile(fileToParse, bank);
      setParsedData(result);
    } catch (err) {
      console.error('Bank Statement Parse Error:', err);
      setParseError(err.message || 'Failed to parse bank statement spreadsheet.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseSelectedFile(droppedFile, selectedBank);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData || !parsedData.transactions || parsedData.transactions.length === 0) {
      showToast('No parsed transactions to import', 'error');
      return;
    }

    try {
      saveBankStatements(selectedBank, parsedData.transactions, importMode);
      showToast(
        `Successfully imported ${parsedData.transactions.length} ${selectedBank.toUpperCase()} statement transactions (${importMode === 'replace' ? 'Replaced' : 'Appended'})`,
        'success'
      );
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Failed to save statement entries', 'error');
    }
  };

  const isSbi = selectedBank === 'sbi';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-brand-400 flex items-center justify-center border border-white/10 shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Import Bank Statement Excel</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official statement parser configured for SBI & IDBI passbook formats
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Step 1: Bank Selection & Sample Template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Target Bank Account
              </label>
              <button
                type="button"
                onClick={() => downloadBankSampleTemplate(selectedBank)}
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-semibold transition-colors"
                title="Download pre-formatted Excel template"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {isSbi ? 'SBI' : 'IDBI'} Sample Excel</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* IDBI Option */}
              <div
                onClick={() => handleBankChange('idbi')}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative ${
                  selectedBank === 'idbi'
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🏦</span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">IDBI Bank</h4>
                      <p className="text-[11px] text-slate-500 font-mono">Current Account</p>
                    </div>
                  </div>
                  {selectedBank === 'idbi' && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[10px] text-slate-600 font-mono">
                  <strong>Expected Headers:</strong> Srl, Txn Date, Value Date, Description, Cheque No, CR/DR, CCY, Amount (INR), Balance (INR), Remark, Description
                </div>
              </div>

              {/* SBI Option */}
              <div
                onClick={() => handleBankChange('sbi')}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative ${
                  selectedBank === 'sbi'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🏛️</span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">State Bank of India (SBI)</h4>
                      <p className="text-[11px] text-slate-500 font-mono">Current Account</p>
                    </div>
                  </div>
                  {selectedBank === 'sbi' && (
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[10px] text-slate-600 font-mono">
                  <strong>Expected Headers:</strong> Txn Date, Value Date, Description, Ref No./Cheque No., Branch Code, Debit, Credit, Balance, Remark, Description
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Upload File Area */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              2. Upload Statement File (.xlsx, .xls, .csv)
            </label>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-brand-500 bg-slate-50/70 hover:bg-blue-50/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 text-slate-600 group-hover:text-brand-600 group-hover:border-brand-300 flex items-center justify-center transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                {file ? (
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      {(file.size / 1024).toFixed(1)} KB • Click or drag another file to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Click to browse or drag and drop statement file here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports direct downloads from {isSbi ? 'SBI Online (Net Banking)' : 'IDBI Internet Banking'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parsing State & Errors */}
          {isParsing && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-center gap-2 text-xs font-semibold text-blue-700 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Scanning and parsing bank columns...</span>
            </div>
          )}

          {parseError && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error reading bank statement</p>
                <p className="mt-0.5 text-rose-700">{parseError}</p>
                <button
                  type="button"
                  onClick={() => downloadBankSampleTemplate(selectedBank)}
                  className="mt-2 text-xs font-bold text-rose-900 underline hover:no-underline"
                >
                  Download {isSbi ? 'SBI' : 'IDBI'} Sample Excel Template to check required column format
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Parsed Data Preview & Summary */}
          {parsedData && parsedData.transactions && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Statement Verification & Preview
                </label>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Valid Statement ({parsedData.transactions.length} rows)</span>
                </span>
              </div>

              {/* Metrics Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Records</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {parsedData.transactions.length}
                  </span>
                </div>

                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Credits (In)</span>
                  <span className="text-lg font-black text-emerald-700 font-mono">
                    +{formatCurrency(parsedData.summary.totalCredit)}
                  </span>
                </div>

                <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Total Debits (Out)</span>
                  <span className="text-lg font-black text-rose-700 font-mono">
                    -{formatCurrency(parsedData.summary.totalDebit)}
                  </span>
                </div>

                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Closing Balance</span>
                  <span className="text-lg font-black text-blue-900 font-mono">
                    {formatCurrency(parsedData.summary.closingBalance)}
                  </span>
                </div>
              </div>

              {/* Preview Table: First 5 Rows */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Preview (First {Math.min(5, parsedData.transactions.length)} Rows)</span>
                  <span className="text-slate-400 text-[11px] font-mono">
                    Period: {parsedData.summary.fromDate || 'N/A'} to {parsedData.summary.toDate || 'N/A'}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-52">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                      {isSbi ? (
                        <tr>
                          <th className="px-3 py-2">Txn Date</th>
                          <th className="px-3 py-2">Value Date</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2">Ref No./Cheque No.</th>
                          <th className="px-3 py-2">Branch Code</th>
                          <th className="px-3 py-2 text-right">Debit</th>
                          <th className="px-3 py-2 text-right">Credit</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                          <th className="px-3 py-2">Remark</th>
                          <th className="px-3 py-2">Description</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3 py-2">Srl</th>
                          <th className="px-3 py-2">Txn Date</th>
                          <th className="px-3 py-2">Value Date</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2">Cheque No</th>
                          <th className="px-3 py-2 text-center">CR/DR</th>
                          <th className="px-3 py-2 text-center">CCY</th>
                          <th className="px-3 py-2 text-right">Amount (INR)</th>
                          <th className="px-3 py-2 text-right">Balance (INR)</th>
                          <th className="px-3 py-2">Remark</th>
                          <th className="px-3 py-2">Description</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {parsedData.transactions.slice(0, 5).map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {isSbi ? (
                            <>
                              <td className="px-3 py-1.5">{t.txnDate}</td>
                              <td className="px-3 py-1.5">{t.valueDate}</td>
                              <td className="px-3 py-1.5 font-sans truncate max-w-[200px]" title={t.description}>{t.description}</td>
                              <td className="px-3 py-1.5">{t.refNo || '-'}</td>
                              <td className="px-3 py-1.5">{t.branchCode || '-'}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-rose-700">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-emerald-700">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-slate-800">{formatCurrency(t.balance)}</td>
                              <td className="px-3 py-1.5 font-sans">{t.remark || '-'}</td>
                              <td className="px-3 py-1.5 font-sans">{t.secondaryDescription || '-'}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5">{t.srl || idx + 1}</td>
                              <td className="px-3 py-1.5">{t.txnDate}</td>
                              <td className="px-3 py-1.5">{t.valueDate}</td>
                              <td className="px-3 py-1.5 font-sans truncate max-w-[200px]" title={t.description}>{t.description}</td>
                              <td className="px-3 py-1.5">{t.chequeNo || t.refNo || '-'}</td>
                              <td className="px-3 py-1.5 text-center font-bold">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.crDr === 'CR' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {t.crDr}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center">{t.ccy || 'INR'}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-slate-900">{formatCurrency(t.amount)}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-slate-800">{formatCurrency(t.balance)}</td>
                              <td className="px-3 py-1.5 font-sans">{t.remark || '-'}</td>
                              <td className="px-3 py-1.5 font-sans">{t.secondaryDescription || '-'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 4: Import Options (Replace vs Append) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">Import Mode:</span>
                  <span className="text-slate-500 text-[11px]">
                    Choose how to merge these {parsedData.transactions.length} records into your {selectedBank.toUpperCase()} ledger
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Replace Existing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Append / Add</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!parsedData || !parsedData.transactions || parsedData.transactions.length === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Confirm & Import Statement</span>
          </button>
        </div>
      </div>
    </div>
  );
}
