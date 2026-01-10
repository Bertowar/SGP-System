import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Operator, Sector, WorkShift } from '../../../types';
import { Input } from '../../Input';
import { saveOperator, fetchSectors, fetchWorkShifts, formatError } from '../../../services/storage';

interface OperatorFormProps {
    onSave: () => void;
    initialData?: Operator;
}

export const OperatorForm: React.FC<OperatorFormProps> = ({ onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [sector, setSector] = useState(initialData?.sector || '');
    const [shiftId, setShiftId] = useState(initialData?.defaultShift || '');
    const [role, setRole] = useState(initialData?.role || '');
    const [salary, setSalary] = useState(initialData?.baseSalary?.toString() || '');
    const [admission, setAdmission] = useState(initialData?.admissionDate || '');
    const [termination, setTermination] = useState(initialData?.terminationDate || '');
    const [active, setActive] = useState(initialData?.active !== undefined ? initialData.active : true);

    const [sectorsList, setSectorsList] = useState<Sector[]>([]);
    const [shifts, setShifts] = useState<WorkShift[]>([]);

    useEffect(() => {
        const loadDeps = async () => {
            const [s, w] = await Promise.all([fetchSectors(), fetchWorkShifts()]);
            setSectorsList(s);
            setShifts(w);
        };
        loadDeps();

        if (initialData) {
            setName(initialData.name);
            setSector(initialData.sector || '');
            setShiftId(initialData.defaultShift || '');
            setRole(initialData.role || '');
            setSalary(initialData.baseSalary?.toString() || '');
            setAdmission(initialData.admissionDate || '');
            setTermination(initialData.terminationDate || '');
            setActive(initialData.active !== undefined ? initialData.active : true);
        }
    }, [initialData]);

    useEffect(() => {
        if (termination) {
            setActive(false);
        }
    }, [termination]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const cleanSalary = salary ? parseFloat(salary.replace(',', '.')) : 0;
            if (isNaN(cleanSalary)) throw new Error("Salário inválido");

            await saveOperator({
                id: initialData?.id || 0,
                name,
                sector,
                defaultShift: shiftId,
                role,
                baseSalary: cleanSalary,
                admissionDate: admission,
                terminationDate: termination,
                active
            });
            onSave();
        } catch (e: any) {
            alert("Erro ao salvar operador: " + formatError(e));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
            <Input label="Nome Completo" value={name} onChange={e => setName(e.target.value)} required className="md:col-span-2" />

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Setor</label>
                <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white"
                    title="Setor do Operador"
                    aria-label="Setor do Operador"
                >
                    <option value="">Indefinido</option>
                    {sectorsList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-semibold text-slate-700">Turno Padrão</label>
                <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white"
                    title="Turno Padrão"
                    aria-label="Turno Padrão"
                >
                    <option value="">Todos / Flexível</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                </select>
            </div>

            <Input label="Função / Cargo" value={role} onChange={e => setRole(e.target.value)} />

            <Input label="Salário Base (R$)" value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" />
            <Input label="Data Admissão" type="date" value={admission} onChange={e => setAdmission(e.target.value)} />
            <Input label="Data Demissão" type="date" value={termination} onChange={e => setTermination(e.target.value)} />

            <div className="flex items-center mt-6">
                <input
                    type="checkbox"
                    id="op_active"
                    checked={active}
                    onChange={e => setActive(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="op_active" className="ml-2 font-bold text-slate-700">Funcionário Ativo</label>
            </div>

            <button type="submit" className="md:col-span-4 mt-2 px-4 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center font-bold hover:bg-green-700">
                <Save size={18} className="mr-2" /> Salvar Operador
            </button>
        </form>
    );
};
