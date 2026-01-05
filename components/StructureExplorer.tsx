
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Box, AlertCircle, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { fetchProductStructure } from '../services/inventoryService'; // Import Service
import { StructureItem } from '../types'; // Import Type

interface StructureExplorerProps {
    productId: string; // Changed from just onClose
    onClose: () => void;
}

export const StructureExplorer: React.FC<StructureExplorerProps> = ({ productId, onClose }) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [data, setData] = useState<StructureItem | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStructure();
    }, [productId]);

    const loadStructure = async () => {
        setLoading(true);
        try {
            const result = await fetchProductStructure(productId);
            if (result) {
                setData(result);
                // Auto-expand root
                setExpanded({ [result.id]: true });
            }
        } catch (error) {
            console.error("Error loading structure:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggle = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Calculate Margin
    const sellingPrice = data?.sellingPrice || 0;
    const totalCost = data?.totalCost || 0;
    const margin = sellingPrice - totalCost;
    const marginPercent = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

    const renderRow = (item: StructureItem, level: number = 0) => {
        const isExpanded = expanded[item.id];
        const hasChildren = item.children && item.children.length > 0;
        const paddingLeft = `${level * 24 + 12}px`;

        return (
            <React.Fragment key={item.id}>
                <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${level === 0 ? 'bg-indigo-50/30' : ''}`}>
                    {/* PRODUCT / COMPONENT NAME */}
                    <td className="py-2.5 pr-4 text-left whitespace-nowrap">
                        <div className="flex items-center" style={{ paddingLeft }}>
                            {hasChildren ? (
                                <button onClick={() => toggle(item.id)} className="mr-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                            ) : (
                                <span className="w-6 mr-2"></span>
                            )}
                            <span className={`text-sm ${level === 0 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                {item.name}
                            </span>
                            {item.type === 'OPERATION' && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 rounded uppercase tracking-wider">Op</span>}
                        </div>
                    </td>

                    {/* QUANTITY */}
                    <td className="py-2.5 px-4 text-right">
                        <span className="text-xs font-mono font-medium text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">{item.quantity.toFixed(item.unit === 'un' ? 0 : 3)} {item.unit}</span>
                    </td>

                    {/* AVAILABILITY */}
                    <td className="py-2.5 px-4 text-center">
                        {item.type === 'OPERATION' ? (
                            <span className="text-xs text-slate-300">-</span>
                        ) : (
                            <div className="flex flex-col items-center">
                                {item.stockAvailable ? (
                                    <span className="flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                        <CheckCircle size={10} className="mr-1" /> OK
                                    </span>
                                ) : (
                                    <span className="flex items-center text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                        <AlertCircle size={10} className="mr-1" /> Indisp.
                                    </span>
                                )}
                                <span className="text-[9px] text-slate-400 mt-0.5">
                                    (Est: {item.currentStock !== undefined ? item.currentStock.toFixed(2) : '-'})
                                </span>
                            </div>
                        )}
                    </td>

                    {/* LEAD TIME */}
                    <td className="py-2.5 px-4 text-center">
                        {item.leadTime > 0 ? (
                            <span className="text-xs text-slate-600 flex items-center justify-center font-medium">
                                <Clock size={12} className="mr-1 text-amber-500" /> {item.leadTime}d
                            </span>
                        ) : (
                            <span className="text-xs text-slate-300">-</span>
                        )}
                    </td>

                    {/* COSTS */}
                    <td className="py-2.5 px-4 text-right">
                        <span className="text-xs font-mono text-slate-600">R$ {item.unitCost.toFixed(2)}</span>
                    </td>

                    {/* TOTAL COST */}
                    <td className="py-2.5 px-4 text-right">
                        <span className={`text-xs font-mono font-bold ${level === 0 ? 'text-indigo-700 text-sm' : 'text-slate-700'}`}>R$ {item.totalCost.toFixed(2)}</span>
                    </td>
                </tr>
                {isExpanded && item.children?.map((child: StructureItem) => renderRow(child, level + 1))}
            </React.Fragment>
        );
    };

    if (loading) return (
        <div className="bg-white rounded-xl p-12 flex justify-center items-center shadow-xl border border-slate-100">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <span className="ml-3 font-bold text-slate-600">Calculando árvore de produto...</span>
        </div>
    );

    if (!data) return (
        <div className="bg-white rounded-xl p-8 flex flex-col justify-center items-center shadow-xl border border-rose-100">
            <AlertCircle size={48} className="text-rose-200 mb-4" />
            <span className="text-slate-800 font-bold mb-2">Estrutura não encontrada</span>
            <p className="text-slate-500 text-sm text-center mb-6">Este produto não possui uma Ficha Técnica (BOM) cadastrada ou válida.</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-bold text-sm transition-colors">
                Fechar
            </button>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* HEADER - CLEAN STYLE */}
            <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Box size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 leading-tight">Análise de Estrutura</h3>
                            <p className="text-xs text-slate-400 font-mono">SKU: {data.code}</p>
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-600 font-medium">
                        {data.name}
                    </div>
                </div>

                {/* KPI CARDS */}
                <div className="flex gap-3">
                    <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Custo Total (Mat+Op)</div>
                        <div className="font-mono font-bold text-rose-600 text-lg">R$ {totalCost.toFixed(2)}</div>
                    </div>
                    {sellingPrice > 0 && (
                        <>
                            <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 text-right">
                                <div className="text-[10px] uppercase font-bold text-slate-400">Preço Venda</div>
                                <div className="font-mono font-bold text-slate-700 text-lg">R$ {sellingPrice.toFixed(2)}</div>
                            </div>
                            <div className={`px-4 py-2 rounded-lg border text-right ${margin > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                <div className={`text-[10px] uppercase font-bold ${margin > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Margem Bruta</div>
                                <div className={`font-mono font-bold text-lg ${margin > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {marginPercent.toFixed(1)}%
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* TABLE */}
            <div className="overflow-auto flex-1">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Item / Operação</th>
                            <th className="py-3 px-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Qtd Nec.</th>
                            <th className="py-3 px-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status Estoque</th>
                            <th className="py-3 px-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Time</th>
                            <th className="py-3 px-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Custo Un.</th>
                            <th className="py-3 px-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {renderRow(data)}
                    </tbody>
                </table>
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center"><CheckCircle size={12} className="text-emerald-500 mr-1.5" /> Estoque Suficiente</span>
                    <span className="flex items-center"><AlertCircle size={12} className="text-rose-500 mr-1.5" /> Faltante (Comprar/Produzir)</span>
                    <span className="flex items-center"><Clock size={12} className="text-amber-500 mr-1.5" /> Impacta Prazo</span>
                </div>
                <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                    Fechar
                </button>
            </div>
        </div>
    );
};
