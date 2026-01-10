import React, { useState } from 'react';
import { FlaskConical, Plus, Trash2, Beaker, Save, X } from 'lucide-react';

// Interfaces for the Mockup
interface MixItem {
    id: string;
    groupId: string;
    materialId: string;
    qty: number;
}

interface Additives {
    pigmentBlack: number;
    pigmentWhite: number;
    alvejante: number;
    clarificante: number;
    uv: number;
}

const ProductionEntryMockup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // Mock Data for Dropdowns
    const groups = [
        { id: 'REC', name: 'Recuperado' },
        { id: 'VIR', name: 'Virgem' },
        { id: 'APA', name: 'Aparas' },
        { id: 'MOI', name: 'Moído' }
    ];

    const materials = [
        { id: 'PE', name: 'Polietileno (PE)' },
        { id: 'PP', name: 'Polipropileno (PP)' },
        { id: 'PET', name: 'PET Cristal' },
        { id: 'MASTER', name: 'Masterbatch' }
    ];

    // State
    const [mixItems, setMixItems] = useState<MixItem[]>([
        { id: '1', groupId: '', materialId: '', qty: 0 },
        { id: '2', groupId: '', materialId: '', qty: 0 }
    ]);

    const [additives, setAdditives] = useState<Additives>({
        pigmentBlack: 0,
        pigmentWhite: 0,
        alvejante: 0,
        clarificante: 0,
        uv: 0
    });

    // Handlers
    const handleAddRow = () => {
        setMixItems([...mixItems, { id: crypto.randomUUID(), groupId: '', materialId: '', qty: 0 }]);
    };

    const handleRemoveRow = (id: string) => {
        setMixItems(mixItems.filter(item => item.id !== id));
    };

    const handleMixChange = (id: string, field: keyof MixItem, value: any) => {
        setMixItems(mixItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleAdditiveChange = (field: keyof Additives, value: string) => {
        setAdditives({ ...additives, [field]: parseFloat(value) || 0 });
    };

    // Calculations
    const totalMix = mixItems.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);
    const totalAdditives = Object.values(additives).reduce((acc, val) => acc + (Number(val) || 0), 0);
    const finalTotal = totalMix + totalAdditives;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl flex flex-col border border-slate-200">

                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-100 p-2 rounded-lg text-brand-600">
                            <FlaskConical size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Apontamento de Extrusão</h2>
                            <p className="text-sm text-slate-500">Configuração de formulação e aditivos para OP #12345</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600" title="Fechar" aria-label="Fechar">
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">

                    <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-5 mb-6">
                        <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-4 uppercase tracking-wide">
                            <Beaker size={16} /> Formulação & Aditivos
                        </h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Left Column: Mix */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        MISTURA / MIX (KG)
                                    </h4>
                                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">Total: {totalMix.toFixed(2)} kg</span>
                                </div>

                                <div className="space-y-3">
                                    {mixItems.map((item, index) => (
                                        <div key={item.id} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-300">
                                            <select
                                                className="flex-1 text-xs border border-slate-300 rounded px-2 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-slate-50"
                                                value={item.groupId}
                                                onChange={(e) => handleMixChange(item.id, 'groupId', e.target.value)}
                                                title="Selecione o Grupo"
                                                aria-label="Selecione o Grupo"
                                            >
                                                <option value="">Grupo...</option>
                                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>

                                            <select
                                                className="flex-[2] text-xs border border-slate-300 rounded px-2 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-slate-50"
                                                value={item.materialId}
                                                onChange={(e) => handleMixChange(item.id, 'materialId', e.target.value)}
                                                title="Selecione o Material"
                                                aria-label="Selecione o Material"
                                            >
                                                <option value="">Material...</option>
                                                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>

                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                className="w-20 text-xs border border-slate-300 rounded px-2 py-2 text-right font-mono outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                                value={item.qty || ''}
                                                onChange={(e) => handleMixChange(item.id, 'qty', e.target.value)}
                                            />

                                            <button
                                                onClick={() => handleRemoveRow(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Remover item"
                                                aria-label="Remover item"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleAddRow}
                                    className="mt-4 w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-xs font-bold hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} /> Adicionar Material
                                </button>
                            </div>

                            {/* Right Column: Additives */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        ADITIVOS (KG)
                                    </h4>
                                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">Total: {totalAdditives.toFixed(3)} kg</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pigmento Preto</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                                            placeholder="0.000"
                                            value={additives.pigmentBlack || ''}
                                            onChange={(e) => handleAdditiveChange('pigmentBlack', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pigmento Branco</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                                            placeholder="0.000"
                                            value={additives.pigmentWhite || ''}
                                            onChange={(e) => handleAdditiveChange('pigmentWhite', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Alvejante</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                                            placeholder="0.000"
                                            value={additives.alvejante || ''}
                                            onChange={(e) => handleAdditiveChange('alvejante', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Clarificante</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                                            placeholder="0.000"
                                            value={additives.clarificante || ''}
                                            onChange={(e) => handleAdditiveChange('clarificante', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Anti-UV</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="w-full text-sm border border-slate-300 rounded px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                                            placeholder="0.000"
                                            value={additives.uv || ''}
                                            onChange={(e) => handleAdditiveChange('uv', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center border border-slate-100">
                        <div>
                            <span className="text-xs text-slate-400 font-bold uppercase block">Peso Total Apontado</span>
                            <span className="text-2xl font-bold text-slate-800">{finalTotal.toFixed(3)} <span className="text-sm font-normal text-slate-500">kg</span></span>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button className="px-6 py-2.5 text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-lg shadow-brand-200 flex items-center gap-2 transition-transform active:scale-95">
                                <Save size={18} /> Salvar Apontamento
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ProductionEntryMockup;
