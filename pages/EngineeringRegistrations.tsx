

import React, { useState, useEffect } from 'react';
import {
    fetchProducts, fetchOperators, fetchMachines, fetchDowntimeTypes, fetchMaterials, fetchScrapReasons, fetchProductCategories, fetchSectors, fetchWorkShifts, fetchProductTypes,
    saveProduct, deleteProduct, deleteMachine, saveOperator, deleteOperator, saveDowntimeType, deleteDowntimeType, saveScrapReason, deleteScrapReason, saveProductCategory, deleteProductCategory, saveSector, deleteSector, saveWorkShift, deleteWorkShift, saveProductType, deleteProductType, formatError
} from '../services/storage';
import { saveMachine } from '../services/masterDataService';
import { fetchBOMItems, getActiveBOM } from '../services/inventoryService';
import { Product, Operator, Machine, DowntimeType, MachineSector, RawMaterial, ScrapReason, ProductCategory, Sector, WorkShift, ProductTypeDefinition } from '../types';
import { Trash2, Edit, Save, Package, Users, Cpu, Timer, AlertCircle, X, Plus, Loader2, AlertTriangle, Layers, Grid, Clock, CheckSquare, RefreshCw, Info, CheckCircle, Boxes, Lightbulb, Workflow, Box } from 'lucide-react'; // Added Workflow and Box
import { Input } from '../components/Input';
import RouteEditorModal from '../components/RouteEditorModal';
import { StructureExplorer } from '../components/StructureExplorer';

// --- Interfaces ---
interface SimpleTableProps<T> {
    data: T[];
    columns: { header: string; render: (item: T) => React.ReactNode; className?: string }[];
    onDelete: (item: T) => void;
    FormComponent: React.FC<{ onSave: () => void; initialData?: T }>;
    onSaveSuccess: () => void;
    customActions?: (item: T) => React.ReactNode;
}

