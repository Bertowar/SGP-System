
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

    // Helper to extract date from the period string (e.g. "01/05/2026 a 15/05/2026")
    const extractDateFromPeriod = (periodStr: string): string => {
        try {
            // Assumes format "DD/MM/YYYY a ..." or just "DD/MM/YYYY" 
            // We want the END date because it represents the accumulation point
            const parts = periodStr.split(' a ');
            const dateStr = parts.length > 1 ? parts[1].trim() : parts[0].trim();

            const [d, m, y] = dateStr.split('/');
            return `${y}-${m}-${d}`;
        } catch {
            return new Date().toISOString().split('T')[0]; // Fallback to today
        }
    };

    const handleSaveToDatabase = async (override: boolean = false) => {
        if (!override) setShowConfirmModal(null); // Reset modal if starting new
        setIsSaving(true);

        try {
            // 1. Prepare Data
            // We use the same map logic to ensure IDs are correct
            // CHANGED: Use productSummaryData to match "Resumo Produtos" logic (Aggregated by Reference/Product)
            const itemsToSave: SalesImportItem[] = productSummaryData.map(item => {
                // Determine consolidated ID (prefer item's own logic if valid, else lookup)
                let idConsolidado = (item.nobreId && item.nobreId !== '-') ? item.nobreId : null;
                if (!idConsolidado) {
                    idConsolidado = consolidatedIdMap.get(item.reference) || null;
                }

                return {
                    reference: item.reference,
                    nobreId: idConsolidado,
                    qtyTotal: item.qtyTotal,
                    valTotal: item.valTotal,
                    qtyMatriz: item.qtyMatriz,
                    valMatriz: item.valMatriz,
                    qtyFilial: item.qtyFilial,
                    valFilial: item.valFilial
                };
            });

            // 2. Extract Date (Use Matrix or Filial date, preferring the latest/non-empty)
            // Ideally they should be the same. We use the Raw Period string we parsed earlier.
            const periodRaw = summaryA.rawPeriod || summaryB.rawPeriod;
            if (!periodRaw) throw new Error("Não foi possível identificar a data do relatório.");

            const fileDate = extractDateFromPeriod(periodRaw);

            // 3. Extract Metrics (IPI)
            const metrics = {
                ipiMatriz: summaryA.totalIPI || 0,
                ipiFilial: summaryB.totalIPI || 0
            };

            // 4. Call Service with Metrics
            const result = await processSalesImport(itemsToSave, fileDate, override, metrics);

            if (result.success) {
                alert("Dados salvos com sucesso!");
                setShowPreviewModal(false);
                setShowConfirmModal(null);
            } else {
                // Handle Validation Errors
                if (result.error && (result.error.includes('DATA_RETROATIVA') || result.error.includes('VALOR_NEGATIVO'))) {
                    // Show Confirmation Modal
                    setForceSave(true); // Prepare for forced save
                    setShowConfirmModal({
                        message: result.error,
                        isError: false // It's a warning requiring confirmation
                    });
                } else {
                    alert("Erro ao salvar: " + result.error);
                }
            }

        } catch (error: any) {
            alert("Erro inesperado: " + (error.message || error));
        } finally {
            setIsSaving(false);
        }
    };

    // Fetch System Products for Cross-Referencing
    const { data: systemProducts = [] } = useProducts();

    // Divergence Alert State
    const [divergenceAlert, setDivergenceAlert] = useState<string | null>(null);

    // --- STATE PERSISTENCE LOGIC (ROBUST SANITIZATION) ---
    // Helper to clean loaded items and prevent crashes
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

    // Save to LocalStorage on Change
    useEffect(() => { localStorage.setItem('pplast_import_reportA', JSON.stringify(reportA)); }, [reportA]);
    useEffect(() => { localStorage.setItem('pplast_import_summaryA', JSON.stringify(summaryA)); }, [summaryA]);
    useEffect(() => { localStorage.setItem('pplast_import_reportB', JSON.stringify(reportB)); }, [reportB]);
    useEffect(() => { localStorage.setItem('pplast_import_summaryB', JSON.stringify(summaryB)); }, [summaryB]);


    // FILTERS STATE
    const [filters, setFilters] = useState({
        id: '',
        ref: '',
        line: '', // Added Line filter
        origin: ''
    });

    // Interactive Category Filter
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'LEVE' | 'ULTRA' | 'NOBRE' | null>(null);

    // Helper to parse BR number format
    const parseBRNumber = (str: string) => {
        if (!str || typeof str !== 'string') return 0;
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    };

    // CHECK FOR DATE DIVERGENCE
    useEffect(() => {
        const rawA = summaryA?.rawPeriod;
        const rawB = summaryB?.rawPeriod;

        if (rawA && rawB) {
            if (rawA !== rawB) {
                setDivergenceAlert(`Atenção: As datas dos relatórios não conferem!\n\nMatriz: ${summaryA.period}\nFilial: ${summaryB.period}`);
            } else {
                setDivergenceAlert(null);
            }
        } else {
            setDivergenceAlert(null);
        }
    }, [summaryA, summaryB]);

    // --- CONSOLIDATION LOGIC (MEMOIZED) ---
    const consolidatedData = useMemo(() => {
        const map = new Map<string, ConsolidatedItem>();

        // 1. Process MATRIZ (A)
        (reportA || []).forEach(item => {
            const itemId = String(item.ID || ''); // Safe access
            if (!itemId) return;

            map.set(itemId, {
                id: itemId,
                reference: String(item.REFERENCIA || ''),
                line: String(item.LINHA || ''),
                origin: 'MATRIZ',
                qtyMatriz: Number(item.qtyValue || 0),
                qtyFilial: 0,
                qtyTotal: Number(item.qtyValue || 0),
                valMatriz: Number(item.totalValue || 0),
                valFilial: 0,
                valTotal: Number(item.totalValue || 0),
                splitString: '',
                category: String(item.LINHA || ''),
                isCellRed: false,
                isRowRed: false
            });
        });

        // 2. Process FILIAL (B)
        (reportB || []).forEach(item => {
            const itemId = String(item.ID || '');
            if (!itemId) return;

            if (map.has(itemId)) {
                // Merge if exists
                const existing = map.get(itemId)!;
                existing.origin = 'AMBOS';
                existing.qtyFilial = Number(item.qtyValue || 0);
                existing.qtyTotal += Number(item.qtyValue || 0);
                existing.valFilial = Number(item.totalValue || 0);
                existing.valTotal += Number(item.totalValue || 0);

                // Priority to Matriz Line, else Filial
                if (!existing.line && item.LINHA) {
                    existing.line = String(item.LINHA);
                    existing.category = String(item.LINHA);
                }
            } else {
                // Add new if not exists
                map.set(itemId, {
                    id: itemId,
                    reference: String(item.REFERENCIA || ''),
                    line: String(item.LINHA || ''),
                    origin: 'FILIAL',
                    qtyMatriz: 0,
                    qtyFilial: Number(item.qtyValue || 0),
                    qtyTotal: Number(item.qtyValue || 0),
                    valMatriz: 0,
                    valFilial: Number(item.totalValue || 0),
                    valTotal: Number(item.totalValue || 0),
                    splitString: '',
                    category: String(item.LINHA || ''),
                    isCellRed: false,
                    isRowRed: false
                });
            }
        });

        // 3. Post-Process for Split Categories & Rules
        const items = Array.from(map.values());

        items.forEach(item => {
            // -- Percentage Split (Based on Monetary VALUE) --
            const totalVal = item.valMatriz + item.valFilial;
            let pctMatriz = 0;
            let pctFilial = 0;

            if (totalVal > 0) {
                pctMatriz = Math.round((item.valMatriz / totalVal) * 100);
                pctFilial = 100 - pctMatriz;
            } else if (item.valMatriz === 0 && item.valFilial === 0) {
                if (item.qtyMatriz > 0 && item.qtyFilial > 0) { pctMatriz = 50; pctFilial = 50; }
                else if (item.qtyMatriz > 0) { pctMatriz = 100; pctFilial = 0; }
                else { pctMatriz = 0; pctFilial = 100; }
            }

            // Normalize Category
            const normCat = item.category ? item.category.toUpperCase().trim() : '';

            // Set display string based on Category
            if (normCat === 'NOBRE') {
                item.splitString = '100'; // Always 100
            } else {
                item.splitString = `${pctMatriz}/${pctFilial}`;
            }

            // -- Highlighting Rules --
            item.isCellRed = false;
            item.isRowRed = false;

            // Rule 1: Row RED if Quantities are different (BUT IGNORE IF NOBRE)
            if (item.qtyMatriz !== item.qtyFilial) {
                if (normCat !== 'NOBRE') {
                    item.isRowRed = true;
                }
            }

            // Rule 2: If Quantities match (or it is Nobre), check Proportions for Cell Highlight
            if (!item.isRowRed) {
                if (normCat === 'LEVE') {
                    if (pctMatriz !== 50) item.isCellRed = true;
                } else if (normCat === 'ULTRA') {
                    if (pctMatriz !== 40) item.isCellRed = true;
                }
            }
        });

        return items.sort((a, b) => a.reference.localeCompare(b.reference));
    }, [reportA, reportB]);

    // --- AGGREGATION LOGIC (TAB D) ---
    const productSummaryData = useMemo(() => {
        const map = new Map<string, ProductSummaryItem>();

        (consolidatedData || []).forEach(item => {
            const key = item.reference;
            if (!key) return;

            if (!map.has(key)) {
                // --- CROSS-REFERENCE LOGIC ---
                const sysMatch = systemProducts.find(p => p.produto === item.reference);
                const sysCode = sysMatch ? sysMatch.codigo.toString() : null;

                map.set(key, {
                    reference: item.reference,
                    nobreId: sysCode || '-',
                    qtyMatriz: 0,
                    valMatriz: 0,
                    qtyFilial: 0,
                    valFilial: 0,
                    qtyTotal: 0,
                    valTotal: 0,
                    isSystemCode: !!sysCode
                });
            }

            const prod = map.get(key)!;

            prod.qtyMatriz += item.qtyMatriz;
            prod.qtyFilial += item.qtyFilial;

            prod.valMatriz += item.valMatriz;
            prod.valFilial += item.valFilial;
            prod.valTotal += (item.valMatriz + item.valFilial);

            const normCat = item.category ? item.category.toUpperCase().trim() : '';

            if (normCat === 'NOBRE') {
                prod.qtyTotal += (item.qtyMatriz + item.qtyFilial);
            } else {
                prod.qtyTotal += Math.max(item.qtyMatriz, item.qtyFilial);
            }

            if (!prod.isSystemCode) {
                if (prod.nobreId === '-') {
                    prod.nobreId = item.id;
                }
                else if (item.line && item.line.toUpperCase().includes('NOBRE') && (item.origin === 'MATRIZ')) {
                    prod.nobreId = item.id;
                }
            }
        });

        return Array.from(map.values()).sort((a, b) => a.reference.localeCompare(b.reference));
    }, [consolidatedData, systemProducts]);


    const consolidatedSummary = useMemo(() => {
        // NEW LOGIC: Total Qty = (Total Filial Qty) + (Matriz Qty ONLY if Line is NOBRE)
        const totalFilialQty = (reportB || []).reduce((acc, item) => acc + (Number(item?.qtyValue) || 0), 0);

        const totalMatrizNobreQty = (reportA || []).reduce((acc, item) => {
            const line = item?.LINHA ? String(item.LINHA).toUpperCase().trim() : '';
            const isNobre = line === 'NOBRE';
            return acc + (isNobre ? (Number(item?.qtyValue) || 0) : 0);
        }, 0);

        const totalQty = totalFilialQty + totalMatrizNobreQty;

        const totalValue = (consolidatedData || []).reduce((acc, item) => acc + item.valTotal, 0);
        const totalIPI = (summaryA?.totalIPI || 0) + (summaryB?.totalIPI || 0);

        return { totalQty, totalValue, totalIPI, count: (consolidatedData || []).length };
    }, [consolidatedData, reportA, reportB, summaryA, summaryB]);


    // SHARED PARSER LOGIC
    const parseReportFile = (file: File, targetReport: 'A' | 'B') => {
        setIsParsing(true);
        const reader = new FileReader();

        reader.onload = (evt) => {
            let text = evt.target?.result as string;
            if (!text) { setIsParsing(false); return; }

            text = text.replace(/^\uFEFF/, '');

            const matrizIdent = /MOVEIS\s+PERARO/i;
            const filialIdent = /-\*-\s*SISTEMA\s*-\*-/i;

            let detectedIdentity = undefined;

            if (matrizIdent.test(text)) detectedIdentity = "MOVEIS PERARO";
            else if (filialIdent.test(text)) detectedIdentity = "SISTEMA";
            else detectedIdentity = "DESCONHECIDO";

            if (targetReport === 'A' && !matrizIdent.test(text)) {
                alert("AVISO: O arquivo selecionado não contém a identificação 'MOVEIS PERARO'. Verifique se este é realmente o relatório da MATRIZ.");
            }
            if (targetReport === 'B' && !filialIdent.test(text)) {
                alert("AVISO: O arquivo selecionado não contém a identificação '-*- SISTEMA -*-'. Verifique se este é realmente o relatório da FILIAL.");
            }

            const periodRegex = /Per.*?odo\s+.*?(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i;
            const headerLines = text.split(/\r?\n/).slice(0, 20).join('\n');
            const periodMatch = headerLines.match(periodRegex);

            let periodDisplay = 'Não identificado';
            let periodRaw = '';

            if (periodMatch) {
                periodDisplay = `${periodMatch[1]} a ${periodMatch[2]}`;
                periodRaw = periodDisplay;
            }

            const lines = text.split(/\r?\n/);
            const data: ReportItem[] = [];
            let accQty = 0;
            let accValue = 0;

            const itemRegex = /^(\d+)\s+(.+?)\s+([^\s]+)\s+([^\s]+)\s+CX\s+([0-9\.]+,\d+)\s+([0-9\.]+,\d{2})/;
            const ipiRegex = /(?:TOTAL|VALOR|VLR)\.?\s*(?:DO\s+)?IPI.*?\s([0-9\.]+,\d{2})/i;

            lines.forEach((line, index) => {
                const match = line.match(itemRegex);
                if (match) {
                    const id = match[1];
                    const rawDesc = match[2].trim();
                    const ref = match[3];
                    const qtyStr = match[5];
                    const totalStr = match[6];

                    const descParts = rawDesc.split(/\s+/);
                    const lastWord = descParts.length > 0 ? descParts[descParts.length - 1] : '';
                    const extractedLine = lastWord.trim();

                    const qty = parseBRNumber(qtyStr);
                    const total = parseBRNumber(totalStr);
                    accQty += qty;
                    accValue += total;

                    data.push({
                        _id: index,
                        'ID': id,
                        'REFERENCIA': ref,
                        'DESCRICAO': rawDesc,
                        'LINHA': extractedLine,
                        'QTDADE': qtyStr,
                        'TOTAL': totalStr,
                        qtyValue: qty,
                        totalValue: total
                    });
                }
            });

            const ipiMatch = text.match(ipiRegex);
            let totalIPI = 0;
            if (ipiMatch) totalIPI = parseBRNumber(ipiMatch[1]);

            const newSummary: ReportSummary = {
                totalQty: accQty,
                totalValue: accValue,
                totalIPI: totalIPI,
                fileName: file.name,
                fileSize: (file.size / 1024).toFixed(1) + ' KB',
                period: periodDisplay,
                rawPeriod: periodRaw,
                identity: detectedIdentity
            };

            if (targetReport === 'A') { setReportA(data); setSummaryA(newSummary); }
            else { setReportB(data); setSummaryB(newSummary); }
            setIsParsing(false);
        };

        reader.readAsText(file, 'ISO-8859-1');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (activeTab === 'C' || activeTab === 'D') return;
        if (file) parseReportFile(file, activeTab);
        e.target.value = '';
    };

    const handleClear = () => {
        if (activeTab === 'A') {
            setReportA([]);
            setSummaryA(defaultSummary);
        } else if (activeTab === 'B') {
            setReportB([]);
            setSummaryB(defaultSummary);
        }
    };

    const handleCategoryClick = (category: 'LEVE' | 'ULTRA' | 'NOBRE') => {
        if (selectedCategoryFilter === category) {
            setSelectedCategoryFilter(null);
        } else {
            setSelectedCategoryFilter(category);
        }
    };

    // Safe filtering with string conversion to prevent crashes
    const filterData = (data: ReportItem[]) => {
        if (!data) return [];
        return data.filter(item => {
            if (!item) return false;
            const matchId = !filters.id || String(item.ID || '').includes(filters.id);
            const matchRef = !filters.ref || String(item.REFERENCIA || '').toLowerCase().includes(filters.ref.toLowerCase());
            const matchLine = !filters.line || String(item.LINHA || '').toLowerCase().includes(filters.line.toLowerCase());
            return matchId && matchRef && matchLine;
        });
    };

    const filterConsolidated = (data: ConsolidatedItem[]) => {
        if (!data) return [];
        return data.filter(item => {
            if (!item) return false;
            const matchId = !filters.id || String(item.id || '').includes(filters.id);
            const matchRef = !filters.ref || String(item.reference || '').toLowerCase().includes(filters.ref.toLowerCase());
            const matchCategory = !selectedCategoryFilter || item.category === selectedCategoryFilter;
            return matchId && matchRef && matchCategory;
        });
    };

    // Apply filters to Product Summary (Tab D) 
    const filteredProductSummary = productSummaryData.filter(item => {
        if (!item) return false;
        const matchRef = !filters.ref || String(item.reference || '').toLowerCase().includes(filters.ref.toLowerCase());
        // Added ID filter for Tab D as well since we have a dedicated column now
        const matchId = !filters.id || String(item.nobreId || '').includes(filters.id);
        return matchRef && matchId;
    });

    const currentReport = activeTab === 'A' ? reportA : reportB;
    const currentSummary = activeTab === 'A' ? summaryA : summaryB;
    const filteredReport = filterData(currentReport);
    const filteredConsolidated = filterConsolidated(consolidatedData);
    const consolidatedIdMap = new Map<string, string>(); // Simplified for debug

    return <div className="space-y-6 pb-20 animate-in fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
            <div>
                <button onClick={() => navigate('/logistics')} className="text-slate-500 hover:text-brand-600 flex items-center mb-1 text-sm font-bold transition-colors">
                    <ArrowLeft size={16} className="mr-1" /> Voltar para Logística
                </button>
                <h2 className="text-2xl font-bold text-slate-800">Conferência Matriz vs Filial</h2>
                <p className="text-slate-500">Importação e consolidação de relatórios de venda.</p>
            </div>
        </div>

        {/* DIVERGENCE ALERT POPUP */}
        {
            divergenceAlert && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in zoom-in-95">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-red-500">
                        <div className="bg-red-50 p-6 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle size={32} className="text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-red-700 mb-2">Divergência de Período</h3>
                            <p className="text-slate-700 whitespace-pre-line mb-6 font-medium">
                                {divergenceAlert}
                            </p>
                            <button onClick={() => setDivergenceAlert(null)} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors w-full">
                                Entendido, revisar arquivos
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button onClick={() => { setActiveTab('A'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'A' ? 'border-brand-600 bg-brand-50/50' : 'border-transparent hover:bg-slate-50'}`}>
                    <div className={`flex items-center font-bold text-sm ${activeTab === 'A' ? 'text-brand-600' : 'text-slate-500'}`}>
                        <Building2 size={18} className="mr-2" /> MATRIZ
                        {reportA.length > 0 && <span className="ml-2 bg-brand-200 text-brand-800 text-[10px] px-2 py-0.5 rounded-full">{reportA.length}</span>}
                    </div>
                    {summaryA?.identity && <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm animate-in zoom-in ${activeTab === 'A' ? 'text-white bg-brand-600' : 'text-slate-300 bg-slate-100'}`}>{summaryA.identity}</span>}
                </button>
                <div className="w-px bg-slate-200"></div>
                <button onClick={() => { setActiveTab('B'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'B' ? 'border-purple-600 bg-purple-50/50' : 'border-transparent hover:bg-slate-50'}`}>
                    <div className={`flex items-center font-bold text-sm ${activeTab === 'B' ? 'text-purple-600' : 'text-slate-500'}`}>
                        <Store size={18} className="mr-2" /> FILIAL
                        {reportB.length > 0 && <span className="ml-2 bg-purple-200 text-purple-800 text-[10px] px-2 py-0.5 rounded-full">{reportB.length}</span>}
                    </div>
                    {summaryB?.identity && <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm animate-in zoom-in ${activeTab === 'B' ? 'text-white bg-purple-600' : 'text-slate-300 bg-slate-100'}`}>{summaryB.identity}</span>}
                </button>
                <div className="w-px bg-slate-200"></div>
                <button onClick={() => { setActiveTab('C'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'C' ? 'border-blue-600 bg-blue-50/50' : 'border-transparent hover:bg-slate-50'}`}>
                    <div className={`flex items-center font-bold text-sm ${activeTab === 'C' ? 'text-blue-600' : 'text-slate-500'}`}>
                        <Sigma size={18} className="mr-2" /> CONSOLIDADO
                        {consolidatedData.length > 0 && <span className="ml-2 bg-blue-200 text-blue-800 text-[10px] px-2 py-0.5 rounded-full">{consolidatedData.length}</span>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${activeTab === 'C' ? 'text-white bg-blue-600' : 'text-slate-300 bg-slate-100'}`}>MATRIZ + FILIAL</span>
                </button>
                <div className="w-px bg-slate-200"></div>
                <button onClick={() => { setActiveTab('D'); setFilters({ id: '', ref: '', line: '', origin: '' }); }} className={`flex-1 py-3 text-center border-b-2 transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'D' ? 'border-green-600 bg-green-50/50' : 'border-transparent hover:bg-slate-50'}`}>
                    <div className={`flex items-center font-bold text-sm ${activeTab === 'D' ? 'text-green-600' : 'text-slate-500'}`}>
                        <Package size={18} className="mr-2" /> RESUMO PRODUTOS
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${activeTab === 'D' ? 'text-white bg-green-600' : 'text-slate-300 bg-slate-100'}`}>AGRUPADO</span>
                </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {(activeTab === 'A' || activeTab === 'B') ? (
                        <>
                            {currentSummary.fileName ? (
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-slate-400">Arquivo</span>
                                    <span className="font-mono text-sm font-bold text-slate-700">{currentSummary.fileName}</span>
                                </div>
                            ) : (
                                <span className="text-sm text-slate-400 italic flex items-center"><FileText size={16} className="mr-2" /> Nenhum arquivo.</span>
                            )}
                            {currentSummary.period && (
                                <>
                                    <div className="hidden md:block w-px h-8 bg-slate-300 mx-2"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center"><Calendar size={10} className="mr-1" /> Período</span>
                                        <span className="font-mono text-sm font-bold text-brand-700">{currentSummary.period}</span>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-slate-600 flex items-center bg-white px-3 py-1.5 rounded border border-slate-200">
                                <Layers size={16} className="mr-2 text-blue-500" />
                                {activeTab === 'C' ? 'Total Itens:' : 'Total Produtos:'} <b className="ml-1 text-slate-800">{activeTab === 'C' ? consolidatedSummary.count : productSummaryData.length}</b>
                            </span>
                            {selectedCategoryFilter && activeTab === 'C' && (
                                <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-full animate-in fade-in">
                                    <Filter size={12} />
                                    Filtro: {selectedCategoryFilter}
                                    <button onClick={() => setSelectedCategoryFilter(null)} className="ml-1 hover:text-red-300" title={`Remover filtro: ${selectedCategoryFilter}`} aria-label={`Remover filtro: ${selectedCategoryFilter}`}><Trash2 size={12} /></button>
                                </span>
                            )}
                            {activeTab === 'C' && consolidatedData.length > 0 && (
                                <button
                                    onClick={() => setShowPreviewModal(true)}
                                    className="ml-2 flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all"
                                >
                                    <Database size={14} className="mr-1.5" />
                                    Pré-visualizar Banco
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                    {(activeTab === 'A' || activeTab === 'B') && (
                        <>
                            <label className={`cursor-pointer text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center transition-all ${currentReport.length > 0 ? 'bg-slate-300 cursor-not-allowed opacity-70' : (activeTab === 'A' ? 'bg-brand-600 hover:bg-brand-700 active:scale-95' : 'bg-purple-600 hover:bg-purple-700 active:scale-95')}`}>
                                <Upload size={18} className="mr-2" />
                                {activeTab === 'A' ? 'Carregar Matriz' : 'Carregar Filial'}
                                <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} disabled={currentReport.length > 0} />
                            </label>
                            {currentReport.length > 0 && (
                                <button onClick={handleClear} className="p-2 border border-slate-300 bg-white rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-500 transition-colors" title="Limpar" aria-label="Limpar"><Trash2 size={18} /></button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto relative bg-white h-[calc(100vh-300px)]">
                {isParsing ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <p>Processando...</p>
                    </div>
                ) : (
                    <>
                        {/* REGULAR VIEW (A or B) */}
                        {(activeTab === 'A' || activeTab === 'B') && (
                            currentReport.length > 0 ? (
                                <table className="w-full text-sm text-left relative">
                                    <thead className="text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-20 shadow-md">
                                        <tr>
                                            <th className="px-6 py-3 w-20 text-center text-slate-400 bg-slate-50">#</th>
                                            <th className="px-6 py-2 bg-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span>ID</span>
                                                    <div className="relative">
                                                        <Search size={10} className="absolute left-2 top-2 text-slate-400" />
                                                        <input type="text" className="w-full pl-6 pr-2 py-1 text-[10px] border rounded outline-none focus:border-brand-500" placeholder="Filtrar" value={filters.id} onChange={e => setFilters({ ...filters, id: e.target.value })} title="Filtrar por ID" aria-label="Filtrar por ID" />
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="px-6 py-2 bg-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span>Referência</span>
                                                    <div className="relative">
                                                        <Search size={10} className="absolute left-2 top-2 text-slate-400" />
                                                        <input type="text" className="w-full pl-6 pr-2 py-1 text-[10px] border rounded outline-none focus:border-brand-500" placeholder="Filtrar" value={filters.ref} onChange={e => setFilters({ ...filters, ref: e.target.value })} title="Filtrar por Referência" aria-label="Filtrar por Referência" />
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="px-6 py-2 bg-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span>Linha (Ext.)</span>
                                                    <div className="relative">
                                                        <Search size={10} className="absolute left-2 top-2 text-slate-400" />
                                                        <input type="text" className="w-full pl-6 pr-2 py-1 text-[10px] border rounded outline-none focus:border-brand-500" placeholder="Filtrar" value={filters.line} onChange={e => setFilters({ ...filters, line: e.target.value })} title="Filtrar por Linha" aria-label="Filtrar por Linha" />
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="px-6 py-3 text-right bg-slate-50">Qtd (CX)</th>
                                            <th className="px-6 py-3 text-right bg-slate-50">Total (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredReport.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-2 text-center text-slate-400 text-xs font-mono">{idx + 1}</td>
                                                <td className="px-6 py-2 font-mono text-slate-600">{row.ID}</td>
                                                <td className="px-6 py-2 font-bold text-slate-800">
                                                    {row.REFERENCIA}
                                                    <span className="block text-[10px] text-slate-400 font-normal">{row.DESCRICAO}</span>
                                                </td>
                                                <td className="px-6 py-2">
                                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{row.LINHA || '-'}</span>
                                                </td>
                                                <td className="px-6 py-2 text-right font-mono text-blue-600">{row.QTDADE}</td>
                                                <td className="px-6 py-2 text-right font-mono text-green-700">{row.TOTAL}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                    <TableIcon size={64} className="mb-4" />
                                    <p className="font-medium">Aguardando importação...</p>
                                </div>
                            )
                        )}

                        {/* CONSOLIDATED VIEW (C) */}
                        {activeTab === 'C' && (
                            consolidatedData.length > 0 ? (
                                <table className="w-full text-sm text-left relative">
                                    <thead className="text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-20 shadow-md">
                                        <tr>
                                            <th className="px-2 py-2 w-24 bg-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs">ID</span>
                                                    <input type="text" className="w-full px-1 py-0.5 text-[10px] border rounded outline-none" placeholder="Filtrar" value={filters.id} onChange={e => setFilters({ ...filters, id: e.target.value })} title="Filtrar por ID" aria-label="Filtrar por ID" />
                                                </div>
                                            </th>
                                            <th className="px-2 py-2 w-40 bg-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs">Ref.</span>
                                                    <input type="text" className="w-full px-1 py-0.5 text-[10px] border rounded outline-none" placeholder="Filtrar" value={filters.ref} onChange={e => setFilters({ ...filters, ref: e.target.value })} title="Filtrar por Referência" aria-label="Filtrar por Referência" />
                                                </div>
                                            </th>
                                            {/* INTERACTIVE HEADERS */}
                                            <th
                                                onClick={() => handleCategoryClick('LEVE')}
                                                className={`px-1 py-2 text-center w-[60px] text-[10px] font-bold uppercase border-l border-slate-200 cursor-pointer transition-colors select-none ${selectedCategoryFilter === 'LEVE' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                                title="Filtrar por LEVE"
                                            >
                                                LEVE
                                            </th>
                                            <th
                                                onClick={() => handleCategoryClick('ULTRA')}
                                                className={`px-1 py-2 text-center w-[60px] text-[10px] font-bold uppercase border-l border-slate-200 cursor-pointer transition-colors select-none ${selectedCategoryFilter === 'ULTRA' ? 'bg-purple-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                                title="Filtrar por ULTRA"
                                            >
                                                ULTRA
                                            </th>
                                            <th
                                                onClick={() => handleCategoryClick('NOBRE')}
                                                className={`px-1 py-2 text-center w-[60px] text-[10px] font-bold uppercase border-l border-slate-200 cursor-pointer transition-colors select-none ${selectedCategoryFilter === 'NOBRE' ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                                title="Filtrar por NOBRE"
                                            >
                                                NOBRE
                                            </th>
                                            <th className="px-2 py-3 text-right text-slate-400 font-normal w-20 text-xs bg-slate-50">Qtd Matriz</th>
                                            <th className="px-2 py-3 text-right text-slate-400 font-normal w-24 text-xs bg-slate-50 border-r border-slate-100">Vlr Matriz</th>
                                            <th className="px-2 py-3 text-right text-slate-400 font-normal w-20 text-xs bg-slate-50">Qtd Filial</th>
                                            <th className="px-2 py-3 text-right text-slate-400 font-normal w-24 text-xs bg-slate-50 border-r border-slate-100">Vlr Filial</th>
                                            <th className="px-4 py-3 text-right text-green-700 w-32 text-xs border-l border-slate-100 bg-slate-50">Valor TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredConsolidated.map((item) => {
                                            const normCat = item.category ? item.category.toUpperCase() : '';
                                            return (
                                                <tr key={item.id} className={`transition-colors ${item.isRowRed ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-slate-50'}`}>
                                                    <td className="px-2 py-2 font-mono text-slate-600 text-xs">{item.id}</td>
                                                    <td className="px-2 py-2 font-bold text-slate-800 text-xs">{item.reference}</td>

                                                    {/* LEVE */}
                                                    <td className={`px-1 py-2 text-center font-mono text-[10px] border-l border-slate-100 ${normCat === 'LEVE' ? (item.isCellRed ? 'bg-red-200 text-red-800 font-bold' : 'text-slate-700 font-medium') : 'text-slate-200'}`}>
                                                        {normCat === 'LEVE' ? item.splitString : '-'}
                                                    </td>

                                                    {/* ULTRA */}
                                                    <td className={`px-1 py-2 text-center font-mono text-[10px] border-l border-slate-100 ${normCat === 'ULTRA' ? (item.isCellRed ? 'bg-red-200 text-red-800 font-bold' : 'text-slate-700 font-medium') : 'text-slate-200'}`}>
                                                        {normCat === 'ULTRA' ? item.splitString : '-'}
                                                    </td>

                                                    {/* NOBRE */}
                                                    <td className={`px-1 py-2 text-center font-mono text-[10px] border-l border-slate-100 ${normCat === 'NOBRE' ? 'text-slate-700 font-medium' : 'text-slate-200'}`}>
                                                        {normCat === 'NOBRE' ? item.splitString : '-'}
                                                    </td>

                                                    <td className="px-2 py-2 text-right font-mono text-xs text-slate-500">
                                                        {item.qtyMatriz > 0 ? item.qtyMatriz.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '-'}
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-mono text-xs text-blue-600 border-r border-slate-100">
                                                        {item.valMatriz > 0 ? item.valMatriz.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-mono text-xs text-slate-500">
                                                        {item.qtyFilial > 0 ? item.qtyFilial.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '-'}
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-mono text-xs text-purple-600 border-r border-slate-100">
                                                        {item.valFilial > 0 ? item.valFilial.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                                                    </td>

                                                    <td className="px-4 py-2 text-right font-mono font-bold text-green-700 text-xs border-l border-slate-100">
                                                        {item.valTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                    <Sigma size={64} className="mb-4" />
                                    <p className="font-medium">Sem dados consolidados ou filtro sem resultados.</p>
                                </div>
                            )
                        )}

                        {/* AGGREGATED PRODUCT VIEW (D) */}
                        {activeTab === 'D' && (
                            filteredProductSummary.length > 0 ? (
                                <table className="w-full text-sm text-left relative">
                                    <thead className="text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-20 shadow-md">
                                        <tr>
                                            <th className="px-2 py-3 text-center w-24 bg-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span>Cód. Nobre</span>
                                                    <input type="text" className="w-full px-1 py-0.5 text-[10px] border rounded outline-none" placeholder="ID" value={filters.id} onChange={e => setFilters({ ...filters, id: e.target.value })} title="Filtrar por ID" aria-label="Filtrar por ID" />
                                                </div>
                                            </th>
                                            <th className="px-4 py-3 text-left bg-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span>Produto (Ref)</span>
                                                    <div className="relative w-32">
                                                        <Search size={10} className="absolute left-2 top-2 text-slate-400" />
                                                        <input type="text" className="w-full pl-6 pr-2 py-1 text-[10px] border rounded outline-none focus:border-brand-500" placeholder="Filtrar" value={filters.ref} onChange={e => setFilters({ ...filters, ref: e.target.value })} title="Filtrar por Produto" aria-label="Filtrar por Produto" />
                                                    </div>
                                                </div>
                                            </th>

                                            {/* MATRIZ GROUP */}
                                            <th className="px-2 py-3 text-right bg-blue-50/50 border-l border-slate-200">Qtd Matriz</th>
                                            <th className="px-2 py-3 text-right bg-blue-50/50">Valor Matriz</th>

                                            {/* FILIAL GROUP */}
                                            <th className="px-2 py-3 text-right bg-purple-50/50 border-l border-slate-200">Qtd Filial</th>
                                            <th className="px-2 py-3 text-right bg-purple-50/50">Valor Filial</th>

                                            {/* TOTAL GROUP */}
                                            <th className="px-2 py-3 text-right bg-green-50/50 border-l border-slate-200">Qtd Geral</th>
                                            <th className="px-4 py-3 text-right bg-green-50/50 font-extrabold text-green-800">TOTAL R$</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredProductSummary.map((item) => (
                                            <tr key={item.reference} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-2 py-3 text-center">
                                                    <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${item.isSystemCode ? 'bg-green-100 text-green-800 border border-green-200' : (item.nobreId !== '-' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-400')}`} title={item.isSystemCode ? 'Código validado no Sistema' : 'Código obtido do Relatório'}>
                                                        {item.nobreId}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-800">{item.reference}</td>

                                                {/* MATRIZ */}
                                                <td className="px-2 py-3 text-right font-mono text-xs text-blue-600 bg-blue-50/10 border-l border-slate-100">
                                                    {item.qtyMatriz.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-2 py-3 text-right font-mono text-xs text-blue-600 bg-blue-50/10">
                                                    {item.valMatriz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>

                                                {/* FILIAL */}
                                                <td className="px-2 py-3 text-right font-mono text-xs text-purple-600 bg-purple-50/10 border-l border-slate-100">
                                                    {item.qtyFilial.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-2 py-3 text-right font-mono text-xs text-purple-600 bg-purple-50/10">
                                                    {item.valFilial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>

                                                {/* TOTAL */}
                                                <td className="px-2 py-3 text-right font-mono text-xs font-bold text-slate-700 bg-green-50/10 border-l border-slate-100">
                                                    {item.qtyTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sm font-extrabold text-green-700 bg-green-50/10">
                                                    {item.valTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                    <Package size={64} className="mb-4" />
                                    <p className="font-medium">Sem dados para resumo ou filtro sem resultados.</p>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>

            {/* Footer Summary - DYNAMIC */}
            <div className="bg-slate-50 border-t border-slate-200 p-4">
                {(activeTab === 'C' || activeTab === 'D') ? (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-in slide-in-from-bottom-2">
                        {/* GRAND TOTAL WITH TAX (NEW) */}
                        <div className="bg-indigo-600 text-white border border-indigo-700 p-3 rounded-lg shadow-md hover:scale-[1.02] transition-transform">
                            <p className="text-[10px] uppercase text-indigo-200 font-bold">Total Líquido + IPI</p>
                            <p className="text-xl font-extrabold">R$ {(consolidatedSummary.totalValue + consolidatedSummary.totalIPI).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>

                        <div className="bg-blue-50 text-blue-800 border border-blue-200 p-3 rounded-lg shadow-sm">
                            <p className="text-[10px] uppercase text-blue-400 font-bold">Total Produtos (R$)</p>
                            <p className="text-xl font-bold">R$ {consolidatedSummary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-white border p-3 rounded-lg shadow-sm border-blue-100">
                            <p className="text-[10px] uppercase text-blue-400 font-bold">Qtd Global (CX)</p>
                            <p className="text-xl font-bold text-blue-700">{consolidatedSummary.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="bg-white border p-3 rounded-lg shadow-sm border-slate-200">
                            <p className="text-[10px] uppercase text-slate-400 font-bold">{activeTab === 'C' ? 'Itens (IDs)' : 'Produtos (Refs)'}</p>
                            <p className="text-xl font-bold text-slate-700">{activeTab === 'C' ? consolidatedSummary.count : filteredProductSummary.length}</p>
                        </div>
                        {consolidatedSummary.totalIPI > 0 && (
                            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg shadow-sm">
                                <p className="text-[10px] uppercase text-orange-500 font-bold flex items-center">
                                    <Calculator size={12} className="mr-1" /> IPI Acumulado
                                </p>
                                <p className="text-xl font-bold text-orange-700">R$ {consolidatedSummary.totalIPI.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white border p-3 rounded-lg shadow-sm">
                            <p className="text-[10px] uppercase text-slate-400 font-bold">Itens</p>
                            <p className="text-xl font-bold text-slate-700">{currentReport.length}</p>
                        </div>
                        <div className="bg-white border p-3 rounded-lg shadow-sm border-blue-100">
                            <p className="text-[10px] uppercase text-blue-400 font-bold">Qtd Total (CX)</p>
                            <p className="text-xl font-bold text-blue-700">{currentSummary.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="bg-white border p-3 rounded-lg shadow-sm border-green-100">
                            <p className="text-[10px] uppercase text-green-400 font-bold">Valor Total</p>
                            <p className="text-xl font-bold text-green-700">R$ {currentSummary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        {currentSummary.totalIPI > 0 && (
                            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg shadow-sm">
                                <p className="text-[10px] uppercase text-orange-500 font-bold flex items-center">
                                    <Calculator size={12} className="mr-1" /> IPI Detectado
                                </p>
                                <p className="text-xl font-bold text-orange-700">R$ {currentSummary.totalIPI.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* PREVIEW MODAL FOR DATABASE SAVING */}
        {
            showPreviewModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                                    <Database size={24} />
                                </div>
                                <div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Pré-visualização de Dados para Gravação</h3>
                                        <p className="text-xs text-slate-500">Verifique a estrutura dos dados antes de criar a tabela e salvar.</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500" title="Fechar Pré-visualização" aria-label="Fechar Pré-visualização">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-0">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 bg-slate-100 border-r border-slate-200 w-24">ID Original</th>
                                            <th className="px-4 py-3 bg-indigo-50/50 text-indigo-800 border-r border-indigo-100 w-32">Id_Consolidado</th>
                                            <th className="px-4 py-3 bg-slate-50">Referência</th>
                                            <th className="px-4 py-3 bg-slate-50">Linha / Categoria</th>
                                            <th className="px-4 py-3 text-right bg-slate-50">Qtd Matriz</th>
                                            <th className="px-4 py-3 text-right bg-slate-50 border-r border-slate-100">Vlr Matriz</th>
                                            <th className="px-4 py-3 text-right bg-slate-50">Qtd Filial</th>
                                            <th className="px-4 py-3 text-right bg-slate-50 border-r border-slate-100">Vlr Filial</th>
                                            <th className="px-4 py-3 text-right bg-slate-50">Valor Total (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {consolidatedData.map((item) => {
                                            // LOGIC TO FIND ID_CONSOLIDADO (Unified & Optimized)
                                            // Uses the pre-calculated map
                                            const idConsolidado = referenceToConsolidatedIdMap.get(item.reference) || null;

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 border-r border-slate-100 font-mono text-slate-500 text-xs font-bold bg-slate-50/30">
                                                        {item.id}
                                                    </td>
                                                    <td className="px-4 py-2 border-r border-slate-100 text-center">
                                                        {idConsolidado ? (
                                                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">{idConsolidado}</span>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic bg-slate-100 px-2 py-1 rounded">N/D</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 font-bold text-slate-700">{item.reference}</td>
                                                    <td className="px-4 py-2 text-xs">
                                                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{item.category}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-slate-600">{item.qtyMatriz.toLocaleString('pt-BR')}</td>
                                                    <td className="px-4 py-2 text-right font-mono text-blue-600 text-xs border-r border-slate-100">
                                                        {item.valMatriz > 0 ? item.valMatriz.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-slate-600">{item.qtyFilial.toLocaleString('pt-BR')}</td>
                                                    <td className="px-4 py-2 text-right font-mono text-purple-600 text-xs border-r border-slate-100">
                                                        {item.valFilial > 0 ? item.valFilial.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-bold text-green-700">{item.valTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center rounded-b-xl">
                                <div className="flex gap-6 items-center">
                                    <div className="text-xs text-slate-500 font-medium flex items-center">
                                        <CheckCircle2 size={16} className="text-green-500 mr-2" />
                                        {consolidatedData.length} registros prontos para validação.
                                    </div>
                                    <div className="h-4 w-px bg-slate-300"></div>
                                    <div className="flex gap-4 text-xs font-bold text-slate-600">
                                        <span className="text-orange-600">Total IPI: R$ {((summaryA?.totalIPI || 0) + (summaryB?.totalIPI || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        <span className="text-indigo-700">Total Geral (Liq+IPI): R$ {(consolidatedSummary.totalValue + consolidatedSummary.totalIPI).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowPreviewModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold transition-colors">
                                        Fechar
                                    </button>
                                    <button
                                        onClick={() => handleSaveToDatabase(false)}
                                        disabled={isSaving}
                                        className={`px-4 py-2 text-white rounded-lg font-bold flex items-center transition-colors ${isSaving ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                    >
                                        {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Database size={16} className="mr-2" />}
                                        {isSaving ? 'Salvando...' : 'Salvar no Banco'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
            )}

                    {/* CONFIRMATION / WARNING MODAL */}
                    {showConfirmModal && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in zoom-in-95">
                            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-orange-500">
                                <div className="bg-orange-50 p-6 flex flex-col items-center text-center">
                                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                                        <AlertTriangle size={32} className="text-orange-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-orange-800 mb-2">Confirmação de Segurança</h3>
                                    <p className="text-slate-700 mb-6 font-medium">
                                        {showConfirmModal.message}
                                    </p>
                                    <p className="text-sm text-slate-500 mb-6">
                                        Deseja forçar a gravação mesmo assim? Isso irá registrar a diferença encontrada como movimentação do dia.
                                    </p>

                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={() => setShowConfirmModal(null)}
                                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => handleSaveToDatabase(true)}
                                            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700"
                                        >
                                            Confirmar e Salvar
                                        </button>
                                    </div>
                                </div>
                            </div>
                            );
};
                            export default LegacyImportPage;
