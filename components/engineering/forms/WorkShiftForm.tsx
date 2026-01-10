import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { WorkShift, Sector } from '../../../types';
import { Input } from '../../Input';
import { saveWorkShift, fetchSectors, formatError } from '../../../services/storage';

interface WorkShiftFormProps {
    onSave: () => void;
    initialData?: WorkShift;
}

export const WorkShiftForm: React.FC<WorkShiftFormProps> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [startTime, setStartTime] = useState(initialData?.startTime || '06:00');
    const [endTime, setEndTime] = useState(initialData?.endTime || '14:00');
    const [sector, setSector] = useState(initialData?.sector || '');
    const [sectorsList, setSectorsList] = useState<Sector[]>([]);

    useEffect(() => {
        const loadSectors = async () => {
            const s = await fetchSectors();
            setSectorsList(s);
        };
        loadSectors();

        if (initialData) {
            setName(initialData.name);
            setStartTime(initialData.startTime);
            setEndTime(initialData.endTime);
            setSector(initialData.sector || '');
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveWorkShift({
                id: initialData?.id || '',
                name,
                startTime,
                endTime,
                active: true,
                sector: sector || undefined
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar turno: " + formatError(e));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
                <Input label="Nome do Turno" placeholder="Ex: Manhã" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Setor Específico</label>
                <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white h-[42px]"
                    title="Setor do Turno"
                    aria-label="Setor do Turno"
                >
                    <option value="">Global / Todos</option>
                    {sectorsList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
            </div>

            <Input label="Início" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            <Input label="Fim" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />

            <button type="submit" className="md:col-span-5 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center mt-2">
                <Save size={18} className="mr-2" /> Salvar Turno
            </button>
        </form>
    );
};
