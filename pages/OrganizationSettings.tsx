import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Navigate } from 'react-router-dom';
import { inviteUser } from '../services/saasService';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Users, Building, ShieldCheck } from 'lucide-react';

export const OrganizationSettings: React.FC = () => {
    const { user, refreshProfile } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('entry');
    const [inviting, setInviting] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        console.log("OrganizationSettings mounted. User:", user);
        supabase.auth.getSession().then(({ data }) => {
            console.log("OrganizationSettings explicit session check:", data.session);
        });

        if (user?.organizationId) {
            fetchMembers();
        }
    }, [user]);

    const fetchMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', user?.organizationId);

            if (error) throw error;
            setMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        setMsg({ type: '', text: '' });

        try {
            await inviteUser({ email: inviteEmail, role: inviteRole });
            setMsg({ type: 'success', text: 'Convite enviado com sucesso!' });
            setInviteEmail('');
            // Ideally, re-fetch pending invites if we had a table for them. 
            // For now, Supabase handles invite persistence in auth.users until accepted with "invited" state, 
            // but we can't query auth.users directly from client.
            // So we just show success message.
        } catch (error: any) {
            setMsg({ type: 'error', text: error.message || 'Erro ao enviar convite.' });
        } finally {
            setInviting(false);
        }
    };

    const [newOrgName, setNewOrgName] = useState('');
    const [creating, setCreating] = useState(false);

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            alert("Erro: Usuário não identificado. Tente atualizar a página.");
            return;
        }
        if (!newOrgName.trim()) return;

        setCreating(true);
        try {
            // 1. Create Org
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert([{ name: newOrgName, slug: newOrgName.toLowerCase().replace(/\s+/g, '-') }])
                .select()
                .single();

            if (orgError) throw orgError;

            // 2. Link User (Upsert to ensure profile exists)
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    email: user.email,
                    organization_id: org.id,
                    role: 'owner',
                    is_super_admin: true
                });

            if (profileError) throw profileError;

            // 3. Refresh Context
            await refreshProfile();
            setMsg({ type: 'success', text: 'Organização criada com sucesso!' });
        } catch (error: any) {
            console.error('Error creating org:', error);
            alert(`Erro detalhado: ${JSON.stringify(error)} - ${error.message}`);
            setMsg({ type: 'error', text: error.message || 'Erro ao criar organização.' });
        } finally {
            setCreating(false);
        }
    };

    // Redirect if not logged in
    if (!user && !loading) {
        return <Navigate to="/login" replace />;
    }

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Carregando...</div>;
    }

    if (!user?.organizationId) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                    <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                        <Building size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Bem-vindo ao SGP</h2>
                    <p className="text-slate-500 mb-6">Você ainda não pertence a nenhuma organização. Crie a sua para começar.</p>

                    <form onSubmit={handleCreateOrg} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Nome da sua Organização (ex: Indústria X)"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newOrgName}
                            onChange={e => setNewOrgName(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            disabled={creating}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                        >
                            {creating ? 'Criando...' : 'Criar e Vincular'}
                        </button>
                    </form>

                    {/* DEBUG SECTION */}
                    <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-left">
                        <p className="font-bold text-red-600">DEBUG INFO:</p>
                        <p>User: {user ? user.email : 'NULL'}</p>
                        <p>Loading: {loading ? 'YES' : 'NO'}</p>
                        <button onClick={() => alert(localStorage.getItem('sgp-auth-token'))} className="text-blue-500 underline mt-1">Show Token</button>
                    </div>

                    {msg.text && (
                        <div className={`mt-4 text-sm font-medium ${msg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                            {msg.text}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Redirect if not logged in
    if (!user && !loading) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Building size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Minha Organização</h2>
                        <p className="text-slate-500">Gerencie sua equipe e permissões</p>
                        <button onClick={() => alert(JSON.stringify(Object.keys(localStorage)) + '\n' + localStorage.getItem('sgp-auth-token'))} className="text-xs bg-red-100 p-1">Debug Storage</button>
                    </div>
                </div>

                {/* Invite Section */}
                {(user.role === 'owner' || user.role === 'admin' || user.role === 'manager') && (
                    <div className="mb-8 p-5 bg-slate-50 rounded-lg border border-slate-200">
                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <UserPlus size={18} /> Convidar Membro
                        </h3>
                        <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4">
                            <input
                                type="email"
                                placeholder="email@colaborador.com"
                                required
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <select
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value)}
                                className="px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="entry">Operador (Apontamento)</option>
                                <option value="manager">Gerente</option>
                                <option value="seller">Vendedor</option>
                                <option value="owner">Admin (Owner)</option>
                            </select>
                            <button
                                type="submit"
                                disabled={inviting}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {inviting ? 'Enviando...' : 'Enviar Convite'}
                            </button>
                        </form>
                        {msg.text && (
                            <div className={`mt-3 text-sm ${msg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                                {msg.text}
                            </div>
                        )}
                    </div>
                )}

                {/* Members List */}
                <div>
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <Users size={18} /> Membros da Equipe
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3">Nome</th>
                                    <th className="px-4 py-3">Função</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {members.map((member) => (
                                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">{member.full_name || 'Usuário Pendente'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${member.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                                                    member.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-slate-100 text-slate-800'}`}>
                                                {member.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500">
                                            Ativo
                                        </td>
                                    </tr>
                                ))}
                                {members.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-slate-400">Nenhum membro encontrado.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
