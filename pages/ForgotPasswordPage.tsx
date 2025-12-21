
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { resetPasswordForEmail } from '../services/auth';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            await resetPasswordForEmail(email);
            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError('Erro ao enviar email. Verifique se o endereço está correto ou tente novamente mais tarde.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="bg-brand-900 p-6 text-center relative">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-800 mb-3 shadow-lg">
                        <Box className="text-white" size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-wide">Recuperação de Senha</h1>
                    <p className="text-brand-200 text-xs mt-1">SGP-System</p>
                </div>

                <div className="p-8">
                    {!success ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <p className="text-slate-600 text-sm text-center mb-4">
                                Digite seu email abaixo. Enviaremos um link para você redefinir sua senha.
                            </p>

                            {error && (
                                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-center">
                                    <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-800">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-slate-500 z-10" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-medium"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 active:bg-brand-800 transition-all flex items-center justify-center shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'ENVIAR LINK'}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-4">
                            <div className="flex justify-center mb-4 text-green-500">
                                <CheckCircle size={48} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Email Enviado!</h3>
                            <p className="text-slate-600 text-sm mb-6">
                                Verifique sua caixa de entrada (e spam) para encontrar as instruções de redefinição.
                            </p>
                            <button
                                onClick={() => setSuccess(false)}
                                className="text-brand-600 hover:text-brand-700 text-sm font-medium hover:underline"
                            >
                                Tentar outro email
                            </button>
                        </div>
                    )}

                    <div className="mt-8 text-center pt-4 border-t border-slate-100">
                        <Link to="/login" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors">
                            <ArrowLeft size={16} className="mr-1" />
                            Voltar para Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
