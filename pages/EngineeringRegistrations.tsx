import React, { useState, useEffect } from 'react';
import {
    fetchProducts, fetchOperators, fetchMachines, fetchDowntimeTypes, fetchScrapReasons, fetchProductCategories, fetchSectors, fetchWorkShifts, fetchProductTypes,
    deleteProduct, deleteMachine, deleteOperator, deleteDowntimeType, deleteScrapReason, deleteProductCategory, deleteSector, deleteWorkShift, deleteProductType, formatError
} from '../services/storage';

import { Product, Operator, Machine, DowntimeType, ScrapReason, ProductCategory, Sector, WorkShift, ProductTypeDefinition } from '../types';
import { Package, Users, Cpu, Timer, AlertTriangle, Layers, Grid, Clock, Boxes, Lightbulb, Play } from 'lucide-react';

import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

// Features Imports
import { ProductList } from '../components/engineering/ProductList';
import { MachineList } from '../components/engineering/MachineList';
import { OperatorList } from '../components/engineering/OperatorList';
import { SectorList } from '../components/engineering/SectorList';
import { WorkShiftList } from '../components/engineering/WorkShiftList';
import { DowntimeList } from '../components/engineering/DowntimeList';
import { ScrapList } from '../components/engineering/ScrapList';
import { CategoryList } from '../components/engineering/CategoryList';
import { ProductTypeList } from '../components/engineering/ProductTypeList';

