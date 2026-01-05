
import React, { useState, useEffect } from 'react';
import { Product, ProductRoute, RouteStep, Machine } from '../types';
import { fetchProductRoute, saveProductRoute, formatError, fetchMachines, fetchSectors } from '../services/storage';
import { X, Plus, Trash2, Save, MoveUp, MoveDown, Clock, Settings, Layers, AlertCircle, Loader2 } from 'lucide-react';
import { Input } from './Input';
import { Sector } from '../types';

interface RouteEditorModalProps {
    product: Product;
    onClose: () => void;
}

interface UiRouteStep extends Partial<RouteStep> {
    uiSector?: string;
}

const RouteEditorModal: React.FC<RouteEditorModalProps> = ({ product, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Header State
    const [routeId, setRouteId] = useState('');
    const [version, setVersion] = useState(1);
    const [desc, setDesc] = useState(`Roteiro Padrão: ${product.produto}`);
    const [active, setActive] = useState(true);

    // Steps State
    const [steps, setSteps] = useState<UiRouteStep[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);

    useEffect(() => {
        loadData();
    }, [product]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [route, machinesData, sectorsData] = await Promise.all([
                fetchProductRoute(product.id || ''),
                fetchMachines(),
                fetchSectors()
            ]);

            setMachines(machinesData);
            setSectors(sectorsData);

            if (route) {
                setRouteId(route.id);
                setVersion(route.version);
                setDesc(route.description || '');
                setActive(route.active);
                // Map existing steps to UI steps (populate uiSector)
                const uiSteps = (route.steps || []).map(s => {
                    const linkedMachine = machinesData.find(m => m.code === s.machineGroupId || m.name === s.machineGroupId);
                    return { ...s, uiSector: linkedMachine?.sector || '' };
                });
                setSteps(uiSteps);
            } else {
                setSteps([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Helper to convert Sector to Verb
    const getOperationVerb = (sectorName: string) => {
        const lower = sectorName.toLowerCase();
        if (lower.includes('extru')) return 'Extrusar';
        if (lower.includes('termo')) return 'Termoformar';
        if (lower.includes('impres')) return 'Imprimir';
        if (lower.includes('corte')) return 'Cortar';
        if (lower.includes('moagem') || lower.includes('moer')) return 'Moer';
        if (lower.includes('mistura')) return 'Misturar';
        if (lower.includes('embala')) return 'Embalar';
        return `Operar em ${sectorName}`;
    };

    const handleAddStep = () => {
        const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.stepOrder || 0)) + 10 : 10;

        // AUTO-FILL LOGIC: Based on Product Compatible Machines
        let defaultSector = '';
        let defaultMachine = '';
        let defaultDesc = '';

        if (product.compatibleMachines && product.compatibleMachines.length > 0) {
            // Find machines objects
            const compMachinesList = machines.filter(m => product.compatibleMachines!.includes(m.code));

            if (compMachinesList.length > 0) {
                // 1. Sector: If all compatible machines are from the same sector, use it.
                const firstSector = compMachinesList[0].sector;
                const allSameSector = compMachinesList.every(m => m.sector === firstSector);
                if (allSameSector && firstSector) {
                    defaultSector = firstSector;
                    defaultDesc = getOperationVerb(firstSector); // Auto-fill Description
                }

                // 2. Machine: If ONLY ONE compatible machine, select it.
                if (compMachinesList.length === 1) {
                    defaultMachine = compMachinesList[0].code;
                }
            }
        }

        setSteps([...steps, {
            stepOrder: nextOrder,
            machineGroupId: defaultMachine,
            uiSector: defaultSector,
            setupTime: 0,
            cycleTime: 0,
            minLotTransfer: 1,
            description: defaultDesc
        }]);
    };

    const handleRemoveStep = (index: number) => {
        const newSteps = [...steps];
        newSteps.splice(index, 1);
        setSteps(newSteps);
    };

    const handleStepChange = (index: number, field: keyof UiRouteStep, value: any) => {
        const newSteps = [...steps];

        // Logic for Sector Change
        if (field === 'uiSector') {
            const verb = getOperationVerb(value);
            newSteps[index] = {
                ...newSteps[index],
                uiSector: value,
                machineGroupId: '',
                description: verb // Auto-update description on sector change
            };
        }
        // Logic for Machine Change (Auto-set Sector if empty AND Auto-set Cycle for Extrusion)
        else if (field === 'machineGroupId') {
            const linkedMachine = machines.find(m => m.code === value || m.name === value);
            const sector = linkedMachine?.sector || newSteps[index].uiSector;

            // NEW: Auto-fill Cycle Time from Machine Capacity for Extrusion
            let newCycle = newSteps[index].cycleTime;
            if (linkedMachine?.productionCapacity && linkedMachine.sector?.toLowerCase().includes('extru')) {
                // Capacity (kg/h) -> Cycle (s) = 3600 / Capacity
                newCycle = 3600 / linkedMachine.productionCapacity;
            }

            // Auto-fill Description if empty or generic
            let newDesc = newSteps[index].description;
            if (sector && (!newDesc || newDesc.startsWith('Operar'))) {
                newDesc = getOperationVerb(sector);
            }

            newSteps[index] = {
                ...newSteps[index],
                [field]: value,
                uiSector: sector,
                cycleTime: newCycle, // Update Cycle
                description: newDesc // Update Description
            };
        }
        else {
            newSteps[index] = { ...newSteps[index], [field]: value };
        }

        setSteps(newSteps);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Validation
            if (steps.length === 0) throw new Error("O roteiro deve ter pelo menos uma etapa.");

            // VALIDATION RELAXED: Machine Group ID is now optional if Sector is defined
            // User: "Se houver mais de uma máquina compativel... deixe com opcional"
            // We still require at least a Sector so we know where to route it.
            if (steps.some(s => !s.uiSector)) throw new Error("Todas as etapas devem ter pelo menos o Setor definido.");

            // Convert UI steps back to regular steps (remove uiSector)
            const cleanSteps = steps.map(({ uiSector, ...s }) => s as RouteStep);

            await saveProductRoute({
                id: routeId,
                productId: product.id || '', // Assuming ID
                version,
                description: desc,
                active
            }, cleanSteps);

            alert("Roteiro salvo com sucesso!");
            onClose();
        } catch (e) {
            alert("Erro ao salvar: " + formatError(e));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-lg shadow-xl flex items-center">
                <Loader2 className="animate-spin mr-3 text-brand-600" /> Carregando Roteiro...
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center">
                            <Layers className="mr-2 text-brand-600" />
                            Roteiro de Produção: {product.produto}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">{product.codigo} - Versão {version}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">

                    {/* ROUTE INFO */}
                    <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Descrição do Roteiro</label>
                        <input
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            className="w-full text-lg font-medium border-b-2 border-slate-200 focus:border-brand-500 outline-none pb-1 bg-transparent placeholder-slate-300"
                            placeholder="Descreva o objetivo deste roteiro..."
                        />
                    </div>

                    {/* STEPS LIST */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <h4 className="font-bold text-slate-700 flex items-center"><Settings className="mr-2 text-slate-400" size={18} /> Etapas do Processo</h4>
                            <button onClick={handleAddStep} className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded font-bold hover:bg-brand-700 flex items-center shadow-sm">
                                <Plus size={16} className="mr-1" /> Adicionar Etapa
                            </button>
                        </div>

                        {steps.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-lg text-slate-400">
                                <AlertCircle className="mx-auto mb-2 opacity-50" size={32} />
                                <p>Nenhuma etapa definida.</p>
                                <p className="text-sm">Clique em "Adicionar Etapa" para começar.</p>
                            </div>
                        )}

                        {steps.map((step, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 relative group transition-all hover:shadow-md">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-500 rounded-l-lg"></div>
                                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleRemoveStep(idx)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                                </div>

                                <div className="grid grid-cols-12 gap-4 items-end">
                                    {/* Order */}
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Seq.</label>
                                        <div className="font-mono text-lg font-bold text-slate-700 pl-2">{step.stepOrder}</div>
                                    </div>

                                    {/* NEW: SECTOR */}
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Setor</label>
                                        <select
                                            value={step.uiSector || ''}
                                            onChange={e => handleStepChange(idx, 'uiSector', e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-brand-500"
                                        >
                                            <option value="">Selecione...</option>
                                            {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Machine Group - Filtered by Sector */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Grupo de Máquina</label>
                                        <input
                                            value={step.machineGroupId || ''}
                                            onChange={e => handleStepChange(idx, 'machineGroupId', e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-brand-500 font-medium"
                                            placeholder="Selecione ou Definir via OP..."
                                            list={`machine-groups-${idx}`}
                                        />
                                        <datalist id={`machine-groups-${idx}`}>
                                            {machines
                                                .filter(m => {
                                                    // Filter by Sector if selected
                                                    if (step.uiSector && m.sector !== step.uiSector) return false;
                                                    // NEW: Prioritize Compatible Machines if defined (and no sector selected yet to narrow down)
                                                    if (!step.uiSector && product.compatibleMachines && product.compatibleMachines.length > 0) {
                                                        return product.compatibleMachines.includes(m.code);
                                                    }
                                                    return true;
                                                })
                                                .map(m => (
                                                    <option key={m.id} value={m.code}>{m.name}</option>
                                                ))}
                                        </datalist>
                                    </div>

                                    {/* Description - col-span-3 (Restored) */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Operação / Instrução</label>
                                        <input
                                            value={step.description || ''}
                                            onChange={e => handleStepChange(idx, 'description', e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-brand-500"
                                            placeholder="Descreva a operação..."
                                        />
                                    </div>

                                    {/* Setup Time */}
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1" title="Tempo de Preparação (min)">Setup (min)</label>
                                        <input
                                            type="number"
                                            value={step.setupTime}
                                            onChange={e => handleStepChange(idx, 'setupTime', Number(e.target.value))}
                                            className="w-full p-2 border border-slate-200 rounded text-sm text-right font-mono"
                                        />
                                    </div>

                                    {/* Cycle Time / Capacity Logic - col-span-1 (Restored) */}
                                    <div className="col-span-1">
                                        {(() => {
                                            // LOGIC CHANGE: User requested "Capacidade por Minuto (pç/kg)"
                                            // Source: Product Registration (itemsPerHour)
                                            // Storage: cycleTime (seconds per unit)

                                            // Calculate current capacity in Units/Minute from cycleTime (inverse)
                                            // cycleTime (s) -> Units/Min = 60 / cycleTime
                                            const currentCapPerMin = step.cycleTime > 0 ? (60 / step.cycleTime) : 0;

                                            // Default from Product (itemsPerHour is Units/Hour) -> Units/Min
                                            const productCapPerMin = product.itemsPerHour ? (product.itemsPerHour / 60) : 0;

                                            return (
                                                <div>
                                                    <label className="text-[10px] font-bold text-brand-600 uppercase block mb-1" title="Capacidade Vinda do Cadastro">Capac.por Min(pç/kg)</label>
                                                    <input
                                                        type="number"
                                                        value={currentCapPerMin ? parseFloat(currentCapPerMin.toFixed(4)) : (productCapPerMin ? parseFloat(productCapPerMin.toFixed(4)) : '')}
                                                        onChange={e => {
                                                            const val = Number(e.target.value);
                                                            // Convert Units/Min -> sec/unit (CycleTime)
                                                            // cycleTime = 60 / val
                                                            const newCycle = val > 0 ? 60 / val : 0;
                                                            handleStepChange(idx, 'cycleTime', newCycle);
                                                        }}
                                                        className="w-full p-2 border border-brand-200 bg-brand-50 rounded text-sm text-right font-mono focus:ring-1 focus:ring-brand-500"
                                                        placeholder={productCapPerMin ? parseFloat(productCapPerMin.toFixed(4)).toString() : "0"}
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Min Lot */}
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1" title="Lote Mínimo de Transferência">Transfer.</label>
                                        <input
                                            type="number"
                                            value={step.minLotTransfer}
                                            onChange={e => handleStepChange(idx, 'minLotTransfer', Number(e.target.value))}
                                            className="w-full p-2 border border-slate-200 rounded text-sm text-right font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-md flex items-center disabled:opacity-70">
                        {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                        Salvar Roteiro
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RouteEditorModal;
