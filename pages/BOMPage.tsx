

import React, { useState, useEffect } from 'react';
import { fetchProducts } from '../services/masterDataService';
import { fetchMaterials, fetchBOMVersions, fetchBOMItems, saveBOMItem, deleteBOMItem, createBOMVersion, activateBOMVersion } from '../services/inventoryService';
import { formatError } from '../services/utils';
import { Product, RawMaterial, ProductBOMHeader, BOMItem, MaterialCategory } from '../types';
import { Wrench, Plus, Trash2, Loader2, Edit, Save, X, Box, Zap, User, Hammer } from 'lucide-react';


const BOMPage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [materials, setMaterials] = useState<RawMaterial[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Versioning State
    const [versions, setVersions] = useState<ProductBOMHeader[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [bomItems, setBomItems] = useState<BOMItem[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingBom, setLoadingBom] = useState(false);

    // Form State
    const [isEditingId, setIsEditingId] = useState<string | null>(null);
    const [formMatId, setFormMatId] = useState('');
    const [formQty, setFormQty] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                const [p, m] = await Promise.all([fetchProducts(), fetchMaterials()]);
                setProducts(p);
                setMaterials(m);
            } catch (e) {
                console.error("Error initializing BOM Page:", e);
                alert("Erro ao carregar dados: " + formatError(e));
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            loadVersions(selectedProduct.id);
        } else {
            setVersions([]);
            setBomItems([]);
            setSelectedVersionId(null);
        }
    }, [selectedProduct]);

    useEffect(() => {
        if (selectedVersionId) {
            loadBOMItems(selectedVersionId);
            resetForm();
        }
    }, [selectedVersionId]);

    const loadVersions = async (productId: string) => {
        const data = await fetchBOMVersions(productId);
        setVersions(data);
        // Auto-select active or first
        if (data.length > 0) {
            const active = data.find(v => v.active);
            setSelectedVersionId(active ? active.id : data[0].id);
        } else {
            // No BOM yet
            setSelectedVersionId(null);
            setBomItems([]);
        }
    };

    const loadBOMItems = async (bomId: string) => {
        setLoadingBom(true);
        const data = await fetchBOMItems(bomId);
        setBomItems(data);
        setLoadingBom(false);
    };

    const handleCreateVersion = async () => {
        if (!selectedProduct) return;
        const currentVersion = versions.find(v => v.id === selectedVersionId);
        if (!confirm(`Criar nova versão da BOM? ${currentVersion ? '(Copiando itens da atual)' : ''}`)) return;

        try {
            const newId = await createBOMVersion(selectedProduct.id, undefined, currentVersion?.id);
            await loadVersions(selectedProduct.id);
            setSelectedVersionId(newId);
            alert("Nova versão criada com rascunho!");
        } catch (e) { alert("Erro ao criar versão: " + formatError(e)); }
    };

    const handleActivateVersion = async () => {
        if (!selectedProduct || !selectedVersionId) return;
        const version = versions.find(v => v.id === selectedVersionId);
        if (!version) return;
        if (!confirm(`Deseja ativar a Versão ${version.version} para produção? Isso desativará outras versões.`)) return;

        try {
            await activateBOMVersion(selectedProduct.id, selectedVersionId);
            await loadVersions(selectedProduct.id); // Refresh to update active flags
            alert("Versão ativada com sucesso!");
        } catch (e) { alert("Erro ao ativar versão: " + formatError(e)); }
    };

    const resetForm = () => {
        setIsEditingId(null);
        setFormMatId('');
        setFormQty('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVersionId || !formMatId || !formQty) return;
        try {
            await saveBOMItem({
                id: isEditingId || undefined,
                bomId: selectedVersionId,
                materialId: formMatId,
                quantity: Number(formQty)
            });
            resetForm();
            loadBOMItems(selectedVersionId);
        } catch (e) { alert("Erro ao salvar item: " + formatError(e)); }
    };

    const handleEdit = (item: BOMItem) => {
        setIsEditingId(item.id);
        setFormMatId(item.materialId);
        setFormQty(item.quantity.toString());
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remover item da receita?")) return;
        try {
            await deleteBOMItem(id);
            if (selectedVersionId) loadBOMItems(selectedVersionId);
        } catch (e) { alert("Erro ao remover item: " + formatError(e)); }
    };

    const getCategoryIcon = (cat?: MaterialCategory) => {
        switch (cat) {
            case 'packaging': return <Box size={14} className="text-orange-500" />;
            case 'energy': return <Zap size={14} className="text-yellow-500" />;
            case 'labor': return <User size={14} className="text-blue-500" />;
            case 'raw_material': return <Hammer size={14} className="text-slate-500" />;
            default: return <Hammer size={14} className="text-slate-500" />;
        }
    };

    const getCategoryLabel = (cat?: MaterialCategory) => {
        switch (cat) {
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
    }, {} as Record<string, BOMItem[]>);

    const currentVersionObj = versions.find(v => v.id === selectedVersionId);

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
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${selectedProduct?.id === p.id
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
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                                    <Wrench className="mr-3 text-brand-600" />
                                    Ficha Técnica (BOM)
                                </h2>
                                <p className="text-slate-500 mt-1">
                                    Gerencie versões e composição de <b>{selectedProduct.produto}</b>.
                                </p>

                                {/* Version Selector */}
                                <div className="mt-4 flex items-center gap-3">
                                    <div className="relative">
                                        <select
                                            value={selectedVersionId || ''}
                                            onChange={e => setSelectedVersionId(e.target.value)}
                                            className="appearance-none bg-slate-100 border border-slate-300 text-slate-700 py-1.5 pl-3 pr-8 rounded-md text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer hover:bg-slate-200 transition-colors"
                                            disabled={versions.length === 0}
                                            title="Versão da Ficha Técnica"
                                            aria-label="Versão da Ficha Técnica"
                                        >
                                            {versions.length === 0 && <option value="">Sem versões</option>}
                                            {versions.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    Versão {v.version} {v.active ? '(Ativa)' : ''} - {new Date(v.createdAt!).toLocaleDateString()}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                        </div>
                                    </div>

// ... Skip lines to next select ...

                                    {versions.length === 0 ? (
                                        <button onClick={handleCreateVersion} className="bg-brand-600 text-white px-3 py-1.5 rounded-md text-sm font-bold hover:bg-brand-700 flex items-center">
                                            <Plus size={14} className="mr-1" /> Criar 1ª Versão
                                        </button>
                                    ) : (
                                        <>
                                            <button onClick={handleCreateVersion} className="bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md text-sm font-bold hover:bg-slate-50 flex items-center" title="Criar nova versão a partir desta">
                                                <Plus size={14} className="mr-1" /> Nova Versão
                                            </button>
                                            {currentVersionObj && !currentVersionObj.active && (
                                                <button onClick={handleActivateVersion} className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-md text-sm font-bold hover:bg-green-100 flex items-center">
                                                    <Zap size={14} className="mr-1" /> Ativar Versão
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>

                                {currentVersionObj?.active ? (
                                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                        Produção Ativa
                                    </span>
                                ) : currentVersionObj ? (
                                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        Rascunho / Histórico
                                    </span>
                                ) : null}

                            </div>
                            <div className="text-right">
                                <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Custo Estimado / Un</span>
                                <span className="text-2xl font-bold text-brand-700 font-mono">
                                    {bomItems.reduce((acc, item) => acc + (item.quantity * (item.material?.unitCost || 0)), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto">
                            {loadingBom ? <Loader2 className="animate-spin" /> : (versions.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed flex flex-col items-center">
                                    <Box size={32} className="mb-2 opacity-50" />
                                    <p>Este produto ainda não possui Ficha Técnica.</p>
                                    <button onClick={handleCreateVersion} className="mt-4 text-brand-600 font-bold hover:underline">Criar Versão Inicial</button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {Object.entries(groupedItems).map(([cat, items]) => (
                                        <div key={cat} className="space-y-2">
                                            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-1">
                                                {getCategoryIcon(cat as MaterialCategory)} {getCategoryLabel(cat as MaterialCategory)}
                                            </h4>
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-slate-500 font-medium">
                                                    <tr>
                                                        <th className="px-2 py-1 w-1/3">Recurso</th>
                                                        <th className="px-2 py-1">Qtd</th>
                                                        <th className="px-2 py-1 text-right">Custo Un.</th>
                                                        <th className="px-2 py-1 text-right">Total</th>
                                                        <th className="px-2 py-1 text-right">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {(items as BOMItem[]).map(item => {
                                                        const cost = item.material?.unitCost || 0;
                                                        const total = cost * item.quantity;
                                                        return (
                                                            <tr key={item.id} className="hover:bg-slate-50 group">
                                                                <td className="px-2 py-2 font-medium text-slate-800">{item.material?.name}</td>
                                                                <td className="px-2 py-2">
                                                                    <span className="font-mono text-slate-700 font-bold">{item.quantity}</span>
                                                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                        {item.material?.unit}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2 text-right text-slate-600">
                                                                    {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </td>
                                                                <td className="px-2 py-2 text-right font-mono text-slate-800 font-bold">
                                                                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </td>
                                                                <td className="px-2 py-2 text-right">
                                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-700" title="Editar"><Edit size={14} /></button>
                                                                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700" title="Remover"><Trash2 size={14} /></button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                    {bomItems.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                                            Versão vazia. Adicione componentes abaixo.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {selectedVersionId && (
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
                                            title="Material ou Recurso"
                                            aria-label="Material ou Recurso"
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
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Wrench size={48} className="mb-4 opacity-20" />
                        <p>Selecione um produto ao lado para gerenciar a ficha técnica.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


export default BOMPage;