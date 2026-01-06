import React, { useState } from 'react';
import { MRPPlanItem } from '../types';
import { ChevronRight, ChevronDown, CheckCircle2, AlertCircle, ShoppingCart, Factory, Package } from 'lucide-react';
import { formatNumber } from '../services/utils';

interface MRPTreeNodeProps {
    node: MRPPlanItem;
}

export const MRPTreeNode: React.FC<MRPTreeNodeProps> = ({ node }) => {
    const [expanded, setExpanded] = useState(true);

    const hasChildren = node.children && node.children.length > 0;
    const isRoot = node.level === 1;

    // Determine Status Color based on Action
    const getActionBadge = () => {
        switch (node.action) {
            case 'PRODUCE':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200"><Factory size={10} className="mr-1" /> PRODUZIR</span>;
            case 'BUY':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200"><ShoppingCart size={10} className="mr-1" /> COMPRAR</span>;
            case 'STOCK':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200"><CheckCircle2 size={10} className="mr-1" /> BAIXAR DO ESTOQUE</span>;
            case 'NONE':
                return <span className="text-slate-400 text-[10px]">OK</span>;
        }
    };

    return (
        <div className="pl-4 border-l border-slate-200 ml-2"> {/* Recursive Indent */}
            <div className={`grid grid-cols-12 items-center gap-2 py-2 border-b border-slate-50 hover:bg-slate-50/80 transition-colors rounded pr-2 ${isRoot ? 'bg-slate-50 font-medium' : ''}`}>

                {/* 1. Name & Expand */}
                <div className="col-span-6 flex items-center">
                    {hasChildren ? (
                        <button onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-slate-600 mr-1">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : (
                        <div className="w-6" /> // Spacer
                    )}

                    <div className="flex flex-col">
                        <div className="flex items-center">
                            <span className={`text-sm ${isRoot ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
                                {node.name}
                            </span>
                            <span className="ml-2 text-[10px] text-slate-400 font-mono bg-slate-100 px-1 rounded">{node.productCode}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 ml-0.5">{node.type}</span>
                    </div>
                </div>

                {/* 2. Required */}
                <div className="col-span-2 text-right text-xs">
                    <div>{formatNumber(node.requiredQty, 2)} <span className="text-[10px] text-slate-400">{node.unit}</span></div>
                    {node.level > 1 && <div className="text-[10px] text-slate-400">Bruto</div>}
                </div>

                {/* 3. Stock */}
                <div className="col-span-2 text-right text-xs">
                    <div className={node.currentStock < node.requiredQty ? 'text-red-600 font-bold' : 'text-slate-600'}>
                        {formatNumber(node.currentStock, 2)}
                    </div>
                </div>

                {/* 4. Action & Net Requirement */}
                <div className="col-span-2 flex flex-col items-end gap-1">
                    {getActionBadge()}
                    {node.netRequirement > 0 && node.action !== 'NONE' && (
                        <span className="text-[10px] font-bold text-slate-600">
                            Liq: {formatNumber(node.netRequirement, 2)} {node.unit}
                        </span>
                    )}
                </div>
            </div>

            {/* Render Children */}
            {expanded && hasChildren && (
                <div className="mt-1">
                    {node.children!.map((child, idx) => (
                        <MRPTreeNode key={child.id || idx} node={child} />
                    ))}
                </div>
            )}
        </div>
    );
};
