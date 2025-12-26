import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { createTenant, updateTenant } from '../services/saasService';
import { useAuth } from '../contexts/AuthContext';
import { Building, Plus, ShieldAlert, Loader2, CheckCircle, AlertOctagon, ArrowRight, Pencil, X } from 'lucide-react';

export const SuperAdminPage: React.FC = () => {
    const { user, refreshProfile } = useAuth();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingOrg, setEditingOrg] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        plan: 'free',
        owner_email: '',
        owner_name: ''
    });
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [logoFile, setLogoFile] = useState<File | null>(null);

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
        // Only auto-generate slug if creating fresh
        if (!editingOrg) {
            setFormData(prev => ({ ...prev, name, slug: generateSlug(name) }));
        } else {
            setFormData(prev => ({ ...prev, name }));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogoFile(e.target.files[0]);
        }
    };

    const openEdit = (org: any) => {
        setEditingOrg(org);
        setFormData({
            name: org.name,
            slug: org.slug,
            plan: org.plan,
            owner_email: '', // Not editable in simple update or hard to track
            owner_name: ''   // Not editable
        });
        setLogoFile(null);
        setShowForm(true);
        setMsg({ type: '', text: '' });
    };

    const resetForm = () => {
        setEditingOrg(null);
        setFormData({ name: '', slug: '', plan: 'free', owner_email: '', owner_name: '' });
        setLogoFile(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setMsg({ type: '', text: '' });

        try {
            let logo_url = undefined;

            if (logoFile) {
                const fileExt = logoFile.name.split('.').pop();
                const fileName = `${formData.slug}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('logos')
                    .upload(filePath, logoFile);

                if (uploadError) throw new Error('Erro ao fazer upload da logo: ' + uploadError.message);

                const { data: { publicUrl } } = supabase.storage
                    .from('logos')
                    .getPublicUrl(filePath);

                logo_url = publicUrl;
            }

            if (editingOrg) {
                // Update
                await updateTenant(editingOrg.id, {
                    name: formData.name,
                    slug: formData.slug,
                    plan: formData.plan,
                    owner_email: '', // Ignored
                    owner_name: '',  // Ignored
                    logo_url
                });
                setMsg({ type: 'success', text: 'Organização atualizada com sucesso!' });
            } else {
                // Create
                await createTenant({ ...formData, logo_url });
                setMsg({ type: 'success', text: 'Organização criada e convite enviado!' });
            }

            resetForm();
            fetchOrganizations();
        } catch (error: any) {
            setMsg({ type: 'error', text: error.message || 'Erro na operação.' });
        } finally {
            setCreating(false);
        }
    };

    const handleSwitchOrg = async (orgId: string) => {
        if (!confirm('Deseja acessar esta organização? O sistema será recarregado.')) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('profiles')
                .update({ organization_id: orgId })
                .eq('id', user?.id);

            if (error) throw error;

            await refreshProfile();
            alert(`Acesso alterado para organização: ${orgId}`);
        } catch (error: any) {
            alert('Erro ao trocar de organização: ' + error.message);
            setLoading(false);
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
                {!showForm && (
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
                    >
                        <Plus size={18} /> Nova Organização
                    </button>
                )}
            </div>

            {msg.text && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {msg.type === 'success' ? <CheckCircle size={20} /> : <AlertOctagon size={20} />}
                    {msg.text}
                </div>
            )}

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-slate-800">
                            {editingOrg ? 'Editar Organização' : 'Dados da Nova Empresa'}
                        </h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Nome da Empresa</label>
                            <input type="text" required value={formData.name} onChange={handleNameChange} className="w-full p-2 border rounded" placeholder="Acme Inc." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Slug (URL)</label>
                            <input type="text" required value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} className="w-full p-2 border rounded bg-slate-50 font-mono text-sm" />
                        </div>

                        {!editingOrg && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nome do Dono</label>
                                    <input type="text" required value={formData.owner_name} onChange={e => setFormData({ ...formData, owner_name: e.target.value })} className="w-full p-2 border rounded" placeholder="Fulano Silva" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">E-mail do Dono (Invite)</label>
                                    <input type="email" required value={formData.owner_email} onChange={e => setFormData({ ...formData, owner_email: e.target.value })} className="w-full p-2 border rounded" placeholder="ceo@acme.com" />
                                </div>
                            </>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Plano</label>
                            <select value={formData.plan} onChange={e => setFormData({ ...formData, plan: e.target.value })} className="w-full p-2 border rounded">
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Logo da Empresa</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full p-2 border rounded text-sm" />
                            {editingOrg && editingOrg.logo_url && !logoFile && (
                                <p className="text-xs text-slate-400 mt-1">Logo atual já salva. Envie novo arquivo para substituir.</p>
                            )}
                        </div>
                        <div className="flex items-end col-span-1 md:col-span-2">
                            <button disabled={creating} type="submit" className="w-full py-2 bg-brand-600 text-white rounded font-bold hover:bg-brand-700 disabled:opacity-50">
                                {creating ? <Loader2 className="animate-spin mx-auto" /> : (editingOrg ? 'Salvar Alterações' : 'Criar Tenant')}
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
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {organizations.map(org => (
                            <tr key={org.id} className="hover:bg-slate-50">
                                <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                                    {org.logo_url ? (
                                        <img src={org.logo_url} alt={org.name} className="w-8 h-8 rounded object-cover border border-slate-200" />
                                    ) : (
                                        <Building size={16} className="text-slate-400" />
                                    )}
                                    {org.name}
                                </td>
                                <td className="p-4 font-mono text-sm text-slate-500">{org.slug}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${org.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' : org.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {org.plan}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-500 text-sm">{new Date(org.created_at).toLocaleDateString()}</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button
                                        onClick={() => openEdit(org)}
                                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                        title="Editar Organização"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleSwitchOrg(org.id)}
                                        className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold border border-transparent hover:border-brand-200"
                                        title="Acessar painel desta empresa"
                                    >
                                        Acessar <ArrowRight size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {organizations.length === 0 && !loading && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhuma organização encontrada.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
