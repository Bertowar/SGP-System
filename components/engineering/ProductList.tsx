import React, { useState } from 'react';
import { Product } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { ProductForm } from './forms/ProductForm';
import { X, Box, Workflow } from 'lucide-react';
import { StructureExplorer } from '../StructureExplorer';
import RouteEditorModal from '../RouteEditorModal';
import { saveProduct, formatError } from '../../services/storage';

interface ProductListProps {
    products: Product[];
    onRefresh: () => void;
    onDelete: (p: Product) => void;
}

export const ProductList: React.FC<ProductListProps> = ({ products, onRefresh, onDelete }) => {
    // Local state for Modals
    const [viewStructure, setViewStructure] = useState<string | null>(null);
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [selectedProductForRoute, setSelectedProductForRoute] = useState<Product | null>(null);

    const handleRemoveMachineFromProduct = async (product: Product, machineCode: string) => {
        const newMachines = product.compatibleMachines?.filter(m => m !== machineCode) || [];

        try {
            await saveProduct({
                ...product,
                compatibleMachines: newMachines
            });
            onRefresh();
        } catch (e: any) {
            alert("Erro ao remover máquina: " + formatError(e));
        }
    };

    return (
        <>
            <SimpleTable<Product>
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
                            onClick={(e) => { e.stopPropagation(); setViewStructure(p.id || p.codigo.toString()); }}
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
                onDelete={onDelete}
                FormComponent={ProductForm}
                onSaveSuccess={onRefresh}
            />

            {/* Sub-Modals */}
            {viewStructure && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <Box size={20} className="text-indigo-600" />
                                Estrutura do Produto & Custo
                            </h3>
                            <button
                                onClick={() => setViewStructure(null)}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                title="Fechar"
                                aria-label="Fechar"
                            >
                                <X size={24} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            <StructureExplorer productId={viewStructure} onClose={() => setViewStructure(null)} />
                        </div>
                    </div>
                </div>
            )}

            {routeModalOpen && selectedProductForRoute && (
                <RouteEditorModal
                    onClose={() => setRouteModalOpen(false)}
                    product={selectedProductForRoute}
                />
            )}
        </>
    );
};