const SimpleTable = <T,>({ data, columns, onDelete, FormComponent, onSaveSuccess, customActions }: SimpleTableProps<T>) => {
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<T | undefined>(undefined);

    const handleEdit = (item: T) => {
        setEditingItem(item);
        setShowForm(true);
    };

    const handleAddNew = () => {
        setEditingItem(undefined);
        setShowForm(true);
    };

    const handleClose = () => {
        setShowForm(false);
        setEditingItem(undefined);
    };

    return (
        <div>
            <div className="mb-4 flex justify-end">
                <button onClick={handleAddNew} className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 shadow-sm transition-all font-bold text-sm">
                    <Plus size={16} className="mr-2" /> Adicionar Novo
                </button>
            </div>

            <div className="overflow-x-auto border rounded-lg shadow-sm">
                <table className="w-full text-sm text-left bg-white">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            {columns.map((c, i) => <th key={i} className={`px-3 py-3 font-semibold text-slate-700 whitespace-nowrap ${c.className || ''}`}>{c.header}</th>)}
                            <th className="px-3 py-3 text-right text-slate-700 font-semibold w-[100px]">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.length === 0 ? (
                            <tr><td colSpan={columns.length + 1} className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                        ) : (
                            data.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    {columns.map((c, i) => <td key={i} className={`px-3 py-3 whitespace-nowrap ${c.className || ''}`}>{c.render(item)}</td>)}
                                    <td className="px-3 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            {customActions && customActions(item)}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL FORM POPUP */}
            {showForm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden scale-100">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingItem ? 'Editar Registro' : 'Novo Registro'}
                            </h3>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                                title="Fechar"
                                aria-label="Fechar"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <FormComponent
                                initialData={editingItem}
                                onSave={() => { setShowForm(false); onSaveSuccess(); }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

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

// --- Inline Forms ---

const ProductForm: React.FC<{ onSave: () => void; initialData?: Product }> = ({ onSave, initialData }) => {

    // Product Form State
    const [code, setCode] = useState(initialData?.codigo || '');
    const [name, setName] = useState(initialData?.produto || '');
    const [desc, setDesc] = useState(initialData?.descricao || '');
    const [weight, setWeight] = useState(initialData?.pesoLiquido?.toString() || '0');
    const [cost, setCost] = useState(initialData?.custoUnit?.toString() || '0');
    const [category, setCategory] = useState(initialData?.category || ''); // RESTORED

    // NEW: Product Type Logic
    const [productTypes, setProductTypes] = useState<ProductTypeDefinition[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState(initialData?.productTypeId || '');
    const [type, setType] = useState<'FINISHED' | 'INTERMEDIATE' | 'COMPONENT' | ''>(initialData?.type || '');

    // NEW: Mix Definition State
    const [mixItems, setMixItems] = useState<{ type: string, subType: string, qty: string }[]>(initialData?.extrusionMix || [
        { type: 'FLAKE', subType: 'CRISTAL', qty: '' },
        { type: 'FLAKE', subType: 'BRANCO', qty: '' },
        { type: '', subType: '', qty: '' },
        { type: '', subType: '', qty: '' }
    ]);

    // NEW: Cycle Time (helper for itemsPerHour)
    const [cycleTime, setCycleTime] = useState('');

    useEffect(() => {
        fetchProductTypes().then(setProductTypes);
    }, []);

    // Handle Type Change
    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const typeId = e.target.value;
        setSelectedTypeId(typeId);

        const selectedDef = productTypes.find(pt => pt.id === typeId);
        if (selectedDef) {
            setType(selectedDef.classification);
            // Auto set unit based on classification if needed, or leave it to user
            if (selectedDef.classification === 'INTERMEDIATE') setUnit('kg');
            else if (selectedDef.classification === 'FINISHED') setUnit('un');
        } else {
            setType('');
        }
    };

    const [unit, setUnit] = useState(initialData?.unit || 'un');
    const [scrapId, setScrapId] = useState(initialData?.scrapMaterialId || '');
    // Ensure it's initialized as array
    const [compMachines, setCompMachines] = useState<string[]>(initialData?.compatibleMachines || []);

    const [machines, setMachines] = useState<Machine[]>([]);
    const [materials, setMaterials] = useState<RawMaterial[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [itemsPerHour, setItemsPerHour] = useState(initialData?.itemsPerHour?.toString() || '0'); // Local state for items per hour

    useEffect(() => {
        if (itemsPerHour && Number(itemsPerHour) > 0) {
            const cycle = 60 / Number(itemsPerHour);
            setCycleTime(cycle.toFixed(4));
        } else {
            setCycleTime('');
        }
    }, []); // Only on mount/reset, otherwise mapped from initialData

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false); // NEW

    useEffect(() => {
        const loadDependencies = async () => {
            const [m, mat, cats] = await Promise.all([fetchMachines(), fetchMaterials(), fetchProductCategories()]);
            setMachines(m);
            setMaterials(mat);
            setCategories(cats);
        };
        loadDependencies();
    }, []);

    // NEW: Calculate Cost from BOM
    const calculateCost = async (prodId: string, prodCode?: string) => {
        setIsCalculating(true);
        try {
            let targetId = prodId;

            // If we don't have an ID (e.g. creating via code but not saved yet), we can't fetch BOM efficiently 
            // unless we resolve code to ID first. But BOMs require Products to exist.
            // So this feature mostly works for existing products.
            if (!targetId && prodCode) {
                // Try to resolve code to ID
                const pList = await fetchProducts();
                const found = pList.find(p => p.codigo.toString() === prodCode.toString());
                if (found) targetId = found.id;
            }

            if (!targetId) return; // Can't calculate without ID

            const header = await getActiveBOM(targetId);
            if (header) {
                const items = await fetchBOMItems(header.id);
                const total = items.reduce((acc, item) => {
                    const cost = item.material?.unitCost || 0;
                    return acc + (item.quantity * cost);
                }, 0);

                if (total > 0) {
                    setCost(total.toFixed(4));
                }
            }
        } catch (e) {
            console.error("Erro ao calcular custo BOM", e);
        } finally {
            setIsCalculating(false);
        }
    };

    // Effect to handle both Edit (initialData present) and New (initialData undefined)
    useEffect(() => {
        if (initialData) {
            setCode(initialData.codigo.toString());
            setName(initialData.produto);
            setDesc(initialData.descricao);
            setWeight(initialData.pesoLiquido.toString());
            setCost(initialData.custoUnit.toString());
            setCategory(initialData.category || 'ARTICULADO');
            setType(initialData.type || 'FINISHED');
            setSelectedTypeId(initialData.productTypeId || ''); // NEW
            setUnit(initialData.unit || 'un');
            setScrapId(initialData.scrapMaterialId || '');
            // Force reset when switching items
            setCompMachines(initialData.compatibleMachines || []);

            // Auto-Calculate Cost from BOM if editing
            calculateCost(initialData.id || '', initialData.codigo.toString());

            // Set Items Per Hour and Cycle Time
            setItemsPerHour(initialData.itemsPerHour?.toString() || '0');
            if (initialData.itemsPerHour && initialData.itemsPerHour > 0) {
                setCycleTime((60 / initialData.itemsPerHour).toFixed(4));
            } else {
                setCycleTime('');
            }
            // Set Mix
            if (initialData.extrusionMix) {
                setMixItems(initialData.extrusionMix);
            } else {
                setMixItems([
                    { type: 'FLAKE', subType: 'CRISTAL', qty: '' },
                    { type: 'FLAKE', subType: 'BRANCO', qty: '' },
                    { type: '', subType: '', qty: '' },
                    { type: '', subType: '', qty: '' }
                ]);
            }
        } else {
            // Force explicit reset on new item (clean state)
            setCode('');
            setName('');
            setDesc('');
            setWeight('');
            setCost('');
            setCategory('');
            setType('');
            setSelectedTypeId(''); // NEW
            setUnit('un');
            setScrapId('');
            setCompMachines([]);
        }
    }, [initialData]);

    const handleMachineToggle = (code: string) => {
        setCompMachines(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (!code) throw new Error("O código do produto é obrigatório.");

            // FIX: Handle comma vs dot for brazilian users
            const cleanWeight = weight ? weight.replace(',', '.') : '0';
            const cleanCost = cost ? cost.replace(',', '.') : '0';

            const numWeight = Number(cleanWeight);
            const numCost = Number(cleanCost);

            if (isNaN(numWeight)) throw new Error("Peso inválido (verifique vírgulas/pontos)");
            if (isNaN(numCost)) throw new Error("Custo inválido (verifique vírgulas/pontos)");

            if (!type) throw new Error("O tipo de produto é obrigatório.");

            await saveProduct({
                ...initialData, // Preserve hidden fields
                codigo: code,
                produto: name,
                descricao: desc,
                pesoLiquido: numWeight,
                custoUnit: numCost,
                category: category,
                type: type as 'FINISHED' | 'INTERMEDIATE' | 'COMPONENT',
                unit: unit,
                scrapMaterialId: scrapId || undefined, // Send undefined if empty string
                productTypeId: selectedTypeId, // NEW
                compatibleMachines: compMachines,
                itemsPerHour: Number(itemsPerHour), // Use local state
                extrusionMix: mixItems.filter(m => m.type || m.subType || m.qty) // Save only filled items
            });
            onSave();
        } catch (e: any) {
            console.error(e);
            alert("Erro ao salvar produto: " + formatError(e));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            <Input label="Cód" value={code} onChange={e => setCode(e.target.value)} required />
            <Input label="Produto" value={name} onChange={e => setName(e.target.value)} required className="md:col-span-3" />
            <Input label="Descrição" value={desc} onChange={e => setDesc(e.target.value)} className="md:col-span-4" />
            <Input label="Peso (Kg)" type="text" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.00" />

            {/* Cost Input with BOM Refresh */}
            <div className="relative">
                <Input label="Custo (R$)" type="text" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
                {!!initialData && (
                    <button
                        type="button"
                        onClick={() => calculateCost(initialData?.id || '', code)}
                        className="absolute right-2 top-8 p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Recalcular da Ficha Técnica"
                    >
                        <RefreshCw size={14} className={isCalculating ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>

            <div className="flex flex-col">
                <Input
                    label="Meta (Peças/Hora)"
                    type="number"
                    value={itemsPerHour}
                    onChange={e => {
                        const val = e.target.value;
                        setItemsPerHour(val);
                        if (Number(val) > 0) {
                            setCycleTime((60 / Number(val)).toFixed(4));
                        } else {
                            setCycleTime('');
                        }
                    }}
                    placeholder="0"
                />
            </div>

            <div className="flex flex-col">
                <Input
                    label="Tempo Prod. (min/pç)"
                    type="number"
                    value={cycleTime}
                    onChange={e => {
                        const val = e.target.value;
                        setCycleTime(val);
                        if (Number(val) > 0) {
                            setItemsPerHour((60 / Number(val)).toFixed(2));
                        }
                    }}
                    placeholder="Auto (min)"
                />
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Categoria (PCP)</label>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white"
                    title="Categoria do Produto"
                    aria-label="Categoria do Produto"
                >
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    {!categories.find(c => c.name === category) && category && <option value={category}>{category}</option>}
                    <option value="">Selecione...</option>
                </select>
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Tipo de Produto</label>
                <select
                    value={selectedTypeId}
                    onChange={handleTypeChange}
                    className="px-3 py-2 border rounded-lg bg-white"
                    required
                    title="Tipo de Produto"
                    aria-label="Tipo de Produto"
                >
                    <option value="">Selecione...</option>
                    {productTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>
                            {pt.name} ({pt.classification === 'FINISHED' ? 'Acabado' : pt.classification === 'INTERMEDIATE' ? 'Bobina' : 'Componente'})
                        </option>
                    ))}
                </select>
                {type && <span className="text-[10px] text-slate-400 font-mono mt-1">Classificação: {type}</span>}
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Unidade de Medida</label>
                <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white"
                    title="Unidade de Medida"
                    aria-label="Unidade de Medida"
                >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="mil">Milheiro (mil)</option>
                    <option value="cx">Caixa (cx)</option>
                </select>
            </div>

            <div className="flex flex-col md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Reciclagem (Aparas/Refugo vira...)</label>
                <select
                    value={scrapId}
                    onChange={(e) => setScrapId(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white text-xs"
                    title="Material de Reciclagem"
                    aria-label="Material de Reciclagem"
                >
                    <option value="">- Nenhuma recuperação -</option>
                    {materials.filter(m => m.category === 'raw_material' || m.category === 'return' || m.category === 'scrap' || m.name.toLowerCase().includes('apara')).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="mt-1 flex gap-1 text-[11px] text-sky-600 bg-sky-50 p-1.5 rounded border border-sky-100">
                    <Info size={14} className="shrink-0 text-sky-500" />
                    <span>A reciclagem (retorno ao processo) depende do cadastro prévio dos materiais na gestão de estoque.</span>
                </div>
            </div>

            <div className="md:col-span-4 border border-slate-200 rounded-lg p-3 bg-white">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Máquinas Compatíveis (Deixe vazio para todas)</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {machines.map(m => (
                        <button
                            key={m.code}
                            type="button"
                            onClick={() => handleMachineToggle(m.code)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${compMachines.includes(m.code)
                                ? 'bg-brand-100 text-brand-700 border-brand-300 font-bold'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                            title={`Alternar compatibilidade com máquina ${m.code}`}
                            aria-label={`Alternar compatibilidade com máquina ${m.code}`}
                        >
                            {m.code}
                        </button>
                    ))}
                </div>
            </div>

            {/* SEÇÃO DA RECEITA (MIX) - Visível apenas se compatível com Extrusão ou Categoria for Extrusão */}
            {(compMachines.some(m => machines.find(mac => mac.code === m)?.sector === 'Extrusão') || category === 'Extrusão' || category === 'Bobina') && (
                <div className="md:col-span-4 border border-blue-200 rounded-lg p-4 bg-blue-50 mt-2">
                    <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
                        <Package size={16} className="mr-2" /> Receita Padrão (Mistura/Mix)
                    </h4>
                    <p className="text-xs text-blue-600 mb-4">Defina a porcentagem padrão dos materiais. O total deve ser 100%.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mixItems.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <select
                                    className="w-24 px-2 py-1.5 text-xs border rounded bg-white"
                                    value={item.type}
                                    title="Tipo de Material do Mix"
                                    aria-label="Tipo de Material do Mix"
                                    onChange={e => {
                                        const newMix = [...mixItems];
                                        newMix[idx].type = e.target.value;
                                        setMixItems(newMix);
                                    }}
                                >
                                    <option value="">Tipo...</option>
                                    <option value="FLAKE">FLAKE</option>
                                    <option value="APARA">APARA</option>
                                    <option value="VIRGEM">VIRGEM</option>
                                </select>
                                <select
                                    className="flex-1 px-2 py-1.5 text-xs border rounded bg-white"
                                    value={item.subType}
                                    title="Cor/Subtipo do Material"
                                    aria-label="Cor/Subtipo do Material"
                                    onChange={e => {
                                        const newMix = [...mixItems];
                                        newMix[idx].subType = e.target.value;
                                        setMixItems(newMix);
                                    }}
                                >
                                    <option value="">Material/Cor...</option>
                                    <option value="CRISTAL">CRISTAL</option>
                                    <option value="BRANCO">BRANCO</option>
                                    <option value="PRETO">PRETO</option>
                                    <option value="AZUL">AZUL</option>
                                    <option value="NATURAL">NATURAL</option>
                                </select>
                                <div className="relative w-24">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1.5 text-xs border rounded text-right font-bold"
                                        placeholder="0"
                                        value={item.qty}
                                        onChange={e => {
                                            const newMix = [...mixItems];
                                            newMix[idx].qty = e.target.value;
                                            setMixItems(newMix);
                                        }}
                                    />
                                    <span className="absolute right-6 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={isSubmitting}
                className="md:col-span-4 bg-green-600 text-white py-3 rounded-lg flex items-center justify-center font-bold hover:bg-green-700 disabled:opacity-50 mt-4"
                title="Salvar Produto"
                aria-label="Salvar Produto"
            >
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                {isSubmitting ? 'Salvando...' : 'Salvar Produto'}
            </button>
        </form>
    );
};

const OperatorForm: React.FC<{ onSave: () => void; initialData?: Operator }> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [sector, setSector] = useState(initialData?.sector || '');
    const [shiftId, setShiftId] = useState(initialData?.defaultShift || '');
    const [role, setRole] = useState(initialData?.role || '');
    const [salary, setSalary] = useState(initialData?.baseSalary?.toString() || '');
    const [admission, setAdmission] = useState(initialData?.admissionDate || '');
    const [termination, setTermination] = useState(initialData?.terminationDate || '');
    const [active, setActive] = useState(initialData?.active !== undefined ? initialData.active : true);

    const [sectorsList, setSectorsList] = useState<Sector[]>([]);
    const [shifts, setShifts] = useState<WorkShift[]>([]);

    useEffect(() => {
        const loadDeps = async () => {
            const [s, w] = await Promise.all([fetchSectors(), fetchWorkShifts()]);
            setSectorsList(s);
            setShifts(w);
        };
        loadDeps();

        if (initialData) {
            setName(initialData.name);
            setSector(initialData.sector || '');
            setShiftId(initialData.defaultShift || '');
            setRole(initialData.role || '');
            setSalary(initialData.baseSalary?.toString() || '');
            setAdmission(initialData.admissionDate || '');
            setTermination(initialData.terminationDate || '');
            setActive(initialData.active !== undefined ? initialData.active : true);
        }
    }, [initialData]);

    // Lógica automática: Se tem demissão, inativa.
    useEffect(() => {
        if (termination) {
            setActive(false);
        }
    }, [termination]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const cleanSalary = salary ? parseFloat(salary.replace(',', '.')) : 0;
            if (isNaN(cleanSalary)) throw new Error("Salário inválido");

            await saveOperator({
                id: initialData?.id || 0, // 0 for new (handled in backend/storage)
                name,
                sector,
                defaultShift: shiftId,
                role,
                baseSalary: cleanSalary,
                admissionDate: admission,
                terminationDate: termination,
                active
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar operador: " + formatError(e));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
            <Input label="Nome Completo" value={name} onChange={e => setName(e.target.value)} required className="md:col-span-2" />

// ... OperatorForm ...

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Setor</label>
                <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white"
                    title="Setor do Operador"
                    aria-label="Setor do Operador"
                >
                    <option value="">Indefinido</option>
                    {sectorsList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Turno Padrão</label>
                <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white"
                    title="Turno Padrão"
                    aria-label="Turno Padrão"
                >
                    <option value="">Todos / Flexível</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                </select>
            </div>

            <Input label="Função / Cargo" value={role} onChange={e => setRole(e.target.value)} />

            <Input label="Salário Base (R$)" value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" />
            <Input label="Data Admissão" type="date" value={admission} onChange={e => setAdmission(e.target.value)} />
            <Input label="Data Demissão" type="date" value={termination} onChange={e => setTermination(e.target.value)} />

            <div className="flex items-center mt-6">
                <input
                    type="checkbox"
                    id="op_active"
                    checked={active}
                    onChange={e => setActive(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="op_active" className="ml-2 font-bold text-slate-700">Funcionário Ativo</label>
            </div>

            <button type="submit" className="md:col-span-4 mt-2 px-4 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center font-bold hover:bg-green-700">
                <Save size={18} className="mr-2" /> Salvar Operador
            </button>
        </form>
    );
};

const DowntimeForm: React.FC<{ onSave: () => void; initialData?: DowntimeType }> = ({ onSave, initialData }) => {
    const [id, setId] = useState(initialData?.id || '');
    const [desc, setDesc] = useState(initialData?.description || '');
    const [exempt, setExempt] = useState(initialData?.exemptFromOperator || false);

    useEffect(() => {
        if (initialData) {
            setId(initialData.id);
            setDesc(initialData.description);
            setExempt(initialData.exemptFromOperator || false);
            setSector(initialData.sector || ''); // NEW
        } else {
            setSector(''); // Reset on new
        }
    }, [initialData]);

    // NEW state for sectors
    const [sector, setSector] = useState(initialData?.sector || '');
    const [sectors, setSectors] = useState<Sector[]>([]);

    useEffect(() => { fetchSectors().then(setSectors); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveDowntimeType({
                id,
                description: desc,
                exemptFromOperator: exempt,
                sector: sector || undefined // NEW
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar tipo de parada: " + formatError(e));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-32">
                <Input label="Cód" value={id} onChange={e => setId(e.target.value)} required disabled={!!initialData} />
            </div>
            <div className="flex-1 w-full">
                <Input label="Descrição" value={desc} onChange={e => setDesc(e.target.value)} required />
            </div>
            <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 mb-1 block">Setor (Opcional)</label>
                <select
                    value={sector}
                    onChange={e => setSector(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                    title="Setor da Parada"
                    aria-label="Setor da Parada"
                >
                    <option value="">Global (Todos)</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            <div className="flex items-center h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 mb-[2px]">
                <input
                    type="checkbox"
                    id="exempt_op"
                    checked={exempt}
                    onChange={e => setExempt(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                    title="Isentar Operador"
                    aria-label="Isentar Operador"
                />
                <label htmlFor="exempt_op" className="ml-2 text-sm font-bold text-slate-700 cursor-pointer">
                    Isenta Operador?
                </label>
            </div>
            <button type="submit" className="w-full md:w-auto mb-[2px] px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center" title="Salvar Parada" aria-label="Salvar Parada">
                <Save size={18} className="mr-2 md:mr-0" />
            </button>
        </form>
    );
};

const ScrapForm: React.FC<{ onSave: () => void; initialData?: ScrapReason }> = ({ onSave, initialData }) => {
    const [desc, setDesc] = useState(initialData?.description || '');
    const [sector, setSector] = useState(initialData?.sector || '');
    const [sectors, setSectors] = useState<Sector[]>([]);

    useEffect(() => { fetchSectors().then(setSectors); }, []);

    useEffect(() => {
        if (initialData) {
            setDesc(initialData.description);
            setSector(initialData.sector || '');
        } else {
            setSector('');
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveScrapReason({ id: initialData?.id, description: desc, sector: sector || undefined });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar motivo de refugo: " + formatError(e));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <Input label="Descrição do Defeito" value={desc} onChange={e => setDesc(e.target.value)} required />
            </div>
            <div className="md:w-64 w-full">
                <label className="text-xs font-bold text-slate-500 mb-1 block">Setor (Opcional)</label>
                <select
                    value={sector}
                    onChange={e => setSector(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                    title="Setor do Refugo"
                    aria-label="Setor do Refugo"
                >
                    <option value="">Global (Todos)</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            <button type="submit" className="w-full md:w-auto mb-[2px] px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center" title="Salvar Refugo" aria-label="Salvar Refugo">
                <Save size={18} />
            </button>
        </form>
    );
};

const ProductTypeForm: React.FC<{ onSave: () => void; initialData?: ProductTypeDefinition }> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [classification, setClassification] = useState<'FINISHED' | 'INTERMEDIATE' | 'COMPONENT'>(initialData?.classification || 'FINISHED');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveProductType({ id: initialData?.id || '', name, classification });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar tipo de produto: " + formatError(e));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 mb-1 block">Nome do Tipo (ex: Tampa, Pote)</label>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                    required
                    placeholder="Nome do Tipo de Produto"
                    title="Nome do Tipo de Produto"
                />
            </div>
            <div className="md:w-64">
                <label className="text-xs font-bold text-slate-500 mb-1 block">Classificação no Sistema</label>
                <select
                    value={classification}
                    onChange={e => setClassification(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                    required
                    title="Classificação do Sistema"
                    aria-label="Classificação do Sistema"
                >
                    <option value="FINISHED">Produto Acabado</option>
                    <option value="INTERMEDIATE">Bobina / Intermediário</option>
                    <option value="COMPONENT">Componente / Matéria Prima</option>
                </select>
            </div>
            <button type="submit" className="w-full md:w-auto mb-[2px] px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center" title="Salvar Tipo" aria-label="Salvar Tipo">
                <Save size={18} className="mr-2 md:mr-0" />
            </button>
        </form>
    );
};

const CategoryForm: React.FC<{ onSave: () => void; initialData?: ProductCategory }> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    useEffect(() => { if (initialData) setName(initialData.name); }, [initialData]);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveProductCategory({ id: initialData?.id, name });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar categoria: " + formatError(e));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
                <Input label="Nome da Categoria" value={name} onChange={e => setName(e.target.value)} required className="w-full" placeholder="Ex: KIT" />
            </div>
            <button type="submit" className="mb-[2px] px-4 py-2 bg-green-600 text-white rounded-lg" title="Salvar Categoria" aria-label="Salvar Categoria"><Save size={18} /></button>
        </form>
    );
};

const SectorForm: React.FC<{ onSave: () => void; initialData?: Sector }> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [isProductive, setIsProductive] = useState(initialData?.isProductive || false); // NEW

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setIsProductive(initialData.isProductive || false);
        }
    }, [initialData]);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveSector({ id: initialData?.id || '', name, active: true, isProductive });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar setor: " + formatError(e));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
                <Input label="Nome do Setor" value={name} onChange={e => setName(e.target.value)} required className="w-full" placeholder="Ex: Termoformagem" />
            </div>
            {/* NEW: Checkbox for Productive Sector */}
// ... SectorForm ...
            <div className="flex items-center h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 mb-[2px]">
                <input
                    type="checkbox"
                    id="is_prod"
                    checked={isProductive}
                    onChange={e => setIsProductive(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="is_prod" className="ml-2 text-sm font-bold text-slate-700 cursor-pointer whitespace-nowrap">
                    Setor Produtivo
                </label>
            </div>
            <button type="submit" className="mb-[2px] px-4 py-2 bg-green-600 text-white rounded-lg" title="Salvar Setor" aria-label="Salvar Setor"><Save size={18} /></button>
        </form>
    );
};

const WorkShiftForm: React.FC<{ onSave: () => void; initialData?: WorkShift }> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [startTime, setStartTime] = useState(initialData?.startTime || '06:00');
    const [endTime, setEndTime] = useState(initialData?.endTime || '14:00');
    const [sector, setSector] = useState(initialData?.sector || ''); // NEW
    const [sectorsList, setSectorsList] = useState<Sector[]>([]);

    useEffect(() => {
        const loadSectors = async () => {
            const s = await fetchSectors();
            setSectorsList(s);
        };
        loadSectors();

        if (initialData) {
            setName(initialData.name);
            setStartTime(initialData.startTime);
            setEndTime(initialData.endTime);
            setSector(initialData.sector || '');
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveWorkShift({
                id: initialData?.id || '',
                name,
                startTime,
                endTime,
                active: true,
                sector: sector || undefined
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar turno: " + formatError(e));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
                <Input label="Nome do Turno" placeholder="Ex: Manhã" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Setor Específico</label>
                <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white h-[42px]"
                    title="Setor do Turno"
                    aria-label="Setor do Turno"
                >
                    <option value="">Global / Todos</option>
                    {sectorsList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
            </div>

            <Input label="Início" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            <Input label="Fim" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />

            <button type="submit" className="md:col-span-5 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center mt-2">
                <Save size={18} className="mr-2" /> Salvar Turno
            </button>
        </form>
    );
};

const MachineForm: React.FC<{ onSave: () => void; initialData?: Machine }> = ({ onSave, initialData }) => {
    const [code, setCode] = useState(initialData?.code || '');
    const [name, setName] = useState(initialData?.name || '');
    const [sector, setSector] = useState<MachineSector>(initialData?.sector || 'Termoformagem');
    const [capacity, setCapacity] = useState(initialData?.productionCapacity?.toString() || '');
    const [unit, setUnit] = useState(initialData?.capacity_unit || 'kg/h'); // NEW
    const [machineValue, setMachineValue] = useState(initialData?.machine_value ? initialData.machine_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    const [activity, setActivity] = useState(initialData?.activity || ''); // NEW
    const [acquisitionDate, setAcquisitionDate] = useState(initialData?.acquisitionDate ? new Date(initialData.acquisitionDate).toISOString().split('T')[0] : '');
    const [sectorsList, setSectorsList] = useState<Sector[]>([]);

    useEffect(() => {
        const loadSectors = async () => {
            const s = await fetchSectors();
            setSectorsList(s);
            // Default to first sector if none selected
            if (!initialData && s.length > 0) {
                setSector(s[0].name);
            }
        };
        loadSectors();

        if (initialData) {
            setCode(initialData.code);
            setName(initialData.name);
            if (initialData.sector) setSector(initialData.sector);
            if (initialData.productionCapacity) setCapacity(initialData.productionCapacity.toString());
            if (initialData.capacity_unit) setUnit(initialData.capacity_unit);
            if (initialData.capacity_unit) setUnit(initialData.capacity_unit);
            if (initialData.machine_value) setMachineValue(initialData.machine_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
            if (initialData.activity) setActivity(initialData.activity); // NEW
            if (initialData.acquisitionDate) setAcquisitionDate(new Date(initialData.acquisitionDate).toISOString().split('T')[0]);
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveMachine({
                ...initialData,
                code,
                name,
                sector,
                productionCapacity: capacity ? Number(capacity) : undefined,
                capacity_unit: unit,
                machine_value: machineValue ? parseFloat(machineValue.replace(/\./g, '').replace(',', '.')) : undefined,
                activity: activity, // NEW
                acquisitionDate: acquisitionDate || undefined
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar máquina: " + formatError(e));
        }
    };

    // Determine Label based on Sector
    const capacityLabel = sector === 'Extrusão' ? 'Capacidade (kg/h)' : 'Capacidade Nominal (Ciclos/h)';

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-4 items-end">
            {/* ROW 1: Code | Sector | Name */}
            <div className="col-span-12 md:col-span-2">
                <Input label="Cód. Máquina" value={code} onChange={e => setCode(e.target.value)} required placeholder="Ex: 001" />
            </div>
// ... MachineForm ...
            <div className="col-span-12 md:col-span-4">
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-slate-700 mb-1">Setor</label>
                    <select value={sector} onChange={(e) => setSector(e.target.value as any)} className="px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 w-full" title="Setor da Máquina" aria-label="Setor da Máquina">
                        {sectorsList.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        {!sectorsList.length && (
                            <>
                                <option value="Termoformagem">Termoformagem</option>
                                <option value="Extrusão">Extrusão</option>
                            </>
                        )}
                    </select>
                </div>
            </div>
            <div className="col-span-12 md:col-span-6">
                <Input label="Nome da Máquina" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Extrusora Principal" />
            </div>

            {/* NEW ACTIVITY FIELD */}
            <div className="col-span-12 md:col-span-4">
                <Input label="Atividade (Função)" value={activity} onChange={e => setActivity(e.target.value)} placeholder="Ex: Extrusar" />
            </div>

            {/* ROW 2: Capacity | Unit | Value | Date (Optional) */}
            <div className="col-span-12 md:col-span-8 flex flex-col">
                <label className="text-sm font-semibold text-slate-700 mb-1">Capacidade Produtiva</label>
                <div className="flex gap-2">
                    <Input className="flex-1" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="0" label="" />
                    <select
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="w-24 px-2 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500"
                        title="Unidade de Capacidade"
                        aria-label="Unidade de Capacidade"
                    >
                        <option value="kg/h">kg/h</option>
                        <option value="un/h">un/h</option>
                        <option value="pç/h">pç/h</option>
                        <option value="cx/h">cx/h</option>
                        <option value="ml/h">ml/h</option>
                        <option value="lt/h">lt/h</option>
                        <option value="m/h">m/h</option>
                        <option value="m²/h">m²/h</option>
                    </select>
                </div>
            </div>
            <div className="col-span-12 md:col-span-4">
                <Input
                    label="Valor do Patrimônio (R$)"
                    value={machineValue}
                    onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        const m = (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        setMachineValue(m);
                    }}
                    placeholder="0,00"
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <Input label="Data de Aquisição" type="date" value={acquisitionDate} onChange={e => setAcquisitionDate(e.target.value)} />
            </div>

            {/* ROW 3: Save Button */}
            <div className="col-span-12 mt-4">
                <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center transition-colors shadow-sm">
                    <Save size={20} className="mr-2" /> Salvar Máquina
                </button>
            </div>
        </form>
    );
};

const EngineeringRegistrations: React.FC = () => {
    // State for MOCKUP
    const [viewStructure, setViewStructure] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'machines' | 'sectors' | 'operators' | 'downtime' | 'scrap' | 'shifts' | 'types'>('products');

    // Data States
    const [products, setProducts] = useState<Product[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [downtimeTypes, setDowntimeTypes] = useState<DowntimeType[]>([]);
    const [scrapReasons, setScrapReasons] = useState<ScrapReason[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
    const [productTypes, setProductTypes] = useState<ProductTypeDefinition[]>([]);

    // NEW: Guided Mode State
    const [isGuidedMode, setIsGuidedMode] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    useEffect(() => {
        if (isGuidedMode) {
            setShowHelpModal(true);
        } else {
            setShowHelpModal(false);
        }
    }, [activeTab, isGuidedMode]);

    // Standard vs Guided Order
    const standardTabs = [
        { id: 'products', label: 'Produtos', icon: Package },
        { id: 'types', label: 'Tipos de Produto', icon: Boxes },
        { id: 'categories', label: 'Categorias Prod.', icon: Layers },
        { id: 'machines', label: 'Máquinas', icon: Cpu },
        { id: 'sectors', label: 'Setores', icon: Grid },
        { id: 'operators', label: 'Operadores', icon: Users },
        { id: 'shifts', label: 'Turnos', icon: Clock },
        { id: 'downtime', label: 'Tipos de Parada', icon: Timer },
        { id: 'scrap', label: 'Motivos de Refugo', icon: AlertTriangle },
    ];

    const guidedTabs = [
        { id: 'sectors', label: '1. Setores', icon: Grid },
        { id: 'categories', label: '2. Categorias', icon: Layers },
        { id: 'types', label: '3. Tipos de Produto', icon: Boxes }, // NEW
        { id: 'shifts', label: '4. Turnos', icon: Clock },
        { id: 'downtime', label: '5. Tipos de Parada', icon: Timer },
        { id: 'scrap', label: '6. Motivos de Refugo', icon: AlertTriangle },
        { id: 'machines', label: '7. Máquinas', icon: Cpu },
        { id: 'operators', label: '8. Operadores', icon: Users },
        { id: 'products', label: '9. Produtos', icon: Package },
    ];

    const currentTabs = isGuidedMode ? guidedTabs : standardTabs;

    // Helper to check if tab is completed (has data)
    const isTabCompleted = (tabId: string) => {
        switch (tabId) {
            case 'products': return products.length > 0;
            case 'types': return productTypes.length > 0; // NEW
            case 'machines': return machines.length > 0;
            case 'operators': return operators.length > 0;
            case 'downtime': return downtimeTypes.length > 0;
            case 'scrap': return scrapReasons.length > 0;
            case 'categories': return categories.length > 0;
            case 'sectors': return sectors.length > 0;
            case 'shifts': return workShifts.length > 0;
            default: return false;
        }
    };

    const [loading, setLoading] = useState(false);

    // Delete States
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);
    const [deleteType, setDeleteType] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Route Editor State
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [selectedProductForRoute, setSelectedProductForRoute] = useState<Product | null>(null);

    // Load Initial Data
    useEffect(() => {
        refreshAllData();
    }, []);

    const refreshAllData = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const [pData, mData, oData, dtData, scData, catData, secData, wData, ptData] = await Promise.all([
                fetchProducts(),
                fetchMachines(),
                fetchOperators(),
                fetchDowntimeTypes(),
                fetchScrapReasons(),
                fetchProductCategories(),
                fetchSectors(),
                fetchWorkShifts(),
                fetchProductTypes() // NEW
            ]);
            setProducts(pData);
            setMachines(mData);
            setOperators(oData);
            setDowntimeTypes(dtData);
            setScrapReasons(scData);
            setCategories(catData);
            setSectors(secData);
            setWorkShifts(wData);
            setProductTypes(ptData); // NEW
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDeleteError = (e: any, typeName: string) => {
        console.error(`Erro ao deletar ${typeName}:`, e);
        let msg = `Erro ao excluir ${typeName}.`;
        const safeError = formatError(e);

        if (safeError && (safeError.includes('foreign key constraint') || safeError.includes('23503'))) {
            msg = `NÃO FOI POSSÍVEL EXCLUIR: Este ${typeName} está vinculado a outros registros.`;
        } else {
            msg = `Erro: ${safeError || 'Permissão Negada.'}`;
        }
        setErrorMessage(msg);
        setTimeout(() => setErrorMessage(null), 10000);
    };

    const openDeleteModal = (item: any, type: string) => {
        setItemToDelete(item);
        setDeleteType(type);
        setDeleteModalOpen(true);
        setErrorMessage(null);
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);

        try {
            if (deleteType === 'produto') await deleteProduct(itemToDelete.codigo);
            else if (deleteType === 'maquina') await deleteMachine(itemToDelete.code);
            else if (deleteType === 'operador') await deleteOperator(itemToDelete.id);
            else if (deleteType === 'parada') await deleteDowntimeType(itemToDelete.id);
            else if (deleteType === 'refugo') await deleteScrapReason(itemToDelete.id);
            else if (deleteType === 'categoria') await deleteProductCategory(itemToDelete.id);
            else if (deleteType === 'setor') await deleteSector(itemToDelete.id);
            else if (deleteType === 'turno') await deleteWorkShift(itemToDelete.id);
            else if (deleteType === 'tipo de produto') await deleteProductType(itemToDelete.id);

            await refreshAllData();
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (error: any) {
            setErrorMessage("Erro ao excluir: " + formatError(error));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRemoveMachineFromProduct = async (product: Product, machineCode: string) => {
        // 1. Filter out the specific machine
        const newMachines = product.compatibleMachines?.filter(m => m !== machineCode) || [];

        try {
            // 2. Save the updated product
            await saveProduct({
                ...product,
                compatibleMachines: newMachines
            });
            // 3. Refresh List
            await refreshAllData();
        } catch (e: any) {
            setErrorMessage("Erro ao remover máquina: " + formatError(e));
            setTimeout(() => setErrorMessage(null), 5000);
        }
    };

    const getDeleteMessage = () => {
        if (!itemToDelete) return '';
        if (deleteType === 'produto') return `Tem certeza que deseja excluir o produto "${itemToDelete.produto}"?`;
        if (deleteType === 'maquina') return `Tem certeza que deseja excluir a máquina "${itemToDelete.name}"?`;
        if (deleteType === 'operador') return `Tem certeza que deseja excluir o operador "${itemToDelete.name}"?`;
        if (deleteType === 'parada') return `Tem certeza que deseja excluir o tipo de parada "${itemToDelete.description}"?`;
        if (deleteType === 'refugo') return `Tem certeza que deseja excluir o motivo "${itemToDelete.description}"?`;
        if (deleteType === 'categoria') return `Tem certeza que deseja excluir a categoria "${itemToDelete.name}"?`;
        if (deleteType === 'setor') return `Tem certeza que deseja excluir o setor "${itemToDelete.name}"?`;
        if (deleteType === 'turno') return `Tem certeza que deseja excluir o turno "${itemToDelete.name}"?`;
        if (deleteType === 'tipo de produto') return `Tem certeza que deseja excluir o tipo de produto "${itemToDelete.name}"?`;
        return 'Tem certeza?';
    };

    return (
        <div className="p-6 w-full max-w-[95rem] mx-auto space-y-6">
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={`Excluir ${deleteType}`}
                message={getDeleteMessage()}
                isDeleting={isDeleting}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Cadastros Gerais</h2>
                    <p className="text-slate-500">Dados mestres do sistema: Produtos, Máquinas e Pessoas.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Guided Mode Toggle */}
                    <button
                        onClick={() => setIsGuidedMode(!isGuidedMode)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${isGuidedMode
                            ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-200'
                            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        {isGuidedMode ? <CheckSquare size={18} /> : <Layers size={18} />}
                        {isGuidedMode ? 'Modo Assistente Ativo' : 'Ativar Assistente de Configuração'}
                    </button>
                    {loading && <Loader2 className="animate-spin text-brand-600" />}
                </div>
            </div>

            {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="mr-2 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="font-bold">Erro na operação</p>
                        <p className="text-sm">{errorMessage}</p>
                    </div>
                </div>
            )}



            <div className={`space-y-4 ${isGuidedMode ? 'bg-brand-50 p-4 rounded-xl border border-brand-100' : ''}`}>
                {isGuidedMode && (
                    <div className="mb-2 text-sm text-brand-800 font-medium flex items-center gap-2">
                        <Info size={16} />
                        Siga a numeração das abas para configurar sua empresa corretamente. Itens concluídos recebem um "check" verde.
                    </div>
                )}

                <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-hide">
                    {currentTabs.map(tab => {
                        const completed = isGuidedMode && isTabCompleted(tab.id);
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-3 text-sm font-medium flex items-center space-x-2 transition-all rounded-t-lg whitespace-nowrap relative ${activeTab === tab.id
                                    ? 'border border-b-0 border-slate-200 bg-white text-brand-600 shadow-sm translate-y-px z-10'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <tab.icon size={16} />
                                <span>{tab.label}</span>
                                {completed && <CheckCircle size={14} className="text-green-500 ml-1 fill-green-100" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
                {activeTab === 'types' && <SimpleTable<ProductTypeDefinition>
                    data={productTypes}
                    columns={[
                        { header: 'Nome do Tipo', render: (t) => <span className="font-bold text-slate-800">{t.name}</span> },
                        { header: 'Classificação Sistema', render: (t) => <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">{t.classification}</span> }
                    ]}
                    onDelete={(t) => openDeleteModal(t, 'tipo de produto')}
                    FormComponent={ProductTypeForm}
                    onSaveSuccess={refreshAllData}
                />}

                {activeTab === 'machines' && <SimpleTable<Machine>
                    data={machines}
                    columns={[
                        { header: 'Código', render: (m: Machine) => <span className="font-mono font-bold text-slate-700">{m.code}</span> },
                        { header: 'Nome', render: (m: Machine) => m.name },
                        { header: 'Setor', render: (m: Machine) => <span className={`px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800`}>{m.sector}</span> },
                        { header: 'Atividade', render: (m: Machine) => m.activity || '-' }, // NEW
                        {
                            header: 'Capacidade',
                            render: (m: Machine) => m.productionCapacity
                                ? <span className="font-mono text-xs">{m.productionCapacity} {m.capacity_unit || (m.sector === 'Extrusão' ? 'kg/h' : 'ciclos/h')}</span>
                                : '-'
                        },
                        {
                            header: 'Valor',
                            render: (m: Machine) => m.machine_value
                                ? <span className="font-mono text-xs text-slate-600">R$ {m.machine_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                : '-'
                        },
                        { header: 'Data Aquisição', render: (m: Machine) => m.acquisitionDate ? new Date(m.acquisitionDate).toLocaleDateString() : '-' },
                    ]}
                    onDelete={(m) => openDeleteModal(m, 'maquina')}
                    FormComponent={MachineForm}
                    onSaveSuccess={refreshAllData}
                />}

                {activeTab === 'sectors' && <SimpleTable<Sector>
                    data={sectors}
                    columns={[
                        { header: 'Nome', render: (s: Sector) => <span className="font-bold text-slate-800">{s.name}</span> },
                        {
                            header: 'Tipo',
                            render: (s: Sector) => s.isProductive
                                ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Produtivo</span>
                                : <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Apoio / Geral</span>
                        },

                    ]}
                    onDelete={(s) => openDeleteModal(s, 'setor')}
                    FormComponent={SectorForm}
                    onSaveSuccess={refreshAllData}
                />}




                {activeTab === 'products' && <SimpleTable<Product>
                    data={products}
                    columns={[
                        { header: 'Cód', className: 'w-[80px]', render: (p: Product) => <span className="font-mono text-xs">{p.codigo}</span> },
                        {
                            header: 'Produto', className: 'w-[320px]', render: (p: Product) => (
                                <div>
                                    <div className="font-bold text-slate-800 truncate max-w-[300px]" title={p.produto}>{p.produto}</div>
                                    <div className="flex gap-2 mt-1">
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${p.type === 'INTERMEDIATE' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'}`}>
                                            {p.type === 'INTERMEDIATE' ? 'Bobina' : 'Acabado'}
                                        </span>
                                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                            {p.unit || 'un'}
                                        </span>
                                    </div>
                                </div>
                            )
                        },
                        {
                            header: 'Compatibilidade', className: 'w-auto', render: (p: Product) => (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {p.compatibleMachines && p.compatibleMachines.length > 0 ? (
                                        p.compatibleMachines.map(mCode => (
                                            <span key={mCode} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 group">
                                                {mCode}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Stop row click
                                                        handleRemoveMachineFromProduct(p, mCode);
                                                    }}
                                                    className="ml-1.5 text-blue-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remover máquina"
                                                >
                                                    <X size={10} strokeWidth={3} />
                                                </button>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-slate-400 italic bg-slate-50 px-2 py-1 rounded">Todas (Universal)</span>
                                    )}
                                </div>
                            )
                        },
                        { header: 'Meta (Pç/h)', render: (p: Product) => p.itemsPerHour ? <span className="font-mono bg-slate-100 px-2 rounded">{p.itemsPerHour}</span> : '-' },
                        { header: 'Peso', render: (p: Product) => p.pesoLiquido },
                        { header: 'Custo', render: (p: Product) => `R$ ${p.custoUnit}` },
                    ]}
                    customActions={(p) => (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); setViewStructure(p.id || p.codigo); }}
                                className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors mr-1"
                                title="Ver Estrutura / Custos"
                            >
                                <Box size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProductForRoute(p);
                                    setRouteModalOpen(true);
                                }}
                                className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors shadow-sm mr-1"
                                title="Editar Roteiro de Produção"
                            >
                                <Workflow size={16} />
                            </button>
                        </>
                    )}
                    onDelete={(p) => openDeleteModal(p, 'produto')}
                    FormComponent={ProductForm}
                    onSaveSuccess={refreshAllData}
                />}



                {activeTab === 'categories' && <SimpleTable<ProductCategory>
                    data={categories}
                    columns={[
                        { header: 'ID / Chave', render: (c: ProductCategory) => <span className="text-slate-400 font-mono text-xs">{c.id}</span> },
                        { header: 'Nome da Categoria', render: (c: ProductCategory) => <span className="font-bold text-slate-800">{c.name}</span> },
                    ]}
                    onDelete={(c) => openDeleteModal(c, 'categoria')}
                    FormComponent={CategoryForm}
                    onSaveSuccess={refreshAllData}
                />}

                {activeTab === 'operators' && <SimpleTable<Operator>
                    data={operators}
                    columns={[
                        {
                            header: 'Nome', render: (o: Operator) => (
                                <div>
                                    <span className={`font-bold ${!o.active ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{o.name}</span>
                                    {!o.active && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 rounded uppercase font-bold">Inativo</span>}
                                </div>
                            )
                        },
                        { header: 'Setor', render: (o: Operator) => <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{o.sector || 'Indefinido'}</span> },
                        {
                            header: 'Turno', render: (o: Operator) => {
                                const shift = workShifts.find(s => s.id === o.defaultShift);
                                return <span className="text-xs text-slate-600">{shift ? shift.name : 'Flexível'}</span>
                            }
                        },
                        { header: 'Função', render: (o: Operator) => o.role || '-' },
                        { header: 'Admissão', render: (o: Operator) => o.admissionDate ? new Date(o.admissionDate).toLocaleDateString() : '-' },
                    ]}
                    onDelete={(o) => openDeleteModal(o, 'operador')}
                    FormComponent={OperatorForm}
                    onSaveSuccess={refreshAllData}
                />}

                {activeTab === 'shifts' && <SimpleTable<WorkShift>
                    data={workShifts}
                    columns={[
                        { header: 'Nome', render: (s: WorkShift) => <span className="font-bold text-slate-800">{s.name}</span> },
                        { header: 'Setor', render: (s: WorkShift) => s.sector ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">{s.sector}</span> : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Global</span> },
                        { header: 'Início', render: (s: WorkShift) => <span className="font-mono bg-slate-100 px-2 py-1 rounded">{s.startTime}</span> },
                        { header: 'Fim', render: (s: WorkShift) => <span className="font-mono bg-slate-100 px-2 py-1 rounded">{s.endTime}</span> },
                    ]}
                    onDelete={(s) => openDeleteModal(s, 'turno')}
                    FormComponent={WorkShiftForm}
                    onSaveSuccess={refreshAllData}
                />}

                {activeTab === 'downtime' && <SimpleTable<DowntimeType>
                    data={downtimeTypes}
                    columns={[
                        { header: 'Código', render: (d: DowntimeType) => <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded">{d.id}</span> },
                        { header: 'Descrição', render: (d: DowntimeType) => d.description },
                        {
                            header: 'Setor', render: (d: DowntimeType) => {
                                const secName = sectors.find(s => s.id === d.sector)?.name || d.sector;
                                return d.sector ? <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">{secName}</span> : <span className="text-slate-400 text-xs italic">Global</span>;
                            }
                        },
                        { header: 'Regra', render: (d: DowntimeType) => d.exemptFromOperator ? <span className="flex items-center text-orange-600 text-xs font-bold"><CheckSquare size={12} className="mr-1" /> Isenta Operador</span> : '-' },
                    ]}
                    onDelete={(dt) => openDeleteModal(dt, 'parada')}
                    FormComponent={DowntimeForm}
                    onSaveSuccess={refreshAllData}
                />}

                {activeTab === 'scrap' && <SimpleTable<ScrapReason>
                    data={scrapReasons}
                    columns={[
                        { header: 'Descrição', render: (s: ScrapReason) => s.description },
                        {
                            header: 'Setor', render: (s: ScrapReason) => {
                                const secName = sectors.find(sec => sec.id === s.sector)?.name || s.sector;
                                return s.sector ? <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">{secName}</span> : <span className="text-slate-400 text-xs italic">Global</span>;
                            }
                        },
                    ]}
                    onDelete={(s) => openDeleteModal(s, 'refugo')}
                    FormComponent={ScrapForm}
                    onSaveSuccess={refreshAllData}
                />}
            </div>

// ... Help Modal ...
            {isGuidedMode && showHelpModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-slate-100">
                        <button
                            onClick={() => setShowHelpModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                            title="Fechar Ajuda"
                            aria-label="Fechar Ajuda"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-4 mt-2">
                            <div className="bg-blue-50 p-4 rounded-full text-blue-600 ring-4 ring-blue-50/50">
                                <Lightbulb size={32} strokeWidth={1.5} />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-800">
                                    {standardTabs.find(t => t.id === activeTab)?.label}
                                </h3>
                                <div className="h-1 w-12 bg-blue-100 mx-auto rounded-full" />
                            </div>

                            <p className="text-slate-600 leading-relaxed text-sm">
                                {(() => {
                                    switch (activeTab) {
                                        case 'products': return "Aqui você cadastra os produtos finais (acabados), intermediários (bobinas) e componentes. É importante definir o 'Tipo de Produto' corretamente para que o sistema saiba como tratar o item no estoque e na produção.";
                                        case 'types': return "ATENÇÃO: Este cadastro define as CLASSIFICAÇÕES dos produtos (ex: Matéria Prima, Produto Acabado, Embalagem), e não os produtos em si. Estas categorias ajudam a organizar o estoque e definir regras de movimentação.";
                                        case 'categories': return "Crie categorias lógicas para agrupar seus produtos em relatórios (ex: 'Linha Premium', 'Linha Econômica'). Isso facilita a análise de vendas e produção.";
                                        case 'machines': return "Cadastre todas as máquinas e equipamentos produtivos. Informe a capacidade produtiva correta, pois ela será usada para calcular a eficiência (OEE) e o planejamento da produção.";
                                        case 'sectors': return "Defina as áreas da fábrica (ex: Extrusão, Corte e Solda). Marque como 'Produtivo' os setores que possuem máquinas e apontamento de produção.";
                                        case 'operators': return "Cadastre os colaboradores que operam as máquinas. Associe-os aos setores corretos para facilitar o apontamento de produção nos tablets/terminais.";
                                        case 'shifts': return "Configure os turnos de trabalho (ex: Manhã, Tarde, Noite). Defina os horários de início e fim para que o sistema calcule corretamente as horas disponíveis para produção.";
                                        case 'downtime': return "Crie motivos de parada padronizados (ex: Falta de Energia, Manutenção Mecânica). Associe a setores específicos para que o operador veja apenas as paradas relevantes para a máquina dele.";
                                        case 'scrap': return "Defina os motivos de refugo (perda de material). Isso ajuda a identificar as principais causas de desperdício na fábrica. Ex: 'Mancha', 'Furo', 'Medida incorreta'.";
                                        default: return "Utilize esta tela para gerenciar os cadastros básicos do sistema.";
                                    }
                                })()}
                            </p>

                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 w-full sm:w-auto mt-2"
                            >
                                Entendi, vamos lá!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ROUTE EDITOR MODAL */}
            {routeModalOpen && selectedProductForRoute && (
                <RouteEditorModal
                    product={selectedProductForRoute}
                    onClose={() => {
                        setRouteModalOpen(false);
                        setSelectedProductForRoute(null);
                    }}
                />
            )}

            {/* MOCKUP MODAL */}
            {viewStructure && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-5xl">
                        <StructureExplorer productId={viewStructure} onClose={() => setViewStructure(null)} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default EngineeringRegistrations;