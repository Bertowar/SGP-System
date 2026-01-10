import React, { useState, useEffect, useMemo } from 'react';
import { fetchMaterials, saveMaterial, deleteMaterial, processStockTransaction, fetchInventoryTransactions, fetchMaterialTransactions, formatError, renameMaterialGroup, fetchProducts, formatCurrency } from '../services/storage';
import { fetchAllActiveBOMs } from '../services/inventoryService';
import { calculateKittingOptions } from '../services/kittingService';
import { RawMaterial, MaterialCategory, InventoryTransaction } from '../types';
import { Plus, Search, Cuboid, Save, ArrowDownCircle, ArrowUpCircle, RefreshCw, Trash2, X, Box, Zap, User, Hammer, Loader2, AlertCircle, ArrowRight, Minus, History, FileText, DollarSign, BarChart3, Filter, Cpu, Layers, ChevronRight, ArrowLeft, LayoutGrid, List as ListIcon, Edit, Undo2, Info, CheckCircle2, Tag } from 'lucide-react';
import { StockHistoryModal } from '../components/StockHistoryModal';
import { toast } from 'sonner';

import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';

// Robust number parser for PT-BR input
const parseInputNumber = (input: string | number): number => {
    if (input === undefined || input === null || input === '') return 0;
    if (typeof input === 'number') return input;

    // PT-BR Strict Parsing logic
    let clean = input.toString();

    // Check if it's already a standard float string (e.g. "6.50" from database or previous edit) without commas
    // Note: User input usually comes with comma in PT-BR (6,50). 
    // Data from DB is number.

    // If we have commas, it's definitely PT-BR decimal separator or thousand separator?
    // In PT-BR: dot is thousand, comma is decimal.

    if (clean.includes(',')) {
        // Remove thousands separator (dots) if any
        clean = clean.replace(/\./g, '');
        // Replace decimal separator (comma) with dot
        clean = clean.replace(',', '.');
    } else {
        // No comma. Only dots? e.g. "1.200" meaning 1200 or 1.2?
        // In PT-BR inputs, usually users type "1000" or "1000,00". 
        // If they type "1.200", it usually means 1200.
        // However, if the field was populate with "6.5" (number converted to string), this logic breaks it!
        // "6.5" -> remove dot -> "65" => ERROR identified! 

        // FIX: Detect if the input looks like a simple float (one dot, no commas, typical JS number string)
        // versus a formatted PT-BR integer with thousands (1.000).
        // If the dot is followed by 1 or 2 digits, it might be decimal? 
        // JS toString() of e.g. 6.5 is "6.5".

        // Heuristic: If we are calling this on a value that might be from state (controlled input), 
        // the state might hold "6.5" (string) if the user typed "6.5" (en-US) or if it came from DB.

        // Safest approach for PT-BR app: Assume Inputs are "0,00". 
        // But if `editingMat.unitCost` was initialized from a number (6.5), the input value might be "6.5" if not formatted.
        // We should ensure the INPUT field displays with comma.

        // For this parser: If no comma is present, and there is a dot:
        // If it looks like a valid float (e.g. "6.50"), keep it.
        // If it looks like thousands "1.000", remove dot.
        // This is ambiguous.

        // BETTER FIX: The Input component or state should handle the display format. 
        // If we simply fix this function to NOT remove dot if it's a valid float structure and small number?
        // No, let's treat it as: Remove dots ONLY IF comma exists? 
        // Or: If valid float, return float.

        // Let's assume the user intends PT-BR.
        // "6.50" -> 6.5. 
        // "1.000" -> 1000.

        // If we strictly enforce PT-BR, "6.50" shouldn't exist as input, it should be "6,50".
        // BUT, if the state was populated directly from DB (number 6.5 -> string "6.5"), then this function receives "6.5".
        // "6.5".replace(/\./g, '') -> "65". THIS IS THE BUG.

        // Solution: If input corresponds to a valid number as-is, use it?
        // But "1.000" is also a valid number (1).

        // Context: editingMat.unitCost comes from DB as number.
        // Step 1 check: Is it coming from an HTML input type="text" or "number"?
        // If type="text", user likely sees "6.5" (if raw) or "6,50" (if formatted).

        // Let's rely on presence of comma.
        // If NO comma is present, and it has a dot:
        // Check if it's a "small" number with dot?
        // Actually, if we simply perform parseFloat on the original string first?

        // Let's use a regex to identify "dot as decimal".
        // If string matches `^\d+\.\d+$` (simple float), treat as float.
        if (/^\d+\.\d+$/.test(clean)) {
            return parseFloat(clean);
        }

        // Otherwise (e.g. "1.000" or simple integer "100"), remove dots (thousands)
        clean = clean.replace(/\./g, '');
    }

    return Number(clean);
};

// --- INTERFACES FOR GROUPING ---
interface MaterialGroup {
    name: string;
    items: RawMaterial[];
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
    units: Set<string>;
}

// Default Categories Map (Key -> Label)
const DEFAULT_CATEGORIES: Record<string, string> = {
    'raw_material': 'Matéria Prima',
    'packaging': 'Embalagem',
    'return': 'Retorno',
    'energy': 'Energia (kWh)',
    'labor': 'Mão de Obra (h)',
    'overhead': 'Custos Indiretos'
};

