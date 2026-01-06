
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchProductionOrders, saveProductionOrder, deleteProductionOrder, createProductionOrder } from '../services/productionService';
import { fetchProducts, fetchMachines, fetchSettings } from '../services/masterDataService';
import { formatError, formatNumber } from '../services/utils';
import { ProductionOrder, Product, Machine, AppSettings, RawMaterial } from '../types';
import { fetchMaterials, fetchBOM, calculateMRP } from '../services/inventoryService';
import { ClipboardList, Plus, Calendar, User, Package, Trash2, Edit, Save, X, Search, Filter, CheckCircle2, AlertCircle, Clock, Loader2, Calculator, ArrowRight, Zap, Info, FlaskConical, AlertTriangle, ChevronRight, ChevronDown, ShoppingCart, Factory } from 'lucide-react';
import { MRPPlanItem } from '../types';
import { Input, Textarea } from '../components/Input';
import { ProductSelect } from '../components/ProductSelect';
// import { createProductionOrder } from '../services/productionService';
import ProductionOrderDetailsModal from '../components/ProductionOrderDetailsModal';
import { MRPTreeNode } from '../components/MRPTreeNode';

import { useAuth } from '../contexts/AuthContext';

const ProductionPlanPage: React.FC = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<ProductionOrder[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    // URL Params for Deep Linking
    const [searchParams] = useSearchParams();

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
    const [editingOrder, setEditingOrder] = useState<Partial<ProductionOrder>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mix/Formulation State (for Extrusion OPs) - Stored as % in OP
    const [mixItems, setMixItems] = useState<{ type: string, subType: string, qty: string }[]>([
        { type: 'FLAKE', subType: 'CRISTAL', qty: '' },
        { type: 'FLAKE', subType: 'BRANCO', qty: '' },
        { type: '', subType: '', qty: '' },
        { type: '', subType: '', qty: '' }
    ]);

    // Calculation State for UI feedback
    const [calcInfo, setCalcInfo] = useState<{ hours: number, shifts: number, days: number, rateUsed: number, source: string } | null>(null);

    // MRP / Availability State
    const [inventory, setInventory] = useState<RawMaterial[]>([]);
    const [availability, setAvailability] = useState<any[]>([]);
    const [mrpPlan, setMrpPlan] = useState<MRPPlanItem | null>(null);
    const [checkingMRP, setCheckingMRP] = useState(false);

    // Modal Flow State
    const [modalStep, setModalStep] = useState<'INPUT' | 'REVIEW'>('INPUT');

    useEffect(() => { loadData(); }, [user?.organizationId]);

    // Deep Linking Effect
    useEffect(() => {
        const opId = searchParams.get('opId');
        if (opId && orders.length > 0 && !loading) {
            const targetOp = orders.find(o => o.id === opId);
            if (targetOp) {
                setSelectedOpId(opId);
                setDetailsModalOpen(true);
            }
        }
    }, [searchParams, orders, loading]);

    const loadData = async () => {
        setLoading(true);
        const [o, p, m, s, mat] = await Promise.all([
            fetchProductionOrders(),
            fetchProducts(),
            fetchMachines(),
            fetchSettings(),
            fetchMaterials()
        ]);
        console.log("DEBUG: LoadData complete. Orders:", o.length, "Products:", p.length, "Inventory:", mat?.length);
        setOrders(o);
        setProducts(p);
        setMachines(m);
        setSettings(s);
        setInventory(mat || []);
        setLoading(false);
    };

    // --- LOGIC: Capacity Calculation (Capacity Planning) ---
    useEffect(() => {
        // Only run logic if modal is open and we have necessary data
        if (!modalOpen || !editingOrder.productCode || !editingOrder.targetQuantity) {
            setCalcInfo(null);
            return;
        }

        const product = products.find(p => p.codigo === editingOrder.productCode);
        const machine = machines.find(m => m.code === editingOrder.machineId);

        let capacityPerHour = 0;
        let rateSource = '';

        // LÓGICA HÍBRIDA DE CAPACIDADE
        // Verifica se é Extrusão (case insensitive para robustez)
        const isExtrusion = machine?.sector && machine.sector.toLowerCase().includes('extru');

        // 1. Extrusão: Usa Capacidade da Máquina (kg/h)
        if (isExtrusion) {
            capacityPerHour = Number(machine?.productionCapacity) || 0;
            rateSource = 'Capacidade Máquina (Kg/h)';
        }
        // 2. Termoformagem (e padrão): Usa Meta do Produto (un/h)
        else {
            capacityPerHour = Number(product?.itemsPerHour) || 0;
            rateSource = 'Meta Produto (Peças/h)';
        }

        if (capacityPerHour > 0) {
            const qty = Number(editingOrder.targetQuantity);
            const totalHours = qty / capacityPerHour;
            const shiftHours = Number(settings?.shiftHours) || 8.8; // Default from settings or fallback

            // Fórmula solicitada: Dias = Horas Necessárias / HorasPorTurno
            // Aqui tratamos "Dias" como a quantidade de turnos de trabalho necessários.
            const totalShifts = totalHours / shiftHours;

            // Arredonda para cima para definir dias de calendário (mínimo 0 se qtd for 0)
            const daysToComplete = Math.ceil(totalShifts);

            setCalcInfo({
                hours: parseFloat(totalHours.toFixed(1)),
                shifts: parseFloat(totalShifts.toFixed(1)),
                days: daysToComplete,
                rateUsed: capacityPerHour,
                source: rateSource
            });

            // Auto-update Date only if user hasn't manually set a date far in the future? 
            // Currently overrides date on calc change.
            // Logic: Today + Days needed. 
            // Using Local Timezone to avoid UTC issues with date inputs
            const today = new Date();
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToComplete);

            // Correctly format to YYYY-MM-DD in local time
            const offset = targetDate.getTimezoneOffset() * 60000;
            const localDateString = (new Date(targetDate.getTime() - offset)).toISOString().slice(0, 10);

            setEditingOrder(prev => ({
                ...prev,
                deliveryDate: localDateString
            }));
        } else {
            setCalcInfo(null);
        }

    }, [editingOrder.productCode, editingOrder.targetQuantity, editingOrder.machineId, settings, modalOpen, machines, products]);

    // --- LOGIC: MRP Availability Check (Deprecated in favor of full MRP Simulation on Review Step) ---
    // Kept empty to remove old side-effect
    useEffect(() => {
        // No-op or keep simple check if needed?
        // Let's rely on the explicit "Simular Planejamento" action in the modal.
    }, []);


    const handleOpenModal = (order?: ProductionOrder) => {
        if (order) {
            setEditingOrder(order);
            // Load mix data if exists
            if (order.metaData?.extrusion_mix) {
                setMixItems(order.metaData.extrusion_mix);
            } else {
                setMixItems([
                    { type: 'FLAKE', subType: 'CRISTAL', qty: '' },
                    { type: 'FLAKE', subType: 'BRANCO', qty: '' },
                    { type: '', subType: '', qty: '' },
                    { type: '', subType: '', qty: '' }
                ]);
            }
        } else {
            // Defaults for New OP
            const todayLocal = new Date();
            const offset = todayLocal.getTimezoneOffset() * 60000;
            const todayString = (new Date(todayLocal.getTime() - offset)).toISOString().slice(0, 10);

            setEditingOrder({
                // id: undefined, // Let DB generate it
                status: 'PLANNED',
                priority: 'NORMAL',
                targetQuantity: 0,
                deliveryDate: todayString
            });
            setMixItems([
                { type: 'FLAKE', subType: 'CRISTAL', qty: '' },
                { type: 'FLAKE', subType: 'BRANCO', qty: '' },
                { type: '', subType: '', qty: '' },
                { type: '', subType: '', qty: '' }
            ]);
        }
        setModalOpen(true);
        setModalStep('INPUT'); // Reset to first step
        setMrpPlan(null);
    };

    // Computed total for Mix Validation
    const totalMixPercentage = useMemo(() => {
        return mixItems.reduce((acc, item) => acc + (parseFloat(item.qty) || 0), 0);
    }, [mixItems]);

    const handleSimulate = async () => {
        if (!editingOrder.productCode || !editingOrder.targetQuantity) {
            alert("Selecione um produto e a quantidade.");
            return;
        }

        // Validation Mix (Keep existing logic)
        const isExtrusion = isExtrusionContext();
        if (isExtrusion) {
            const hasItems = mixItems.some(i => i.type && parseFloat(i.qty) > 0);
            if (hasItems && Math.abs(totalMixPercentage - 100) > 0.1) {
                alert(`A receita (Mix) deve fechar em 100%.\nTotal atual: ${totalMixPercentage.toFixed(1)}%`);
                return;
            }
        }

        setCheckingMRP(true);
        try {
            const plan = await calculateMRP(editingOrder.productCode, editingOrder.targetQuantity);
            setMrpPlan(plan);
            setModalStep('REVIEW');
        } catch (e) {
            alert("Erro na simulação: " + formatError(e));
        } finally {
            setCheckingMRP(false);
        }
    };

    const handleSave = async () => {
        // e.preventDefault() removed as we call this manually now

        setIsSubmitting(true);
        try {
            if (!editingOrder.id) {
                // CREATE NEW (Phase 2 Logic)
                await createProductionOrder({
                    productCode: editingOrder.productCode!,
                    quantity: editingOrder.targetQuantity!,
                    deliveryDate: editingOrder.deliveryDate,
                    priority: editingOrder.priority,
                    notes: editingOrder.notes,
                    machineId: editingOrder.machineId,
                    mrpPlan: mrpPlan // Pass the validated plan
                });
            } else {
                // UPDATE EXISTING (Keep basic update)
                const isExtrusion = isExtrusionContext();
                const payload = {
                    ...editingOrder,
                    metaData: {
                        ...editingOrder.metaData,
                        extrusion_mix: isExtrusion ? mixItems.filter(i => i.type && i.qty) : undefined
                    }
                };
                await saveProductionOrder(payload);
            }

            setModalOpen(false);
            loadData();
        } catch (e) {
            alert("Erro ao salvar OP: " + formatError(e));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir esta Ordem de Produção?")) return;
        try {
            await deleteProductionOrder(id);
            loadData();
        } catch (e) {
            alert("Erro ao excluir: " + formatError(e));
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'PLANNED': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-200';
            case 'CANCELLED': return 'bg-red-50 text-red-700 border-red-200 opacity-60';
            default: return 'bg-slate-100';
        }
    };

    const getPriorityBadge = (p?: string) => {
        switch (p) {
            case 'URGENT': return <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">URGENTE</span>;
            case 'HIGH': return <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded">ALTA</span>;
            default: return null;
        }
    };

    // --- SMART MACHINE FILTERING LOGIC ---
    const filteredMachinesForOrder = useMemo(() => {
        if (!editingOrder.productCode) return [];

        const product = products.find(p => p.codigo === editingOrder.productCode);
        if (!product) return machines;

        if (product.compatibleMachines && product.compatibleMachines.length > 0) {
            return machines.filter(m => product.compatibleMachines!.includes(m.code));
        }

        const type = (product.type || '').toUpperCase();
        if (type === 'INTERMEDIATE') return machines.filter(m => m.sector === 'Extrusão');
        if (type === 'FINISHED') return machines.filter(m => m.sector === 'Termoformagem');

        return machines;
    }, [machines, products, editingOrder.productCode]);

    useEffect(() => {
        if (editingOrder.machineId && filteredMachinesForOrder.length > 0) {
            const isValid = filteredMachinesForOrder.some(m => m.code === editingOrder.machineId);
            if (!isValid) {
                setEditingOrder(prev => ({ ...prev, machineId: '' }));
            }
        }
    }, [editingOrder.productCode, filteredMachinesForOrder]);

    const isExtrusionContext = () => {
        if (!editingOrder.productCode) return false;
        const product = products.find(p => p.codigo === editingOrder.productCode);
        const machine = machines.find(m => m.code === editingOrder.machineId);

        // 1. Check by Product Type
        if (product?.type === 'INTERMEDIATE') return true;

        // 2. Check by Selected Machine Sector
        if (machine?.sector && machine.sector.toLowerCase().includes('extru')) return true;

        // 3. NEW: Check by Compatible Machines (Implicit Context)
        // Helps when creating new OP without machine selected yet
        if (product?.compatibleMachines && product.compatibleMachines.length > 0) {
            const linkedMachines = machines.filter(m => product.compatibleMachines!.includes(m.code));
            const hasExtrusionLink = linkedMachines.some(m => m.sector && m.sector.toLowerCase().includes('extru'));
            if (hasExtrusionLink) return true;
        }

        return false;
    };

    const handleMixItemChange = (index: number, field: string, val: string) => {
        const newItems = [...mixItems];
        (newItems[index] as any)[field] = val;
        setMixItems(newItems);
    };

    const filteredOrders = orders.filter(o => filterStatus === 'ALL' || o.status === filterStatus);

    const getProgress = (produced: number = 0, target: number = 1) => {
        const pct = (produced / target) * 100;
        return Math.min(pct, 100);
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-600" /></div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Planejamento e Controle (PCP)</h2>
                    <p className="text-slate-500">Gestão de Ordens de Produção (OPs)</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-brand-700 font-bold shadow-md transition-transform hover:-translate-y-0.5">
                    <Plus size={20} className="mr-2" /> Nova OP
                </button>
            </div>

            {/* FILTERS */}
            <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {['ALL', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterStatus === status
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        {status === 'ALL' ? 'Todas' : status === 'PLANNED' ? 'Planejadas' : status === 'IN_PROGRESS' ? 'Em Andamento' : status === 'COMPLETED' ? 'Concluídas' : 'Canceladas'}
                    </button>
                ))}
            </div>

            {/* KANBAN / LIST VIEW - Expanded width using negative margins (-mx-4) to gain ~15-20px per card */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 -mx-4 px-2">
                {filteredOrders.filter(o => !o.parentOrderId).length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        Nenhuma ordem encontrada.
                    </div>
                )}

                {filteredOrders.filter(o => !o.parentOrderId).map(order => {
                    // Find Child OPs
                    const childOps = filteredOrders.filter(child => child.parentOrderId === order.id);

                    return (
                        <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow relative overflow-hidden group">

                            {/* Header: Split ID and Product */}
                            <div className="flex justify-between items-start mb-2 pl-1">
                                <div className="pr-2 flex-1">
                                    <div className="flex flex-col">
                                        <span className="text-slate-500 font-mono text-xs font-medium mb-0.5">OP #{order.id} |</span>
                                        <h3 className="font-semibold text-slate-800 text-base leading-tight">
                                            {order.product?.produto || `Prod ${order.productCode}`}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        {getPriorityBadge(order.priority)}
                                        {order.machineId && (
                                            <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center">
                                                <Clock size={10} className="mr-1" /> {order.machineId}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Status & Actions */}
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    {/* Status Badge: Styled to match mockup (Solid colors or clean pills) */}
                                    <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border shadow-sm ${order.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white border-blue-700' :
                                        order.status === 'COMPLETED' ? 'bg-green-600 text-white border-green-700' :
                                            order.status === 'CONFIRMED' ? 'bg-emerald-600 text-white border-emerald-700' :
                                                order.status === 'CANCELLED' ? 'bg-red-50 text-red-600 border-red-200' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                        {order.status === 'IN_PROGRESS' ? 'EM PRODUÇÃO' :
                                            order.status === 'PLANNED' ? 'PLANEJADA' :
                                                order.status === 'CONFIRMED' ? 'CONFIRMADA' :
                                                    order.status === 'COMPLETED' ? 'CONCLUÍDA' :
                                                        order.status === 'CANCELLED' ? 'CANCELADA' : order.status}
                                    </span>

                                    {/* Action Icons */}
                                    <div className="flex gap-1 mt-1">
                                        <button onClick={() => { setSelectedOpId(order.id); setDetailsModalOpen(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors" title="Detalhes"><ClipboardList size={16} /></button>
                                        <button onClick={() => handleOpenModal(order)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-600 transition-colors" title="Editar"><Edit size={16} /></button>
                                        <button onClick={() => handleDelete(order.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>

                            {/* Separator Line */}
                            <div className="border-b border-slate-100 mb-4 -mx-5 bg-slate-50/50 h-px"></div>

                            {/* Progress Section */}
                            <div className="pl-1 mb-5">
                                <div className="text-[11px] text-slate-500 font-medium mb-1.5 ml-1">Progresso em Tempo Real</div>
                                <div className="h-6 w-full bg-blue-50 rounded-full overflow-hidden border border-blue-100 relative">
                                    <ProgressBarFill percentage={getProgress(order.producedQuantity, order.targetQuantity)} />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[11px] font-bold text-white drop-shadow-md">
                                            {formatNumber(getProgress(order.producedQuantity, order.targetQuantity), 0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Info Section: Dates & Quantity (Normal font weight) */}
                            <div className="pl-1 mb-6 space-y-2 text-sm text-slate-700">
                                {/* Line 1: Start Date (Left) | Quantity (Right) */}
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="mr-1.5 text-slate-600">Inicio:</span>
                                        <span className="text-slate-800">{new Date(order.createdAt).toLocaleDateString()}</span>
                                        <Calendar size={14} className="ml-1.5 text-slate-400" />
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-slate-800">{formatNumber(order.producedQuantity || 0, 0)}</span>
                                        <span className="mx-1 text-slate-400">/</span>
                                        <span className="text-slate-800">{formatNumber(order.targetQuantity, 0)}</span>
                                        <Package size={14} className="ml-1.5 text-slate-400" />
                                    </div>
                                </div>

                                {/* Line 2: Delivery Date (Left) */}
                                <div className="flex items-center">
                                    <span className="mr-1.5 text-slate-600">Entrega:</span>
                                    <span className="text-slate-800">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/D'}</span>
                                    <Calendar size={14} className="ml-1.5 text-slate-400" />
                                </div>
                            </div>

                            {/* PRODUCTION SEQUENCE / CHAIN (Extrusion -> Thermoforming) */}
                            {(childOps.length > 0 || true) && (
                                <div className="bg-slate-50/80 rounded-xl py-3 px-2 border border-slate-200 text-sm mt-auto">
                                    <h4 className="text-[13px] font-bold text-slate-600 mb-2 pl-1 block">
                                        Processos Vinculados (OPs Filhas)
                                    </h4>
                                    <div className="space-y-2">
                                        {[...childOps, order]
                                            .sort((a, b) => {
                                                // Sort Logic: Extrusion (1) -> Thermoforming (2) -> Others (99)
                                                // Try to guess sector from Machine or Product Type
                                                const getSectorWeight = (op: ProductionOrder) => {
                                                    const m = machines.find(mac => mac.code === op.machineId);
                                                    const sec = m?.sector?.toLowerCase() || '';
                                                    const type = op.product?.type?.toUpperCase() || '';

                                                    if (sec.includes('extru') || type === 'INTERMEDIATE') return 1;
                                                    if (sec.includes('termo') || type === 'FINISHED') return 2;
                                                    return 99;
                                                };
                                                return getSectorWeight(a) - getSectorWeight(b);
                                            })
                                            .map(chainOp => {
                                                const isCurrent = chainOp.id === order.id;
                                                const m = machines.find(mac => mac.code === chainOp.machineId);
                                                // Smart Sector Name: Machine Sector > Product Type Inference > Generic
                                                let sectorName = m?.sector;
                                                if (!sectorName) {
                                                    if (chainOp.product?.type === 'INTERMEDIATE') sectorName = 'Extrusão';
                                                    else if (chainOp.product?.type === 'FINISHED') sectorName = 'Termoformagem';
                                                    else sectorName = 'Processo';
                                                }

                                                return (
                                                    <div key={chainOp.id} className="flex flex-wrap items-center justify-between gap-2">
                                                        {/* Chain OP Pill */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Always allow opening details, even for current OP
                                                                setSelectedOpId(chainOp.id);
                                                                setDetailsModalOpen(true);
                                                            }}
                                                            className={`flex-1 min-w-0 rounded-full py-0.5 px-3 transition-colors text-left group bg-slate-100 hover:bg-blue-50 border border-slate-200 text-slate-600 hover:text-blue-800`}
                                                            title="Clique para ver detalhes e roteiro da OP"
                                                        >
                                                            <span className="text-xs font-semibold truncate block">
                                                                {isCurrent ? (
                                                                    // Current OP
                                                                    <span className="underline decoration-slate-300 underline-offset-2 group-hover:decoration-blue-300">
                                                                        {sectorName}: {chainOp.id.split('-')[2] || chainOp.id.substring(0, 8)} ({chainOp.product?.produto}) <span className="opacity-75 text-[10px] ml-1 no-underline">(Atual)</span>
                                                                    </span>
                                                                ) : (
                                                                    // Linked OP
                                                                    <span className="underline decoration-slate-300 underline-offset-2 group-hover:decoration-blue-300">
                                                                        {sectorName}: {chainOp.id.split('-')[2] || chainOp.id.substring(0, 8)} ({chainOp.product?.produto})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </button>

                                                        {/* Chain Status Badge */}
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm shrink-0 ${chainOp.status === 'COMPLETED' ? 'bg-green-600' :
                                                            chainOp.status === 'IN_PROGRESS' ? 'bg-blue-600' :
                                                                chainOp.status === 'CONFIRMED' ? 'bg-emerald-600' :
                                                                    'bg-amber-600'
                                                            }`}>
                                                            {chainOp.status === 'IN_PROGRESS' ? 'ANDAMENTO' :
                                                                chainOp.status === 'COMPLETED' ? 'CONCLUÍDO' :
                                                                    chainOp.status === 'CONFIRMED' ? 'CONFIRMADO' :
                                                                        chainOp.status === 'PLANNED' ? 'PENDENTE' : chainOp.status}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* MODAL NOVA ORDEM - NOVO LAYOUT */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
                    <div className="bg-white rounded-xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                        {/* HEADER MODAL */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex flex-col">
                                <h3 className="font-bold text-xl text-slate-800 flex items-center">
                                    <ClipboardList className="mr-2 text-brand-600" size={24} />
                                    {editingOrder.id && orders.find(o => o.id === editingOrder.id) ? 'Editar Ordem de Produção' : 'Nova Ordem de Produção'}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-600 shadow-sm">{editingOrder.id}</span>
                                    <div className="h-4 w-px bg-slate-300"></div>
                                    <select
                                        title="Status da Ordem"
                                        className="text-xs bg-transparent font-bold text-brand-700 outline-none uppercase cursor-pointer hover:text-brand-900"
                                        value={editingOrder.status}
                                        onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value as any })}
                                    >
                                        <option value="PLANNED">Planejada</option>
                                        <option value="IN_PROGRESS">Em Andamento</option>
                                        <option value="URGENT">Urgente (Prioridade)</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={() => setModalOpen(false)} title="Fechar" aria-label="Fechar Modal" className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1 space-y-8 bg-white">

                            {/* STEP 1: INPUT */}
                            {modalStep === 'INPUT' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-left-4">


                                    {/* SEÇÃO 1: O QUE PRODUZIR? (Produto + Quantidade) */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                        <div className="md:col-span-8">
                                            <div className="mb-1 flex items-center gap-2">
                                                <Package size={16} className="text-brand-600" />
                                                <label className="text-sm font-bold text-slate-700">Produto</label>
                                            </div>
                                            <ProductSelect
                                                products={products}
                                                value={editingOrder.productCode || null}
                                                onChange={(val) => {
                                                    const pCode = val ? String(val) : undefined;
                                                    // Load Mix from Master Data
                                                    if (pCode) {
                                                        const prod = products.find(p => p.codigo === pCode);
                                                        if (prod?.extrusionMix && prod.extrusionMix.length > 0) {
                                                            setMixItems(prod.extrusionMix);
                                                        } else {
                                                            // Reset to default blank mix if no master data
                                                            setMixItems([
                                                                { type: 'FLAKE', subType: 'CRISTAL', qty: '' },
                                                                { type: 'FLAKE', subType: 'BRANCO', qty: '' },
                                                                { type: '', subType: '', qty: '' },
                                                                { type: '', subType: '', qty: '' }
                                                            ]);
                                                        }
                                                    }
                                                    setEditingOrder({ ...editingOrder, productCode: pCode });
                                                }}
                                            />
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="text-sm font-bold text-slate-700 mb-1 block">Quantidade Planejada</label>
                                            <Input
                                                label=""
                                                type="number"
                                                value={editingOrder.targetQuantity}
                                                onChange={e => setEditingOrder({ ...editingOrder, targetQuantity: Number(e.target.value) })}
                                                required
                                                className="text-xl font-bold text-slate-800 h-[42px] bg-white shadow-sm border-slate-300"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* SEÇÃO 2: PLANEJAMENTO (CAPACITY) */}
                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden">
                                        {/* Decorative Background Icon */}
                                        <Calculator className="absolute -right-6 -bottom-6 text-slate-200/50 w-32 h-32 pointer-events-none" />

                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center border-b border-slate-200 pb-2">
                                            <Clock size={14} className="mr-2" /> Planejamento de Capacidade
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 items-center">
                                            {/* Coluna 1: Painel Informativo (Cálculo) */}
                                            <div>
                                                {calcInfo ? (
                                                    <div className="bg-blue-100/50 p-3 rounded-lg border border-blue-200 space-y-1">
                                                        <div className="flex justify-between text-xs text-blue-800 font-medium">
                                                            <span>Meta Base:</span>
                                                            <strong>{formatNumber(calcInfo.rateUsed, 1)}</strong>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-blue-600 font-normal">
                                                            <span>Fonte:</span>
                                                            <span>{calcInfo.source}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-blue-800 font-medium mt-1">
                                                            <span>Tempo Estimado:</span>
                                                            <strong>{formatNumber(calcInfo.hours, 1)} horas</strong>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-xs text-slate-400 bg-slate-100/50 rounded-lg border border-dashed border-slate-200 p-3">
                                                        <Info size={16} className="mr-2 shrink-0" />
                                                        {editingOrder.targetQuantity
                                                            ? "Sem dados de meta para cálculo."
                                                            : "Defina a quantidade para calcular a estimativa."}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Coluna 2: Data Calculada */}
                                            <div className="flex flex-col">
                                                <label className="text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                                                    Previsão de Término
                                                    {calcInfo && <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 rounded">Calculado (+{calcInfo.days} dias)</span>}
                                                </label>
                                                <Input
                                                    label=""
                                                    type="date"
                                                    value={editingOrder.deliveryDate}
                                                    onChange={e => setEditingOrder({ ...editingOrder, deliveryDate: e.target.value })}
                                                    required
                                                    className={`h-10 font-bold ${calcInfo ? 'bg-green-50/50 border-green-300 text-green-800 focus:ring-green-500' : 'bg-white'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>




                                    {/* SEÇÃO 2b: CHECAGEM DE DISPONIBILIDADE (MRP) */}
                                    {availability.length > 0 && (
                                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 mb-6">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center border-b border-slate-100 pb-2">
                                                <Package size={14} className="mr-2" /> Disponibilidade de Materiais (MRP)
                                            </h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase text-left">
                                                            <th className="px-3 py-2 rounded-l-lg">Componente</th>
                                                            <th className="px-3 py-2">Necessário</th>
                                                            <th className="px-3 py-2">Em Estoque</th>
                                                            <th className="px-3 py-2 rounded-r-lg text-right">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {availability.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-3 py-3 font-medium text-slate-700">{item.name}</td>
                                                                <td className="px-3 py-3">{formatNumber(item.required, 2)} <span className="text-[10px] text-slate-400">{item.unit}</span></td>
                                                                <td className="px-3 py-3 font-bold text-slate-600">{formatNumber(item.inStock, 2)} <span className="text-[10px] text-slate-400">{item.unit}</span></td>
                                                                <td className="px-3 py-3 text-right">
                                                                    {item.status === 'AVAILABLE' ? (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                                                            <CheckCircle2 size={10} className="mr-1" /> Disponível
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200" title={`Faltam ${formatNumber(item.missing, 2)} ${item.unit}`}>
                                                                            <AlertCircle size={10} className="mr-1" /> Falta {formatNumber(item.missing, 0)}{item.unit}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* SEÇÃO 3: FORMULAÇÃO / MIX (EXTRUSÃO ONLY) */}
                                    {isExtrusionContext() && (
                                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 animate-in fade-in">
                                            <div className="flex items-center gap-2 mb-4 text-blue-800 border-b border-blue-200 pb-2">
                                                <FlaskConical size={18} className="text-blue-600" />
                                                <h3 className="font-bold text-sm uppercase tracking-wide">Receita de Mistura / Mix Padrão</h3>
                                            </div>

                                            <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                                                <p className="text-xs text-slate-500 mb-4">
                                                    Defina a composição da receita em <b>Porcentagem (%)</b>. O total deve fechar em 100%.
                                                </p>
                                                {mixItems.map((item, idx) => (
                                                    <div key={idx} className="flex gap-2 mb-2">
                                                        <select title="Tipo do Material" className="w-24 px-2 py-1.5 text-xs border rounded bg-slate-50" value={item.type} onChange={e => handleMixItemChange(idx, 'type', e.target.value)}>
                                                            <option value="">Tipo...</option>
                                                            <option value="FLAKE">FLAKE</option>
                                                            <option value="APARA">APARA</option>
                                                        </select>
                                                        <select title="Subtipo / Cor" className="flex-1 px-2 py-1.5 text-xs border rounded bg-slate-50" value={item.subType} onChange={e => handleMixItemChange(idx, 'subType', e.target.value)}>
                                                            <option value="">Cor / Material...</option>
                                                            <option value="CRISTAL">CRISTAL</option>
                                                            <option value="BRANCO">BRANCO</option>
                                                            <option value="PRETO">PRETO</option>
                                                            <option value="AZUL">AZUL</option>
                                                        </select>
                                                        <div className="flex items-center w-28">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                className="w-full px-2 py-1.5 text-xs border rounded text-right font-bold"
                                                                placeholder="0"
                                                                value={item.qty}
                                                                onChange={e => handleMixItemChange(idx, 'qty', e.target.value)}
                                                            />
                                                            <span className="text-[10px] ml-1 text-slate-400 font-bold">%</span>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Validation Footer */}
                                                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end items-center">
                                                    <span className="text-xs font-bold text-slate-500 mr-2">Total Receita:</span>
                                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${Math.abs(totalMixPercentage - 100) <= 0.1
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {formatNumber(totalMixPercentage, 1)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SEÇÃO 4: DETALHES GERAIS */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-bold text-slate-700 mb-2 block">Prioridade</label>
                                            <div className="flex bg-slate-100 p-1 rounded-lg max-w-md">
                                                {['NORMAL', 'HIGH', 'URGENT'].map(p => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setEditingOrder({ ...editingOrder, priority: p as any })}
                                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${editingOrder.priority === p
                                                            ? (p === 'URGENT' ? 'bg-red-600 text-white shadow-md' : p === 'HIGH' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-800 shadow-md')
                                                            : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                    >
                                                        {p === 'NORMAL' ? 'Normal' : p === 'HIGH' ? 'Alta' : 'URGENTE'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-sm font-bold text-slate-700 mb-1 block">Cliente / Destino (Opcional)</label>
                                                <Input
                                                    label=""
                                                    value={editingOrder.customerName || ''}
                                                    onChange={e => setEditingOrder({ ...editingOrder, customerName: e.target.value })}
                                                    placeholder="Ex: Estoque, Cliente X, Intermediário..."
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1">Informe o destino (Estoque, Intermediário ou Cliente Final)</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-slate-700 mb-1 block">Observações</label>
                                                <Textarea
                                                    label=""
                                                    value={editingOrder.notes || ''}
                                                    onChange={e => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                                                    rows={2} // Reduced rows
                                                    placeholder="Detalhes específicos para a produção..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Buttons for Step 1 (moved inside form flow) */}
                                    <div className="flex justify-end gap-3 pt-8 border-t border-slate-100">
                                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                                        <button type="button" onClick={handleSimulate} disabled={checkingMRP} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-md flex items-center">{checkingMRP ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight className="mr-2" size={18} />} Simular Planejamento</button>
                                    </div>

                                </div>
                            )}

                            {/* STEP 2: REVIEW (MRP TREE) */}
                            {modalStep === 'REVIEW' && mrpPlan && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 pt-4">
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                                        <h4 className="text-lg font-bold text-blue-900 mb-2">Revisão do Planejamento</h4>
                                        <p className="text-sm text-blue-700">O sistema analisou a estrutura do produto <b>{mrpPlan.name}</b> e seu estoque atual. Abaixo estão as ações sugeridas:</p>
                                    </div>

                                    {/* Recursive Tree Component */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 p-3 border-b border-slate-200 grid grid-cols-12 text-xs font-bold text-slate-500 uppercase">
                                            <div className="col-span-6">Item / Processo</div>
                                            <div className="col-span-2 text-right">Necessário</div>
                                            <div className="col-span-2 text-right">Estoque</div>
                                            <div className="col-span-2 text-center">Ação</div>
                                        </div>
                                        <div className="bg-white p-4 space-y-2">
                                            <MRPTreeNode node={mrpPlan} />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                        <button onClick={() => setModalStep('INPUT')} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50">Voltar / Editar</button>
                                        <button onClick={handleSave} disabled={isSubmitting} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-md flex items-center">{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={18} />} Confirmar e Gerar OPs</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
            }

            {/* MODAL DETALHES (PHASE 2) */}
            {
                detailsModalOpen && selectedOpId && (
                    <ProductionOrderDetailsModal
                        opId={selectedOpId}
                        onClose={() => setDetailsModalOpen(false)}
                        onUpdate={loadData}
                    />
                )
            }
        </div >
    );
};



export default ProductionPlanPage;

const ProgressBarFill = ({ percentage }: { percentage: number }) => {
    const barRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (barRef.current) {
            barRef.current.style.width = `${Math.max(5, percentage)}%`;
        }
    }, [percentage]);

    return (
        <div
            ref={barRef}
            className="h-full rounded-full bg-blue-600 shadow-sm transition-all duration-500"
        ></div>
    );
};
