import React from 'react';
import { Sector } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { SectorForm } from './forms/SectorForm';

interface SectorListProps {
    sectors: Sector[];
    onRefresh: () => void;
    onDelete: (s: Sector) => void;
}

export const SectorList: React.FC<SectorListProps> = ({ sectors, onRefresh, onDelete }) => {
    return (
        <SimpleTable<Sector>
            data={sectors}
            columns={[
                { header: 'Nome', render: (s: Sector) => <span className="font-bold text-slate-800">{s.name}</span> },
                {
                    header: 'Tipo',
                    render: (s: Sector) => s.isProductive
                        ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Produtivo</span>
                        : <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Apoio / Geral</span>
                },
                {
                    header: 'Ordem (UI)',
                    render: (s: Sector) => <span className="text-sm text-slate-600 font-mono">{s.displayOrder || '-'}</span>,
                    className: 'text-center w-24'
                },
            ]}
            onDelete={onDelete}
            FormComponent={SectorForm}
            onSaveSuccess={onRefresh}
        />
    );
};
