import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { ScrapReason, Sector } from '../../../types';
import { Input } from '../../Input';
import { saveScrapReason, fetchSectors, formatError } from '../../../services/storage';

interface ScrapFormProps {
    onSave: () => void;
    initialData?: ScrapReason;
}

export const ScrapForm: React.FC<ScrapFormProps> = ({ onSave, initialData }) => {
    const [desc, setDesc] = useState(initialData?.description || '');
    const [sector, setSector] = useState(initialData?.sector || '');
    const [sectors, setSectors] = useState<Sector[]>([]);

    useEffect(() => { fetchSectors().then(setSectors); }, []);

    useEffect(() => {
        if (initialData) {
            setDesc(initialData.description);
            setSector(initialData.sector || '');
        } else {
            setSector('');
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveScrapReason({ id: initialData?.id, description: desc, sector: sector || undefined });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar motivo de refugo: " + formatError(e));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <Input label="Descrição do Defeito" value={desc} onChange={e => setDesc(e.target.value)} required />
            </div>
            <div className="md:w-64 w-full">
                <label className="text-xs font-bold text-slate-500 mb-1 block">Setor (Opcional)</label>
                <select
                    value={sector}
                    onChange={e => setSector(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                    title="Setor do Refugo"
                    aria-label="Setor do Refugo"
                >
                    <option value="">Global (Todos)</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            <button type="submit" className="w-full md:w-auto mb-[2px] px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center" title="Salvar Refugo" aria-label="Salvar Refugo">
                <Save size={18} />
            </button>
        </form>
    );
};
