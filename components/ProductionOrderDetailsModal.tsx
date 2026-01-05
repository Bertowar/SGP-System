
import React, { useState, useEffect } from 'react';
import { ProductionOrder, WorkOrder, MaterialReservation, Machine } from '../types';
import { fetchProductionOrderDetails, saveProductionOrder, fetchActiveProductionOrders, fetchEntriesByProductionOrderId } from '../services/productionService';
import { fetchMachines } from '../services/masterDataService';
import { formatNumber } from '../services/utils';
import { X, Calendar, Package, Clock, CheckCircle2, AlertCircle, Play, Layers, Boxes, User, ArrowRight, Activity, CheckSquare, Scale } from 'lucide-react';

interface ProductionOrderDetailsModalProps {
    opId: string;
    onClose: () => void;
    onUpdate?: () => void;
}

const ProductionOrderDetailsModal: React.FC<ProductionOrderDetailsModalProps> = ({ opId, onClose, onUpdate }) => {
    const [op, setOp] = useState<any | null>(null);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [activeOps, setActiveOps] = useState<any[]>([]); // To store all active OPs for load calc
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'roteiro' | 'materiais' | 'apontamentos'>('roteiro');
    const [entries, setEntries] = useState<any[]>([]);

    // Determine context (Extrusion vs Others)
    const currentMachine = machines.find(m => m.id === op?.machineId) || machines.find(m => m.code === op?.machineId);
    const isExtrusion = currentMachine?.sector === 'Extrusão' || op?.product?.type === 'INTERMEDIATE' || op?.product?.produto?.toLowerCase().includes('bobina');

    const realizedTotal = entries.filter(e => e.id !== 'error').reduce((acc, e) => {
        // Exclude downtime entries from production totals
        if (e.downtimeMinutes > 0) return acc;

        if (isExtrusion) {
            return acc + (Number(e.measuredWeight) || Number(e.metaData?.measuredWeight) || 0);
        }
        return acc + (Number(e.qtyOK) || 0);
    }, 0);

    const targetTotal = op?.targetQuantity || 0;
    const progressPct = targetTotal > 0 ? Math.min(100, Math.floor((realizedTotal / targetTotal) * 100)) : 0;

    useEffect(() => {
        loadDetails();
    }, [opId]);

    // ... (lines skipped)

    {
        !entries?.length && (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Activity className="mx-auto mb-2 opacity-50" />
                Nenhum apontamento registrado para esta OP.
            </div>
        )
    }

    const loadDetails = async () => {
        setLoading(true);
        const [data, ms, active, ents] = await Promise.all([
            fetchProductionOrderDetails(opId),
            fetchMachines(),
            fetchActiveProductionOrders(),
            fetchEntriesByProductionOrderId(opId)
        ]);
        setOp(data);
        setMachines(ms);
        setActiveOps(active);
        setEntries(ents);
        setLoading(false);
    };

    const getMachineAvailability = (targetMachineId: string) => {
        if (!targetMachineId) return null;
        const now = new Date();
        let totalSecondsRemaining = 0;

        activeOps.forEach(o => {
            // Check direct assignment using UUID
            if (o.machineId === targetMachineId && o.status !== 'COMPLETED' && o.status !== 'CANCELLED') {
                if (o.workOrders && o.workOrders.length > 0) {
                    // Sum WorkOrders for this machine
                    o.workOrders.forEach((wo: any) => {
                        if (wo.machineId === targetMachineId && wo.status !== 'COMPLETED') {
                            const rem = (wo.qtyPlanned - wo.qtyProduced);
                            if (rem > 0) totalSecondsRemaining += (rem * (wo.cycleTime || 10)); // Default 10s if missing
                        }
                    });
                } else {
                    // Fallback to OP level
                    const rem = (o.targetQuantity - o.producedQuantity);
                    if (rem > 0) totalSecondsRemaining += (rem * 10);
                }
            }
        });

        if (totalSecondsRemaining <= 0) return now;
        return new Date(now.getTime() + (totalSecondsRemaining * 1000));
    };

    const handleMachineChange = async (newMachineId: string) => {
        if (!op) return;
        setSaving(true);
        try {
            await saveProductionOrder({ id: op.id, machineId: newMachineId || null });
            setOp({ ...op, machineId: newMachineId }); // Optimistic update
            onUpdate?.();
        } catch (error) {
            console.error("Erro ao salvar máquina:", error);
            console.error("Erro ao salvar máquina:", error);
            const targetMachine = machines.find((m: any) => m.id === newMachineId);
            const sessionOrg = machines.length > 0 ? machines[0].organizationId : 'Unknown';
            const debugInfo = `\nOP ID: ${op.id}\nOP Org: ${op.organizationId || 'N/A'}\nTarget Machine: ${targetMachine?.name} (${targetMachine?.code})\nMachine Org: ${targetMachine?.organizationId || 'N/A'}\nSession Org (Proxy): ${sessionOrg}`;
            alert(`Erro ao salvar máquina: ${error.message || JSON.stringify(error)}${debugInfo}`);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!op) return;
        setSaving(true);
        try {
            await saveProductionOrder({ id: op.id, status: newStatus as any });
            setOp({ ...op, status: newStatus });
            onUpdate?.();
        } catch (error) {
            console.error("Erro ao salvar status:", error);
            alert("Erro ao salvar status.");
        } finally {
            setSaving(false);
        }
    };

    const getConsumptionData = () => {
        if (!op?.reservations) return [];

        const totals: Record<string, number> = {};

        // Aggregate from Entries
        console.log('DEBUG: Entries:', entries);
        entries.forEach(e => {
            if (!e.metaData) return;
            // Skip pure downtime entries that might have accidental metadata copy
            if ((e.qtyOK || 0) === 0 && (e.qtyDefect || 0) === 0) return;

            // Extrusion Logic
            if (e.metaData.extrusion) {
                // Mix
                if (e.metaData.extrusion.mix?.length) {
                    e.metaData.extrusion.mix.forEach((m: any) => {
                        const qty = Number(m.qty) || 0;
                        if (qty > 0 && m.subType) {
                            // NEW: Use Composite Key (Type + SubType) to prevent collision (e.g. key: "FLAKE CRISTAL")
                            const type = m.type ? m.type.toUpperCase() : '';
                            const sub = m.subType.toUpperCase();
                            const compositeKey = type ? `${type} ${sub}` : sub;

                            totals[compositeKey] = (totals[compositeKey] || 0) + qty;
                        }
                    });
                }
                // Additives
                if (e.metaData.extrusion.additives) {
                    Object.entries(e.metaData.extrusion.additives).forEach(([key, val]) => {
                        const qty = Number(val) || 0;
                        if (qty > 0) {
                            // Map keys to readable text
                            let label = key;
                            if (key === 'pigmentBlack') label = 'PRETO';
                            if (key === 'pigmentWhite') label = 'BRANCO';
                            if (key === 'alvejante') label = 'ALVEJANTE';
                            if (key === 'clarificante') label = 'CLARIFICANTE';
                            totals[label.toUpperCase()] = (totals[label.toUpperCase()] || 0) + qty;
                        }
                    });
                }
            }
        });
        console.log('DEBUG: Totals:', totals);

        const consumedKeys = new Set<string>();
        const results: any[] = [];

        // 1. Map Reservations to Realized
        op.reservations.forEach((res: any) => {
            const matName = res.material?.name?.toUpperCase() || '';
            let realized = 0;

            // Better Matching Heuristic
            Object.keys(totals).forEach(key => {
                // Key format: "TYPE SUBTYPE" or just "SUBTYPE"
                // MatName format: "PET FLAKE RECICLADO", "APARA CRISTAL", "ALVEJANTE BRANCO"

                let match = false;

                // 1. Exact Includes (Simplest)
                if (matName.includes(key)) {
                    match = true;
                }
                // 2. Cross Match for FLAKE / APARA specific logic
                else {
                    const parts = key.split(' ');
                    if (parts.length >= 2) {
                        const type = parts[0]; // FLAKE, APARA
                        const sub = parts.slice(1).join(' '); // CRISTAL, AZUL

                        // If Reservation confirms Type (e.g. contains 'APARA') AND contains Subtype ('CRISTAL')
                        // And the Key is indeed 'APARA CRISTAL'
                        if (matName.includes(type) && matName.includes(sub)) {
                            match = true;
                        }
                        // Special Case: "PET FLAKE RECICLADO" vs "FLAKE CRISTAL"
                        // Often "Reciclado" = "Cristal" in this context? Or user selected wrong?
                        // If user put "FLAKE CRISTAL" and reservation is "PET FLAKE", we should probably match if no other specific match?
                        // Let's rely on Type match first.
                        if (type === 'FLAKE' && matName.includes('FLAKE') && !matName.includes('APARA')) {
                            // Weak match on subtype?
                            // If matName has "RECICLADO" and key has "CRISTAL", maybe treat as equivalent?
                            if (sub === 'CRISTAL' && matName.includes('RECICLADO')) match = true;
                        }
                    }
                }

                if (match) {
                    realized += totals[key];
                    consumedKeys.add(key);
                }
            });

            results.push({
                name: res.material?.name || 'Material',
                code: res.material?.code,
                planned: Number(res.quantity) || 0,
                realized: realized,
                diff: realized - (Number(res.quantity) || 0),
                pct: Number(res.quantity) > 0 ? (realized / Number(res.quantity)) * 100 : 0
            });
        });

        // 2. Add Unplanned Items (Extra)
        Object.keys(totals).forEach(key => {
            if (!consumedKeys.has(key)) {
                results.push({
                    name: key, // Use the key as name (e.g., "FLAKE AZUL")
                    code: 'EXTRA',
                    planned: 0,
                    realized: totals[key],
                    diff: totals[key], // All realized is "excess" since planned was 0
                    pct: 100 // Visual indicator full
                });
            }
        });

        return results;
    };

    if (!op && !loading) {
        return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center">
                    <AlertCircle size={48} className="text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Erro ao carregar detalhes</h3>
                    <p className="text-slate-500 mb-6 text-center">Não foi possível encontrar os dados da OP ou consultar os detalhes.</p>
                    <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-2 rounded-lg transition-colors">Fechar</button>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'text-slate-500 bg-slate-100';
            case 'READY': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'IN_PROGRESS': return 'text-orange-600 bg-orange-50 border-orange-200 animate-pulse';
            case 'COMPLETED': return 'text-green-600 bg-green-50 border-green-200';
            case 'CONFIRMED': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'PLANNED': return 'text-slate-500 border-slate-200';
            default: return 'text-slate-500';
        }
    };

    const translateStatus = (status: string) => {
        const map: Record<string, string> = {
            'PENDING': 'PENDENTE',
            'READY': 'PRONTO',
            'IN_PROGRESS': 'EM PRODUÇÃO',
            'COMPLETED': 'CONCLUÍDO',
            'CONFIRMED': 'CONFIRMADO',
            'PLANNED': 'PLANEJADO',
            'CANCELLED': 'CANCELADO',
            'PAUSED': 'PAUSADO',
            'CONSUMED': 'CONSUMIDO',
            'RELEASED': 'LIBERADO',
            'DRAFT': 'RASCUNHO',
            'SEPARATED': 'SEPARADO',
            'SHIPPED': 'ENVIADO'
        };
        return map[status] || status;
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded font-mono">
                                #{op?.id}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getStatusColor(op?.status)}`}>
                                {translateStatus(op?.status)}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {op?.product?.produto}
                        </h2>
                        <p className="text-sm text-slate-500 flex items-center gap-4 mt-1">
                            <span className="flex items-center"><Calendar size={14} className="mr-1" /> Entrega: {op?.deliveryDate ? new Date(op.deliveryDate).toLocaleDateString() : 'N/D'}</span>
                            <span className="flex items-center"><Package size={14} className="mr-1" /> Qtd: {formatNumber(op?.targetQuantity, 0)}</span>
                        </p>

                        {/* MACHINE & STATUS SELECTORS */}
                        <div className="mt-3 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Máquina:</label>
                                <select
                                    className="text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-brand-500 bg-white min-w-[140px]"
                                    value={op?.machineId || ''}
                                    onChange={(e) => handleMachineChange(e.target.value)}
                                >
                                    <option value="">Selecione...</option>
                                    {machines.filter(m => {
                                        // 1. Try to infer sector from Product Type or Name
                                        // Note: `op.product` usually has `type` if fetched correctly, or we use name heuristics.
                                        // We need to match with Machine Sector (usually 'Extrusão' or 'Termoformagem')

                                        const prodType = op?.product?.type || '';
                                        const prodName = op?.product?.produto || '';

                                        let targetSector = '';

                                        // Heuristic: Intermediate/Bobina = Extrusão
                                        if (prodType === 'INTERMEDIATE' || prodName.toLowerCase().includes('bobina')) {
                                            targetSector = 'Extrus'; // Match 'Extrusão' or 'Extrusora'
                                        }
                                        // Heuristic: Finished = Termoformagem
                                        else if (prodType === 'FINISHED' || (prodName && !prodName.toLowerCase().includes('bobina'))) {
                                            targetSector = 'Termo'; // Match 'Termoformagem'
                                        }

                                        // If we identified a target sector, filter strictly
                                        if (targetSector) {
                                            return m.sector?.toLowerCase().includes(targetSector.toLowerCase());
                                        }

                                        // Fallback: If no logic matches, show all (or maybe none?) - better show all to be safe.
                                        return true;
                                    }).map(m => {
                                        const availDate = getMachineAvailability(m.id);
                                        const isBusy = availDate && availDate > new Date();

                                        // Format Message
                                        const busyText = isBusy ? ` (Ocupada até ${availDate.toLocaleDateString()})` : '';

                                        return (
                                            <option key={m.id} value={m.id} disabled={!!isBusy} className={isBusy ? 'text-red-400' : ''}>
                                                {m.code} - {m.name}{busyText}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Status:</label>
                                <select
                                    className="text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-brand-500 bg-white min-w-[120px]"
                                    value={op?.status || 'PLANNED'}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                >
                                    <option value="PLANNED">PENDENTE</option>
                                    <option value="IN_PROGRESS">INICIADA</option>
                                    <option value="PAUSED">PAUSADA</option>
                                    <option value="COMPLETED">CONCLUÍDA</option>
                                    <option value="CANCELLED">CANCELADA</option>
                                </select>
                            </div>

                            {/* Finish Button */}
                            {op?.status !== 'COMPLETED' && op?.status !== 'CANCELLED' && (
                                <button
                                    onClick={() => {
                                        if (window.confirm('Confirma o encerramento desta Ordem de Produção?')) {
                                            handleStatusChange('COMPLETED');
                                        }
                                    }}
                                    className="ml-2 flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors shadow-sm"
                                    title="Encerrar Produção"
                                >
                                    <CheckSquare size={14} />
                                    Finalizar OP
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status Card: Realized vs Planned */}
                    <div className="hidden md:block mx-6 flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm max-w-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Progresso da Produção</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${progressPct >= 100 ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {progressPct}%
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-brand-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPct}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                                <Activity size={12} className="text-green-500" />
                                {formatNumber(realizedTotal, isExtrusion ? 2 : 0)} {isExtrusion ? 'kg' : 'Un'}
                            </span>
                            <span className="text-slate-400 font-medium">Meta: {formatNumber(targetTotal, 0)} {isExtrusion ? 'kg' : 'Un'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {saving && <span className="text-xs font-bold text-green-600 animate-pulse flex items-center"><CheckCircle2 size={14} className="mr-1" /> Salvando...</span>}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
                    <button
                        onClick={() => setActiveTab('roteiro')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'roteiro' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layers size={16} /> Roteiro de Produção
                    </button>
                    <button
                        onClick={() => setActiveTab('materiais')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'materiais' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Boxes size={16} /> Materiais Reservados
                    </button>
                    <button
                        onClick={() => setActiveTab('apontamentos')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'apontamentos' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Activity size={16} /> Apontamentos
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-slate-400">Carregando detalhes...</div>
                    ) : (
                        <>
                            {/* TAB ROTEIRO */}
                            {activeTab === 'roteiro' && (
                                <div className="space-y-4">
                                    {!op?.steps?.length && (
                                        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            <AlertCircle className="mx-auto mb-2 opacity-50" />
                                            Nenhum roteiro vinculado a esta OP.
                                        </div>
                                    )}

                                    <div className="relative">
                                        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200"></div>
                                        {op?.steps?.filter((step: any) => {
                                            // Filter steps by Sector to avoid showing Extrusion steps in Thermo OP and vice versa
                                            const prodType = op?.product?.type || '';
                                            const prodName = op?.product?.produto || '';
                                            const isExtrusionOp = prodType === 'INTERMEDIATE' || prodName.toLowerCase().includes('bobina');

                                            const stepDesc = step.step?.description?.toLowerCase() || '';
                                            // Check step machine sector if available
                                            const machSector = step.machine?.sector?.toLowerCase() || '';

                                            if (isExtrusionOp) {
                                                // In Extrusion OP, hide Thermoforming steps
                                                if (stepDesc.includes('termo') || machSector.includes('termo')) return false;
                                            } else {
                                                // In Thermo OP (Finished), hide Extrusion steps
                                                if (stepDesc.includes('extrus') || machSector.includes('extrus')) return false;
                                            }
                                            return true;
                                        }).sort((a: any, b: any) => (a.step?.stepOrder || 0) - (b.step?.stepOrder || 0)).map((step: any, idx: number) => (
                                            <div key={step.id} className="relative z-10 pl-14 mb-6 last:mb-0 group">
                                                <div className={`absolute left-4 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center text-[10px] font-bold z-20 ${step.status === 'COMPLETED' ? 'border-green-500 text-green-600' :
                                                    step.status === 'IN_PROGRESS' ? 'border-orange-500 text-orange-600' :
                                                        step.status === 'READY' ? 'border-blue-500 text-blue-600' : 'border-slate-300 text-slate-400'
                                                    }`}>
                                                    {idx + 1}
                                                </div>

                                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 group-hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                                {step.step?.description || `Etapa ${step.step?.stepOrder}`}
                                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${getStatusColor(step.status)}`}>
                                                                    {translateStatus(step.status)}
                                                                </span>
                                                            </h4>
                                                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                                                <Clock size={12} /> Setup: {step.step?.setupTime}m | Ciclo: {step.step?.cycleTime}s
                                                            </p>
                                                        </div>
                                                        {step.machine && (
                                                            <div className="text-right">
                                                                <div className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                                    {step.machine.name}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-4 mt-4 bg-slate-50 p-3 rounded border border-slate-100">
                                                        <div className="text-center">
                                                            <div className="text-[10px] uppercase font-bold text-slate-400">Planejado</div>
                                                            <div className="font-mono font-bold text-slate-700">{formatNumber(step.qtyPlanned, 0)}</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[10px] uppercase font-bold text-slate-400">Produzido</div>
                                                            <div className="font-mono font-bold text-green-600">{formatNumber(step.qtyProduced, 0)}</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[10px] uppercase font-bold text-slate-400">Refugo</div>
                                                            <div className="font-mono font-bold text-red-500">{formatNumber(step.qtyRejected, 0)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB MATERIAIS */}
                            {activeTab === 'materiais' && (
                                <div className="space-y-6 animate-in fade-in">
                                    {!op?.reservations?.length && (
                                        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            <AlertCircle className="mx-auto mb-2 opacity-50" />
                                            Nenhum material reservado ou BOM não definida.
                                        </div>
                                    )}

                                    {/* COMPARATIVO DE CONSUMO - Feature Added */}
                                    {op?.reservations?.length > 0 && (
                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                            {(() => {
                                                const consumption = getConsumptionData();
                                                const totalPlanned = consumption.reduce((acc, c) => acc + c.planned, 0);
                                                const totalRealized = consumption.reduce((acc, c) => acc + c.realized, 0);
                                                const totalDiff = totalRealized - totalPlanned;
                                                const pct = totalPlanned > 0 ? (totalRealized / totalPlanned) * 100 : 0;

                                                return (
                                                    <>
                                                        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                            <h3 className="font-bold text-slate-700 flex items-center">
                                                                <Scale size={18} className="mr-2 text-slate-500" /> Comparativo de Consumo
                                                            </h3>
                                                            <span className="text-sm font-bold text-slate-600">
                                                                Consumo Total: <span className={pct > 100 ? 'text-red-600' : 'text-green-600'}>{formatNumber(pct, 0)}%</span>
                                                            </span>
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wide">
                                                                    <tr>
                                                                        <th className="px-4 py-2">Material</th>
                                                                        <th className="px-4 py-2 text-right w-32">Planejado (kg)</th>
                                                                        <th className="px-4 py-2 text-right w-32">Realizado (kg)</th>
                                                                        <th className="px-4 py-2 text-right w-32">Diferença</th>
                                                                        <th className="px-4 py-2 w-80">Progresso</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50">
                                                                    {consumption.map((item, idx) => (
                                                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                                            <td className="px-4 py-0.5">
                                                                                <div className="font-bold text-slate-700">{item.name}</div>
                                                                                <div className="text-[10px] text-slate-400 font-mono">{item.code}</div>
                                                                            </td>
                                                                            <td className="px-4 py-0.5 text-right font-mono text-slate-600">
                                                                                {formatNumber(item.planned, 2)}
                                                                            </td>
                                                                            <td className={`px-4 py-0.5 text-right font-mono ${item.realized > item.planned ? 'text-red-700 font-extrabold bg-red-100 rounded' : 'text-slate-700 font-bold'}`}>
                                                                                {formatNumber(item.realized, 2)}
                                                                            </td>
                                                                            <td className="px-4 py-0.5 text-right text-xs font-bold">
                                                                                <span className={item.diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                                                                    {item.diff > 0 ? '+' : ''}{formatNumber(item.diff, 2)} kg
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-0.5 align-middle">
                                                                                <div className="flex flex-col items-end mb-0.5">
                                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.pct > 100 ? 'bg-red-100 text-red-700' : item.pct > 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                                        {Math.floor(item.pct)}%
                                                                                    </span>
                                                                                </div>
                                                                                <div className="w-full h-4 bg-slate-50 rounded-full border border-slate-200 p-0.5 relative overflow-hidden shadow-inner">
                                                                                    <div
                                                                                        className={`h-full rounded-full transition-all duration-500 shadow-sm ${item.pct > 100 ? 'bg-red-500 shadow-red-500/50' : item.pct > 80 ? 'bg-green-500 shadow-green-500/50' : 'bg-yellow-400 shadow-yellow-400/50'}`}
                                                                                        style={{ width: `${Math.min(100, item.pct)}%`, boxShadow: item.pct > 0 ? '0 0 8px currentColor' : 'none', color: item.pct > 100 ? '#ef4444' : item.pct > 80 ? '#22c55e' : '#facc15' }}
                                                                                    ></div>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot className="bg-slate-50 border-t border-slate-200">
                                                                    <tr>
                                                                        <td className="px-4 py-2 font-bold text-slate-700 text-xs uppercase text-right">Total</td>
                                                                        <td className="px-4 py-2 text-right font-bold font-mono text-slate-700">{formatNumber(totalPlanned, 2)}</td>
                                                                        <td className="px-4 py-2 text-right font-bold font-mono text-slate-800">{formatNumber(totalRealized, 2)}</td>
                                                                        <td className={`px-4 py-2 text-right font-bold text-xs ${totalDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                            {totalDiff > 0 ? '+' : ''}{formatNumber(totalDiff, 2)} kg
                                                                        </td>
                                                                        <td className="px-4 py-2"></td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB APONTAMENTOS */}
                            {activeTab === 'apontamentos' && (
                                <div className="space-y-4">
                                    {/* Error Display */}
                                    {entries[0]?.id === 'error' && (
                                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                                            <strong className="font-bold">Erro ao carregar: </strong>
                                            <span className="block sm:inline">{entries[0].error}</span>
                                        </div>
                                    )}

                                    {!entries?.length && (
                                        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            <Activity className="mx-auto mb-2 opacity-50" />
                                            Nenhum apontamento registrado para esta OP. (Debug: {entries ? entries.length : 'null'} | OpId: {opId})
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {entries.filter(e => e.id !== 'error').map((entry: any) => (
                                            <div key={entry.id} className={`p-4 rounded-lg border flex items-center justify-between ${entry.downtimeMinutes > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-full ${entry.downtimeMinutes > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                        {entry.downtimeMinutes > 0 ? <Clock size={20} /> : <Package size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">
                                                            {entry.downtimeMinutes > 0 ? 'Parada Registrada' : 'Produção Registrada'}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 flex items-center gap-2">
                                                            <Calendar size={12} /> {new Date(entry.date).toLocaleDateString()}
                                                            <Clock size={12} /> {entry.startTime ? entry.startTime.substring(0, 5) : '--:--'} - {entry.endTime ? entry.endTime.substring(0, 5) : '--:--'}
                                                        </p>
                                                        {entry.downtimeMinutes > 0 && (
                                                            <p className="text-xs text-red-600 font-bold mt-1">Motivo: {entry.downtimeTypeName || 'N/A'} ({entry.downtimeMinutes} min)</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {entry.downtimeMinutes === 0 ? (
                                                        <div className="flex flex-col items-end">
                                                            {/* Logic to prefer Weight if available, with fallback to metadata */}
                                                            {(() => {
                                                                const weight = Number(entry.measuredWeight) || Number(entry.metaData?.measuredWeight) || 0;
                                                                if (weight > 0) {
                                                                    return (
                                                                        <>
                                                                            <div className="text-lg font-bold text-slate-700">{formatNumber(weight, 3)} <span className="text-xs font-normal text-slate-400">kg</span></div>
                                                                            <div className="flex gap-2">
                                                                                {Number(entry.qtyOK) > 0 && <span className="text-xs text-slate-500 font-mono" title="Quantidade (Un)">{formatNumber(entry.qtyOK, 0)} Un</span>}
                                                                                {entry.qtyNOK > 0 && <span className="text-xs font-bold text-red-500" title="Refugo">{formatNumber(entry.qtyNOK, 0)} Refugo</span>}
                                                                            </div>
                                                                        </>
                                                                    );
                                                                }
                                                                return (
                                                                    <>
                                                                        <div className="text-lg font-bold text-slate-700">{formatNumber(entry.qtyOK, 0)} <span className="text-xs font-normal text-slate-400">OK</span></div>
                                                                        {entry.qtyNOK > 0 && <div className="text-xs font-bold text-red-500">{formatNumber(entry.qtyNOK, 0)} Refugo</div>}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Parada</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div >
        </div >
    );
};

export default ProductionOrderDetailsModal;