const EngineeringRegistrations: React.FC = () => {
    // State Active Tab
    const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'machines' | 'sectors' | 'operators' | 'downtime' | 'scrap' | 'shifts' | 'types'>('sectors'); // Start with sectors as it's foundational

    // Data States
    const [products, setProducts] = useState<Product[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [downtimeTypes, setDowntimeTypes] = useState<DowntimeType[]>([]);
    const [scrapReasons, setScrapReasons] = useState<ScrapReason[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
    const [productTypes, setProductTypes] = useState<ProductTypeDefinition[]>([]);
    const [loading, setLoading] = useState(false);

    // Guided Mode State
    const [isGuidedMode, setIsGuidedMode] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    useEffect(() => {
        if (isGuidedMode) {
            setShowHelpModal(true);
            setActiveTab('sectors'); // Reset to first step
        } else {
            setShowHelpModal(false);
        }
    }, [isGuidedMode]);

    // Standard vs Guided Order
    const standardTabs = [
        { id: 'sectors', label: 'Setores', icon: Grid },
        { id: 'categories', label: 'Categorias', icon: Layers },
        { id: 'types', label: 'Tipos', icon: Boxes },
        { id: 'shifts', label: 'Turnos', icon: Clock },
        { id: 'downtime', label: 'Paradas', icon: Timer },
        { id: 'scrap', label: 'Refugos', icon: AlertTriangle },
        { id: 'machines', label: 'Máquinas', icon: Cpu },
        { id: 'operators', label: 'Operadores', icon: Users },
        { id: 'products', label: 'Produtos', icon: Package },
    ];

    const guidedTabs = [
        { id: 'sectors', label: '1. Setores', icon: Grid },
        { id: 'categories', label: '2. Categorias', icon: Layers },
        { id: 'types', label: '3. Tipos', icon: Boxes },
        { id: 'shifts', label: '4. Turnos', icon: Clock },
        { id: 'downtime', label: '5. Paradas', icon: Timer },
        { id: 'scrap', label: '6. Refugos', icon: AlertTriangle },
        { id: 'machines', label: '7. Máquinas', icon: Cpu },
        { id: 'operators', label: '8. Operadores', icon: Users },
        { id: 'products', label: '9. Produtos', icon: Package },
    ];

    const currentTabs = isGuidedMode ? guidedTabs : standardTabs;

    // Helper to check if tab is completed (has data)
    const isTabCompleted = (tabId: string) => {
        switch (tabId) {
            case 'products': return products.length > 0;
            case 'types': return productTypes.length > 0;
            case 'machines': return machines.length > 0;
            case 'operators': return operators.length > 0;
            case 'downtime': return downtimeTypes.length > 0;
            case 'scrap': return scrapReasons.length > 0;
            case 'categories': return categories.length > 0;
            case 'sectors': return sectors.length > 0;
            case 'shifts': return workShifts.length > 0;
            default: return false;
        }
    };

    // Delete States
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);
    const [deleteType, setDeleteType] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Load Initial Data
    useEffect(() => {
        refreshAllData();
    }, []);

    const refreshAllData = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const [pData, mData, oData, dtData, scData, catData, secData, wData, ptData] = await Promise.all([
                fetchProducts(),
                fetchMachines(),
                fetchOperators(),
                fetchDowntimeTypes(),
                fetchScrapReasons(),
                fetchProductCategories(),
                fetchSectors(),
                fetchWorkShifts(),
                fetchProductTypes()
            ]);
            setProducts(pData);
            setMachines(mData);
            setOperators(oData);
            setDowntimeTypes(dtData);
            setScrapReasons(scData);
            setCategories(catData);
            setSectors(secData);
            setWorkShifts(wData);
            setProductTypes(ptData);
        } catch (e) {
            console.error(e);
            setErrorMessage("Erro ao carregar dados. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    const openDeleteModal = (item: any, type: string) => {
        setItemToDelete(item);
        setDeleteType(type);
        setDeleteModalOpen(true);
        setErrorMessage(null);
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);

        try {
            if (deleteType === 'produto') await deleteProduct(itemToDelete.codigo);
            else if (deleteType === 'maquina') await deleteMachine(itemToDelete.code);
            else if (deleteType === 'operador') await deleteOperator(itemToDelete.id);
            else if (deleteType === 'parada') await deleteDowntimeType(itemToDelete.id);
            else if (deleteType === 'refugo') await deleteScrapReason(itemToDelete.id);
            else if (deleteType === 'categoria') await deleteProductCategory(itemToDelete.id);
            else if (deleteType === 'setor') await deleteSector(itemToDelete.id);
            else if (deleteType === 'turno') await deleteWorkShift(itemToDelete.id);
            else if (deleteType === 'tipo de produto') await deleteProductType(itemToDelete.id);

            await refreshAllData();
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (error: any) {
            const safeError = formatError(error);
            if (safeError.includes('foreign key') || safeError.includes('constraint')) {
                setErrorMessage("Não é possível excluir: Este item está sendo usado em outros registros (vínculos).");
            } else {
                setErrorMessage("Erro ao excluir: " + safeError);
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const getDeleteMessage = () => {
        if (!itemToDelete) return '';
        if (deleteType === 'produto') return `Tem certeza que deseja excluir o produto "${itemToDelete.produto}"?`;
        if (deleteType === 'maquina') return `Tem certeza que deseja excluir a máquina "${itemToDelete.name}"?`;
        if (deleteType === 'operador') return `Tem certeza que deseja excluir o operador "${itemToDelete.name}"?`;
        if (deleteType === 'parada') return `Tem certeza que deseja excluir o tipo de parada "${itemToDelete.description}"?`;
        if (deleteType === 'refugo') return `Tem certeza que deseja excluir o motivo "${itemToDelete.description}"?`;
        if (deleteType === 'categoria') return `Tem certeza que deseja excluir a categoria "${itemToDelete.name}"?`;
        if (deleteType === 'setor') return `Tem certeza que deseja excluir o setor "${itemToDelete.name}"?`;
        if (deleteType === 'turno') return `Tem certeza que deseja excluir o turno "${itemToDelete.name}"?`;
        if (deleteType === 'tipo de produto') return `Tem certeza que deseja excluir o tipo de produto "${itemToDelete.name}"?`;
        return 'Tem certeza?';
    };

    return (
        <div className="p-6 w-full max-w-[95rem] mx-auto space-y-6">
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={`Excluir ${deleteType}`}
                message={getDeleteMessage()}
                isDeleting={isDeleting}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Cadastros Gerais</h2>
                    <p className="text-slate-500">Dados mestres do sistema: Produtos, Máquinas e Pessoas.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Toggle Guided Mode */}
                    {/* Status Indicator (Compact) */}
                    <div className="bg-white border border-slate-200 rounded-full px-3 py-1.5 flex items-center gap-3 shadow-sm mr-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">Status</span>
                            <span className="text-xs font-medium text-slate-700">
                                {loading ? 'Sincronizando...' : 'Atualizado'}
                            </span>
                        </div>
                        <div className="relative flex h-2 w-2">
                            {loading && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-indigo-500' : 'bg-green-500'}`}></span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsGuidedMode(!isGuidedMode)}
                        className={`flex items-center px-4 py-2 rounded-full text-sm font-bold transition-all ${isGuidedMode
                            ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-200'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <Lightbulb size={18} className={`mr-2 ${isGuidedMode ? 'text-yellow-300 fill-current' : ''}`} />
                        {isGuidedMode ? 'Modo Guiado (Ativo)' : 'Modo Guiado'}
                    </button>
                    {isGuidedMode && !showHelpModal && (
                        <div className="animate-in fade-in duration-500 absolute top-20 right-6 z-10 bg-indigo-600 text-white p-4 rounded-xl shadow-xl max-w-sm">
                            <h4 className="font-bold flex items-center mb-2"><Lightbulb size={18} className="mr-2" /> Assistente de Configuração</h4>
                            <p className="text-sm opacity-90">Siga a ordem numérica das abas para configurar o sistema corretamente do zero.</p>
                            <button onClick={() => setShowHelpModal(true)} className="mt-3 text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-white">Entendi</button>
                        </div>
                    )}
                </div>
            </div>

            {errorMessage && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-center shadow-sm animate-in slide-in-from-top-2">
                    <AlertTriangle className="mr-3 shrink-0" />
                    <span className="font-medium">{errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-400 hover:text-red-700">Fechar</button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
                {/* Horizontal Tabs Navigation */}
                <div className="bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch">
                    <nav className="flex overflow-x-auto no-scrollbar flex-1" aria-label="Tabs">
                        {currentTabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const isCompleted = isTabCompleted(tab.id);

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`
                                        group relative min-w-[120px] flex-none py-4 px-6 text-center text-sm font-medium border-b-2 transition-all hover:bg-slate-100/50
                                        ${isActive
                                            ? 'border-indigo-600 text-indigo-700 bg-white'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }
                                    `}
                                >
                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} />
                                            <span className="whitespace-nowrap">{tab.label}</span>
                                        </div>
                                        {isCompleted && (
                                            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-500" title="Cadastro com dados" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </nav>

                </div>

                {/* Main Content Area */}
                <div className="flex-1 p-6 overflow-x-hidden bg-white/50">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center">
                            {currentTabs.find(t => t.id === activeTab)?.icon && React.createElement(currentTabs.find(t => t.id === activeTab)!.icon, { className: "mr-3 text-brand-600", size: 24 })}
                            {currentTabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            Gerencie os registros do sistema para esta seção de {currentTabs.find(t => t.id === activeTab)?.label.toLowerCase()}.
                        </p>
                    </div>

                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {loading && products.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-slate-400">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin mb-4" />
                                    <span>Carregando dados...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'sectors' && (
                                    <SectorList
                                        sectors={sectors}
                                        onRefresh={refreshAllData}
                                        onDelete={(s) => openDeleteModal(s, 'setor')}
                                    />
                                )}

                                {activeTab === 'categories' && (
                                    <CategoryList
                                        categories={categories}
                                        onRefresh={refreshAllData}
                                        onDelete={(c) => openDeleteModal(c, 'categoria')}
                                    />
                                )}

                                {activeTab === 'types' && (
                                    <ProductTypeList
                                        types={productTypes}
                                        onRefresh={refreshAllData}
                                        onDelete={(t) => openDeleteModal(t, 'tipo de produto')}
                                    />
                                )}

                                {activeTab === 'shifts' && (
                                    <WorkShiftList
                                        shifts={workShifts}
                                        onRefresh={refreshAllData}
                                        onDelete={(s) => openDeleteModal(s, 'turno')}
                                    />
                                )}

                                {activeTab === 'machines' && (
                                    <MachineList
                                        machines={machines}
                                        onRefresh={refreshAllData}
                                        onDelete={(m) => openDeleteModal(m, 'maquina')}
                                    />
                                )}

                                {activeTab === 'operators' && (
                                    <OperatorList
                                        operators={operators}
                                        workShifts={workShifts}
                                        onRefresh={refreshAllData}
                                        onDelete={(o) => openDeleteModal(o, 'operador')}
                                    />
                                )}

                                {activeTab === 'downtime' && (
                                    <DowntimeList
                                        downtimes={downtimeTypes}
                                        sectors={sectors}
                                        onRefresh={refreshAllData}
                                        onDelete={(d) => openDeleteModal(d, 'parada')}
                                    />
                                )}

                                {activeTab === 'scrap' && (
                                    <ScrapList
                                        scraps={scrapReasons}
                                        sectors={sectors}
                                        onRefresh={refreshAllData}
                                        onDelete={(s) => openDeleteModal(s, 'refugo')}
                                    />
                                )}

                                {activeTab === 'products' && (
                                    <ProductList
                                        products={products}
                                        onRefresh={refreshAllData}
                                        onDelete={(p) => openDeleteModal(p, 'produto')}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngineeringRegistrations;