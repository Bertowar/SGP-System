
import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { Search, X } from 'lucide-react';

interface ProductSelectProps {
  products: Product[];
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  inputRef?: React.RefObject<any>; // Changed to any to accept Div ref
  onNext?: () => void;
  fullList?: Product[]; // Lista completa para garantir resolução do produto selecionado mesmo com filtro
}

export const ProductSelect: React.FC<ProductSelectProps> = ({ products, value, onChange, error, inputRef, onNext, fullList }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null); // Internal ref for the search input

  // Local ref for the trigger if parent doesn't provide one
  const localTriggerRef = useRef<HTMLDivElement>(null);
  const actualTriggerRef = inputRef || localTriggerRef;

  // Busca na lista completa se disponível, senão na lista filtrada (fallback)
  const sourceList = fullList || products;
  const selectedProduct = sourceList.find(p => p.codigo === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  // Auto-focus search input when menu opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredProducts = products.filter(p =>
    (p.produto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toString().includes(searchTerm)
  );

  const handleSelect = (product: Product) => {
    onChange(product.codigo);
    setIsOpen(false);
    setSearchTerm('');
    // Return focus to trigger so Tab flow continues naturally? 
    // Or move to next field directly.
    if (onNext) {
      setTimeout(() => onNext(), 50);
    } else {
      actualTriggerRef.current?.focus();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredProducts.length > 0) {
        handleSelect(filteredProducts[0]);
      } else if (selectedProduct && onNext) {
        onNext();
      }
    }
  };

  const skipFocusOpenRef = useRef(false);

  // Handle keys on the trigger div (when closed)
  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <div className="flex flex-col space-y-1 relative" ref={wrapperRef}>
      <label className="text-sm font-semibold text-slate-700">Produto *</label>

      <div
        ref={actualTriggerRef}
        tabIndex={0} // Make focusable
        className={`px-3 py-2 bg-white border rounded-lg cursor-pointer flex items-center justify-between transition-all outline-none focus:ring-2 focus:ring-brand-500 ${error ? 'border-red-500' : 'border-slate-300 hover:border-brand-400'
          } ${isOpen ? 'ring-2 ring-brand-500 border-brand-500' : ''}`}
        onMouseDown={() => { skipFocusOpenRef.current = true; }}
        onClick={() => {
          setIsOpen(!isOpen);
          skipFocusOpenRef.current = false;
        }}
        onFocus={() => {
          if (!skipFocusOpenRef.current) setIsOpen(true);
        }} // Auto open on focus (Tab/Enter from prev field) unless using mouse
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`block truncate ${!selectedProduct ? 'text-slate-400' : 'text-slate-900'}`}>
          {selectedProduct
            ? `${selectedProduct.produto} - ${selectedProduct.descricao}`
            : 'Selecione um produto...'}
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 flex flex-col top-full">
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white rounded-t-lg">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder="Buscar código, nome ou descrição..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">Nenhum produto encontrado.</div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.codigo}
                  className={`p-3 text-sm cursor-pointer hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0 ${value === product.codigo ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700'
                    }`}
                  onClick={() => handleSelect(product)}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold">{product.produto}</span>
                    <span className="text-xs text-slate-400">Cod: {product.codigo}</span>
                  </div>
                  <div className="truncate text-xs opacity-80">{product.descricao}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
};