const InventoryPage: React.FC = () => {
    const { user } = useAuth();

    // --- STATE ---
    const [materials, setMaterials] = useState<RawMaterial[]>([]);
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<MaterialCategory | 'ALL'>('ALL');

    // VIEW MODE: GROUPS or ITEMS (Drill-down)
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

    // Modals
    const [modalOpen, setModalOpen] = useState(false);
    const [trxModalOpen, setTrxModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false); // NEW
    const [kittingModalOpen, setKittingModalOpen] = useState(false);
    const [kittingOptions, setKittingOptions] = useState<any[]>([]);

    // History View State
    const [historyItems, setHistoryItems] = useState<InventoryTransaction[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Form States
    const [editingMat, setEditingMat] = useState<RawMaterial | null>(null);
    const [selectedMat, setSelectedMat] = useState<RawMaterial | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI State for Group Creation (Split Logic)
    const [groupMode, setGroupMode] = useState<'SELECT' | 'CREATE'>('SELECT');
    // UI State for Category Creation
    const [categoryMode, setCategoryMode] = useState<'SELECT' | 'CREATE'>('SELECT');

    // Transaction Form
    const [trxType, setTrxType] = useState<'IN' | 'OUT' | 'ADJ'>('IN');
    const [trxQty, setTrxQty] = useState('');
    const [trxTotalValue, setTrxTotalValue] = useState(''); // NEW: Valor Total da Compra (R$)
    const [trxNote, setTrxNote] = useState('');
    const [isTrxSubmitting, setIsTrxSubmitting] = useState(false);

    useEffect(() => { loadData(); }, [user?.organizationId]);

    // ... (rest of code)

    // NOTE: I need to wrap the whole component changes in a larger chunk because they are separate.
    // I will replace separate blocks via MULTI_REPLACE or just focus on the Modal and Handler first.
    // However, I need to insert the state definition at the top.
    // And modify the handler separately.
    // Since 'replace_file_content' is single block, I will replace the state initialization section first.

    // Wait, the tool is strictly for single contiguous block.
    // This replace call is trying to do too much if I target the whole file.
    // I will restart and use `multi_replace_file_content` or sequential replacements.
    // Let's replace the state definition first (lines 68-72).


    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [matData, trxData] = await Promise.all([
                fetchMaterials(user?.organizationId),
                fetchInventoryTransactions(user?.organizationId)
            ]);
            setMaterials(matData);
            setTransactions(trxData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshHistory = async () => {
        const trxData = await fetchInventoryTransactions(user?.organizationId);
        setTransactions(trxData);
    };

    const openHistory = async (mat?: RawMaterial) => {
        setHistoryLoading(true);
        setHistoryModalOpen(true);
        setSelectedMat(mat || null);
        try {
            if (mat) {
                const specificHistory = await fetchMaterialTransactions(mat.id);
                setHistoryItems(specificHistory);
            } else {
                setHistoryItems(transactions);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar histórico.");
        } finally {
            setHistoryLoading(false);
        }
    };

    // --- GROUPING LOGIC ---
    const groupedInventory = useMemo(() => {
        const groups: Record<string, MaterialGroup> = {};

        // Filter first
        const filtered = materials.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.code.toLowerCase().includes(searchTerm.toLowerCase()) || (m.group || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = activeCategory === 'ALL' || m.category === activeCategory;
            return matchesSearch && matchesCat;
        });

        filtered.forEach(mat => {
            const groupName = mat.group || 'Diversos';
            if (!groups[groupName]) {
                groups[groupName] = {
                    name: groupName,
                    items: [],
                    totalStock: 0,
                    totalValue: 0,
                    lowStockCount: 0,
                    units: new Set()
                };
            }

            groups[groupName].items.push(mat);
            groups[groupName].totalStock += mat.currentStock;
            groups[groupName].totalValue += (mat.currentStock * mat.unitCost);
            if (mat.currentStock <= mat.minStock) groups[groupName].lowStockCount++;
            groups[groupName].units.add(mat.unit);
        });

        return Object.values(groups).sort((a, b) => b.totalValue - a.totalValue);
    }, [materials, searchTerm, activeCategory]);

    // Used for the "Details" view
    const currentGroupItems = useMemo(() => {
        if (!selectedGroup) return [];
        return materials.filter(m => (m.group || 'Diversos') === selectedGroup).sort((a, b) => a.name.localeCompare(b.name));
    }, [materials, selectedGroup]);

    // --- DASHBOARD METRICS ---
    const metrics = useMemo(() => {
        let totalValue = 0;
        let lowStockCount = 0;
        let totalItems = materials.length;

        materials.forEach(m => {
            totalValue += (m.currentStock * m.unitCost);
            if (m.currentStock <= m.minStock) lowStockCount++;
        });

        return { totalValue, lowStockCount, totalItems };
    }, [materials]);

    const handleSaveMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMat) return;

        // Validation for Create Modes
        if (groupMode === 'CREATE') {
            if (!editingMat.group || editingMat.group.trim().length < 2) {
                toast.warning("Por favor, digite um nome válido para a nova família/grupo (mínimo 2 caracteres).");
                return;
            }
        }

        if (categoryMode === 'CREATE') {
            if (!editingMat.category || editingMat.category.trim().length < 2) {
                toast.warning("Por favor, digite um nome válido para a nova categoria.");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const cost = parseInputNumber(editingMat.unitCost.toString());
            const min = parseInputNumber(editingMat.minStock.toString());
            const current = parseInputNumber(editingMat.currentStock.toString());
            const lead = parseInputNumber(editingMat.leadTime?.toString() || '0'); // NEW

            if (isNaN(cost) || isNaN(min) || isNaN(current)) throw new Error("Valores numéricos inválidos");

            // Ensure group is set (default to Diversos if empty)
            const finalGroup = editingMat.group && editingMat.group.trim() !== '' ? editingMat.group : 'Diversos';

            await saveMaterial({
                ...editingMat,
                unitCost: cost,
                minStock: min,
                currentStock: current,
                leadTime: lead, // NEW
                group: finalGroup
            }, user?.organizationId);
            setModalOpen(false);
            setEditingMat(null);
            loadData();
        } catch (error: any) {
            toast.error("Erro ao salvar material: " + formatError(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCategoryChange = (cat: MaterialCategory) => {
        if (!editingMat) return;
        let defaultUnit = editingMat.unit;
        // Logic specific to default categories
        if (cat === 'energy') defaultUnit = 'kWh';
        else if (cat === 'labor') defaultUnit = 'h';
        else if (cat === 'raw_material' && defaultUnit === 'h') defaultUnit = 'kg';
        else if (cat === 'packaging' && defaultUnit === 'kg') defaultUnit = 'un';

        setEditingMat({ ...editingMat, category: cat, unit: defaultUnit });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir material?")) return;
        try {
            await deleteMaterial(id);
            loadData();
            toast.success("Material excluído com sucesso.");
        } catch (e: any) {
            toast.error("Não é possível excluir: " + formatError(e));
        }
    };

    const handleTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMat || !trxQty) return;

        setIsTrxSubmitting(true);
        try {
            const numQty = parseInputNumber(trxQty);
            if (isNaN(numQty) || (trxType !== 'ADJ' && numQty <= 0)) {
                throw new Error(`Quantidade inválida. Insira um número maior que zero.`);
            }

            // Append User Info to Notes
            let finalNote = trxNote;
            if (user && user.fullName) {
                finalNote = finalNote ? `${finalNote} - por ${user.fullName}` : `Manual - por ${user.fullName}`;
            }

            // CÁLCULO DO NOVO CUSTO MÉDIO (Se houver valor de compra)
            let newUnitCost: number | undefined = undefined;
            if (trxType === 'IN' && trxTotalValue) {
                const purchaseValue = parseInputNumber(trxTotalValue);
                if (!isNaN(purchaseValue) && purchaseValue > 0) {
                    const currentTotalValue = selectedMat.currentStock * selectedMat.unitCost;
                    const newTotalQty = selectedMat.currentStock + numQty;

                    if (newTotalQty > 0) {
                        newUnitCost = (currentTotalValue + purchaseValue) / newTotalQty;
                        // Add info to notes
                        finalNote += ` | Custo Médio Ajustado: R$ ${selectedMat.unitCost.toFixed(2)} -> R$ ${newUnitCost.toFixed(2)}`;
                    }
                }
            }

            await processStockTransaction({
                materialId: selectedMat.id,
                type: trxType,
                quantity: numQty,
                notes: finalNote
            }, newUnitCost, user?.organizationId);

            setTrxModalOpen(false);
            loadData();
        } catch (e: any) {
            alert("Erro na transação: " + formatError(e));
        } finally {
            setIsTrxSubmitting(false);
        }
    };

    const handleRenameGroup = async () => {
        if (!selectedGroup || selectedGroup === 'Diversos') {
            alert("Não é possível renomear o grupo padrão.");
            return;
        }

        const newName = window.prompt("Novo nome para o grupo (Isso atualizará todos os itens):", selectedGroup);
        if (!newName || newName === selectedGroup) return;

        try {
            setLoading(true);
            await renameMaterialGroup(selectedGroup, newName);
            setSelectedGroup(newName); // Update UI context
            loadData(); // Refresh data
        } catch (e) {
            alert("Erro ao renomear: " + formatError(e));
            setLoading(false);
        }
    };

    const openNew = () => {
        // Pre-fill group if inside a group view
        const defaultGroup = selectedGroup && selectedGroup !== 'Diversos' ? selectedGroup : 'Diversos';
        setEditingMat({ id: '', code: '', name: '', unit: 'kg', currentStock: 0, minStock: 100, unitCost: 0, category: 'raw_material', group: defaultGroup, leadTime: 0 });
        setGroupMode('SELECT'); // Reset to selection mode
        setCategoryMode('SELECT');
        setModalOpen(true);
    };

    const openEdit = (mat: RawMaterial) => {
        setEditingMat(mat);
        setGroupMode('SELECT');
        setCategoryMode('SELECT');
        setModalOpen(true);
    };

    const openTrx = (mat: RawMaterial, type: 'IN' | 'OUT') => {
        setSelectedMat(mat);
        setTrxType(type);
        setTrxQty('');
        setTrxTotalValue(''); // Reset value
        setTrxNote('');
        setTrxModalOpen(true);
    };

    const getCategoryIcon = (cat: MaterialCategory) => {
        switch (cat) {
            case 'packaging': return <Box size={18} className="text-orange-500" />;
            case 'return': return <Undo2 size={18} className="text-red-500" />;
            case 'energy': return <Zap size={18} className="text-yellow-500" />;
            case 'labor': return <User size={18} className="text-blue-500" />;
            case 'overhead': return <DollarSign size={18} className="text-green-500" />;
            case 'raw_material': return <Hammer size={18} className="text-slate-500" />;
            default: return <Tag size={18} className="text-indigo-500" />;
        }
    };

    const getCategoryLabel = (cat: string) => {
        return DEFAULT_CATEGORIES[cat] || cat;
    };

    // --- KITTING LOGIC ---
    const handleOpenKitting = async () => {
        setLoading(true);
        try {
            const [prods, mats, boms] = await Promise.all([
                fetchProducts(),
                fetchMaterials(),
                fetchAllActiveBOMs()
            ]);

            const options = calculateKittingOptions(prods, mats, boms);
            setKittingOptions(options);
            setKittingModalOpen(true);
        } catch (e) {
            alert("Erro ao carregar opções de montagem: " + formatError(e));
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteKitting = async (opt: any, qty: number) => {
        if (qty <= 0) return;
        if (!confirm(`Confirmar montagem de ${qty} kits de ${opt.product.produto}? Isso consumirá os componentes do estoque.`)) return;

        setIsSubmitting(true);
        try {
            // 1. Consume Components
            for (const comp of opt.components) {
                if (comp.materialId) {
                    await processStockTransaction({
                        materialId: comp.materialId,
                        type: 'OUT',
                        quantity: parseFloat((comp.required * qty).toFixed(4)),
                        notes: `Montagem Kit ${opt.product.produto} (${qty} un)`
                    }, undefined, user?.organizationId);
                }
            }

            // 2. Add Kit to Inventory
            // Try to find material by code
            const kitMaterial = materials.find(m => m.code === opt.product.codigo.toString()); // Note: product.codigo is number

            if (kitMaterial) {
                await processStockTransaction({
                    materialId: kitMaterial.id,
                    type: 'IN',
                    quantity: qty,
                    notes: `Montagem Kit ${opt.product.produto}`
                }, undefined, user?.organizationId);
                alert("Montagem realizada com sucesso! Estoque atualizado.");
                setKittingModalOpen(false);
                loadData();
            } else {
                alert(`Montagem realizada (baixa de componentes), MAS o Kit/Produto final (${opt.product.produto}) não foi encontrado no Estoque para dar entrada. Certifique-se de cadastrá-lo com código ${opt.product.codigo}.`);
                setKittingModalOpen(false);
                loadData();
            }

        } catch (e) {
            alert("Erro na montagem: " + formatError(e));
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTransactionPreview = () => {
        if (!selectedMat || !trxQty) return null;
        const qty = parseInputNumber(trxQty);
        if (isNaN(qty)) return null;

        const current = selectedMat.currentStock;
        let future = current;
        if (trxType === 'IN') future = current + qty;
        else if (trxType === 'OUT') future = current - qty;
        else if (trxType === 'ADJ') future = qty;

        return { current, future, diff: future - current };
    };

    // Suggest existing groups for autocomplete
    const existingGroups = useMemo(() => {
        const s = new Set<string>();
        materials.forEach(m => { if (m.group && m.group !== 'Diversos') s.add(m.group); });
        return Array.from(s).sort();
    }, [materials]);

    // Consolidate all available categories (Defaults + Custom ones found in DB)
    const allCategories = useMemo(() => {
        const cats = new Set(Object.keys(DEFAULT_CATEGORIES));
        materials.forEach(m => {
            if (m.category) cats.add(m.category);
        });
        return Array.from(cats).sort();
    }, [materials]);

    const preview = getTransactionPreview();
    const isBalanceInsufficient = trxType === 'OUT' && preview && preview.future < 0;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Gestão de Estoque (WMS)</h2>
                    <p className="text-slate-500">
                        {selectedGroup ? `Itens da Família: ${selectedGroup}` : 'Visão Geral por Família de Materiais'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {selectedGroup && (
                        <button onClick={() => setSelectedGroup(null)} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-100 flex items-center transition-all">
                            <ArrowLeft size={18} className="mr-2" /> Voltar
                        </button>
                    )}
                    <button onClick={() => openHistory()} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center hover:bg-slate-50 shadow-sm transition-all font-bold mr-2">
                        <History size={20} className="mr-2 text-slate-500" /> Histórico Geral
                    </button>
                    <button onClick={handleOpenKitting} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-purple-700 shadow-sm transition-all font-bold mr-2">
                        <Layers size={20} className="mr-2" /> Assistente de Montagem
                    </button>
                    <button onClick={openNew} className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-brand-700 shadow-sm transition-all font-bold">
                        <Plus size={20} className="mr-2" /> Novo Item
                    </button>
                </div>
            </div>

            {/* DASHBOARD CARDS (Show only on Main View) */}
            {!selectedGroup && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Valor Total</p>
                            <h3 className="text-2xl font-bold text-brand-700">R$ {metrics.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="p-3 bg-brand-50 text-brand-600 rounded-lg">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Itens Críticos</p>
                            <h3 className={`text-2xl font-bold ${metrics.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {metrics.lowStockCount} <span className="text-sm text-slate-400 font-normal">de {metrics.totalItems}</span>
                            </h3>
                        </div>
                        <div className={`p-3 rounded-lg ${metrics.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            <AlertCircle size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Movimentações Recentes</p>
                            <h3 className="text-2xl font-bold text-slate-700">{transactions.length}</h3>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                            <History size={24} />
                        </div>
                    </div>
                </div>
            )}

            {/* FILTERS & SEARCH (Always visible but adapts) */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-2 rounded-xl shadow-sm border border-slate-200 sticky top-0 z-20">
                <div className="flex-1 w-full md:w-auto flex items-center px-2">
                    <Search className="text-slate-400 mr-2" size={20} />
                    <input
                        type="text"
                        placeholder={selectedGroup ? `Buscar itens em ${selectedGroup}...` : "Buscar grupos ou materiais..."}
                        className="flex-1 outline-none text-slate-700 text-sm h-10"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                {!selectedGroup && (
                    <div className="flex space-x-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                        {[
                            { id: 'ALL', label: 'Todos', icon: Cuboid },
                            { id: 'raw_material', label: 'Mat. Prima', icon: Hammer },
                            { id: 'packaging', label: 'Embalagem', icon: Box },
                            { id: 'return', label: 'Retorno', icon: Undo2 },
                            { id: 'labor', label: 'M.O.', icon: User },
                        ].map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id as any)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center whitespace-nowrap transition-all ${activeCategory === cat.id
                                    ? 'bg-slate-800 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                <cat.icon size={14} className="mr-1.5" />
                                {cat.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600" /></div>
            ) : (
                <>
                    {/* VIEW 1: GROUP CARDS (PARENTS) */}
                    {!selectedGroup && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {groupedInventory.map(group => (
                                <div
                                    key={group.name}
                                    onClick={() => setSelectedGroup(group.name)}
                                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all cursor-pointer group hover:border-brand-300 relative h-full flex flex-col"
                                >
                                    {/* Parent Indicator Badge */}
                                    <div className="absolute top-0 right-0 bg-brand-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                                        FAMÍLIA / PAI
                                    </div>

                                    <div className="p-5 border-b border-slate-50 flex justify-between items-start mt-2">
                                        <div className="flex items-center space-x-3 w-full">
                                            <div className="p-3 bg-brand-50 text-brand-600 rounded-lg group-hover:bg-brand-600 group-hover:text-white transition-colors shrink-0">
                                                <Layers size={24} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className="text-lg font-bold text-slate-800 leading-tight truncate w-full" title={group.name}>{group.name}</h3>
                                                <div className="flex items-center text-slate-500 text-xs mt-1">
                                                    <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded mr-1 text-slate-700">{group.items.length}</span>
                                                    <span>itens vinculados</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-slate-50/50 flex-1 flex flex-col justify-between">
                                        <div className="grid grid-cols-1 gap-2 mb-2">
                                            <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 shadow-sm">
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total em Estoque</p>
                                                <p className="text-lg font-bold text-slate-800">
                                                    {group.totalStock.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                                                        {Array.from(group.units).join('/')}
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="text-right mt-1">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase mr-2">Valor Estimado</span>
                                                <span className="text-sm font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                                                    R$ {group.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                        {group.lowStockCount > 0 && (
                                            <div className="mt-3 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center animate-pulse">
                                                <AlertCircle size={14} className="mr-2" />
                                                {group.lowStockCount} itens críticos
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {groupedInventory.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                                    Nenhum material encontrado. Clique em "Novo Item" para começar.
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW 2: ITEMS LIST (CHILDREN) */}
                    {selectedGroup && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-right-4">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-100 text-brand-700 rounded-lg">
                                        <Layers size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 text-lg flex items-center">
                                                {selectedGroup}
                                            </h3>
                                            <button
                                                onClick={handleRenameGroup}
                                                className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                                title="Renomear Grupo (Pai)"
                                                aria-label="Renomear Grupo (Pai)"
                                            >
                                                <Edit size={14} />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500">Visualizando itens vinculados a este grupo</p>
                                    </div>
                                </div>
                                <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500 font-bold shadow-sm">
                                    {currentGroupItems.length} variações
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-slate-600 font-semibold border-b">
                                        <tr>
                                            <th className="px-3 py-4">Item (Filho)</th>
                                            <th className="px-3 py-4">Categoria</th>
                                            <th className="px-3 py-4 text-right">Estoque</th>
                                            <th className="px-3 py-4 text-right text-orange-600">Reservado</th>
                                            <th className="px-3 py-4 text-right">Custo Un.</th>
                                            <th className="px-3 py-4 text-right">Valor Total</th>
                                            <th className="px-3 py-4 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {currentGroupItems.map(mat => (
                                            <tr key={mat.id} className="hover:bg-slate-50 group transition-colors">
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center">
                                                        <div className={`w-2 h-2 rounded-full mr-3 ${mat.currentStock <= mat.minStock ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                                        <div>
                                                            <div className="font-bold text-slate-800">{mat.name}</div>
                                                            <div className="text-xs text-slate-400 font-mono">{mat.code}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center text-slate-500 text-xs">
                                                        {getCategoryIcon(mat.category)}
                                                        <span className="ml-2 capitalize">{getCategoryLabel(mat.category)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <div className={`font-bold ${mat.currentStock <= mat.minStock ? 'text-red-600' : 'text-slate-700'}`}>
                                                        {mat.currentStock.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-400">{mat.unit}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">Min: {mat.minStock}</div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <div className="font-bold text-orange-600">
                                                        {(mat.allocated || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        <span className="text-xs font-normal text-slate-400 ml-1">{mat.unit}</span>
                                                    </div>
                                                    {(mat.allocated || 0) > 0 && (
                                                        <div className="text-[10px] text-slate-400">
                                                            Disponível: {((mat.currentStock - (mat.allocated || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 text-right font-mono text-slate-600">
                                                    R$ {mat.unitCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 py-4 text-right font-bold text-slate-800 bg-slate-50/50">
                                                    {formatCurrency(mat.currentStock * mat.unitCost)}
                                                </td>
                                                <td className="px-3 py-4 text-center">
                                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openHistory(mat)}
                                                            className="p-1.5 bg-brand-50 text-brand-700 rounded hover:bg-brand-100"
                                                            title="Ver Histórico (Kardex)"
                                                            aria-label="Ver Histórico (Kardex)"
                                                        >
                                                            <History size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => openTrx(mat, 'IN')}
                                                            className="p-1.5 bg-green-50 text-green-700 rounded hover:bg-green-100"
                                                            title="Entrada"
                                                            aria-label="Entrada"
                                                        >
                                                            <ArrowDownCircle size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => openTrx(mat, 'OUT')}
                                                            className="p-1.5 bg-orange-50 text-orange-700 rounded hover:bg-orange-100"
                                                            title="Saída"
                                                            aria-label="Saída"
                                                        >
                                                            <ArrowUpCircle size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => openEdit(mat)}
                                                            className="p-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                                            title="Editar"
                                                            aria-label="Editar"
                                                        >
                                                            <RefreshCw size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(mat.id)}
                                                            className="p-1.5 bg-red-50 text-red-700 rounded hover:bg-red-100"
                                                            title="Excluir"
                                                            aria-label="Excluir"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
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

            {/* MODAL CADASTRO (Updated with Tabs for Group AND Category Selection) */}
            {modalOpen && editingMat && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-slate-800">{editingMat.id ? 'Editar Item de Estoque' : 'Novo Item de Estoque'}</h3>
                            <button onClick={() => setModalOpen(false)} aria-label="Fechar" title="Fechar"><X className="text-slate-400 hover:text-slate-600" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form onSubmit={handleSaveMaterial} className="space-y-6">

                                {/* 1. GROUP SELECTION SECTION (With Tabs) */}
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                                        <label className="text-sm font-bold text-blue-800 flex items-center">
                                            <Layers size={18} className="mr-2 text-blue-600" />
                                            Classificação (Família / Pai)
                                        </label>

                                        {/* Group Tabs */}
                                        <div className="flex bg-white rounded-lg border border-blue-200 p-1 self-start md:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => { setGroupMode('SELECT'); setEditingMat(prev => prev ? { ...prev, group: 'Diversos' } : null); }}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center ${groupMode === 'SELECT' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                <ListIcon size={12} className="mr-1.5" /> Selecionar Existente
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setGroupMode('CREATE'); setEditingMat(prev => prev ? { ...prev, group: '' } : null); }}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center ${groupMode === 'CREATE' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                <Plus size={12} className="mr-1.5" /> Criar Nova Família
                                            </button>
                                        </div>
                                    </div>

                                    {groupMode === 'SELECT' ? (
                                        <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                            <select
                                                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none shadow-sm"
                                                value={editingMat.group || 'Diversos'}
                                                onChange={e => setEditingMat({ ...editingMat, group: e.target.value })}
                                                aria-label="Selecionar família existente"
                                                title="Selecionar família existente"
                                            >
                                                <option value="Diversos">Diversos (Padrão)</option>
                                                {existingGroups.filter(g => g !== 'Diversos').map(g => (
                                                    <option key={g} value={g}>{g}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-blue-600/70 mt-1.5 ml-1">
                                                Selecione uma família existente para agrupar este item.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="relative">
                                                <Input
                                                    label=""
                                                    value={editingMat.group || ''}
                                                    onChange={e => setEditingMat({ ...editingMat, group: e.target.value })}
                                                    placeholder="Digite o nome da nova família (ex: Resinas, Caixas)..."
                                                    className="bg-white border-blue-300 focus:ring-blue-400 font-bold text-blue-900 placeholder:font-normal placeholder:text-blue-300"
                                                    autoFocus
                                                />
                                                <div className="absolute right-2 top-2 text-green-600 pointer-events-none opacity-0 transition-opacity">
                                                    <CheckCircle2 size={20} />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-blue-700 mt-2 flex items-start bg-blue-100/50 p-2 rounded border border-blue-100">
                                                <Info size={14} className="mr-1.5 flex-shrink-0 mt-0.5" />
                                                <span>
                                                    <b>Atenção:</b> Uma nova família (Card Principal) será criada no painel com o nome digitado acima assim que você salvar este item.
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* 2. MAIN GRID LAYOUT */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-slate-100">

                                    {/* Código */}
                                    <div className="md:col-span-3">
                                        <Input label="Código" value={editingMat.code} onChange={e => setEditingMat({ ...editingMat, code: e.target.value })} required placeholder="Cód." />
                                    </div>

                                    {/* Descrição */}
                                    <div className="md:col-span-9">
                                        <Input label="Descrição do Item (Filho)" value={editingMat.name} onChange={e => setEditingMat({ ...editingMat, name: e.target.value })} required placeholder="Ex: Caixa 300x300" />
                                    </div>

                                    {/* Categoria - NEW DYNAMIC SELECT/CREATE */}
                                    <div className="md:col-span-4">
                                        <label className="text-sm font-semibold text-slate-700 mb-1 flex justify-between items-center">
                                            Categoria
                                            <div className="flex bg-slate-100 rounded p-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => { setCategoryMode('SELECT'); setEditingMat(prev => prev ? { ...prev, category: 'raw_material' } : null) }}
                                                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${categoryMode === 'SELECT' ? 'bg-white shadow text-brand-600' : 'text-slate-400'}`}
                                                >
                                                    Lista
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCategoryMode('CREATE'); setEditingMat(prev => prev ? { ...prev, category: '' } : null) }}
                                                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${categoryMode === 'CREATE' ? 'bg-white shadow text-brand-600' : 'text-slate-400'}`}
                                                >
                                                    Nova
                                                </button>
                                            </div>
                                        </label>

                                        {categoryMode === 'SELECT' ? (
                                            <select
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                                value={editingMat.category}
                                                onChange={e => handleCategoryChange(e.target.value as any)}
                                                aria-label="Selecionar categoria"
                                                title="Selecionar categoria"
                                            >
                                                {allCategories.map(cat => (
                                                    <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input
                                                label=""
                                                value={editingMat.category}
                                                onChange={e => setEditingMat({ ...editingMat, category: e.target.value })}
                                                placeholder="Digite nova categoria..."
                                                className="h-[38px] text-sm"
                                            />
                                        )}
                                    </div>

                                    {/* Unidade */}
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-semibold text-slate-700 mb-1 block">Unidade</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                            value={editingMat.unit}
                                            onChange={e => setEditingMat({ ...editingMat, unit: e.target.value })}
                                            aria-label="Selecionar unidade de medida"
                                            title="Selecionar unidade de medida"
                                        >
                                            <option value="kg">kg</option>
                                            <option value="g">g</option>
                                            <option value="un">un</option>
                                            <option value="l">l</option>
                                            <option value="m">m</option>
                                            <option value="kWh">kWh</option>
                                            <option value="h">h</option>
                                        </select>
                                    </div>

                                    {/* Custo Unitário */}
                                    <div className="md:col-span-3">
                                        <Input label="Custo Unit. (R$)" type="text" value={editingMat.unitCost} onChange={e => setEditingMat({ ...editingMat, unitCost: e.target.value as any })} placeholder="0.00" />
                                    </div>

                                    {/* Estoque Mínimo */}
                                    <div className="md:col-span-3">
                                        <Input label="Estoque Mínimo" type="text" value={editingMat.minStock} onChange={e => setEditingMat({ ...editingMat, minStock: e.target.value as any })} placeholder="0.00" />
                                    </div>

                                    {/* Lead Time (NEW) */}
                                    <div className="md:col-span-3">
                                        <Input label="Lead Time (Dias)" type="number" value={editingMat.leadTime || ''} onChange={e => setEditingMat({ ...editingMat, leadTime: Number(e.target.value) })} placeholder="0" />
                                    </div>
                                </div>

                                {/* 3. MANUAL STOCK ADJUSTMENT (Bottom Section) */}
                                <div className="pt-2 border-t border-slate-100">
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-center justify-between">
                                        <div>
                                            <label className="text-xs font-bold text-orange-700 flex items-center">
                                                <AlertCircle size={12} className="mr-1" /> Saldo Inicial / Correção
                                            </label>
                                            <p className="text-[10px] text-orange-600 mt-0.5 max-w-[250px] leading-tight">
                                                Para movimentações do dia-a-dia, use os botões de Entrada/Saída na lista.
                                            </p>
                                        </div>
                                        <div className="w-32">
                                            <Input label="" type="text" value={editingMat.currentStock} onChange={e => setEditingMat({ ...editingMat, currentStock: e.target.value as any })} placeholder="0.00" className="bg-white border-orange-200 focus:ring-orange-200 text-right font-bold" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-2">
                                    <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-600">Cancelar</button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center font-bold shadow-md disabled:opacity-70"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
                                        Salvar Item
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TRANSAÇÃO */}
            {trxModalOpen && selectedMat && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in zoom-in-95">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-1 flex items-center text-slate-800">
                            {trxType === 'IN' ? <ArrowDownCircle className="mr-2 text-green-600" /> : trxType === 'OUT' ? <ArrowUpCircle className="mr-2 text-orange-600" /> : <RefreshCw className="mr-2 text-blue-600" />}
                            {trxType === 'IN' ? 'Entrada de Estoque' : trxType === 'OUT' ? 'Saída Manual' : 'Ajuste de Inventário'}
                        </h3>
                        <p className="text-slate-500 mb-6 text-sm ml-8">{selectedMat.code} - {selectedMat.name}</p>

                        <form onSubmit={handleTransaction} className="space-y-5">
                            <Input
                                label={`Quantidade (${selectedMat.unit})`}
                                type="text"
                                autoFocus
                                placeholder="0,00"
                                value={trxQty}
                                onChange={e => setTrxQty(e.target.value)}
                                required
                                className="text-lg font-bold"
                            />

                            {/* Campo de VALOR TOTAL DA COMPRA (Apenas na Entrada) */}
                            {trxType === 'IN' && (
                                <div className="bg-green-50/50 p-3 rounded-lg border border-green-100">
                                    <Input
                                        label="Valor Total da Nota/Compra (R$)"
                                        type="text"
                                        placeholder="0,00"
                                        value={trxTotalValue}
                                        onChange={e => setTrxTotalValue(e.target.value)}
                                        className="font-bold text-green-800"
                                    />
                                    <p className="text-[10px] text-green-600 mt-1">
                                        *Preencher apenas se desejar atualizar o Custo Médio do item.
                                        Deixe vazio para manter o custo atual.
                                    </p>
                                </div>
                            )}

                            {preview && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden">
                                    <div className="flex justify-between items-center text-center relative z-10">
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Atual</p>
                                            <p className="text-lg font-bold text-slate-700">
                                                {preview.current.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                            </p>
                                        </div>
                                        <ArrowRight className="text-slate-300" />
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Novo Saldo</p>
                                            <p className={`text-lg font-bold ${preview.future < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                                                {preview.future.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                            </p>
                                        </div>
                                    </div>
                                    {isBalanceInsufficient && (
                                        <div className="mt-3 bg-red-100 text-red-700 text-xs font-bold p-2 rounded flex items-center justify-center animate-pulse">
                                            <AlertCircle size={14} className="mr-1" /> Saldo Insuficiente!
                                        </div>
                                    )}
                                </div>
                            )}

                            <Input
                                label="Observação (Opcional)"
                                value={trxNote}
                                onChange={e => setTrxNote(e.target.value)}
                                placeholder="Ex: NF 1234, Ajuste contagem..."
                            />

                            <div className="flex justify-end space-x-3 pt-2">
                                <button type="button" onClick={() => setTrxModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm font-medium">Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={isTrxSubmitting || !!isBalanceInsufficient}
                                    className={`px-6 py-2 text-white rounded-lg font-bold flex items-center transition-all shadow-md ${isBalanceInsufficient ? 'bg-slate-300 cursor-not-allowed' :
                                        trxType === 'IN' ? 'bg-green-600 hover:bg-green-700' :
                                            trxType === 'OUT' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                >
                                    {isTrxSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL KITTING (ASSISTENTE DE MONTAGEM) */}
            {kittingModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in zoom-in-95">
                    <div className="bg-white rounded-xl w-full max-w-4xl p-6 shadow-2xl h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-purple-700 flex items-center">
                                    <Layers className="mr-2" /> Assistente de Montagem (Kitting)
                                </h3>
                                <p className="text-slate-500 text-sm">Transforme componentes (Pratos/Tampas) em Kits prontos.</p>
                            </div>
                            <button onClick={() => setKittingModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar" title="Fechar"><X /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4">
                            {kittingOptions.length === 0 ? (
                                <div className="text-center p-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                    <Info size={48} className="mx-auto mb-3 opacity-20" />
                                    <p>Nenhuma oportunidade de montagem identificada.</p>
                                    <p className="text-sm mt-2">Verifique se os produtos possuem Ficha Técnica (BOM) cadastrada e se há saldo dos componentes no estoque.</p>
                                </div>
                            ) : kittingOptions.map((opt, idx) => (
                                <div key={idx} className="border border-slate-200 rounded-xl p-4 hover:border-purple-200 transition-colors bg-slate-50/50">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-lg text-slate-800">{opt.product.produto}</h4>
                                            <p className="text-xs text-slate-500 font-mono">Cód: {opt.product.codigo}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs uppercase font-bold text-slate-500">Máximo Produzível</span>
                                            <span className="text-2xl font-bold text-purple-600">{opt.maxKits} un</span>
                                        </div>
                                    </div>

                                    {/* Components Breakdown */}
                                    <div className="bg-white rounded-lg border border-slate-100 p-3 mb-4">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Componentes Necessários</p>
                                        <div className="space-y-2">
                                            {opt.components.map((c: any, i: number) => (
                                                <div key={i} className="flex justify-between text-sm items-center border-b border-slate-50 pb-1 last:border-0">
                                                    <span className="flex items-center text-slate-700">
                                                        <Box size={12} className="mr-2 text-slate-400" /> {c.name || 'Desconhecido'}
                                                    </span>
                                                    <div className="flex gap-4 text-xs">
                                                        <span className="text-slate-400">Req: {c.required}</span>
                                                        <span className={`font-bold ${c.stock < c.required ? 'text-red-500' : 'text-green-600'}`}>
                                                            Estoque: {c.stock}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                                        <div className="flex items-center">
                                            <label className="text-xs font-bold text-slate-500 mr-2">Qtd a Montar:</label>
                                            <input
                                                type="number"
                                                className="w-24 px-2 py-1 border rounded font-bold text-right"
                                                defaultValue={opt.maxKits > 0 ? opt.maxKits : 0}
                                                id={`qty-${idx}`}
                                                aria-label={`Quantidade a montar de ${opt.product.produto}`}
                                                title={`Quantidade a montar de ${opt.product.produto}`}
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const el = document.getElementById(`qty-${idx}`) as HTMLInputElement;
                                                handleExecuteKitting(opt, Number(el.value));
                                            }}
                                            disabled={opt.maxKits <= 0 || isSubmitting}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center shadow-sm"
                                        >
                                            {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Zap size={16} className="mr-2" />}
                                            Transformar Estoque
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL HISTORY (KARDEX) */}
            <StockHistoryModal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                loading={historyLoading}
                historyItems={historyItems}
                selectedMat={selectedMat}
            />


        </div>
    );
};

export default InventoryPage;