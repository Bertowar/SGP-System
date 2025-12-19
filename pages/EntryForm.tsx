import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    useProducts, useMachines, useOperators, useDowntimeTypes,
    useScrapReasons, useSectors, useWorkShifts, useMachineStatuses,
    useRegisterEntry, useCustomFields, useProductionOrders
} from '../hooks/useQueries';
import { ProductionEntry } from '../types';
import { Input, Textarea } from '../components/Input';
import { ProductSelect } from '../components/ProductSelect';
import { DynamicFields } from '../components/DynamicFields';
import { Save, AlertCircle, Loader2, ArrowLeft, Clock, Cpu, Play, Square, AlertTriangle, User, ChevronRight, X, Package, Timer, Scale, PowerOff, Calendar, Beaker, FlaskConical, Droplet, ClipboardList, Trash2 } from 'lucide-react';
import { formatError, fetchEntriesByDate, deleteEntry } from '../services/storage';

// Helper para tratar números com vírgula de forma segura



// Helper para tratar números com vírgula de forma segura
const safeParseFloat = (val: any) => {
    if (!val) return 0;
    const str = val.toString().replace(/,/g, '.');
    return parseFloat(str) || 0;
};

const EntryForm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const editEntry = (location.state as any)?.editEntry as ProductionEntry | undefined;

    // Queries
    const { data: products = [] } = useProducts();
    const { data: machines = [] } = useMachines();
    const { data: operators = [] } = useOperators();
    const { data: downtimeTypes = [] } = useDowntimeTypes();
    const { data: scrapReasons = [] } = useScrapReasons();
    const { data: shifts = [] } = useWorkShifts();
    const { data: machineStatuses = {} } = useMachineStatuses();
    const { data: customFields = [] } = useCustomFields();
    const { data: productionOrders = [] } = useProductionOrders();

    // Mutation
    const { mutateAsync: saveEntryMutation, isPending: isSubmitting } = useRegisterEntry();

    // Refs for Mix Inputs (to handle Enter navigation)
    const mixInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // FILTRO DE SETORES (Apenas Extrusão e Termoformagem conforme solicitado)
    const displayedSectors = ['Extrusão', 'Termoformagem'];

    // Current Date Helper
    const today = new Date().toISOString().split('T')[0];

    // Form State
    const [date, setDate] = useState(today);
    const [machineId, setMachineId] = useState('');
    const [operatorId, setOperatorId] = useState<number | ''>('');
    const [shift, setShift] = useState('');

    const [productCode, setProductCode] = useState<number | null>(null);
    const [selectedOpId, setSelectedOpId] = useState(''); // NEW: Selected OP ID

    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    const [qtyOK, setQtyOK] = useState(''); // Extrusão: Qtd Bobinas, TF: Qtd Peças
    const [qtyDefect, setQtyDefect] = useState(''); // Extrusão: Refile+Borra (Auto), TF: Qtd Refugo
    const [measuredWeight, setMeasuredWeight] = useState(''); // Extrusão: Peso Total (Kg)
    const [cycleRate, setCycleRate] = useState(''); // Ciclagem (Novo campo direto)

    const [scrapReasonId, setScrapReasonId] = useState('');
    const [downtimeTypeId, setDowntimeTypeId] = useState('');
    const [observations, setObservations] = useState('');

    // Custom Fields & Metadata
    const [customValues, setCustomValues] = useState<Record<string, any>>({});

    // EXTRUSION SPECIFIC STATES
    const [mixItems, setMixItems] = useState<{ type: string, subType: string, qty: string, targetPct?: string }[]>([
        { type: 'FLAKE', subType: 'CRISTAL', qty: '', targetPct: '' },
        { type: 'FLAKE', subType: 'BRANCO', qty: '', targetPct: '' },
        { type: '', subType: '', qty: '', targetPct: '' },
        { type: '', subType: '', qty: '', targetPct: '' }
    ]);

    const [additives, setAdditives] = useState({
        pigmentBlack: '',
        pigmentWhite: '',
        alvejante: '',
        clarificante: ''
    });

    // Extrusion Losses (Separate fields)
    const [refileQty, setRefileQty] = useState('');
    const [borraQty, setBorraQty] = useState('');

    const [isDowntime, setIsDowntime] = useState(false);
    const [isLongStop, setIsLongStop] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const selectedMachine = machines.find(m => m.code === machineId);
    const isExtrusion = useMemo(() => selectedMachine?.sector === 'Extrusão', [selectedMachine]);

    // Determine if Operator is Optional based on Reason
    const isOperatorExempt = useMemo(() => {
        if (!isDowntime) return false;
        if (isLongStop) return true;
        const type = downtimeTypes.find(dt => dt.id === downtimeTypeId);
        return type?.exemptFromOperator || false;
    }, [isDowntime, isLongStop, downtimeTypeId, downtimeTypes]);

    // Calculo total mistura
    const totalMixWeight = useMemo(() => {
        return mixItems.reduce((acc, item) => acc + safeParseFloat(item.qty), 0);
    }, [mixItems]);

    // VISUAL DEDUPLICATION AND SECTOR FILTERING OF SHIFTS
    const availableShifts = useMemo(() => {
        if (!selectedMachine) return [];
        const relevantShifts = shifts.filter(s => !s.sector || s.sector === selectedMachine.sector);
        const seen = new Set();
        return relevantShifts.filter(s => {
            if (seen.has(s.name)) return false;
            seen.add(s.name);
            return true;
        });
    }, [shifts, selectedMachine]);

    // FILTRO DE OPERADORES INTELIGENTE
    const filteredOperators = useMemo(() => {
        if (!selectedMachine) return [];
        const validShiftIds = shifts
            .filter(s => s.name === shift)
            .filter(s => !s.sector || s.sector === selectedMachine.sector)
            .map(s => s.id);

        return operators.filter(op => {
            if (operatorId && op.id === operatorId) return true;
            if (!op.active) return false;
            const sectorMatch = !op.sector || op.sector === selectedMachine.sector;
            const shiftMatch = !shift || !op.defaultShift || validShiftIds.includes(op.defaultShift);
            return sectorMatch && shiftMatch;
        });
    }, [operators, selectedMachine, shift, shifts, operatorId]);

    // FILTRO DE PRODUTOS
    const filteredProducts = useMemo(() => {
        if (!machineId || !selectedMachine) return [];
        return products.filter(p => {
            const allowedMachines = p.compatibleMachines || [];
            if (allowedMachines.length > 0) return allowedMachines.includes(machineId);
            if (selectedMachine.sector === 'Extrusão') return p.type === 'INTERMEDIATE';
            if (selectedMachine.sector === 'Termoformagem') return p.type === 'FINISHED';
            return true;
        });
    }, [products, machineId, selectedMachine]);

    // FILTRO DE ORDENS DE PRODUÇÃO
    const availableOps = useMemo(() => {
        if (!machineId) return [];
        return productionOrders.filter(op => {
            if (op.status !== 'PLANNED' && op.status !== 'IN_PROGRESS') return false;
            if (op.machineId && op.machineId !== machineId) return false;
            return true;
        });
    }, [productionOrders, machineId]);

    const filteredCustomFields = useMemo(() => {
        return customFields.filter(f => f.key !== 'peso_produto');
    }, [customFields]);

    // HANDLER: OP Selection
    const handleOpChange = (opId: string) => {
        setSelectedOpId(opId);
        const op = productionOrders.find(o => o.id === opId);

        if (op) {
            if (op.productCode) setProductCode(op.productCode);
            if (isExtrusion && op.metaData?.extrusion_mix) {
                const mappedMix = (op.metaData.extrusion_mix as any[]).map(item => ({
                    type: item.type,
                    subType: item.subType,
                    qty: '',
                    targetPct: item.qty
                }));
                setMixItems(mappedMix);
            }
        } else {
            setProductCode(null);
            if (isExtrusion) {
                setMixItems([
                    { type: 'FLAKE', subType: 'CRISTAL', qty: '', targetPct: '' },
                    { type: 'FLAKE', subType: 'BRANCO', qty: '', targetPct: '' },
                    { type: '', subType: '', qty: '', targetPct: '' },
                    { type: '', subType: '', qty: '', targetPct: '' }
                ]);
            }
        }
    };

    useEffect(() => {
        if (productCode && machineId) {
            const isValid = filteredProducts.some(p => p.codigo === productCode);
            if (!isValid && !selectedOpId) setProductCode(null);
        }
    }, [machineId, filteredProducts, productCode, selectedOpId]);

    useEffect(() => {
        if (isExtrusion) {
            const r = safeParseFloat(refileQty);
            const b = safeParseFloat(borraQty);
            const totalLoss = r + b;
            setQtyDefect(totalLoss > 0 ? totalLoss.toFixed(2) : '');
        }
    }, [refileQty, borraQty, isExtrusion]);

    const [historyEntries, setHistoryEntries] = useState<ProductionEntry[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // Initialize (Edit Mode)
    useEffect(() => {
        if (editEntry) {
            populateForm(editEntry);
        }
    }, [editEntry]);

    // Load History
    useEffect(() => {
        if (machineId) {
            loadHistory();
        } else {
            setHistoryEntries([]);
        }
    }, [machineId, date, shift]); // Reload when machine, date or SHIFT changes

    const loadHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const all = await fetchEntriesByDate(date);
            // Filter: same machine AND same shift (if selected), sort by created desc
            const filtered = all
                .filter(e => e.machineId === machineId && (!shift || e.shift === shift))
                .sort((a, b) => b.createdAt - a.createdAt);
            setHistoryEntries(filtered);
        } catch (error) {
            console.error(error);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const populateForm = (entry: ProductionEntry) => {
        setDate(entry.date);
        setMachineId(entry.machineId);
        setOperatorId(entry.operatorId);
        setShift(entry.shift || '');
        setProductCode(entry.productCode || null);
        setSelectedOpId(entry.productionOrderId || '');
        setStartTime(entry.startTime || '');
        setEndTime(entry.endTime || '');
        setQtyOK(entry.qtyOK.toString());
        setQtyDefect(entry.qtyDefect.toString());
        setScrapReasonId(entry.scrapReasonId || '');
        setObservations(entry.observations);
        setCycleRate(entry.cycleRate?.toString() || entry.metaData?.cycleRate?.toString() || '');

        if (entry.downtimeMinutes > 0) {
            setIsDowntime(true);
            setDowntimeTypeId(entry.downtimeTypeId || '');
            setIsLongStop(entry.metaData?.long_stop === true);
        } else {
            setIsDowntime(false);
        }

        const weight = entry.measuredWeight || entry.metaData?.measuredWeight || entry.metaData?.peso_produto || '';
        setMeasuredWeight(weight.toString());

        // Load Extrusion Specifics
        if (entry.metaData?.extrusion) {
            const ext = entry.metaData.extrusion;
            if (ext.mix) setMixItems(ext.mix);
            if (ext.additives) {
                const loadedAdds: any = { ...ext.additives };
                Object.keys(loadedAdds).forEach(k => {
                    if (typeof loadedAdds[k] === 'boolean') loadedAdds[k] = '';
                    else loadedAdds[k] = loadedAdds[k].toString();
                });
                setAdditives(loadedAdds);
            }
            if (ext.refile) setRefileQty(ext.refile.toString());
            if (ext.borra) setBorraQty(ext.borra.toString());
        }
        setCustomValues(entry.metaData || {});
    };
    // Reset Logic
    useEffect(() => {
        if (!machineId && !editEntry) {
            setOperatorId('');
            setProductCode(null);
            setSelectedOpId('');
            setStartTime('');
            setEndTime('');
            setQtyOK('');
            setQtyDefect('');
            setMeasuredWeight('');
            setCycleRate('');
            setScrapReasonId('');
            setDowntimeTypeId('');
            setObservations('');
            setIsDowntime(false);
            setIsLongStop(false);
            setErrorMsg(null);
            setShift('');
            setRefileQty('');
            setBorraQty('');
            setAdditives({ pigmentBlack: '', pigmentWhite: '', alvejante: '', clarificante: '' });
            setMixItems([
                { type: 'FLAKE', subType: 'CRISTAL', qty: '', targetPct: '' },
                { type: 'FLAKE', subType: 'BRANCO', qty: '', targetPct: '' },
                { type: '', subType: '', qty: '', targetPct: '' },
                { type: '', subType: '', qty: '', targetPct: '' }
            ]);
        }
    }, [machineId, editEntry]);

    const handleShiftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newShiftName = e.target.value;
        setShift(newShiftName);
        const targetShift = availableShifts.find(s => s.name === newShiftName);
        if (targetShift && !startTime && !endTime) {
            setStartTime(targetShift.startTime);
            setEndTime(targetShift.endTime);
        }
    };

    const calculateDuration = () => {
        if (!startTime || !endTime) return 0;
        const [h1, m1] = startTime.split(':').map(Number);
        const [h2, m2] = endTime.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 1440;
        return diff;
    };

    const closeModal = () => {
        if (editEntry) navigate(-1);
        else setMachineId('');
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (date > today) return setErrorMsg("Data inválida. Não é permitido lançar em data futura.");
        if (!machineId) return setErrorMsg("Selecione a máquina.");
        if (!operatorId && !isOperatorExempt) return setErrorMsg("Selecione o operador.");
        if (!startTime || !endTime) return setErrorMsg("Defina horário inicial e final.");

        const duration = calculateDuration();

        if (isDowntime) {
            if (!downtimeTypeId) return setErrorMsg("Selecione o tipo de parada.");
        } else {
            if (!productCode) return setErrorMsg("Selecione o produto.");
            if (qtyOK === '' && qtyDefect === '') return setErrorMsg("Informe a quantidade.");
        }

        try {
            const prodRef = products.find(p => p.codigo === productCode);

            // Conversões seguras
            const weightValue = safeParseFloat(measuredWeight);
            const boxesValue = isExtrusion ? safeParseFloat(qtyOK) : 1;
            const defectValue = safeParseFloat(qtyDefect);
            const cycleValue = safeParseFloat(cycleRate);
            const refileValue = safeParseFloat(refileQty);
            const borraValue = safeParseFloat(borraQty);

            // Automatic Scrap Logic
            const theoreticalUnitWeight = prodRef?.pesoLiquido || 0;
            const totalTheoreticalWeight = theoreticalUnitWeight * boxesValue;
            const autoCalculatedApara = weightValue > 0
                ? Math.max(0, weightValue - totalTheoreticalWeight)
                : 0;

            const metaPayload: any = {
                ...customValues,
                was_draft: editEntry?.metaData?.is_draft === true,
                long_stop: isDowntime ? isLongStop : false
            };

            if (isExtrusion && !isDowntime) {
                const additivesPayload: any = {};
                Object.keys(additives).forEach((k) => {
                    const val = (additives as any)[k];
                    if (val) additivesPayload[k] = safeParseFloat(val);
                });

                // Process Mix Items safely
                const processedMix = mixItems
                    .filter(i => i.type && i.qty)
                    .map(i => ({
                        ...i,
                        qty: safeParseFloat(i.qty).toString() // Mantenha como string no JSON se preferir, ou number. O original mantinha a string do input. Vamos converter para number para garantir e depois string se necessario, mas o original salvava o objeto mixItem direto. 
                        // Melhor: vamos salvar o valor numérico limpo mas em formato string para compatibilidade visual ou number se o backend aceitar.
                        // O original fazia: mixItems.filter... (salvava strings com virgula).
                        // Vamos tentar salvar strings limpas (com ponto) para evitar problemas futuros de parsing.
                        // Mas safeParseFloat retorna number.
                    }));

                // Correção para o array mix: vamos salvar com ponto decimal nas strings, ou numeros.
                // Vou optar por salvar NUMEROS no payload onde faz sentido, ou strings padronizadas com ponto.
                // Para garantir compatibilidade com o que existia (que parecia ser string), vou deixar string com ponto.
                const sanitizedMix = mixItems.filter(i => i.type && i.qty).map(item => ({
                    ...item,
                    qty: safeParseFloat(item.qty).toString()
                }));

                metaPayload.extrusion = {
                    mix: sanitizedMix,
                    additives: additivesPayload,
                    refile: refileValue,
                    borra: borraValue
                };
                metaPayload.boxes = boxesValue;
            }

            const entry: ProductionEntry = {
                id: editEntry?.id || crypto.randomUUID(),
                date,
                machineId,
                operatorId: operatorId ? Number(operatorId) : 99999,
                shift,
                productCode: isDowntime ? undefined : productCode || undefined,
                startTime,
                endTime,
                qtyOK: isDowntime ? 0 : safeParseFloat(qtyOK),
                qtyDefect: isDowntime ? 0 : defectValue,
                scrapReasonId: isDowntime ? undefined : scrapReasonId || undefined,
                downtimeMinutes: isDowntime ? duration : 0,
                downtimeTypeId: isDowntime ? downtimeTypeId : undefined,
                observations,
                cycleRate: cycleValue,
                measuredWeight: weightValue,
                calculatedScrap: autoCalculatedApara,
                metaData: metaPayload,
                productionOrderId: !isDowntime ? selectedOpId || undefined : undefined,
                createdAt: editEntry?.createdAt || Date.now()
            };

            await saveEntryMutation({ entry, isEdit: !!editEntry });
            if (editEntry) navigate('/list');
            else closeModal();
        } catch (err: any) {
            setErrorMsg(formatError(err) || "Erro ao salvar apontamento.");
        }
    };

    const handleMixItemChange = (index: number, field: string, val: string) => {
        const newItems = [...mixItems];
        (newItems[index] as any)[field] = val;
        setMixItems(newItems);
    };

    const handleMixKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextIndex = index + 1;
            if (nextIndex < mixInputRefs.current.length) {
                mixInputRefs.current[nextIndex]?.focus();
            }
        }
    };

    const handleEditHistory = (entry: ProductionEntry) => {
        // We use a hack mostly: navigate to the same page but with state? 
        // Or better: just populate form and use a local "editingId" state? 
        // The original component only uses 'editEntry' from location.
        // Let's rely on navigating w/ state to keep consistency or navigate to self.
        // Actually, just calling populateForm works, but we need to know we are editing an ID.
        // The original save logic uses "editEntry?.id".
        // Let's simulate editEntry by updating location state (replace) or better: add a local "editingEntryId" state.

        // HOWEVER, "saveEntryMutation" uses "isEdit: !!editEntry". 
        // To avoid big refactors, let's navigate to self with the entry.
        navigate('.', { state: { editEntry: entry }, replace: true });
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este apontamento?")) return;
        try {
            await deleteEntry(id);
            await loadHistory();
        } catch (e) {
            alert("Erro ao excluir: " + formatError(e));
        }
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-700 flex items-center mb-2 text-sm font-bold">
                        <ArrowLeft size={16} className="mr-1" /> Voltar ao Painel
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">Apontamento de Produção</h2>
                    <p className="text-slate-500">Selecione o posto de trabalho para abrir o formulário.</p>
                </div>
            </div>

            {displayedSectors.map(sector => {
                const sectorMachines = machines.filter(m => m.sector === sector);
                if (sectorMachines.length === 0) return null;
                return (
                    <div key={sector} className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center mb-4 border-b border-slate-100 pb-2">
                            <h3 className="text-lg font-bold text-slate-700 uppercase tracking-wide flex items-center">
                                {sector === 'Extrusão' ? <Cpu className="mr-2 text-blue-500" /> : <Square className="mr-2 text-orange-500" />}
                                {sector}
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {sectorMachines.map(m => {
                                const statusData = machineStatuses[m.code];
                                const status = statusData?.status || 'idle';
                                let cardClass = "border-slate-200 bg-white hover:border-brand-300";
                                let textClass = "text-slate-800";
                                let subTextClass = "text-slate-500";
                                let indicatorClass = "bg-slate-300 border-white/50";
                                let displayLabel = m.name;
                                if (status === 'running') {
                                    cardClass = "bg-green-600 border-green-600 hover:bg-green-700 hover:border-green-800 shadow-md shadow-green-200";
                                    textClass = "text-white";
                                    subTextClass = "text-green-100";
                                    indicatorClass = "bg-green-300 animate-pulse border-white/50";
                                    const prod = statusData?.productCode ? products.find(p => p.codigo === statusData.productCode) : null;
                                    displayLabel = prod ? prod.produto : 'Em Produção';
                                } else if (status === 'stopped') {
                                    cardClass = "bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-800 shadow-md shadow-red-200";
                                    textClass = "text-white";
                                    subTextClass = "text-red-100";
                                    indicatorClass = "bg-red-300 border-white/50";
                                    displayLabel = "EM PARADA";
                                }
                                return (
                                    <button key={m.code} onClick={() => setMachineId(m.code)} className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 group relative overflow-hidden h-28 transform hover:-translate-y-1 ${cardClass}`}>
                                        <div className="flex justify-between w-full mb-auto"><span className={`font-bold text-xl tracking-tight ${textClass}`}>{m.code}</span><div className={`w-3 h-3 rounded-full border-2 ${indicatorClass}`}></div></div>
                                        <span className={`text-sm font-bold truncate w-full text-left uppercase tracking-wide ${subTextClass}`}>{displayLabel}</span>
                                        <ChevronRight className={`absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity ${status !== 'idle' ? 'text-white' : 'text-slate-300'}`} size={18} />
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )
            })}

            {machineId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col scale-100">
                        <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b border-slate-100 bg-slate-50 shrink-0 gap-4">
                            <div className="flex flex-col w-full md:w-auto">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{editEntry ? 'Editar Apontamento' : 'Novo Apontamento'}</h3>
                                <div className="flex flex-col"><span className="text-6xl md:text-7xl font-black text-slate-800 tracking-tighter">{machineId}</span><span className={`text-xs font-bold uppercase tracking-wider ${isExtrusion ? 'text-blue-600' : 'text-orange-600'}`}>{selectedMachine?.sector}</span></div>
                            </div>
                            <div className="flex-1 flex justify-center w-full md:w-auto">
                                <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner w-full max-w-lg">
                                    <button type="button" onClick={() => setIsDowntime(false)} className={`flex-1 flex items-center justify-center py-4 px-4 rounded-lg text-lg md:text-xl font-extrabold transition-all duration-300 uppercase tracking-wider ${!isDowntime ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Package size={24} className="mr-2" /> PRODUÇÃO</button>
                                    <button type="button" onClick={() => setIsDowntime(true)} className={`flex-1 flex items-center justify-center py-4 px-4 rounded-lg text-lg md:text-xl font-extrabold transition-all duration-300 uppercase tracking-wider ${isDowntime ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Timer size={24} className="mr-2" /> PARADAS</button>
                                </div>
                            </div>
                            <button onClick={closeModal} className="absolute top-4 right-4 md:static p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={28} /></button>
                        </div>
                        <div className="overflow-y-auto p-6 bg-white flex-1">
                            {errorMsg && (
                                <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center border border-red-200 shadow-sm sticky top-0 z-10"><AlertCircle size={20} className="mr-3 flex-shrink-0" /><span className="font-bold">{errorMsg}</span></div>
                            )}
                            <form id="entry-form" onSubmit={handleSubmit}>
                                <div className="mb-6 p-5 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 mb-4 text-slate-700 border-b border-slate-200 pb-2"><Clock size={18} className="text-brand-600" /> <h3 className="font-bold">Dados Gerais</h3></div>
                                    <div className="space-y-4">
                                        {/* LINHA UNI-LINE: OP + DATA + TURNO + TEMPOS */}
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                                            {/* OP ou Espaço Vazio se não houver OP */}
                                            {!isDowntime && availableOps.length > 0 ? (
                                                <div className="lg:col-span-4">
                                                    <label className="text-[10px] uppercase font-bold text-blue-800 mb-1 flex items-center"><ClipboardList size={12} className="mr-1" /> Ordem de Produção</label>
                                                    <select className="w-full px-2 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-400 font-bold text-slate-700 h-[38px]" value={selectedOpId} onChange={e => handleOpChange(e.target.value)}>
                                                        <option value="">- Avulso -</option>{availableOps.map(op => <option key={op.id} value={op.id}>{op.id} - {op.product?.produto.substring(0, 15)}...</option>)}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="hidden lg:block lg:col-span-4"></div> /* Spacer to keep alignment if desired, or let others grow */
                                            )}

                                            {/* Data */}
                                            <div className={`${!isDowntime && availableOps.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Data</label>
                                                <input type="date" className="w-full px-2 py-2 border rounded-lg h-[38px] font-bold text-slate-800 text-sm" value={date} onChange={e => setDate(e.target.value)} max={today} required />
                                            </div>

                                            {/* Turno */}
                                            <div className={`${!isDowntime && availableOps.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Turno *</label>
                                                <select className="w-full px-2 py-2 border rounded-lg h-[38px] bg-white text-sm font-bold" value={shift} onChange={handleShiftChange} required disabled={!machineId}><option value="">Selecione...</option>{availableShifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                                            </div>

                                            {/* Início */}
                                            <div className={`${!isDowntime && availableOps.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Início</label>
                                                <input type="time" className="w-full px-2 py-2 border rounded-lg h-[38px] font-bold text-slate-800 text-sm" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                                            </div>

                                            {/* Fim */}
                                            <div className={`${!isDowntime && availableOps.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Fim</label>
                                                <input type="time" className="w-full px-2 py-2 border rounded-lg h-[38px] font-bold text-slate-800 text-sm" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                                            </div>
                                        </div>

                                        {/* LINHA 2: OPERADOR + PRODUTO/PARADA */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Operador */}
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Operador {isOperatorExempt ? '(Opcional)' : '*'}</label>
                                                <select className="w-full px-3 py-2 border rounded-lg h-[42px] bg-white font-medium text-sm" value={operatorId} onChange={e => setOperatorId(Number(e.target.value))} required={!isOperatorExempt} disabled={isOperatorExempt && isLongStop}><option value="">{isOperatorExempt ? 'Máquina sem operador' : 'Selecione...'}</option>{filteredOperators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select>
                                            </div>

                                            {/* Produto ou Motivo Parada */}
                                            <div>
                                                {!isDowntime ? (
                                                    <div className="relative">
                                                        {selectedOpId && (<div className="absolute inset-0 bg-slate-100/50 z-10 cursor-not-allowed rounded-lg border border-transparent hover:border-slate-300" title="Produto definido pela OP." onClick={() => alert("Produto travado pela OP selecionada.")}></div>)}
                                                        <ProductSelect products={filteredProducts} fullList={products} value={productCode} onChange={setProductCode} error={!productCode && errorMsg ? 'Selecione' : undefined} />
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Motivo Parada *</label>
                                                        <select className="w-full px-3 py-2 border rounded-lg h-[42px] bg-white font-bold text-sm" value={downtimeTypeId} onChange={e => setDowntimeTypeId(e.target.value)} required><option value="">Selecione...</option>{downtimeTypes.map(d => <option key={d.id} value={d.id}>{d.id} - {d.description}</option>)}</select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {isDowntime && (
                                            <div className="flex items-center bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg w-full h-[42px] cursor-pointer hover:bg-orange-100 transition-colors" onClick={() => { const newVal = !isLongStop; setIsLongStop(newVal); if (newVal) { setOperatorId(''); const s = shifts.find(s => s.name === shift); if (s) { setStartTime(s.startTime); setEndTime(s.endTime); } } }}>
                                                <input type="checkbox" className="w-5 h-5 text-orange-600 rounded mr-2" checked={isLongStop} readOnly /><label className="cursor-pointer font-bold text-slate-800 text-sm">Parada Longa <span className="block text-[10px] text-slate-500 font-normal">Inativação</span></label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {!isDowntime && isExtrusion && (
                                    <div className="mb-6 p-5 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in">
                                        <div className="flex items-center gap-2 mb-4 text-blue-800 border-b border-blue-200 pb-2"><Beaker size={18} className="text-blue-600" /> <h3 className="font-bold">Formulação & Aditivos</h3>{selectedOpId && <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded ml-auto font-bold">OP VINCULADA</span>}</div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm relative flex flex-col justify-between">
                                                <div><h4 className="text-xs font-bold text-blue-500 uppercase flex items-center mb-3"><FlaskConical size={14} className="mr-1" /> Mistura / Mix (Kg)</h4>{mixItems.map((item, idx) => (<div key={idx} className="flex gap-2 mb-2 items-center"><select className={`w-24 px-2 py-1 text-xs border rounded ${selectedOpId ? 'bg-slate-100 text-slate-500' : 'bg-slate-50'}`} value={item.type} onChange={e => handleMixItemChange(idx, 'type', e.target.value)} disabled={!!selectedOpId}><option value="">Tipo...</option><option value="FLAKE">FLAKE</option><option value="APARA">APARA</option></select><select className={`flex-1 px-2 py-1 text-xs border rounded ${selectedOpId ? 'bg-slate-100 text-slate-500' : 'bg-slate-50'}`} value={item.subType} onChange={e => handleMixItemChange(idx, 'subType', e.target.value)} disabled={!!selectedOpId}><option value="">Cor / Material...</option><option value="CRISTAL">CRISTAL</option><option value="BRANCO">BRANCO</option><option value="PRETO">PRETO</option><option value="AZUL">AZUL</option></select><input type="number" step="0.001" className="w-20 px-2 py-1 text-xs border rounded text-right font-bold focus:ring-2 focus:ring-blue-400 outline-none" placeholder="0.00" value={item.qty} onChange={e => handleMixItemChange(idx, 'qty', e.target.value)} onKeyDown={(e) => handleMixKeyDown(e, idx)} ref={el => { mixInputRefs.current[idx] = el; }} />{item.targetPct && (<span className="text-[9px] text-slate-400 font-mono ml-1 w-10">Ref: {item.targetPct}%</span>)}</div>))}</div>
                                                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end items-center"><span className="text-sm font-bold text-slate-500 mr-2">Total da Mistura:</span><span className="text-lg font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-lg border border-blue-200">{totalMixWeight.toFixed(2)} Kg</span></div>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm"><h4 className="text-xs font-bold text-blue-500 uppercase mb-3 flex items-center"><Droplet size={14} className="mr-1" /> Aditivos (Kg)</h4><div className="grid grid-cols-2 gap-3">{[{ key: 'pigmentBlack', label: 'Pigmento Preto' }, { key: 'pigmentWhite', label: 'Pigmento Branco' }, { key: 'alvejante', label: 'Alvejante' }, { key: 'clarificante', label: 'Clarificante' }].map(ad => (<div key={ad.key} className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 mb-1">{ad.label}</label><input type="number" step="0.001" className={`px-2 py-1.5 border rounded text-sm outline-none transition-colors ${(additives as any)[ad.key] ? 'border-blue-400 bg-blue-50 text-blue-800 font-bold' : 'border-slate-200 bg-slate-50'}`} value={(additives as any)[ad.key]} onChange={e => setAdditives({ ...additives, [ad.key]: e.target.value })} placeholder="0.000" /></div>))}</div></div>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    {!isDowntime ? (
                                        <div className="space-y-6 animate-in fade-in">
                                            {isExtrusion ? (
                                                <div className="mb-6 p-5 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in">
                                                    <div className="flex items-center gap-2 mb-4 text-slate-700 border-b border-slate-200 pb-2">
                                                        <Package size={18} className="text-slate-600" />
                                                        <h3 className="font-bold">Dados de Produção</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* 1. AREA DE PERDAS (Extrusão) */}
                                                        <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 relative overflow-hidden">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                                                            <h4 className="text-red-800 font-bold mb-3 flex items-center uppercase tracking-wide text-xs">
                                                                <Trash2 className="mr-2" size={16} /> Perdas / Aparas
                                                            </h4>
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-3 h-full">
                                                                    <div>
                                                                        <label className="text-[10px] uppercase font-bold text-red-700/70 mb-1 block">Refile (Kg)</label>
                                                                        <input type="number" step="0.001" value={refileQty} onChange={e => setRefileQty(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none font-bold text-sm text-red-700 placeholder-red-200/50 h-[38px]" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] uppercase font-bold text-red-700/70 mb-1 block">Borra (Kg)</label>
                                                                        <input type="number" step="0.001" value={borraQty} onChange={e => setBorraQty(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none font-bold text-sm text-red-700 placeholder-red-200/50 h-[38px]" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 2. AREA DE PRODUÇÃO (Extrusão) */}
                                                        <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 relative overflow-hidden">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                                                            <h4 className="text-green-800 font-bold mb-3 flex items-center uppercase tracking-wide text-xs">
                                                                <Package className="mr-2" size={16} /> Produção (Bobina)
                                                            </h4>
                                                            {/* CAMPOS EM LINHA (Grid 2 cols) */}
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] uppercase font-bold text-green-700/70 mb-1 block">Peso (Kg)</label>
                                                                    <input type="number" step="0.001" value={measuredWeight} onChange={e => setMeasuredWeight(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none font-bold text-sm text-green-700 placeholder-green-200/50 h-[38px]" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase font-bold text-green-700/70 mb-1 block">Qtd (Un)</label>
                                                                    <input type="number" value={qtyOK} onChange={e => setQtyOK(e.target.value)} placeholder="0" className="w-full px-3 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none font-bold text-sm text-green-700 placeholder-green-200/50 h-[38px]" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                    <Input label="Qtd Aprovada (OK)" type="number" value={qtyOK} onChange={e => setQtyOK(e.target.value)} placeholder="0" className="font-bold text-2xl h-12 text-green-700" />
                                                    <div className="flex flex-col space-y-1"><label className="text-sm font-semibold text-slate-700 flex items-center"><Scale size={14} className="mr-1.5 text-blue-500" />Peso Médio (g)</label><input type="number" step="0.001" value={measuredWeight} onChange={e => setMeasuredWeight(e.target.value)} placeholder="0.00" className="px-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-2xl h-12 text-blue-700" /></div>
                                                    <div className="md:col-span-1"><Input label="Qtd Refugo" type="number" value={qtyDefect} onChange={e => setQtyDefect(e.target.value)} placeholder="0" className="font-bold text-2xl h-12 text-red-600 border-red-200 focus:border-red-500" /></div>
                                                </div>
                                            )}

                                            {Number(qtyDefect) > 0 && !isExtrusion && (
                                                <div className="bg-red-50 p-4 rounded-lg border border-red-100"><label className="text-sm font-bold text-red-700 mb-2 flex items-center"><AlertTriangle size={16} className="mr-2" /> Motivo do Refugo *</label><select className="w-full px-3 py-3 border border-red-200 rounded-lg bg-white text-red-700" value={scrapReasonId} onChange={e => setScrapReasonId(e.target.value)} required><option value="">Selecione o defeito...</option>{scrapReasons.map(r => <option key={r.id} value={r.id}>{r.description}</option>)}</select></div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-6 animate-in fade-in"><div className="bg-orange-50 p-6 rounded-xl border border-orange-100 space-y-4"><h4 className="text-orange-800 font-bold text-sm uppercase tracking-wide flex items-center mb-2"><Timer size={16} className="mr-2" /> Detalhes do Tempo</h4><div className="grid grid-cols-2 gap-4"><Input label="Início da Parada" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required /><Input label="Término da Parada" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required /></div><div className="text-right pt-2 border-t border-orange-200/50 mt-2"><span className="text-xl font-mono text-slate-700 bg-white px-3 py-1 rounded border border-orange-200">{calculateDuration()} min</span></div></div></div>
                                    )}
                                    <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
                                        <Textarea label="Observações" value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ocorrências, detalhes..." />
                                        {filteredCustomFields.length > 0 && (<div className="bg-slate-50 p-5 rounded-xl border border-slate-200"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center"><Clock size={14} className="mr-2" /> Dados Adicionais/Checklist</h4><DynamicFields fields={filteredCustomFields} values={customValues} onChange={(k, v) => setCustomValues(prev => ({ ...prev, [k]: v }))} /></div>)}
                                    </div>

                                    {/* HISTÓRICO RECENTE */}
                                    {historyEntries.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-slate-200">
                                            <h4 className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                                                <Clock size={16} className="mr-2" /> Últimos Lançamentos ({date ? date.split('-').reverse().join('/') : ''})
                                            </h4>
                                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                                                        <tr>
                                                            <th className="px-4 py-2">Hora</th>
                                                            <th className="px-4 py-2">Turno</th>
                                                            <th className="px-4 py-2">Produto / Motivo</th>
                                                            <th className="px-4 py-2 text-right">Qtd</th>
                                                            <th className="px-4 py-2 text-center w-20">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {historyEntries.map(entry => (
                                                            <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-2 font-mono text-xs">{entry.startTime} - {entry.endTime}</td>
                                                                <td className="px-4 py-2">{entry.shift}</td>
                                                                <td className="px-4 py-2">
                                                                    {entry.downtimeMinutes > 0 ? (
                                                                        <span className="text-red-600 font-bold flex items-center gap-1"><PowerOff size={12} /> {entry.downtimeTypeId ? downtimeTypes.find(d => d.id === entry.downtimeTypeId)?.description : 'Parada'}</span>
                                                                    ) : (
                                                                        <span className="font-medium">{entry.productCode ? (products.find(p => p.codigo === entry.productCode)?.produto || entry.productCode) : '-'}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    {entry.downtimeMinutes > 0 ? (
                                                                        <span className="text-slate-400">{entry.downtimeMinutes} min</span>
                                                                    ) : (
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-green-700">{entry.measuredWeight || 0} Kg</span>
                                                                            {entry.metaData?.boxes && <span className="text-[10px] text-slate-500">{entry.metaData.boxes} un</span>}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button type="button" onClick={() => handleEditHistory(entry)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><ClipboardList size={16} /></button>
                                                                        <button type="button" onClick={() => handleDeleteHistory(entry.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir"><Trash2 size={16} /></button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0"><button type="button" onClick={closeModal} className="px-6 py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button><button type="submit" form="entry-form" disabled={isSubmitting} className={`px-8 py-3 text-white rounded-lg font-bold shadow-lg flex items-center disabled:opacity-70 transition-transform active:scale-95 ${isDowntime ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}{isDowntime ? 'Salvar Parada' : 'Salvar Produção'}</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntryForm;