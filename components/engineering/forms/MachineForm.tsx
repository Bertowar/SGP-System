import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Machine, Sector, MachineSector } from '../../../types';
import { Input } from '../../Input';
import { saveMachine } from '../../../services/masterDataService';
import { fetchSectors, formatError } from '../../../services/storage';

interface MachineFormProps {
    onSave: () => void;
    initialData?: Machine;
}

export const MachineForm: React.FC<MachineFormProps> = ({ onSave, initialData }) => {
    const [code, setCode] = useState(initialData?.code || '');
    const [name, setName] = useState(initialData?.name || '');
    const [sector, setSector] = useState<MachineSector>(initialData?.sector || 'Termoformagem');
    const [capacity, setCapacity] = useState(initialData?.productionCapacity?.toString() || '');
    const [unit, setUnit] = useState(initialData?.capacity_unit || 'kg/h');
    const [machineValue, setMachineValue] = useState(initialData?.machine_value ? initialData.machine_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    const [activity, setActivity] = useState(initialData?.activity || '');
    const [acquisitionDate, setAcquisitionDate] = useState(initialData?.acquisitionDate ? new Date(initialData.acquisitionDate).toISOString().split('T')[0] : '');
    const [sectorsList, setSectorsList] = useState<Sector[]>([]);
    const [displayOrder, setDisplayOrder] = useState(initialData?.displayOrder?.toString() || '');

    useEffect(() => {
        const loadSectors = async () => {
            const s = await fetchSectors();
            setSectorsList(s);
            if (!initialData && s.length > 0) {
                setSector(s[0].name as MachineSector); // Force cast for safety or handle better
            }
        };
        loadSectors();

        if (initialData) {
            setCode(initialData.code);
            setName(initialData.name);
            if (initialData.sector) setSector(initialData.sector);
            if (initialData.productionCapacity) setCapacity(initialData.productionCapacity.toString());
            if (initialData.capacity_unit) setUnit(initialData.capacity_unit);
            if (initialData.machine_value) setMachineValue(initialData.machine_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
            if (initialData.activity) setActivity(initialData.activity);
            if (initialData.acquisitionDate) setAcquisitionDate(new Date(initialData.acquisitionDate).toISOString().split('T')[0]);
            if (initialData.displayOrder) setDisplayOrder(initialData.displayOrder.toString());
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveMachine({
                ...initialData,
                code,
                name,
                sector,
                productionCapacity: capacity ? Number(capacity) : undefined,
                capacity_unit: unit,
                machine_value: machineValue ? parseFloat(machineValue.replace(/\./g, '').replace(',', '.')) : undefined,
                activity: activity,
                acquisitionDate: acquisitionDate || undefined,
                displayOrder: displayOrder ? Number(displayOrder) : undefined
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar máquina: " + formatError(e));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-12 md:col-span-2">
                <Input label="Cód. Máquina" value={code} onChange={e => setCode(e.target.value)} required placeholder="Ex: 001" />
            </div>

            <div className="col-span-12 md:col-span-4">
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-slate-700 mb-1">Setor</label>
                    <select value={sector} onChange={(e) => setSector(e.target.value as any)} className="px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 w-full" title="Setor da Máquina" aria-label="Setor da Máquina">
                        {sectorsList.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        {!sectorsList.length && (
                            <>
                                <option value="Termoformagem">Termoformagem</option>
                                <option value="Extrusão">Extrusão</option>
                            </>
                        )}
                    </select>
                </div>
            </div>
            <div className="col-span-12 md:col-span-6">
                <Input label="Nome da Máquina" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Extrusora Principal" />
            </div>

            <div className="col-span-12 md:col-span-4">
                <Input label="Atividade (Função)" value={activity} onChange={e => setActivity(e.target.value)} placeholder="Ex: Extrusar" />
            </div>

            <div className="col-span-12 md:col-span-8 flex flex-col">
                <label className="text-sm font-semibold text-slate-700 mb-1">Capacidade Produtiva</label>
                <div className="flex gap-2">
                    <Input className="flex-1" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="0" label="" />
                    <select
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="w-24 px-2 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500"
                        title="Unidade de Capacidade"
                        aria-label="Unidade de Capacidade"
                    >
                        <option value="kg/h">kg/h</option>
                        <option value="un/h">un/h</option>
                        <option value="pç/h">pç/h</option>
                        <option value="cx/h">cx/h</option>
                        <option value="ml/h">ml/h</option>
                        <option value="lt/h">lt/h</option>
                        <option value="m/h">m/h</option>
                        <option value="m²/h">m²/h</option>
                    </select>
                </div>
            </div>
            <div className="col-span-12 md:col-span-4">
                <Input
                    label="Valor do Patrimônio (R$)"
                    value={machineValue}
                    onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        const m = (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        setMachineValue(m);
                    }}
                    placeholder="0,00"
                />
            </div>
            <div className="col-span-12 md:col-span-4">
                <Input label="Data de Aquisição" type="date" value={acquisitionDate} onChange={e => setAcquisitionDate(e.target.value)} />
            </div>

            <div className="col-span-12 md:col-span-4">
                <Input
                    label="Ordem (UI)"
                    type="number"
                    value={displayOrder}
                    onChange={e => setDisplayOrder(e.target.value)}
                    placeholder="0"
                />
            </div>

            <div className="col-span-12 mt-4">
                <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center transition-colors shadow-sm">
                    <Save size={20} className="mr-2" /> Salvar Máquina
                </button>
            </div>
        </form>
    );
};
