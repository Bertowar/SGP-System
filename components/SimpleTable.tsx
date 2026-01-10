import React, { useState } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';

export interface SimpleTableProps<T> {
    data: T[];
    columns: { header: string; render: (item: T) => React.ReactNode; className?: string }[];
    onDelete: (item: T) => void;
    FormComponent: React.FC<{ onSave: () => void; initialData?: T }>;
    onSaveSuccess: () => void;
    customActions?: (item: T) => React.ReactNode;
}

export const SimpleTable = <T,>({ data, columns, onDelete, FormComponent, onSaveSuccess, customActions }: SimpleTableProps<T>) => {
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
