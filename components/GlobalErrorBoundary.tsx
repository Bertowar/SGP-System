
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface GlobalErrorBoundaryProps {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<GlobalErrorBoundaryProps, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-red-100 p-8 max-w-lg w-full text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                            <AlertTriangle size={32} />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Ops! Algo deu errado.
                        </h1>

                        <p className="text-slate-500 mb-6">
                            O sistema encontrou um erro inesperado e precisou interromper a operação para proteger seus dados.
                        </p>

                        {this.state.error && (
                            <div className="bg-slate-100 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32">
                                <code className="text-xs text-slate-700 font-mono">
                                    {this.state.error.toString()}
                                </code>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="flex items-center justify-center px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <RefreshCcw size={18} className="mr-2" />
                                Tentar Novamente
                            </button>

                            <button
                                onClick={this.handleHome}
                                className="flex items-center justify-center px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors"
                            >
                                <Home size={18} className="mr-2" />
                                Ir para o Início
                            </button>
                        </div>
                    </div>

                    <p className="mt-8 text-xs text-slate-400">
                        Se o erro persistir, tire um print desta tela e contate o suporte.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
