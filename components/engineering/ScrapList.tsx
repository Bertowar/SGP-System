import React from 'react';
import { ScrapReason, Sector } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { ScrapForm } from './forms/ScrapForm';

interface ScrapListProps {
    scraps: ScrapReason[];
    sectors: Sector[];
    onRefresh: () => void;
    onDelete: (s: ScrapReason) => void;
}

export const ScrapList: React.FC<ScrapListProps> = ({ scraps, sectors, onRefresh, onDelete }) => {
    return (
        <SimpleTable<ScrapReason>
            data={scraps}
            columns={[
                { header: 'Descrição', render: (r: ScrapReason) => r.description },
                {
                    header: 'Setor', render: (r: ScrapReason) => {
                        const secName = sectors.find(s => s.id === r.sector)?.name || r.sector;
                        return secName ? <span className="text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded border border-slate-200">{secName}</span> : <span className="text-xs text-slate-400">Global</span>
                    }
                },
            ]}
            onDelete={onDelete}
            FormComponent={ScrapForm}
            onSaveSuccess={onRefresh}
        />
    );
};
