import React from 'react';
import { ProductCategory } from '../../types';
import { SimpleTable } from '../SimpleTable';
import { CategoryForm } from './forms/CategoryForm';

interface CategoryListProps {
    categories: ProductCategory[];
    onRefresh: () => void;
    onDelete: (c: ProductCategory) => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({ categories, onRefresh, onDelete }) => {
    return (
        <SimpleTable<ProductCategory>
            data={categories}
            columns={[
                { header: 'ID / Chave', render: (c: ProductCategory) => <span className="text-slate-400 font-mono text-xs">{c.id}</span> },
                { header: 'Nome da Categoria', render: (c: ProductCategory) => <span className="font-bold text-slate-800">{c.name}</span> },
            ]}
            onDelete={onDelete}
            FormComponent={CategoryForm}
            onSaveSuccess={onRefresh}
        />
    );
};
