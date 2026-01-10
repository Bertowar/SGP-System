import React from 'react';
import { Machine } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { MachineForm } from './forms/MachineForm';

interface MachineListProps {
    machines: Machine[];
    onRefresh: () => void;
    onDelete: (m: Machine) => void;
}

export const MachineList: React.FC<MachineListProps> = ({ machines, onRefresh, onDelete }) => {
    return (
        <SimpleTable<Machine>
            data={machines}
            columns={[
                { header: 'Código', render: (m: Machine) => <span className="font-mono font-bold text-slate-700">{m.code}</span> },
                { header: 'Nome', render: (m: Machine) => m.name },
                { header: 'Setor', render: (m: Machine) => <span className={`px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800`}>{m.sector}</span> },
                { header: 'Atividade', render: (m: Machine) => m.activity || '-' },
                {
                    header: 'Capacidade',
                    render: (m: Machine) => m.productionCapacity
                        ? <span className="font-mono text-xs">{m.productionCapacity} {m.capacity_unit || (m.sector === 'Extrusão' ? 'kg/h' : 'ciclos/h')}</span>
                        : '-'
                },
                {
                    header: 'Valor',
                    render: (m: Machine) => m.machine_value
                        ? <span className="font-mono text-xs text-slate-600">R$ {m.machine_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        : '-'
                },
                { header: 'Data Aquisição', render: (m: Machine) => m.acquisitionDate ? new Date(m.acquisitionDate).toLocaleDateString() : '-' },
            ]}
            onDelete={onDelete}
            FormComponent={MachineForm}
            onSaveSuccess={onRefresh}
        />
    );
};
