import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { ProductTypeDefinition } from '../../../types';
import { saveProductType, formatError } from '../../../services/storage';

interface ProductTypeFormProps {
    onSave: () => void;
    initialData?: ProductTypeDefinition;
}

export const ProductTypeForm: React.FC<ProductTypeFormProps> = ({ onSave, initialData }) => {
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
