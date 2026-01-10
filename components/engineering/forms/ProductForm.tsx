import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Info, Package, Loader2 } from 'lucide-react';
import { Product, ProductTypeDefinition, Machine, RawMaterial, ProductCategory } from '../../../types';
import { Input } from '../../Input';
import { saveProduct, fetchProductTypes, fetchMaterials, fetchProductCategories, fetchProducts, formatError } from '../../../services/storage';
import { fetchMachines } from '../../../services/masterDataService';
import { getActiveBOM, fetchBOMItems } from '../../../services/inventoryService';

interface ProductFormProps {
    onSave: () => void;
    initialData?: Product;
}

export const ProductForm: React.FC<ProductFormProps> = ({ onSave, initialData }) => {

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
    // NEW: Display Order
    const [displayOrder, setDisplayOrder] = useState(initialData?.displayOrder?.toString() || '');

    useEffect(() => {
        if (itemsPerHour && Number(itemsPerHour) > 0) {
            const cycle = 60 / Number(itemsPerHour);
            setCycleTime(cycle.toFixed(4));
        } else {
            setCycleTime('');
        }
    }, [itemsPerHour]); // Added itemsPerHour dependency for safer sync

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
            setDisplayOrder(initialData.displayOrder?.toString() || '');

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
            setDisplayOrder('');
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
                extrusionMix: mixItems.filter(m => m.type || m.subType || m.qty), // Save only filled items
                displayOrder: displayOrder ? Number(displayOrder) : undefined // NEW
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
            <Input
                label="Ordem (UI)"
                type="number"
                value={displayOrder}
                onChange={e => setDisplayOrder(e.target.value)}
                placeholder="0"
            />
            <Input label="Produto" value={name} onChange={e => setName(e.target.value)} required className="md:col-span-2" />
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

            <div className="flex flex-col md:col-span-1">
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

            {/* SEÇÃO DA RECEITA (MIX) - Visível para Intermediários (ex: Bobinas) */}
            {(type === 'INTERMEDIATE' || productTypes.find(pt => pt.id === selectedTypeId)?.name.toLowerCase().includes('bobina')) && (
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
