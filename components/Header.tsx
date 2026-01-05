
import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, User, LogOut, ChevronDown, Check, Settings, Shield, Building } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAllOrganizations } from '../services/auth';
import { Organization } from '../types';

interface HeaderProps {
    toggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
    const { user, logout, currentOrg, debugSetRole, switchOrg } = useAuth();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
    const [isOrgSwitcherOpen, setIsOrgSwitcherOpen] = useState(false);
    const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch orgs if super admin and menu is open
    useEffect(() => {
        if (isProfileOpen && user?.isSuperAdmin) {
            getAllOrganizations().then(setAvailableOrgs).catch(console.error);
        }
    }, [isProfileOpen, user]);

    const roleMap: Record<string, string> = {
        'owner': 'PROPRIETÁRIO',
        'admin': 'ADMINISTRADOR',
        'manager': 'GERENTE',
        'supervisor': 'SUPERVISOR',
        'operator': 'OPERADOR',
        'seller': 'VENDEDOR'
    };

    const handleRoleSwitch = (newRole: string) => {
        debugSetRole(newRole);
        setIsProfileOpen(false);
    };

    const availableRoles = [
        { id: 'owner', label: 'Owner' },
        { id: 'admin', label: 'Admin' },
        { id: 'manager', label: 'Manager' },
        { id: 'supervisor', label: 'Supervisor' },
        { id: 'operator', label: 'Operator' },
        { id: 'seller', label: 'Seller' },
    ];

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shadow-sm z-30 relative">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                >
                    <Menu size={24} />
                </button>

                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-full border border-orange-200">
                    <ShieldAlertIcon size={14} className="text-orange-500" />
                    <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">Beta 1.0</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs font-bold text-orange-800 uppercase">{currentOrg?.name || 'SGP MASTER'}</span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* User Profile Section */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-all border border-transparent hover:border-slate-200"
                    >
                        <div className="hidden md:flex flex-col items-end leading-tight">
                            <span className="text-sm font-bold text-slate-800">
                                {user?.fullName || user?.email?.split('@')[0] || 'Usuário'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {roleMap[user?.role || 'operator'] || user?.role}
                            </span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-sky-500 flex items-center justify-center text-sky-700 shadow-sm">
                            <User size={20} className="stroke-[2.5]" />
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {isProfileOpen && (
                        <div className="absolute top-14 right-0 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 animate-in fade-in slide-in-from-top-2">
                            {/* User Header */}
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                                <p className="font-bold text-slate-800">{user?.fullName || 'Usuário'}</p>
                                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                            </div>

                            {/* Profile Link */}
                            <div className="py-2">
                                <button className="w-full text-left px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-600 flex items-center gap-2 transition-colors">
                                    <Settings size={16} />
                                    Meu Perfil
                                </button>
                            </div>

                            {/* Role Switcher Collapsible */}
                            <div className="py-1 border-t border-slate-100">
                                <button
                                    onClick={() => setIsRoleSwitcherOpen(!isRoleSwitcherOpen)}
                                    className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-bold text-brand-600 hover:bg-brand-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <UsersIcon size={16} />
                                        Trocar Perfil
                                    </div>
                                    <ChevronDown size={16} className={`transition-transform duration-200 ${isRoleSwitcherOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isRoleSwitcherOpen && (
                                    <div className="bg-slate-50 py-1 border-t border-slate-100/50 shadow-inner">
                                        {availableRoles.map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => handleRoleSwitch(role.id)}
                                                className="w-full text-left px-8 py-2 text-xs text-slate-600 hover:text-brand-700 hover:bg-brand-100/50 flex items-center justify-between transition-colors"
                                            >
                                                {role.label}
                                                {user?.role === role.id && <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Organization Switcher (Super Admin Only) */}
                            {user?.isSuperAdmin && (
                                <div className="py-1 border-t border-slate-100">
                                    <button
                                        onClick={() => setIsOrgSwitcherOpen(!isOrgSwitcherOpen)}
                                        className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-bold text-purple-600 hover:bg-purple-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Building size={16} />
                                            Trocar Organização
                                        </div>
                                        <ChevronDown size={16} className={`transition-transform duration-200 ${isOrgSwitcherOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isOrgSwitcherOpen && (
                                        <div className="bg-slate-50 py-1 border-t border-slate-100/50 shadow-inner max-h-40 overflow-y-auto">
                                            {availableOrgs.length > 0 ? availableOrgs.map(org => (
                                                <button
                                                    key={org.id}
                                                    onClick={() => { switchOrg(org.id); setIsOrgSwitcherOpen(false); }}
                                                    className="w-full text-left px-8 py-2 text-xs text-slate-600 hover:text-purple-700 hover:bg-purple-100/50 flex items-center justify-between transition-colors"
                                                >
                                                    {org.name}
                                                    {currentOrg?.id === org.id && <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>}
                                                </button>
                                            )) : (
                                                <p className="px-8 py-2 text-xs text-slate-400">Carregando...</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Logout */}
                            <div className="border-t border-slate-100 mt-1 py-1">
                                <button
                                    onClick={() => logout()}
                                    className="w-full text-left px-5 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                                >
                                    <LogOut size={16} />
                                    Sair
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

// Helper Icons locally scoped if needed, or import from lucide-react
import { AlertTriangle as ShieldAlertIcon, Users as UsersIcon } from 'lucide-react';
