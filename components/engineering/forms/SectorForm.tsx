import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Sector } from '../../../types';
import { Input } from '../../Input';
import { saveSector, formatError } from '../../../services/storage';

interface SectorFormProps {
    onSave: () => void;
    initialData?: Sector;
}

export const SectorForm: React.FC<SectorFormProps> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [isProductive, setIsProductive] = useState(initialData?.isProductive || false);
    const [displayOrder, setDisplayOrder] = useState(initialData?.displayOrder?.toString() || '');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setIsProductive(initialData.isProductive || false);
            setDisplayOrder(initialData.displayOrder?.toString() || '');
        } else {
            setName('');
            setIsProductive(false);
            setDisplayOrder('');
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveSector({
                id: initialData?.id || '',
                name,
                active: true,
                isProductive,
                displayOrder: displayOrder ? Number(displayOrder) : undefined
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar setor: " + formatError(e));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1 flex gap-4">
                <div className="flex-1">
                    <Input label="Nome do Setor" value={name} onChange={e => setName(e.target.value)} required className="w-full" placeholder="Ex: Termoformagem" />
                </div>
                <div className="w-24">
                    <Input
                        label="Ordem"
                        type="number"
                        value={displayOrder}
                        onChange={e => setDisplayOrder(e.target.value)}
                        placeholder="0"
                    />
                </div>
            </div>
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
