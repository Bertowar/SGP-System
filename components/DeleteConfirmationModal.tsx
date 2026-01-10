import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    isDeleting: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, title, message, isDeleting }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden scale-100 transform transition-all">
                <div className="p-6">
                    <div className="flex items-center space-x-3 text-red-600 mb-4">
                        <div className="p-3 bg-red-100 rounded-full">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-xl font-bold">{title}</h3>
                    </div>
                    <div className="text-slate-600 mb-6">
                        {message}
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md flex items-center transition-colors disabled:opacity-70"
                        >
                            {isDeleting ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                            {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
