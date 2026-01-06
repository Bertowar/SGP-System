
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    fetchEntriesByDate, deleteEntry, fetchProducts, fetchOperators, fetchDowntimeTypes, fetchMachines, fetchSectors, fetchSettings, formatError, formatNumber
} from '../services/storage';
import { ProductionEntry, Product, Operator, DowntimeType, Machine, Sector, AppSettings } from '../types';
import { Trash2, Edit, Calendar, Loader2, AlertCircle, X, Eye, Clock, Cpu, Users, Package, Timer, Bookmark, Filter, XCircle } from 'lucide-react';

// --- Helpers ---
const calculateDurationMinutes = (start?: string, end?: string) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 1440; // Passou da meia-noite
    return diff;
};

const formatMinutesToHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
};

// --- Interfaces ---
interface GroupedEntry {
    key: string;
    machineId: string;
    operatorId: number;
    date: string;
    totalProdMinutes: number;
    totalStopMinutes: number;
    totalOk: number;
    totalDefect: number;
    totalWeight: number; // New Field
    totalReturn: number; // New Field: Retorno
    entries: ProductionEntry[];
    hasDrafts: boolean; // New Flag
}

// --- Modal Component for Deletion Confirmation ---
interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    isDeleting: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, title, message, isDeleting }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden scale-100 transform transition-all">
                <div className="p-6">
                    <div className="flex items-center space-x-3 text-red-600 mb-4">
                        <div className="p-3 bg-red-100 rounded-full">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-xl font-bold">{title}</h3>
                    </div>
                    <div className="text-slate-600 mb-6">
                        {message}
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md flex items-center transition-colors disabled:opacity-70"
                        >
                            {isDeleting ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                            {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Details Modal for Grouped Entries ---
interface DetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: GroupedEntry | null;
    products: Product[];
    downtimeTypes: DowntimeType[];
    onEdit: (entry: ProductionEntry) => void;
    onDelete: (entry: ProductionEntry) => void;
}

const DetailsModal: React.FC<DetailsModalProps> = ({ isOpen, onClose, group, products, downtimeTypes, onEdit, onDelete }) => {
    if (!isOpen || !group) return null;

    return (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Detalhes do Apontamento</h3>
                        <p className="text-sm text-slate-500">Máquina: <b>{group.machineId}</b> • Data: {new Date(group.date).toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
                </div>

                <div className="overflow-y-auto p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                            <tr>
                                <th className="px-6 py-3">Horário</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3">Descrição (Prod/Parada)</th>
                                <th className="px-6 py-3 text-center">Qtd / Duração</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {group.entries.map(e => {
                                const isDowntime = e.downtimeMinutes > 0;
                                const isDraft = e.metaData?.is_draft === true;

                                return (
                                    <tr key={e.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-mono text-slate-600">
                                            {e.startTime ? e.startTime.substring(0, 5) : '--:--'} - {e.endTime ? e.endTime.substring(0, 5) : '--:--'}
                                        </td>
                                        <td className="px-6 py-3">
                                            {isDraft && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-600 mr-2 border border-slate-300">
                                                    RASCUNHO
                                                </span>
                                            )}
                                            {isDowntime ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                                    <Timer size={12} className="mr-1" /> Parada
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    <Package size={12} className="mr-1" /> Produção
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            {isDowntime ? (
                                                <span className="text-slate-700">{downtimeTypes.find(dt => dt.id === e.downtimeTypeId)?.description || e.downtimeTypeId}</span>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-800">{products.find(p => p.codigo === e.productCode)?.produto}</span>
                                                    <span className="text-xs text-slate-500 truncate w-48">{e.observations}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {isDowntime ? (
                                                <span className="font-bold text-orange-700">{e.downtimeMinutes} min</span>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold text-green-700">OK: {formatNumber(e.qtyOK, 0)}</span>
                                                    {e.qtyDefect > 0 && <span className="text-xs font-bold text-red-600">Ref: {formatNumber(e.qtyDefect, 0)}</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { onClose(); onEdit(e); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                                                <button onClick={() => { onDelete(e); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm">
                    <div className="font-medium text-slate-500">Total de registros: {group.entries.length}</div>
                    <div className="flex gap-4 font-bold text-slate-700">
                        <span>Tempo Prod: {formatMinutesToHours(group.totalProdMinutes)}</span>
                        <span>Tempo Parado: {formatMinutesToHours(group.totalStopMinutes)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


import { useAuth } from '../contexts/AuthContext';

const ProductionList: React.FC = () => {
    const { user } = useAuth(); // Hooks must be at top level
    const navigate = useNavigate();

    // Data Helpers
    const today = new Date().toISOString().split('T')[0];

    // Data States
    const [entries, setEntries] = useState<ProductionEntry[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [downtimeTypes, setDowntimeTypes] = useState<DowntimeType[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);

    // Filter States
    // Filter States (Initialized from SessionStorage)
    const [date, setDate] = useState(() => sessionStorage.getItem('prodList_date') || today);
    const [selectedSector, setSelectedSector] = useState(() => sessionStorage.getItem('prodList_sector') || '');
    const [selectedMachine, setSelectedMachine] = useState(() => sessionStorage.getItem('prodList_machine') || '');
    const [selectedOperator, setSelectedOperator] = useState(() => sessionStorage.getItem('prodList_operator') || '');


    // Persist Filters
    useEffect(() => { sessionStorage.setItem('prodList_date', date); }, [date]);
    useEffect(() => { sessionStorage.setItem('prodList_sector', selectedSector); }, [selectedSector]);
    useEffect(() => { sessionStorage.setItem('prodList_machine', selectedMachine); }, [selectedMachine]);
    useEffect(() => { sessionStorage.setItem('prodList_operator', selectedOperator); }, [selectedOperator]);


    // Grouping State
    const [groupedEntries, setGroupedEntries] = useState<GroupedEntry[]>([]);

    // Modal States
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<GroupedEntry | null>(null);

    // Filters & Loading
    const [loading, setLoading] = useState(false);

    // Delete States
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Load Initial Data
    useEffect(() => {
        refreshAllData();
    }, [date, user?.organizationId]);

    // Derived filtered machine list for dropdown
    const availableMachines = useMemo(() => {
        if (!selectedSector) return machines;
        return machines.filter(m => m.sector === selectedSector);
    }, [machines, selectedSector]);

    // Derived filtered operator list for dropdown
    const availableOperators = useMemo(() => {
        if (!selectedSector) return operators;
        return operators.filter(o => !o.sector || o.sector === selectedSector);
    }, [operators, selectedSector]);



    // Grouping Logic (Memoized with Filters)
    useMemo(() => {
        const groups: Record<string, GroupedEntry> = {};

        // Apply filters first
        const filteredEntries = entries.filter(entry => {
            if (selectedMachine && entry.machineId !== selectedMachine) return false;
            if (selectedOperator && entry.operatorId.toString() !== selectedOperator) return false;



            if (selectedSector) {
                const m = machines.find(mac => mac.code === entry.machineId);
                // If machine not found, keep it safe or hide? Hide for consistency.
                if (!m || m.sector !== selectedSector) return false;
            }
            return true;
        });

        filteredEntries.forEach(entry => {
            const key = `${entry.date}-${entry.machineId}-${entry.operatorId}`;
            const isDraft = entry.metaData?.is_draft === true;

            if (!groups[key]) {
                groups[key] = {
                    key,
                    date: entry.date,
                    machineId: entry.machineId || '',
                    operatorId: entry.operatorId,
                    totalProdMinutes: 0,
                    totalStopMinutes: 0,
                    totalOk: 0,
                    totalDefect: 0,
                    totalWeight: 0,
                    totalReturn: 0,
                    entries: [],
                    hasDrafts: false
                };
            }

            groups[key].entries.push(entry);
            if (isDraft) groups[key].hasDrafts = true;

            if (entry.downtimeMinutes > 0) {
                groups[key].totalStopMinutes += entry.downtimeMinutes;
            } else {
                const duration = calculateDurationMinutes(entry.startTime, entry.endTime);
                groups[key].totalProdMinutes += duration;
                groups[key].totalOk += entry.qtyOK;
                groups[key].totalDefect += entry.qtyDefect;
                // Sum weight
                const w = Number(entry.measuredWeight || entry.metaData?.measuredWeight || 0);
                groups[key].totalWeight += w;

                // Retorno Logic
                const m = machines.find(mac => mac.code === entry.machineId);
                const isExtrusion = m?.sector === 'Extrusão' || (entry.machineId && entry.machineId.startsWith('EXT'));

                if (isExtrusion) {
                    // Extrusion: Refile + Borra from Metadata
                    const refile = Number(entry.metaData?.extrusion?.refile || 0);
                    const borra = Number(entry.metaData?.extrusion?.borra || 0);

                    // Business Rule: Include Borra only if configured
                    if (settings?.includeBorraInReturn) {
                        groups[key].totalReturn += (refile + borra);
                    } else {
                        groups[key].totalReturn += refile;
                    }
                } else {
                    // TF: Use saved calculated value directly
                    groups[key].totalReturn += entry.qtyDefect;
                }
            }
        });

        setGroupedEntries(Object.values(groups).sort((a, b) => a.machineId.localeCompare(b.machineId)));
    }, [entries, selectedMachine, selectedOperator, selectedSector, machines, settings]);

    const totals = useMemo(() => {
        return groupedEntries.reduce((acc, g) => ({
            prod: acc.prod + g.totalProdMinutes,
            stop: acc.stop + g.totalStopMinutes,
            weight: acc.weight + g.totalWeight,
            return: acc.return + g.totalReturn,
            ok: acc.ok + g.totalOk
        }), { prod: 0, stop: 0, weight: 0, return: 0, ok: 0 });
    }, [groupedEntries]);


    const refreshAllData = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const [eData, pData, oData, dtData, mData, sData, stData] = await Promise.all([
                fetchEntriesByDate(date),
                fetchProducts(),
                fetchOperators(),
                fetchDowntimeTypes(),
                fetchMachines(),
                fetchSectors(),
                fetchSettings()
            ]);
            setEntries(eData);
            setProducts(pData);
            setOperators(oData);
            setDowntimeTypes(dtData);
            setMachines(mData);
            setSectors(sData);
            setSettings(stData);

            // Refresh selected group if modal is open
            if (selectedGroup) {
                setDetailsModalOpen(false);
                setSelectedGroup(null);
            }

        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDeleteError = (e: any) => {
        console.error(`Erro ao deletar:`, e);
        setErrorMessage("Erro ao excluir apontamento: " + formatError(e));
        setTimeout(() => setErrorMessage(null), 10000);
    };

    // --- Handlers ---

    const handleEditEntry = (entry: ProductionEntry) => {
        navigate('/entry', { state: { editEntry: entry } });
    };

    const handleViewDetails = (group: GroupedEntry) => {
        setSelectedGroup(group);
        setDetailsModalOpen(true);
    };

    const openDeleteModal = (item: any) => {
        setItemToDelete(item);
        setDeleteModalOpen(true);
        setErrorMessage(null);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);

        try {
            await deleteEntry(itemToDelete.id);
            await refreshAllData();
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (e: any) {
            handleDeleteError(e);
            setDeleteModalOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        if (newDate > today) {
            alert("Não é permitido selecionar datas futuras.");
            setDate(today);
        } else {
            setDate(newDate);
        }
    };

    const clearFilters = () => {
        setSelectedSector('');
        setSelectedMachine('');
        setSelectedOperator('');

        // Date is not cleared to empty, but user might want to reset to today?
        // Usually 'Clear Filters' implies dropdowns. 
        // If we wanted to reset date: setDate(today);

        sessionStorage.removeItem('prodList_sector');
        sessionStorage.removeItem('prodList_machine');
        sessionStorage.removeItem('prodList_operator');

    };

    return (
        <div className="space-y-6">
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
                title="Confirmar Exclusão"
                message="Tem certeza que deseja apagar este item?"
            />

            <DetailsModal
                isOpen={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                group={selectedGroup}
                products={products}
                downtimeTypes={downtimeTypes}
                onEdit={(entry) => { setDetailsModalOpen(false); handleEditEntry(entry); }}
                onDelete={(entry) => openDeleteModal(entry)}
            />

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Apontamentos de Produção</h2>
                    <p className="text-slate-500">Histórico diário e controle de registros.</p>
                </div>
                {loading && <Loader2 className="animate-spin text-brand-600" />}
            </div>

            {/* TOTALS SUMMARY */}


            {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="mr-2 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="font-bold">Erro na operação</p>
                        <p className="text-sm">{errorMessage}</p>
                    </div>
                    <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-500 hover:text-red-700"><X size={18} /></button>
                </div>
            )}

            {/* FILTER BAR */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-nowrap gap-2 items-center overflow-x-auto">

                {/* Date Picker */}
                <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Data</span>
                    <div className="relative bg-slate-50 border border-slate-200 rounded-md h-[32px] w-36 flex items-center overflow-hidden hover:border-brand-400 transition-colors">
                        <input
                            type="date"
                            className="w-full h-full pl-2 pr-6 outline-none text-slate-800 font-bold border-none bg-transparent text-xs"
                            value={date}
                            onChange={handleDateChange}
                            max={today}
                        />
                        <div className="absolute right-1 text-slate-400 pointer-events-none">
                            <Calendar size={14} />
                        </div>
                    </div>
                </div>

                <div className="h-6 w-px bg-slate-200 mx-1 shrink-0"></div>

                {/* Filters Row - Compact */}
                <div className="flex items-center gap-2 flex-1">



                    {/* Sector Filter */}
                    <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase hidden md:inline">Setor</span>
                        <select
                            className="h-[32px] px-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none w-[100px] md:w-auto"
                            value={selectedSector}
                            onChange={e => {
                                setSelectedSector(e.target.value);
                                setSelectedMachine('');
                                setSelectedOperator('');
                            }}
                        >
                            <option value="">Todos</option>
                            {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            {!sectors.length && (
                                <>
                                    <option value="Extrusão">Extrusão</option>
                                    <option value="Termoformagem">Termoformagem</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Machine Filter */}
                    <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase hidden md:inline">Mq</span>
                        <select
                            className="h-[32px] px-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none w-[80px] md:w-[110px]"
                            value={selectedMachine}
                            onChange={e => setSelectedMachine(e.target.value)}
                        >
                            <option value="">Todas</option>
                            {availableMachines.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
                        </select>
                    </div>

                    {/* Operator Filter */}
                    <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase hidden md:inline">Op</span>
                        <select
                            className="h-[32px] px-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none w-[80px] md:w-[110px]"
                            value={selectedOperator}
                            onChange={e => setSelectedOperator(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {availableOperators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>

                    {/* Clear Button */}
                    {(selectedSector || selectedMachine || selectedOperator) && (
                        <button
                            onClick={clearFilters}
                            className="h-[32px] px-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 flex items-center font-bold text-[10px] transition-colors ml-auto"
                            title="Limpar Filtros"
                        >
                            <XCircle size={14} className="mr-1" /> Limpar
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto relative min-h-[500px]">

                <div className="border rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm bg-white">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-slate-700">Máquina</th>
                                <th className="px-6 py-3 font-semibold text-slate-700">Operador</th>
                                <th className="px-3 py-3 font-semibold text-slate-700">Tempo Prod.</th>
                                <th className="px-3 py-3 font-semibold text-slate-700">Parada</th>

                                <th className="px-6 py-3 font-semibold text-center">Peso (Kg)</th>
                                <th className="px-6 py-3 font-semibold text-center">Retorno</th>
                                <th className="px-6 py-3 font-semibold text-center">Produção</th>
                                <th className="px-6 py-3 text-right font-semibold text-slate-700">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {groupedEntries.length === 0 ? (
                                <tr><td colSpan={8} className="p-12 text-center text-slate-400 bg-white">
                                    <Filter size={48} className="mx-auto mb-4 opacity-20" />
                                    Nenhum registro encontrado para os filtros selecionados.
                                </td></tr>
                            ) : groupedEntries.map(g => (
                                <tr key={g.key} className={`transition-colors ${g.hasDrafts ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-slate-50'}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center">
                                                <Cpu size={16} className="mr-2 text-slate-400" />
                                                <span className="font-bold text-slate-800">{g.machineId}</span>
                                            </div>
                                            {/* Show OP Link */}
                                            {(() => {
                                                // Find first non-null OP in group
                                                const opId = g.entries.find(e => e.productionOrderId)?.productionOrderId;
                                                if (!opId) return null;
                                                return (
                                                    <div className="flex items-center mt-0.5">
                                                        <Link to={`/production-plan?opId=${opId}`} className="text-[10px] text-blue-600 font-mono font-bold truncate max-w-[120px] hover:underline hover:text-blue-800 transition-colors" title="Ver Ordem de Produção">
                                                            {opId}
                                                        </Link>
                                                    </div>
                                                );
                                            })()}
                                            {g.hasDrafts && (
                                                <span className="mt-1 ml-6 px-1.5 py-0.5 bg-yellow-200 text-yellow-800 text-[10px] font-bold rounded flex items-center w-fit" title="Contém rascunhos pendentes">
                                                    <Bookmark size={10} className="mr-1" />
                                                    Rascunho
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <Users size={16} className="mr-2 text-slate-400" />
                                            <span>{operators.find(o => o.id === g.operatorId)?.name || `ID ${g.operatorId}`}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-green-700 bg-green-50 px-2 py-1 rounded font-bold" title="Tempo Efetivo (Produção - Paradas)">
                                                {formatMinutesToHours(Math.max(0, g.totalProdMinutes - g.totalStopMinutes))}
                                            </span>
                                            {/* DEBUG: Show Times */}
                                            <span className="text-[10px] text-slate-500 mt-1">
                                                {g.entries.filter(e => e.downtimeMinutes === 0).map(e => `${(e.startTime || '??:??').substring(0, 5)}-${(e.endTime || '??:??').substring(0, 5)}`).join(' / ') || 'Sem Prod'}
                                            </span>
                                            {g.totalStopMinutes > 0 && <span className="text-[10px] text-slate-400 mt-1 line-through" title="Tempo Bruto">{formatMinutesToHours(g.totalProdMinutes)}</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-4">
                                        <span className={`font-mono px-2 py-1 rounded ${g.totalStopMinutes > 0 ? 'text-orange-700 bg-orange-50' : 'text-slate-400'}`}>
                                            {g.totalStopMinutes > 0 ? formatMinutesToHours(g.totalStopMinutes) : '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-bold text-slate-800">{formatNumber(g.totalWeight, 2)}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {g.totalReturn > 0 ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-bold border border-red-200">
                                                {formatNumber(g.totalReturn, 2)}
                                            </span>
                                        ) : g.totalDefect > 0 ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-bold border border-red-200">
                                                {formatNumber(g.totalDefect, 0)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-slate-800">{formatNumber(g.totalOk, 0)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleViewDetails(g)}
                                            className="inline-flex items-center px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors text-xs font-bold uppercase tracking-wider"
                                        >
                                            <Eye size={14} className="mr-1" /> Detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800 text-sm">
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-right text-slate-500 uppercase text-xs tracking-wider">Totalização (Liq):</td>
                                <td className="px-3 py-4 font-mono text-green-700 bg-green-50/50">{formatMinutesToHours(Math.max(0, totals.prod - totals.stop))}</td>
                                <td className="px-3 py-4 font-mono text-orange-700 bg-orange-50/50">{formatMinutesToHours(totals.stop)}</td>
                                <td className="px-6 py-4 text-center text-slate-800">{formatNumber(totals.weight, 2)}</td>
                                <td className="px-6 py-4 text-center text-red-600">{formatNumber(totals.return, 2)}</td>
                                <td className="px-6 py-4 text-center text-slate-800">{formatNumber(totals.ok, 0)}</td>
                                <td className="px-6 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProductionList;
