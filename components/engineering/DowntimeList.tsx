import React from 'react';
import { DowntimeType, Sector } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { DowntimeForm } from './forms/DowntimeForm';

interface DowntimeListProps {
    downtimes: DowntimeType[];
    sectors: Sector[];
    onRefresh: () => void;
    onDelete: (d: DowntimeType) => void;
}

export const DowntimeList: React.FC<DowntimeListProps> = ({ downtimes, sectors, onRefresh, onDelete }) => {
    return (
        <SimpleTable<DowntimeType>
            data={downtimes}
            columns={[
                { header: 'Código', render: (d: DowntimeType) => <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded">{d.id}</span> },
                { header: 'Descrição', render: (d: DowntimeType) => d.description },
                {
                    header: 'Setor', render: (d: DowntimeType) => {
                        const secName = sectors.find(s => s.id === d.sector)?.name || d.sector;
                        return secName ? <span className="text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded border border-slate-200">{secName}</span> : <span className="text-xs text-slate-400">Global</span>
                    }
                },
                { header: 'Isenta Operador?', render: (d: DowntimeType) => d.exemptFromOperator ? <span className="text-green-600 font-bold text-xs uppercase">Sim</span> : <span className="text-slate-400 text-xs">Não</span> },
            ]}
            onDelete={onDelete}
            FormComponent={DowntimeForm}
            onSaveSuccess={onRefresh}
        />
    );
};
