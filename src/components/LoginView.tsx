import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';
import { safeFetchJson } from '../utils/api';

interface LoginViewProps {
  onLoginSuccess: (user: any, accessToken: string) => void;
  onCreateCompany?: () => void;
}

export function LoginView({ onLoginSuccess, onCreateCompany }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingrese su usuario y contraseña.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await safeFetchJson<any>('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      if (response.ok && response.rawJson?.accessToken) {
        onLoginSuccess(response.rawJson.user, response.rawJson.accessToken);
      } else {
        setError(response.error || 'Credenciales inválidas. Intente de nuevo.');
      }
    } catch (err: any) {
      setError('Error de conexión con el servidor de seguridad.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50/40 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Visual background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="w-full max-w-md z-10">
        {/* Brand Container */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white p-3 shadow-lg shadow-blue-600/15 mb-3">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">NUBLY APP</h1>
          <p className="text-xs text-blue-600 font-mono font-bold tracking-widest mt-0.5">POS & HIGH-SPEED INVENTORY</p>
        </div>

        {/* Login Box */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900">Inicio de Sesión</h2>
            <p className="text-xs text-slate-500">Consola de Control de Seguridad POS</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Usuario del Sistema
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  placeholder="Ej: admin"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Contraseña de Acceso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs tracking-wide shadow-md shadow-blue-600/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Autenticando...</span>
              ) : (
                <span>ACCEDER AL POS</span>
              )}
            </button>
          </form>

          {/* Action button to launch onboarding / create company */}
          {onCreateCompany && (
            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 mb-2 font-medium">¿Aún no tienes tu empresa configurada?</p>
              <button
                type="button"
                onClick={onCreateCompany}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-200 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 text-blue-600 font-extrabold text-[11px] transition-all cursor-pointer"
              >
                <span>Crear y Configurar Empresa ➔</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 space-y-2">
          {/* Obscured Credentials (tapar los datos por defecto) */}
          <div className="inline-block bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-center">
            {showDemoCredentials ? (
              <p className="text-[10px] text-slate-600 font-medium">
                Administrador por defecto: <strong className="text-slate-800">admin</strong> / clave <strong className="text-slate-800">1234.</strong>
                <button 
                  type="button" 
                  onClick={() => setShowDemoCredentials(false)}
                  className="text-blue-600 hover:underline ml-2 font-bold cursor-pointer"
                >
                  Ocultar
                </button>
              </p>
            ) : (
              <button 
                type="button" 
                onClick={() => setShowDemoCredentials(true)}
                className="text-[10px] text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
              >
                🔒 Ver credenciales de administrador de ejemplo
              </button>
            )}
          </div>
          
          <p className="text-[10px] text-slate-400">
            © {new Date().getFullYear()} Nubly App POS. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
