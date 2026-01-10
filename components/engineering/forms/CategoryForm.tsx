import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { ProductCategory } from '../../../types';
import { Input } from '../../Input';
import { saveProductCategory, formatError } from '../../../services/storage';

interface CategoryFormProps {
    onSave: () => void;
    initialData?: ProductCategory;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({ onSave, initialData }) => {
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
