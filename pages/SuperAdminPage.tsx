import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { createTenant } from '../services/saasService';
import { useAuth } from '../contexts/AuthContext';
import { Building, Plus, ShieldAlert, Loader2, CheckCircle, AlertOctagon } from 'lucide-react';

export const SuperAdminPage: React.FC = () => {
    const { user } = useAuth();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        plan: 'free',
        owner_email: '',
        owner_name: ''
    });
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        if (user?.isSuperAdmin) {
            fetchOrganizations();
        }
    }, [user]);

    const fetchOrganizations = async () => {
        try {
            // Thanks to RLS policies, Super Admin sees all
            const { data, error } = await supabase
                .from('organizations')
                .select('*, profiles(count)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrganizations(data || []);
        } catch (error) {
            console.error('Error fetching orgs:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateSlug = (name: string) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setFormData(prev => ({ ...prev, name, slug: generateSlug(name) }));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setMsg({ type: '', text: '' });

        try {
            await createTenant(formData);
            setMsg({ type: 'success', text: 'Organização criada e convite enviado!' });
            setShowForm(false);
            setFormData({ name: '', slug: '', plan: 'free', owner_email: '', owner_name: '' });
            fetchOrganizations();
        } catch (error: any) {
            setMsg({ type: 'error', text: error.message || 'Erro ao criar organização.' });
        } finally {
            setCreating(false);
        }
    };

    if (!user?.isSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <ShieldAlert size={48} className="mb-4 text-red-500" />
                <h2 className="text-xl font-bold">Acesso Negado</h2>
                <p>Esta área é restrita a Super Administradores.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Super Admin</h2>
                        <p className="text-slate-500">Gestão de Multi-tenancy</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
                >
                    <Plus size={18} /> Nova Organização
                </button>
            </div>

            {msg.text && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {msg.type === 'success' ? <CheckCircle size={20} /> : <AlertOctagon size={20} />}
                    {msg.text}
                </div>
            )}

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">Dados da Nova Empresa</h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Nome da Empresa</label>
                            <input type="text" required value={formData.name} onChange={handleNameChange} className="w-full p-2 border rounded" placeholder="Acme Inc." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Slug (URL)</label>
                            <input type="text" required value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} className="w-full p-2 border rounded bg-slate-50 font-mono text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Nome do Dono</label>
                            <input type="text" required value={formData.owner_name} onChange={e => setFormData({ ...formData, owner_name: e.target.value })} className="w-full p-2 border rounded" placeholder="Fulano Silva" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">E-mail do Dono (Invite)</label>
                            <input type="email" required value={formData.owner_email} onChange={e => setFormData({ ...formData, owner_email: e.target.value })} className="w-full p-2 border rounded" placeholder="ceo@acme.com" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Plano</label>
                            <select value={formData.plan} onChange={e => setFormData({ ...formData, plan: e.target.value })} className="w-full p-2 border rounded">
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button disabled={creating} type="submit" className="w-full py-2 bg-brand-600 text-white rounded font-bold hover:bg-brand-700 disabled:opacity-50">
                                {creating ? <Loader2 className="animate-spin mx-auto" /> : 'Criar Tenant'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                        <tr>
                            <th className="p-4">Empresa</th>
                            <th className="p-4">Slug</th>
                            <th className="p-4">Plano</th>
                            <th className="p-4">Criado em</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {organizations.map(org => (
                            <tr key={org.id} className="hover:bg-slate-50">
                                <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                                    <Building size={16} className="text-slate-400" />
                                    {org.name}
                                </td>
                                <td className="p-4 font-mono text-sm text-slate-500">{org.slug}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${org.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' : org.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {org.plan}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-500 text-sm">{new Date(org.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {organizations.length === 0 && !loading && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhuma organização encontrada.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
