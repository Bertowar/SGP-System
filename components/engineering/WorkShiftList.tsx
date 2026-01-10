import React from 'react';
import { WorkShift } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { WorkShiftForm } from './forms/WorkShiftForm';

interface WorkShiftListProps {
    shifts: WorkShift[];
    onRefresh: () => void;
    onDelete: (s: WorkShift) => void;
}

export const WorkShiftList: React.FC<WorkShiftListProps> = ({ shifts, onRefresh, onDelete }) => {
    return (
        <SimpleTable<WorkShift>
            data={shifts}
            columns={[
                { header: 'Nome', render: (s: WorkShift) => <span className="font-bold text-slate-800">{s.name}</span> },
                { header: 'Setor', render: (s: WorkShift) => s.sector ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">{s.sector}</span> : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Global</span> },
                { header: 'Início', render: (s: WorkShift) => <span className="font-mono bg-slate-100 px-2 py-1 rounded">{s.startTime}</span> },
                { header: 'Fim', render: (s: WorkShift) => <span className="font-mono bg-slate-100 px-2 py-1 rounded">{s.endTime}</span> },
            ]}
            onDelete={onDelete}
            FormComponent={WorkShiftForm}
            onSaveSuccess={onRefresh}
        />
    );
};
