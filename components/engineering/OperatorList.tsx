import React from 'react';
import { Operator, WorkShift } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { OperatorForm } from './forms/OperatorForm';

interface OperatorListProps {
    operators: Operator[];
    workShifts: WorkShift[];
    onRefresh: () => void;
    onDelete: (o: Operator) => void;
}

export const OperatorList: React.FC<OperatorListProps> = ({ operators, workShifts, onRefresh, onDelete }) => {
    return (
        <SimpleTable<Operator>
            data={operators}
            columns={[
                {
                    header: 'Nome', render: (o: Operator) => (
                        <div>
                            <span className={`font-bold ${!o.active ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{o.name}</span>
                            {!o.active && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 rounded uppercase font-bold">Inativo</span>}
                        </div>
                    )
                },
                { header: 'Setor', render: (o: Operator) => <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{o.sector || 'Indefinido'}</span> },
                {
                    header: 'Turno', render: (o: Operator) => {
                        const shift = workShifts.find(s => s.id === o.defaultShift);
                        return <span className="text-xs text-slate-600">{shift ? shift.name : 'Flexível'}</span>
                    }
                },
                { header: 'Função', render: (o: Operator) => o.role || '-' },
                { header: 'Admissão', render: (o: Operator) => o.admissionDate ? new Date(o.admissionDate).toLocaleDateString() : '-' },
            ]}
            onDelete={onDelete}
            FormComponent={OperatorForm}
            onSaveSuccess={onRefresh}
        />
    );
};
