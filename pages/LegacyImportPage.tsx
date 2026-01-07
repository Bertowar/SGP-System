
import React, { useState, useEffect, useMemo } from 'react';
import { Upload, FileText, Trash2, Calculator, Table as TableIcon, Loader2, ArrowLeft, Building2, Store, Calendar, AlertTriangle, Sigma, Layers, Search, Filter, Package, Database, X, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useQueries';
import { processSalesImport, SalesImportItem } from '../services/storage';

// Interfaces for Report Data
interface ReportItem {
    _id: number;
    ID: string;
    REFERENCIA: string;
    DESCRICAO: string; // Captured description
    LINHA: string;     // Extracted last word (LEVE, ULTRA, NOBRE)
    QTDADE: string;
    TOTAL: string;
    qtyValue: number;
    totalValue: number;
}

interface ReportSummary {
    totalQty: number;
    totalValue: number;
    totalIPI: number;
    fileName: string;
    fileSize: string;
    period: string;
    rawPeriod: string;
    identity?: string;
}

// Interface for Merged Items
interface ConsolidatedItem {
    id: string;
    reference: string;
    line: string;
    origin: 'MATRIZ' | 'FILIAL' | 'AMBOS';
    qtyMatriz: number;
    qtyFilial: number;
    qtyTotal: number;
    valMatriz: number;
    valFilial: number;
    valTotal: number;
    splitString: string;
    category: string;
    isCellRed: boolean;
    isRowRed: boolean;
}

// Interface for Product Aggregation (Tab D)
interface ProductSummaryItem {
    reference: string;
    nobreId: string;
    qtyMatriz: number;
    valMatriz: number;
    qtyFilial: number;
    valFilial: number;
    qtyTotal: number;
    valTotal: number;
    isSystemCode: boolean;
}

const LegacyImportPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D'>('A');
    const [isParsing, setIsParsing] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // Database Saving State
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState<{ message: string; isError: boolean } | null>(null);
    const [forceSave, setForceSave] = useState(false);

    // Fetch System Products for Cross-Referencing
    const { data: systemProducts = [] } = useProducts();
    const [divergenceAlert, setDivergenceAlert] = useState<string | null>(null);

    // Helper to extract date from the period string (e.g. "01/05/2026 a 15/05/2026")
    const extractDateFromPeriod = (periodStr: string): string => {
        try {
            const parts = periodStr.split(' a ');
            const dateStr = parts.length > 1 ? parts[1].trim() : parts[0].trim();
            const [d, m, y] = dateStr.split('/');
            return `${y}-${m}-${d}`;
        } catch {
            return new Date().toISOString().split('T')[0];
        }
    };

    const sanitizeReportItems = (items: any[]): ReportItem[] => {
        if (!Array.isArray(items)) return [];
        return items.filter(i => i && typeof i === 'object').map(i => ({
            _id: Number(i._id) || 0,
            ID: String(i.ID || ''),
            REFERENCIA: String(i.REFERENCIA || ''),
            DESCRICAO: String(i.DESCRICAO || ''),
            LINHA: String(i.LINHA || ''),
            QTDADE: String(i.QTDADE || '0'),
            TOTAL: String(i.TOTAL || '0'),
            qtyValue: Number(i.qtyValue) || 0,
            totalValue: Number(i.totalValue) || 0
        }));
    };

    const defaultSummary: ReportSummary = {
        totalQty: 0, totalValue: 0, totalIPI: 0, fileName: '', fileSize: '', period: '', rawPeriod: '', identity: ''
    };

    const [reportA, setReportA] = useState<ReportItem[]>(() => {
        try {
            const saved = localStorage.getItem('pplast_import_reportA');
            return saved ? sanitizeReportItems(JSON.parse(saved)) : [];
        } catch (e) { return []; }
    });

    const [summaryA, setSummaryA] = useState<ReportSummary>(() => {
        try {
            const saved = localStorage.getItem('pplast_import_summaryA');
            const parsed = saved ? JSON.parse(saved) : null;
            return (parsed && typeof parsed === 'object') ? parsed : defaultSummary;
        } catch (e) { return defaultSummary; }
    });

    const [reportB, setReportB] = useState<ReportItem[]>(() => {
        try {
            const saved = localStorage.getItem('pplast_import_reportB');
            return saved ? sanitizeReportItems(JSON.parse(saved)) : [];
        } catch (e) { return []; }
    });

    const [summaryB, setSummaryB] = useState<ReportSummary>(() => {
        try {
            const saved = localStorage.getItem('pplast_import_summaryB');
            const parsed = saved ? JSON.parse(saved) : null;
            return (parsed && typeof parsed === 'object') ? parsed : defaultSummary;
        } catch (e) { return defaultSummary; }
    });

    useEffect(() => { localStorage.setItem('pplast_import_reportA', JSON.stringify(reportA)); }, [reportA]);
    useEffect(() => { localStorage.setItem('pplast_import_summaryA', JSON.stringify(summaryA)); }, [summaryA]);
    useEffect(() => { localStorage.setItem('pplast_import_reportB', JSON.stringify(reportB)); }, [reportB]);
    useEffect(() => { localStorage.setItem('pplast_import_summaryB', JSON.stringify(summaryB)); }, [summaryB]);

    const [filters, setFilters] = useState({ id: '', ref: '', line: '', origin: '' });
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'LEVE' | 'ULTRA' | 'NOBRE' | null>(null);

    const parseBRNumber = (str: string) => {
        if (!str || typeof str !== 'string') return 0;
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    };

    useEffect(() => {
        const rawA = summaryA?.rawPeriod;
        const rawB = summaryB?.rawPeriod;
        if (rawA && rawB && rawA !== rawB) {
            setDivergenceAlert(`Atenção: As datas dos relatórios não conferem!\n\nMatriz: ${summaryA.period}\nFilial: ${summaryB.period}`);
        } else {
            setDivergenceAlert(null);
        }
    }, [summaryA, summaryB]);

    // 1. Consolidated Data Base
    const consolidatedData = useMemo(() => {
        const map = new Map<string, ConsolidatedItem>();
        (reportA || []).forEach(item => {
            const itemId = String(item.ID || '');
            if (!itemId) return;
            map.set(itemId, {
                id: itemId, reference: String(item.REFERENCIA || ''), line: String(item.LINHA || ''),
                origin: 'MATRIZ', qtyMatriz: Number(item.qtyValue || 0), qtyFilial: 0,
                qtyTotal: Number(item.qtyValue || 0), valMatriz: Number(item.totalValue || 0),
                valFilial: 0, valTotal: Number(item.totalValue || 0), splitString: '',
                category: String(item.LINHA || ''), isCellRed: false, isRowRed: false
            });
        });

        (reportB || []).forEach(item => {
            const itemId = String(item.ID || '');
            if (!itemId) return;
            if (map.has(itemId)) {
                const existing = map.get(itemId)!;
                existing.origin = 'AMBOS';
                existing.qtyFilial = Number(item.qtyValue || 0);
                existing.qtyTotal += Number(item.qtyValue || 0);
                existing.valFilial = Number(item.totalValue || 0);
                existing.valTotal += Number(item.totalValue || 0);
                if (!existing.line && item.LINHA) {
                    existing.line = String(item.LINHA);
                    existing.category = String(item.LINHA);
                }
            } else {
                map.set(itemId, {
                    id: itemId, reference: String(item.REFERENCIA || ''), line: String(item.LINHA || ''),
                    origin: 'FILIAL', qtyMatriz: 0, qtyFilial: Number(item.qtyValue || 0),
                    qtyTotal: Number(item.qtyValue || 0), valMatriz: 0, valFilial: Number(item.totalValue || 0),
                    valTotal: Number(item.totalValue || 0), splitString: '', category: String(item.LINHA || ''),
                    isCellRed: false, isRowRed: false
                });
            }
        });

        const items = Array.from(map.values());
        items.forEach(item => {
            const totalVal = item.valMatriz + item.valFilial;
            let pctMatriz = 0;
            if (totalVal > 0) pctMatriz = Math.round((item.valMatriz / totalVal) * 100);
            const normCat = item.category ? item.category.toUpperCase().trim() : '';
            item.splitString = normCat === 'NOBRE' ? '100' : `${pctMatriz}/${100 - pctMatriz}`;
            if (item.qtyMatriz !== item.qtyFilial && normCat !== 'NOBRE') item.isRowRed = true;
            if (!item.isRowRed) {
                if (normCat === 'LEVE' && pctMatriz !== 50) item.isCellRed = true;
                else if (normCat === 'ULTRA' && pctMatriz !== 40) item.isCellRed = true;
            }
        });
        return items.sort((a, b) => a.reference.localeCompare(b.reference));
    }, [reportA, reportB]);

    // 2. Maps and Summaries
    const referenceToConsolidatedIdMap = useMemo(() => {
        const map = new Map<string, string>();
        consolidatedData.forEach(item => { map.set(item.reference, item.id); });
        return map;
    }, [consolidatedData]);

    const productSummaryData = useMemo(() => {
        const map = new Map<string, ProductSummaryItem>();
        (consolidatedData || []).forEach(item => {
            const key = item.reference;
            if (!key) return;
            if (!map.has(key)) {
                const sysMatch = systemProducts.find(p => p.produto === item.reference);
                const sysCode = sysMatch ? sysMatch.codigo.toString() : null;
                map.set(key, {
                    reference: item.reference, nobreId: sysCode || '-', qtyMatriz: 0, valMatriz: 0,
                    qtyFilial: 0, valFilial: 0, qtyTotal: 0, valTotal: 0, isSystemCode: !!sysCode
                });
            }
            const prod = map.get(key)!;
            prod.qtyMatriz += item.qtyMatriz;
            prod.qtyFilial += item.qtyFilial;
            prod.valMatriz += item.valMatriz;
            prod.valFilial += item.valFilial;
            prod.valTotal += (item.valMatriz + item.valFilial);
            const normCat = item.category ? item.category.toUpperCase().trim() : '';
            if (normCat === 'NOBRE') prod.qtyTotal += (item.qtyMatriz + item.qtyFilial);
            else prod.qtyTotal += Math.max(item.qtyMatriz, item.qtyFilial);
            if (!prod.isSystemCode) {
                if (prod.nobreId === '-') prod.nobreId = item.id;
                else if (item.line && item.line.toUpperCase().includes('NOBRE') && (item.origin === 'MATRIZ')) prod.nobreId = item.id;
            }
        });
        return Array.from(map.values()).sort((a, b) => a.reference.localeCompare(b.reference));
    }, [consolidatedData, systemProducts]);

    const consolidatedSummary = useMemo(() => {
        const totalFilialQty = (reportB || []).reduce((acc, item) => acc + (Number(item?.qtyValue) || 0), 0);
        const totalMatrizNobreQty = (reportA || []).reduce((acc, item) => {
            return acc + (String(item?.LINHA).toUpperCase().trim() === 'NOBRE' ? (Number(item?.qtyValue) || 0) : 0);
        }, 0);
        return {
            totalQty: totalFilialQty + totalMatrizNobreQty,
            totalValue: (consolidatedData || []).reduce((acc, item) => acc + item.valTotal, 0),
            totalIPI: (summaryA?.totalIPI || 0) + (summaryB?.totalIPI || 0),
            count: (consolidatedData || []).length
        };
    }, [consolidatedData, reportA, reportB, summaryA, summaryB]);

    // 3. Handlers
    const handleSaveToDatabase = async (override: boolean = false) => {
        if (!override) setShowConfirmModal(null);
        setIsSaving(true);
        try {
            const itemsToSave: SalesImportItem[] = productSummaryData.map(item => {
                let idConsolidado = (item.nobreId && item.nobreId !== '-') ? item.nobreId : null;
                return {
                    reference: item.reference, nobreId: idConsolidado, qtyTotal: item.qtyTotal,
                    valTotal: item.valTotal, qtyMatriz: item.qtyMatriz, valMatriz: item.valMatriz,
                    qtyFilial: item.qtyFilial, valFilial: item.valFilial
                };
            });
            const periodRaw = summaryA.rawPeriod || summaryB.rawPeriod;
            if (!periodRaw) throw new Error("Não foi possível identificar a data do relatório.");
            const fileDate = extractDateFromPeriod(periodRaw);
            const metrics = { ipiMatriz: summaryA.totalIPI || 0, ipiFilial: summaryB.totalIPI || 0 };
            const result = await processSalesImport(itemsToSave, fileDate, override, metrics);
            if (result.success) {
                alert("Dados salvos com sucesso!");
                setShowPreviewModal(false);
                setShowConfirmModal(null);
            } else {
                if (result.error && (result.error.includes('DATA_RETROATIVA') || result.error.includes('VALOR_NEGATIVO'))) {
                    setForceSave(true);
                    setShowConfirmModal({ message: result.error, isError: false });
                } else { alert("Erro ao salvar: " + result.error); }
            }
        } catch (error: any) { alert("Erro inesperado: " + (error.message || error)); } finally { setIsSaving(false); }
    };

    const parseReportFile = (file: File, targetReport: 'A' | 'B') => {
        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            let text = evt.target?.result as string;
            if (!text) { setIsParsing(false); return; }
            text = text.replace(/^\uFEFF/, '');
            const matrizIdent = /MOVEIS\s+PERARO/i, filialIdent = /-\*-\s*SISTEMA\s*-\*-/i;
            let detectedIdentity = matrizIdent.test(text) ? "MOVEIS PERARO" : (filialIdent.test(text) ? "SISTEMA" : "DESCONHECIDO");
            if (targetReport === 'A' && !matrizIdent.test(text)) alert("AVISO: Relatório da MATRIZ não identificado.");
            if (targetReport === 'B' && !filialIdent.test(text)) alert("AVISO: Relatório da FILIAL não identificado.");
            const periodRegex = /Per.*?odo\s+.*?(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i;
            const headerLines = text.split(/\r?\n/).slice(0, 20).join('\n');
            const periodMatch = headerLines.match(periodRegex);
            const periodDisplay = periodMatch ? `${periodMatch[1]} a ${periodMatch[2]}` : 'Não identificado';
            const lines = text.split(/\r?\n/), data: ReportItem[] = [];
            let accQty = 0, accValue = 0;
            const itemRegex = /^(\d+)\s+(.+?)\s+([^\s]+)\s+([^\s]+)\s+CX\s+([0-9\.]+,\d+)\s+([0-9\.]+,\d{2})/;
            const ipiRegex = /(?:TOTAL|VALOR|VLR)\.?\s*(?:DO\s+)?IPI.*?\s([0-9\.]+,\d{2})/i;
            lines.forEach((line, index) => {
                const match = line.match(itemRegex);
                if (match) {
                    const id = match[1], rawDesc = match[2].trim(), ref = match[3], qtyStr = match[5], totalStr = match[6];
                    const descParts = rawDesc.split(/\s+/), extractedLine = descParts[descParts.length - 1].trim();
                    const qty = parseBRNumber(qtyStr), total = parseBRNumber(totalStr);
                    accQty += qty; accValue += total;
                    data.push({ _id: index, ID: id, REFERENCIA: ref, DESCRICAO: rawDesc, LINHA: extractedLine, QTDADE: qtyStr, TOTAL: totalStr, qtyValue: qty, totalValue: total });
                }
            });
            const ipiMatch = text.match(ipiRegex), totalIPI = ipiMatch ? parseBRNumber(ipiMatch[1]) : 0;
            const newSummary: ReportSummary = { totalQty: accQty, totalValue: accValue, totalIPI, fileName: file.name, fileSize: (file.size / 1024).toFixed(1) + ' KB', period: periodDisplay, rawPeriod: periodDisplay, identity: detectedIdentity };
            if (targetReport === 'A') { setReportA(data); setSummaryA(newSummary); }
            else { setReportB(data); setSummaryB(newSummary); }
            setIsParsing(false);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeTab !== 'C' && activeTab !== 'D') parseReportFile(file, activeTab);
        e.target.value = '';
    };

    const handleClear = () => {
        if (activeTab === 'A') { setReportA([]); setSummaryA(defaultSummary); }
        else if (activeTab === 'B') { setReportB([]); setSummaryB(defaultSummary); }
    };

    const filterData = (data: ReportItem[]) => {
        return (data || []).filter(item => {
            const matchId = !filters.id || String(item.ID || '').includes(filters.id);
            const matchRef = !filters.ref || String(item.REFERENCIA || '').toLowerCase().includes(filters.ref.toLowerCase());
            const matchLine = !filters.line || String(item.LINHA || '').toLowerCase().includes(filters.line.toLowerCase());
            return matchId && matchRef && matchLine;
        });
    };

    const filterConsolidated = (data: ConsolidatedItem[]) => {
        return (data || []).filter(item => {
            const matchId = !filters.id || String(item.id || '').includes(filters.id);
            const matchRef = !filters.ref || String(item.reference || '').toLowerCase().includes(filters.ref.toLowerCase());
            const matchCategory = !selectedCategoryFilter || item.category === selectedCategoryFilter;
            return matchId && matchRef && matchCategory;
        });
    };

    const filteredProductSummary = productSummaryData.filter(item => {
        const matchRef = !filters.ref || String(item.reference || '').toLowerCase().includes(filters.ref.toLowerCase());
        const matchId = !filters.id || String(item.nobreId || '').includes(filters.id);
        return matchRef && matchId;
    });

    const currentReport = activeTab === 'A' ? reportA : reportB;
    const currentSummary = activeTab === 'A' ? summaryA : summaryB;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <button onClick={() => navigate('/logistics')} className="text-slate-500 hover:text-brand-600 flex items-center mb-1 text-sm font-bold transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Voltar para Logística
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">Conferência Matriz vs Filial</h2>
                    <p className="text-slate-500">Importação e consolidação de relatórios de venda.</p>
                </div>
            </div>

            {divergenceAlert && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-center border-2 border-red-500">
                        <AlertTriangle size={32} className="text-red-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-red-700 mb-2">Divergência de Período</h3>
                        <p className="text-slate-700 mb-6">{divergenceAlert}</p>
                        <button onClick={() => setDivergenceAlert(null)} className="w-full bg-red-600 text-white py-2 rounded-lg font-bold">Entendido</button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
                <div className="flex border-b border-slate-200">
                    <button onClick={() => { setActiveTab('A'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all font-bold text-sm ${activeTab === 'A' ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>MATRIZ</button>
                    <button onClick={() => { setActiveTab('B'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all font-bold text-sm ${activeTab === 'B' ? 'border-purple-600 bg-purple-50 text-purple-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>FILIAL</button>
                    <button onClick={() => { setActiveTab('C'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all font-bold text-sm ${activeTab === 'C' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>CONSOLIDADO</button>
                    <button onClick={() => { setActiveTab('D'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all font-bold text-sm ${activeTab === 'D' ? 'border-green-600 bg-green-50 text-green-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>RESUMO PRODUTOS</button>
                </div>

                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {(activeTab === 'A' || activeTab === 'B') ? (
                            <div className="flex items-center gap-4">
                                {currentSummary.fileName && <span className="font-mono text-sm font-bold text-slate-700">{currentSummary.fileName}</span>}
                                {currentSummary.period && <span className="font-mono text-sm font-bold text-brand-700">{currentSummary.period}</span>}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-600 bg-white px-3 py-1.5 rounded border">
                                    Total: {activeTab === 'C' ? consolidatedSummary.count : productSummaryData.length}
                                </span>
                                {activeTab === 'C' && consolidatedData.length > 0 && (
                                    <button onClick={() => setShowPreviewModal(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Pré-visualizar Banco</button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {(activeTab === 'A' || activeTab === 'B') && (
                            <>
                                <label className={`cursor-pointer text-white px-4 py-2 rounded-lg font-bold shadow-sm ${currentReport.length > 0 ? 'bg-slate-300' : (activeTab === 'A' ? 'bg-brand-600' : 'bg-purple-600')}`}>
                                    {activeTab === 'A' ? 'Carregar Matriz' : 'Carregar Filial'}
                                    <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} disabled={currentReport.length > 0} />
                                </label>
                                {currentReport.length > 0 && <button onClick={handleClear} className="p-2 border rounded-lg hover:text-red-600" title="Limpar relatório" aria-label="Limpar relatório"><Trash2 size={18} /></button>}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-white h-[calc(100vh-300px)]">
                    {isParsing ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin mb-2" size={32} />Processando...</div>
                    ) : (
                        <div className="w-full">
                            {(activeTab === 'A' || activeTab === 'B') && (
                                currentReport.length > 0 ? (
                                    <table className="w-full text-sm text-left"><thead className="bg-slate-50 sticky top-0"><tr><th className="px-6 py-3">ID</th><th className="px-6 py-3">Referência</th><th className="px-6 py-3">Linha</th><th className="px-6 py-3 text-right">Qtd (CX)</th><th className="px-6 py-3 text-right">Total (R$)</th></tr></thead><tbody className="divide-y">{filterData(currentReport).map((row, idx) => (<tr key={idx} className="hover:bg-slate-50"><td className="px-6 py-2">{row.ID}</td><td className="px-6 py-2 font-bold">{row.REFERENCIA}</td><td className="px-6 py-2">{row.LINHA}</td><td className="px-6 py-2 text-right text-blue-600">{row.QTDADE}</td><td className="px-6 py-2 text-right text-green-700">{row.TOTAL}</td></tr>))}</tbody></table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-20 text-slate-400 opacity-60"><TableIcon size={64} className="mb-4" />Aguardando importação...</div>
                                )
                            )}
                            {activeTab === 'C' && (
                                consolidatedData.length > 0 ? (
                                    <table className="w-full text-sm text-left"><thead className="bg-slate-50 sticky top-0"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Referência</th><th className="px-4 py-3 text-right">Qtd Matriz</th><th className="px-4 py-3 text-right">Qtd Filial</th><th className="px-4 py-3 text-right">Valor TOTAL</th></tr></thead><tbody className="divide-y">{filterConsolidated(consolidatedData).map((item) => (<tr key={item.id} className={`hover:bg-slate-50 ${item.isRowRed ? 'bg-red-50' : ''}`}><td className="px-4 py-2">{item.id}</td><td className="px-4 py-2 font-bold">{item.reference}</td><td className="px-4 py-2 text-right">{item.qtyMatriz.toLocaleString('pt-BR')}</td><td className="px-4 py-2 text-right">{item.qtyFilial.toLocaleString('pt-BR')}</td><td className="px-4 py-2 text-right font-bold text-green-700">R$ {item.valTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>))}</tbody></table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-20 text-slate-400 opacity-60"><Sigma size={64} className="mb-4" />Sem dados consolidados.</div>
                                )
                            )}
                            {activeTab === 'D' && (
                                filteredProductSummary.length > 0 ? (
                                    <table className="w-full text-sm text-left"><thead className="bg-slate-50 sticky top-0"><tr><th className="px-4 py-3">Cód. Nobre</th><th className="px-4 py-3">Produto (Ref)</th><th className="px-4 py-3 text-right">Qtd Matriz</th><th className="px-4 py-3 text-right">Qtd Filial</th><th className="px-4 py-3 text-right font-extrabold text-green-800">TOTAL R$</th></tr></thead><tbody className="divide-y">{filteredProductSummary.map((item) => (<tr key={item.reference} className="hover:bg-slate-50"><td className="px-4 py-2 font-mono text-xs">{item.nobreId}</td><td className="px-4 py-2 font-bold">{item.reference}</td><td className="px-4 py-2 text-right text-blue-600">{item.qtyMatriz.toLocaleString('pt-BR')}</td><td className="px-4 py-2 text-right text-purple-600">{item.qtyFilial.toLocaleString('pt-BR')}</td><td className="px-4 py-2 text-right font-extrabold text-green-700">R$ {item.valTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>))}</tbody></table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-20 text-slate-400 opacity-60"><Package size={64} className="mb-4" />Sem produtos para exibir.</div>
                                )
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 border-t p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white border p-3 rounded-lg shadow-sm"><p className="text-[10px] uppercase text-slate-400 font-bold">Total Global (CX)</p><p className="text-xl font-bold text-slate-700">{consolidatedSummary.totalQty.toLocaleString('pt-BR')}</p></div>
                        <div className="bg-white border p-3 rounded-lg shadow-sm"><p className="text-[10px] uppercase text-slate-400 font-bold">Valor Total (R$)</p><p className="text-xl font-bold text-green-700">R$ {consolidatedSummary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                        <div className="bg-white border p-3 rounded-lg shadow-sm"><p className="text-[10px] uppercase text-slate-400 font-bold">IPI Acumulado</p><p className="text-xl font-bold text-orange-700">R$ {consolidatedSummary.totalIPI.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                        <div className="bg-indigo-600 text-white p-3 rounded-lg shadow-sm"><p className="text-[10px] uppercase text-indigo-200 font-bold">Líquido + IPI</p><p className="text-xl font-extrabold">R$ {(consolidatedSummary.totalValue + consolidatedSummary.totalIPI).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    </div>
                </div>
            </div>

            {showPreviewModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center"><h3 className="text-lg font-bold">Pré-visualização para Gravação</h3><button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-200 rounded-full" title="Fechar pré-visualização" aria-label="Fechar pré-visualização"><X size={24} /></button></div>
                        <div className="flex-1 overflow-auto p-4">
                            <table className="w-full text-sm text-left"><thead className="bg-slate-50 font-bold border-b"><tr><th className="px-4 py-2">Referência</th><th className="px-4 py-2 text-right">Qtd Matriz</th><th className="px-4 py-2 text-right">Qtd Filial</th><th className="px-4 py-2 text-right">Valor Total</th></tr></thead><tbody>{productSummaryData.map((item, idx) => (<tr key={idx} className="border-b"><td className="px-4 py-2 font-bold">{item.reference}</td><td className="px-4 py-2 text-right">{item.qtyMatriz.toLocaleString('pt-BR')}</td><td className="px-4 py-2 text-right">{item.qtyFilial.toLocaleString('pt-BR')}</td><td className="px-4 py-2 text-right font-bold text-green-700">R$ {item.valTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>))}</tbody></table>
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setShowPreviewModal(false)} className="px-4 py-2 text-slate-600">Fechar</button>
                            <button onClick={() => handleSaveToDatabase(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center">{isSaving && <Loader2 className="animate-spin mr-2" size={16} />}Salvar no Banco</button>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-center border-2 border-orange-500">
                        <AlertTriangle size={48} className="text-orange-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-orange-800 mb-2">Confirmação</h3>
                        <p className="text-slate-700 mb-6">{showConfirmModal.message}</p>
                        <div className="flex gap-3"><button onClick={() => setShowConfirmModal(null)} className="flex-1 px-4 py-2 border rounded-lg font-bold shadow-sm">Cancelar</button><button onClick={() => handleSaveToDatabase(true)} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold shadow-sm">Confirmar</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LegacyImportPage;
