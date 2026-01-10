import React from 'react';
import { ProductTypeDefinition } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { ProductTypeForm } from './forms/ProductTypeForm';

interface ProductTypeListProps {
    types: ProductTypeDefinition[];
    onRefresh: () => void;
    onDelete: (t: ProductTypeDefinition) => void;
}

export const ProductTypeList: React.FC<ProductTypeListProps> = ({ types, onRefresh, onDelete }) => {
    return (
        <SimpleTable<ProductTypeDefinition>
            data={types}
            columns={[
                { header: 'Nome do Tipo', render: (t) => <span className="font-bold text-slate-800">{t.name}</span> },
                { header: 'Classificação Sistema', render: (t) => <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">{t.classification}</span> }
            ]}
            onDelete={onDelete}
            FormComponent={ProductTypeForm}
            onSaveSuccess={onRefresh}
        />
    );
};
