

import React, { useState, useEffect } from 'react';
import { fetchProducts, fetchMaterials, fetchBOM, saveBOM, deleteBOMItem, formatError } from '../services/storage';
import { Product, RawMaterial, ProductBOM, MaterialCategory } from '../types';
import { Wrench, Plus, Trash2, Loader2, Edit, Save, X, Box, Zap, User, Hammer } from 'lucide-react';

const BOMPage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [materials, setMaterials] = useState<RawMaterial[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
    const [bomItems, setBomItems] = useState<ProductBOM[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingBom, setLoadingBom] = useState(false);

    // Form State
    const [isEditingId, setIsEditingId] = useState<string | null>(null);
    const [formMatId, setFormMatId] = useState('');
    const [formQty, setFormQty] = useState('');

    useEffect(() => {
        const init = async () => {
            const [p, m] = await Promise.all([fetchProducts(), fetchMaterials()]);
            setProducts(p);
            setMaterials(m);
            setLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            loadBOM(selectedProduct);
            resetForm();
        } else {
            setBomItems([]);
        }
    }, [selectedProduct]);

    const loadBOM = async (code: number) => {
        setLoadingBom(true);
        const data = await fetchBOM(code);
        setBomItems(data);
        setLoadingBom(false);
    };

    const resetForm = () => {
        setIsEditingId(null);
        setFormMatId('');
        setFormQty('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !formMatId || !formQty) return;
        try {
            await saveBOM({
                id: isEditingId || '', 
                productCode: selectedProduct,
                materialId: formMatId,
                quantityRequired: Number(formQty)
            });
            resetForm();
            loadBOM(selectedProduct);
        } catch (e) { alert("Erro ao salvar item: " + formatError(e)); }
    };

    const handleEdit = (item: ProductBOM) => {
        setIsEditingId(item.id);
        setFormMatId(item.materialId);
        setFormQty(item.quantityRequired.toString());
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remover item da receita?")) return;
        try {
            await deleteBOMItem(id);
            if (selectedProduct) loadBOM(selectedProduct);
        } catch (e) { alert("Erro ao remover item: " + formatError(e)); }
    };

    const getCategoryIcon = (cat?: MaterialCategory) => {
        switch(cat) {
            case 'packaging': return <Box size={14} className="text-orange-500"/>;
            case 'energy': return <Zap size={14} className="text-yellow-500"/>;
            case 'labor': return <User size={14} className="text-blue-500"/>;
            case 'raw_material': return <Hammer size={14} className="text-slate-500"/>;
            default: return <Hammer size={14} className="text-slate-500"/>;
        }
    };

    const getCategoryLabel = (cat?: MaterialCategory) => {
        switch(cat) {
            case 'packaging': return 'Embalagem';
            case 'energy': return 'Energia';
            case 'labor': return 'Mão de Obra';
            case 'raw_material': return 'Matéria Prima';
            default: return 'Outros';
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

    // Group items by category
    const groupedItems = bomItems.reduce((acc, item) => {
        const cat = item.material?.category || 'raw_material';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, ProductBOM[]>);

    return (
        <div className="flex h-[calc(100vh-100px)] gap-6">
            {/* Sidebar de Produtos */}
            <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-slate-700">Selecione o Produto</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {products.map(p => (
                        <button
                            key={p.codigo}
                            onClick={() => setSelectedProduct(p.codigo)}
                            className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                                selectedProduct === p.codigo 
                                ? 'bg-brand-50 text-brand-700 font-bold ring-1 ring-brand-200' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex justify-between">
                                <span>{p.produto}</span>
                                <span className="font-mono text-xs opacity-50">{p.codigo}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Painel de Receita */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                {selectedProduct ? (
                    <>
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                                <Wrench className="mr-3 text-brand-600" />
                                Ficha Técnica (BOM)
                            </h2>
                            <p className="text-slate-500">
                                Recursos consumidos para <b>1 unidade</b> de {products.find(p => p.codigo === selectedProduct)?.produto}.
                            </p>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto">
                            {loadingBom ? <Loader2 className="animate-spin" /> : (
                                <div className="space-y-6">
                                    {Object.entries(groupedItems).map(([cat, items]) => (
                                        <div key={cat} className="space-y-2">
                                            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-1">
                                                {getCategoryIcon(cat as MaterialCategory)} {getCategoryLabel(cat as MaterialCategory)}
                                            </h4>
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-slate-500 font-medium">
                                                    <tr>
                                                        <th className="px-2 py-1 w-1/2">Recurso</th>
                                                        <th className="px-2 py-1">Qtd</th>
                                                        <th className="px-2 py-1">Un</th>
                                                        <th className="px-2 py-1 text-right">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {(items as ProductBOM[]).map(item => (
                                                        <tr key={item.id} className="hover:bg-slate-50 group">
                                                            <td className="px-2 py-2 font-medium text-slate-800">{item.material?.name}</td>
                                                            <td className="px-2 py-2 font-mono text-slate-700">{item.quantityRequired}</td>
                                                            <td className="px-2 py-2 text-slate-500 text-xs">{item.material?.unit}</td>
                                                            <td className="px-2 py-2 text-right">
                                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-700" title="Editar"><Edit size={14}/></button>
                                                                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700" title="Remover"><Trash2 size={14}/></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                    {bomItems.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                                            Nenhum recurso vinculado a este produto. Adicione abaixo.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                            <h4 className="font-bold text-slate-700 mb-3 text-sm">
                                {isEditingId ? 'Editar Componente' : 'Adicionar Componente / Recurso'}
                            </h4>
                            <form onSubmit={handleSave} className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Recurso</label>
                                    <select 
                                        className="w-full px-3 py-2 border rounded-lg bg-white"
                                        value={formMatId}
                                        onChange={e => setFormMatId(e.target.value)}
                                        required
                                        disabled={!!isEditingId} // Disable resource change on edit
                                    >
                                        <option value="">Selecione...</option>
                                        {materials.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.unit}) - {getCategoryLabel(m.category)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-32">
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Quantidade</label>
                                    <input 
                                        type="number" 
                                        step="0.0001" 
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="0.00"
                                        value={formQty}
                                        onChange={e => setFormQty(e.target.value)}
                                        required
                                    />
                                </div>
                                <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center h-[42px]">
                                    <Save size={18} className="mr-1" /> {isEditingId ? 'Atualizar' : 'Adicionar'}
                                </button>
                                {isEditingId && (
                                    <button type="button" onClick={resetForm} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 flex items-center h-[42px]">
                                        <X size={18} className="mr-1" /> Cancelar
                                    </button>
                                )}
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Wrench size={48} className="mb-4 opacity-20" />
                        <p>Selecione um produto ao lado para editar a receita.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BOMPage;