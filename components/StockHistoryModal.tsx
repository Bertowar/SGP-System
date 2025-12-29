import React from 'react';
import { InventoryTransaction, RawMaterial } from '../types';
import { History, X, Loader2, FileText } from 'lucide-react';

interface StockHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    loading: boolean;
    historyItems: InventoryTransaction[];
    selectedMat: RawMaterial | null;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
    isOpen,
    onClose,
    loading,
    historyItems,
    selectedMat
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-in zoom-in-95">
            <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg mr-3">
                            <History size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Histórico de Movimentações</h3>
                            <p className="text-slate-500 text-xs">
                                {selectedMat ? `${selectedMat.code} - ${selectedMat.name}` : 'Visão Geral (Últimas Movimentações)'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="text-slate-500" /></button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="animate-spin text-brand-600" size={32} />
                        </div>
                    ) : historyItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p>Nenhum registro encontrado.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-slate-600 font-semibold border-b sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-3 bg-slate-50 w-24">Data/Hora</th>
                                    {!selectedMat && <th className="px-3 py-3 bg-slate-50 w-40">Item</th>}
                                    <th className="px-3 py-3 bg-slate-50 text-center w-24">Tipo</th>
                                    <th className="px-3 py-3 bg-slate-50 text-right w-24">Qtd</th>
                                    <th className="px-3 py-3 bg-slate-50">Observações / Usuário</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {historyItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-3 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleTimeString('pt-BR')}</span>
                                            </div>
                                        </td>
                                        {!selectedMat && (
                                            <td className="px-3 py-3 font-medium text-slate-700">
                                                {item.material?.name || '-'} <span className="text-xs text-slate-400 block font-normal">{item.material?.code}</span>
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'IN' ? 'bg-green-100 text-green-700' :
                                                item.type === 'OUT' ? 'bg-red-100 text-red-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {item.type === 'IN' ? 'ENTRADA' : item.type === 'OUT' ? 'SAÍDA' : 'AJUSTE'}
                                            </span>
                                        </td>
                                        <td className={`px-3 py-3 text-right font-bold ${item.type === 'IN' ? 'text-green-600' :
                                            item.type === 'OUT' ? 'text-red-600' :
                                                'text-blue-600'
                                            }`}>
                                            {item.type === 'OUT' ? '-' : '+'}{Number(item.quantity).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-3 py-3 text-slate-600 max-w-xs truncate" title={item.notes}>
                                            {item.notes || '-'}
                                            {item.createdBy && (
                                                <span className="block text-xs text-slate-400 mt-1">Por: {item.createdBy}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
