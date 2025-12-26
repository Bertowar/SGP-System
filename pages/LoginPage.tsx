import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, Lock, Mail, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient'; // NEW IMPORT

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const { manualLogin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const savedEmail = localStorage.getItem('pplast_saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setError('');

    try {
      await manualLogin(email, password);

      // Success is implicit if no error is thrown.
      // Navigation is handled by the AuthContext state change or useEffect in many apps, 
      // but here we can just wait for the user state to update or basic navigation.
      // However, usually manualLogin triggers onAuthStateChange in AuthContext.

      console.log('Login successful');
      navigate('/');

    } catch (err: any) {
      console.error('Login error:', err);
      // Supabase errors usually have a 'message' field
      setError(err.message || 'Erro ao conectar ao servidor.');
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-brand-900 p-8 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-800 mb-4 shadow-lg">
            <Box className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">SGP-System</h1>
          <div className="mt-2 text-sm text-brand-200 opacity-90 font-mono border-none text-white">
            v8.0.0
          </div>
          <p className="text-brand-200 text-sm mt-1">Gestão de Produção e Custos</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex flex-col gap-2">
                <div className="flex items-center">
                  <Info size={16} className="mr-2 flex-shrink-0" />
                  {error}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="text-xs underline text-red-700 hover:text-red-900 text-left ml-6"
                >
                  Clique aqui para Limpar Cache e Tentar Novamente
                </button>
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
                  placeholder="ex: admin@sgp-system.com"
                  style={{ backgroundColor: 'white', color: 'black' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500 z-10" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-white text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-medium"
                  placeholder="••••••••"
                  style={{ backgroundColor: 'white', color: 'black' }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none z-20"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700 cursor-pointer select-none">
                  Lembrar-me
                </label>
              </div>
              <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-500">
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={localLoading}
              className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 active:bg-brand-800 transition-all flex items-center justify-center shadow-md transform hover:-translate-y-0.5"
            >
              {localLoading ? <Loader2 className="animate-spin" /> : 'ACESSAR SISTEMA'}
            </button>
          </form>


          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">Problemas de acesso? Contate o suporte.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
