import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { DowntimeType, Sector } from '../../../types';
import { Input } from '../../Input';
import { saveDowntimeType, fetchSectors, formatError } from '../../../services/storage';

interface DowntimeFormProps {
    onSave: () => void;
    initialData?: DowntimeType;
}

export const DowntimeForm: React.FC<DowntimeFormProps> = ({ onSave, initialData }) => {
    const [id, setId] = useState(initialData?.id || '');
    const [desc, setDesc] = useState(initialData?.description || '');
    const [exempt, setExempt] = useState(initialData?.exemptFromOperator || false);
    const [sector, setSector] = useState(initialData?.sector || '');
    const [sectors, setSectors] = useState<Sector[]>([]);

    useEffect(() => { fetchSectors().then(setSectors); }, []);

    useEffect(() => {
        if (initialData) {
            setId(initialData.id);
            setDesc(initialData.description);
            setExempt(initialData.exemptFromOperator || false);
            setSector(initialData.sector || '');
        } else {
            setSector('');
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveDowntimeType({
                id,
                description: desc,
                exemptFromOperator: exempt,
                sector: sector || undefined
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar tipo de parada: " + formatError(e));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-32">
                <Input label="Cód" value={id} onChange={e => setId(e.target.value)} required disabled={!!initialData} />
            </div>
            <div className="flex-1 w-full">
                <Input label="Descrição" value={desc} onChange={e => setDesc(e.target.value)} required />
            </div>
            <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 mb-1 block">Setor (Opcional)</label>
                <select
                    value={sector}
                    onChange={e => setSector(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                    title="Setor da Parada"
                    aria-label="Setor da Parada"
                >
                    <option value="">Global (Todos)</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            <div className="flex items-center h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 mb-[2px]">
                <input
                    type="checkbox"
                    id="exempt_op"
                    checked={exempt}
                    onChange={e => setExempt(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                    title="Isentar Operador"
                    aria-label="Isentar Operador"
                />
                <label htmlFor="exempt_op" className="ml-2 text-sm font-bold text-slate-700 cursor-pointer">
                    Isenta Operador?
                </label>
            </div>
            <button type="submit" className="w-full md:w-auto mb-[2px] px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center" title="Salvar Parada" aria-label="Salvar Parada">
                <Save size={18} className="mr-2 md:mr-0" />
            </button>
        </form>
    );
};
