
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, List, PlusCircle, Box, Wrench, Settings,
    Truck, Database, FileText, Zap, ShieldAlert, DollarSign,
    Layers, Package, Target, ShoppingCart, ClipboardList, User, Store
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
    isOpen?: boolean; // Kept for compatibility, though we always show full in this design
}

type ModuleType = 'PCP' | 'WMS' | 'ENG' | 'LOG' | 'FIN';

export const Sidebar: React.FC<SidebarProps> = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Determine active module based on current path, default to PCP
    const [activeModule, setActiveModule] = useState<ModuleType>('PCP');

    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/inventory') || path.includes('/stock')) setActiveModule('WMS');
        else if (path.includes('/engineering')) setActiveModule('ENG');
        else if (path.includes('/logistics')) setActiveModule('LOG');
        else if (path.includes('/financial')) setActiveModule('FIN');
        else setActiveModule('PCP');
    }, [location.pathname]);

    const handleModuleClick = (module: ModuleType, defaultPath: string) => {
        setActiveModule(module);
        navigate(defaultPath);
    };

    const modules = [
        { id: 'PCP', label: 'PCP', icon: <Layers size={24} />, path: '/' },
        { id: 'WMS', label: 'WMS', icon: <Package size={24} />, path: '/inventory' },
        { id: 'ENG', label: 'ENG', icon: <Wrench size={24} />, path: '/engineering/products' },
        { id: 'LOG', label: 'LOG', icon: <Truck size={24} />, path: '/logistics' },
        { id: 'FIN', label: 'FIN', icon: <DollarSign size={24} />, path: '/financial' },
    ];

    const menuItems: Record<ModuleType, any[]> = {
        PCP: [
            { name: "Painel Geral", path: "/", icon: <LayoutDashboard size={20} /> },
            { name: "Ordens de Produção", path: "/production-plan", icon: <ClipboardList size={20} /> },
            { name: "Apontamento", path: "/entry", icon: <PlusCircle size={20} /> },
            { name: "Digitação Rápida", path: "/fast-entry", icon: <Zap size={20} /> },
            { name: "Registros de Produção", path: "/list", icon: <List size={20} /> },
            { name: "Minha Organização", path: "/organization", icon: <Database size={20} /> },
            { name: "Configurações", path: "/settings", icon: <Settings size={20} /> },
            { name: "Super Admin", path: "/super-admin", icon: <ShieldAlert size={20} />, restricted: true },
        ],
        WMS: [
            { name: "Visão Geral", path: "/inventory", icon: <LayoutDashboard size={20} /> },
            { name: "Kardex", path: "/inventory/kardex", icon: <FileText size={20} /> },
            { name: "Auditoria", path: "/inventory/audit", icon: <ClipboardList size={20} /> },
        ],
        ENG: [
            { name: "Fichas Técnicas", path: "/engineering/bom", icon: <Wrench size={20} /> },
            { name: "Metas de Produção", path: "/engineering/targets", icon: <Target size={20} /> },
            { name: "Cadastros Gerais", path: "/engineering/products", icon: <Database size={20} /> },
        ],
        LOG: [
            { name: "Expedição", path: "/logistics", icon: <Truck size={20} /> },
        ],
        FIN: [
            { name: "Custos", path: "/financial", icon: <DollarSign size={20} /> },
            { name: "Resumo Vendas", path: "/financial/sales", icon: <Store size={20} /> },
        ]
    };

    return (
        <aside className="h-screen flex flex-row flex-shrink-0 bg-[#061626] text-slate-300 font-sans">
            {/* 1. Module Switcher (Left Strip) */}
            <div className="w-20 bg-[#061626] flex flex-col items-center border-r border-[#1e2e41] z-20 shadow-[-10px_0_20px_rgba(0,0,0,0.5)_inset]">
                {/* Logo Area */}
                <div className="h-20 w-full flex items-center justify-center mb-2">
                    <div className="text-secondary-400">
                        <Box size={32} strokeWidth={1.5} className="text-[#0ed3cf]" />
                    </div>
                </div>

                {/* Modules */}
                <div className="flex-1 flex flex-col gap-6 w-full px-2">
                    {modules.map((mod) => (
                        <button
                            key={mod.id}
                            onClick={() => handleModuleClick(mod.id as ModuleType, mod.path)}
                            className={`
                                flex flex-col items-center justify-center w-full py-2 rounded-xl transition-all duration-200 group relative
                                ${activeModule === mod.id
                                    ? 'bg-[#004e7c] text-white shadow-md' // CHANGED: Background matches right panel, white text
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#112233]' // CHANGED: Lighter inactive text
                                }
                            `}
                        >
                            {/* Active Indicator Bar - Adjusted/Removed to look connected or simplified */}
                            {activeModule === mod.id && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#0ed3cf] rounded-r-full shadow-[0_0_10px_#0ed3cf]"></div>
                            )}

                            <div className={`mb-1 transition-all duration-200 ${activeModule === mod.id ? 'scale-110 drop-shadow-[0_0_5px_rgba(14,211,207,0.5)]' : 'group-hover:scale-110'}`}>
                                {mod.icon}
                            </div>
                            <span className="text-[10px] font-bold tracking-wider">{mod.label}</span>
                        </button>
                    ))}
                </div>

                {/* Connection Status / Footer */}
                <div className="pb-6 pt-2 w-full flex justify-center">
                    <Zap size={18} className="text-green-400 fill-green-400 opacity-80" /> {/* CHANGED: Lighter green */}
                </div>
            </div>

            {/* 2. Sub-menu (Right Panel) */}
            <div className="w-64 bg-[#004e7c] flex flex-col text-white shadow-[10px_0_30px_rgba(0,0,0,0.3)]">
                {/* Header of Sub-menu */}
                <div className="h-20 flex items-center px-6 bg-[#004e7c] border-b border-[#005e94]">

                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#7dd3fc] uppercase tracking-wider mb-0.5">Módulo</span> {/* CHANGED: Lighter blue */}
                        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            {modules.find(m => m.id === activeModule)?.label === 'PCP' ? 'Produção' :
                                modules.find(m => m.id === activeModule)?.label === 'ENG' ? 'Engenharia' :
                                    modules.find(m => m.id === activeModule)?.label === 'WMS' ? 'Estoque' :
                                        modules.find(m => m.id === activeModule)?.label === 'LOG' ? 'Logística' : 'Financeiro'}
                        </h2>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar">
                    {menuItems[activeModule].map((item, idx) => {
                        if (item.restricted && !user?.isSuperAdmin) return null;

                        return (
                            <NavLink
                                key={idx}
                                to={item.path}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                                    ${isActive
                                        ? 'bg-[#008bd2] text-white shadow-lg shadow-black/20'
                                        : 'text-[#e0f2fe] hover:bg-[#005e94] hover:text-white' // CHANGED: Significantly lighter text (#e0f2fe is very light blue)
                                    }
                                `}
                            >
                                {item.icon}
                                {item.name}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Footer Info */}
                <div className="p-4 border-t border-[#005e94] text-center bg-[#004169]">
                    <p className="text-xs text-[#bae6fd] font-medium">SGP-System</p> {/* CHANGED: Lighter */}
                    <p className="text-[10px] text-[#7dd3fc] mt-0.5">© 2024</p>
                </div>
            </div>
        </aside>
    );
};
